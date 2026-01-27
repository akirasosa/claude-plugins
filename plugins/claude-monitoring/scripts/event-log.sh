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
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)

# Generate event_id (UUID-like)
EVENT_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$$-$RANDOM")

# Current timestamp
CREATED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
DATE_PART=$(date '+%Y-%m-%d')
HOSTNAME=$(hostname -s 2>/dev/null || echo "unknown")

# Get tmux info
TMUX_SESSION=""
TMUX_WINDOW=""
TMUX_WINDOW_ID=""
if [[ -n "${TMUX:-}" ]]; then
    TMUX_SESSION=$(tmux display-message -p '#S' 2>/dev/null || echo "")
    TMUX_WINDOW=$(tmux display-message -p '#I' 2>/dev/null || echo "")
    TMUX_WINDOW_ID=$(tmux display-message -p '#{window_id}' 2>/dev/null || echo "")
fi

# Get git branch
GIT_BRANCH=""
if [[ -n "$CWD" ]]; then
    GIT_BRANCH=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
fi

# Escape for SQLite (double single quotes)
escape_sql() {
    echo "${1//\'/\'\'}"
}

# Extract only necessary fields for event_data
EVENT_DATA=$(echo "$INPUT" | jq -c '{
  session_id, project_directory, cwd, tool_name, reason
} | with_entries(select(.value != null and .value != ""))' 2>/dev/null || echo "{}")

# Build SQL with proper escaping
SQL="INSERT INTO events (
    event_id, session_id, event_type, created_at,
    project_dir, cwd, event_data, tool_name,
    summary, tmux_session, tmux_window, tmux_window_id, hostname, date_part, git_branch
) VALUES (
    '$(escape_sql "$EVENT_ID")',
    '$(escape_sql "$SESSION_ID")',
    '$(escape_sql "$EVENT_TYPE")',
    '$(escape_sql "$CREATED_AT")',
    '$(escape_sql "$PROJECT_DIR")',
    '$(escape_sql "$CWD")',
    '$(escape_sql "$EVENT_DATA")',
    '$(escape_sql "$TOOL_NAME")',
    '$(escape_sql "$SUMMARY")',
    '$(escape_sql "$TMUX_SESSION")',
    $(if [[ -n "$TMUX_WINDOW" ]]; then echo "$TMUX_WINDOW"; else echo "NULL"; fi),
    $(if [[ -n "$TMUX_WINDOW_ID" ]]; then echo "'$(escape_sql "$TMUX_WINDOW_ID")'"; else echo "NULL"; fi),
    '$(escape_sql "$HOSTNAME")',
    '$(escape_sql "$DATE_PART")',
    '$(escape_sql "$GIT_BRANCH")'
);"

sqlite3 "$DB_FILE" "$SQL"
