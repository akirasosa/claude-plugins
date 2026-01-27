#!/usr/bin/env bash
set -euo pipefail
# Claude Code notification script with DB logging
# Usage: notification.sh <event_type>
# event_type: notification (input wait), stop (task complete), sessionend, sessionstart

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

EVENT_TYPE="${1:-notification}"

# Read JSON input from stdin (with timeout)
INPUT=$(timeout 5 cat 2>/dev/null || echo "{}")
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)

show_notification() {
    local title="$1"
    local message="$2"
    if [[ "$(uname)" == "Darwin" ]]; then
        osascript -e "display notification \"$message\" with title \"$title\"" >/dev/null 2>&1 || true
    elif command -v notify-send &>/dev/null; then
        notify-send "$title" "$message" >/dev/null 2>&1 || true
    fi
}

log_to_db() {
    local event_type="$1"
    local summary="$2"
    local plugin_root="$SCRIPT_DIR/.."

    echo "$INPUT" | bun run "$plugin_root/src/cli.ts" event-log "$event_type" "$summary" 2>/dev/null
}

# Get GCP project ID for Gemini API
get_gcp_project() {
    # 1. Environment variable
    if [[ -n "${GEMINI_GCP_PROJECT:-}" ]]; then
        echo "$GEMINI_GCP_PROJECT"
        return
    fi
    # 2. Settings file
    local settings_file="$HOME/.claude/claude-monitoring.local.md"
    if [[ -f "$settings_file" ]]; then
        local project
        project=$(grep -E '^gcp_project:' "$settings_file" | sed 's/gcp_project: *//' | tr -d ' ')
        if [[ -n "$project" ]]; then
            echo "$project"
            return
        fi
    fi
    # 3. gcloud default project
    timeout 3 gcloud config get-value project 2>/dev/null || true
}

# Get GCP location for Gemini API
get_gcp_location() {
    # 1. Environment variable
    if [[ -n "${GEMINI_GCP_LOCATION:-}" ]]; then
        echo "$GEMINI_GCP_LOCATION"
        return
    fi
    # 2. Settings file
    local settings_file="$HOME/.claude/claude-monitoring.local.md"
    if [[ -f "$settings_file" ]]; then
        local location
        location=$(grep -E '^gcp_location:' "$settings_file" | sed 's/gcp_location: *//' | tr -d ' ')
        if [[ -n "$location" ]]; then
            echo "$location"
            return
        fi
    fi
    # 3. Default
    echo "asia-northeast1"
}

# Prevent consecutive Stop event firing (same session within 30 seconds)
STOP_DEDUP_INTERVAL=30
should_notify_stop() {
    local session_id="$1"
    local state_file="/tmp/claude-monitoring-last-stop-${session_id}"
    local now=$(date +%s)

    if [[ -f "$state_file" ]]; then
        local last_time=$(cat "$state_file" 2>/dev/null || echo 0)
        local diff=$((now - last_time))
        if [[ $diff -lt $STOP_DEDUP_INTERVAL ]]; then
            return 1  # Skip notification (consecutive Stop)
        fi
    fi

    echo "$now" > "$state_file"
    return 0  # Show notification
}

generate_summary() {
    local transcript_path="$1"
    local project_id
    project_id=$(get_gcp_project)

    # Skip summary generation if no project ID available
    if [[ -z "$project_id" ]]; then
        return
    fi

    local location
    location=$(get_gcp_location)
    local model_id="gemini-2.5-flash"
    local api_url="https://aiplatform.googleapis.com/v1/projects/${project_id}/locations/${location}/publishers/google/models/${model_id}:generateContent"

    if [[ -n "$transcript_path" && -f "$transcript_path" ]]; then
        local transcript_tail
        transcript_tail=$(tail -c 5000 "$transcript_path" 2>/dev/null)

        if [[ -n "$transcript_tail" ]]; then
            local prompt="The following is the end of Claude Code's transcript (conversation history). Summarize what was completed concisely in 15 words or less. Output only the summary without any decorations or explanations.

$transcript_tail"

            local escaped_prompt
            escaped_prompt=$(echo "$prompt" | jq -Rs .)

            local access_token
            access_token=$(timeout 5 gcloud auth print-access-token 2>/dev/null)

            timeout 10 curl -s "$api_url" \
                -H "Authorization: Bearer ${access_token}" \
                -H "Content-Type: application/json" \
                -d "{\"contents\": {\"role\": \"user\", \"parts\": {\"text\": $escaped_prompt}}}" \
                2>/dev/null | jq -r '.candidates[0].content.parts[0].text // empty' 2>/dev/null | head -c 100
        fi
    fi
}

case "$EVENT_TYPE" in
    stop)
        (
            SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
            SUMMARY=$(generate_summary "$TRANSCRIPT_PATH")
            log_to_db "Stop" "${SUMMARY:-Task completed}"  # Always log to DB

            # Only show notification if not a consecutive Stop
            if should_notify_stop "$SESSION_ID"; then
                if [[ -n "$SUMMARY" ]]; then
                    show_notification "Claude Code" "[Stop] $SUMMARY"
                else
                    show_notification "Claude Code" "[Stop] Task completed"
                fi
            fi
        ) </dev/null >/dev/null 2>&1 &
        disown 2>/dev/null || true
        ;;
    notification)
        (
            SUMMARY=$(generate_summary "$TRANSCRIPT_PATH")
            if [[ -n "$SUMMARY" ]]; then
                show_notification "Claude Code" "[Notification] $SUMMARY"
                log_to_db "Notification" "$SUMMARY"
            else
                show_notification "Claude Code" "[Notification] Waiting for input"
                log_to_db "Notification" "Waiting for input"
            fi
        ) </dev/null >/dev/null 2>&1 &
        disown 2>/dev/null || true
        ;;
    sessionend)
        # Log session end with reason (no notification)
        (
            REASON=$(echo "$INPUT" | jq -r '.reason // "unknown"' 2>/dev/null)
            log_to_db "SessionEnd" "reason=$REASON"
        ) </dev/null >/dev/null 2>&1 &
        disown 2>/dev/null || true
        ;;
    sessionstart)
        # Log session start (no notification)
        (
            log_to_db "SessionStart" "Session started"
        ) </dev/null >/dev/null 2>&1 &
        disown 2>/dev/null || true
        ;;
esac

exit 0
