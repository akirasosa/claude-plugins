-- Initial schema for orchestrator-worker messaging system

-- Orchestrator sessions
CREATE TABLE IF NOT EXISTS orchestrator_sessions (
    id TEXT PRIMARY KEY,
    project_dir TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Messages from workers to orchestrators
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    orchestrator_id TEXT NOT NULL,
    worker_id TEXT,
    message_type TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread',
    created_at TEXT NOT NULL,
    FOREIGN KEY (orchestrator_id) REFERENCES orchestrator_sessions(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_orchestrator ON messages(orchestrator_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(orchestrator_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_orchestrator_created ON orchestrator_sessions(created_at);
