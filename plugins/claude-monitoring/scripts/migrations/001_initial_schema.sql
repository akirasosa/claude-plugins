-- Migration: 001_initial_schema
-- Description: Initial database schema without git_branch column

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
