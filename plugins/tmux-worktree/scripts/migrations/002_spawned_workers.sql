-- Migration: Add spawned_workers table for tracking worker sessions

CREATE TABLE IF NOT EXISTS spawned_workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orchestrator_id TEXT NOT NULL,
    branch TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    status TEXT DEFAULT 'active',     -- 'active', 'completed', 'ended'
    pr_url TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (orchestrator_id) REFERENCES orchestrator_sessions(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_spawned_workers_orchestrator ON spawned_workers(orchestrator_id);
CREATE INDEX IF NOT EXISTS idx_spawned_workers_status ON spawned_workers(status);
CREATE INDEX IF NOT EXISTS idx_spawned_workers_path ON spawned_workers(worktree_path);
