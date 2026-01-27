#!/usr/bin/env bash
# Log Claude Code events to SQLite database
# Usage: echo '{"session_id":"..."}' | event-log.sh <event_type> [summary]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Initialize DB if not exists or run migrations if needed
if [[ ! -f "$DB_FILE" ]]; then
    "$SCRIPT_DIR/db-init.sh" >/dev/null 2>&1 || true
else
    # Run migrations silently if there are pending ones
    "$SCRIPT_DIR/db-migrate.sh" >/dev/null 2>&1 || true
fi

EVENT_TYPE="${1:-unknown}"
SUMMARY="${2:-}"

# Read JSON input from stdin (with timeout)
INPUT=$(timeout 5 cat 2>/dev/null || echo "{}")

# Extract fields from JSON
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null)
PROJECT_DIR=$(echo "$INPUT" | jq -r '.project_directory // ""' 2>/dev/null)

# Generate event_id (UUID-like)
EVENT_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$$-$RANDOM")

# Current timestamp
CREATED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
DATE_PART=$(date '+%Y-%m-%d')

# Escape for SQLite (double single quotes)
escape_sql() {
    echo "${1//\'/\'\'}"
}

# Get tmux window ID
TMUX_WINDOW_ID=""
if [[ -n "${TMUX:-}" ]]; then
    # For SessionStart, capture the current window
    # For other events, look up from the SessionStart event of this session
    if [[ "$EVENT_TYPE" == "SessionStart" ]]; then
        TMUX_WINDOW_ID=$(tmux display-message -p '#{window_id}' 2>/dev/null || echo "")
    elif [[ -n "$SESSION_ID" ]]; then
        TMUX_WINDOW_ID=$(sqlite3 "$DB_FILE" "SELECT tmux_window_id FROM events WHERE session_id='$(escape_sql "$SESSION_ID")' AND event_type='SessionStart' LIMIT 1" 2>/dev/null || echo "")
        # Fallback to current window if no SessionStart found
        if [[ -z "$TMUX_WINDOW_ID" ]]; then
            TMUX_WINDOW_ID=$(tmux display-message -p '#{window_id}' 2>/dev/null || echo "")
        fi
    fi
fi

# Get git branch
GIT_BRANCH=""
if [[ -n "$PROJECT_DIR" ]]; then
    GIT_BRANCH=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
fi


# Build SQL with proper escaping
SQL="INSERT INTO events (
    event_id, session_id, event_type, created_at,
    project_dir, summary, tmux_window_id, date_part, git_branch
) VALUES (
    '$(escape_sql "$EVENT_ID")',
    '$(escape_sql "$SESSION_ID")',
    '$(escape_sql "$EVENT_TYPE")',
    '$(escape_sql "$CREATED_AT")',
    '$(escape_sql "$PROJECT_DIR")',
    '$(escape_sql "$SUMMARY")',
    $(if [[ -n "$TMUX_WINDOW_ID" ]]; then echo "'$(escape_sql "$TMUX_WINDOW_ID")'"; else echo "NULL"; fi),
    '$(escape_sql "$DATE_PART")',
    '$(escape_sql "$GIT_BRANCH")'
);"

sqlite3 "$DB_FILE" "$SQL"
