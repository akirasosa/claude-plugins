#!/bin/bash
# Initialize Claude Code events database
# Usage: db-init.sh

set -euo pipefail

DB_DIR="$HOME/.local/share/claude-code"
DB_FILE="$DB_DIR/events.db"

# Create directory if it doesn't exist
mkdir -p "$DB_DIR"

# Initialize database with schema
sqlite3 "$DB_FILE" <<'EOF'
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    project_dir TEXT,
    cwd TEXT,
    event_data TEXT,
    tool_name TEXT,
    summary TEXT,
    tmux_session TEXT,
    tmux_window INTEGER,
    hostname TEXT,
    date_part TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_date_part ON events(date_part);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
EOF

echo "Database initialized: $DB_FILE"
