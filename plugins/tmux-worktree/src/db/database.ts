import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { DB_DIR, DB_FILE } from "./config";
import type {
  CreateOrchestratorInput,
  CreateSpawnedWorkerInput,
  Message,
  OrchestratorSession,
  OrchestratorStatus,
  SendMessageInput,
  SpawnedWorker,
  WorkerStatus,
} from "./types";

export function dbExists(): boolean {
  return existsSync(DB_FILE);
}

export function ensureDbDir(): void {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }
}

function getDb(readonly = false): Database {
  ensureDbDir();
  if (readonly) {
    return new Database(DB_FILE, { readonly: true });
  }
  return new Database(DB_FILE);
}

function withReadOnlyDb<T>(fn: (db: Database) => T, defaultValue: T): T {
  if (!dbExists()) return defaultValue;
  const db = getDb(true);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${id}`;
}

// Orchestrator Session Operations

export function createOrchestratorSession(input: CreateOrchestratorInput): OrchestratorSession {
  const db = getDb();
  try {
    const id = generateId("orch");
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO orchestrator_sessions (id, project_dir, created_at)
       VALUES (?, ?, ?)`,
    ).run(id, input.project_dir, now);

    return { id, project_dir: input.project_dir, created_at: now };
  } finally {
    db.close();
  }
}

export function getOrchestratorSession(id: string): OrchestratorSession | null {
  return withReadOnlyDb((db) => {
    const result = db
      .query("SELECT * FROM orchestrator_sessions WHERE id = ?")
      .get(id) as OrchestratorSession | null;
    return result;
  }, null);
}

// Message Operations

export function sendMessage(input: SendMessageInput): Message {
  const db = getDb();
  try {
    const id = generateId("msg");
    const now = new Date().toISOString();
    const contentJson = JSON.stringify(input.content);

    db.prepare(
      `INSERT INTO messages (id, orchestrator_id, worker_id, message_type, content, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'unread', ?)`,
    ).run(id, input.orchestrator_id, input.worker_id || null, input.message_type, contentJson, now);

    return {
      id,
      orchestrator_id: input.orchestrator_id,
      worker_id: input.worker_id || null,
      message_type: input.message_type,
      content: contentJson,
      status: "unread",
      created_at: now,
    };
  } finally {
    db.close();
  }
}

export function pollMessages(orchestratorId: string): Message[] {
  if (!dbExists()) return [];

  const db = getDb();
  try {
    // Get unread messages
    const messages = db
      .query(
        `SELECT * FROM messages
         WHERE orchestrator_id = ? AND status = 'unread'
         ORDER BY created_at ASC`,
      )
      .all(orchestratorId) as Message[];

    if (messages.length > 0) {
      // Mark as read
      const ids = messages.map((m) => m.id);
      const placeholders = ids.map(() => "?").join(",");
      db.prepare(`UPDATE messages SET status = 'read' WHERE id IN (${placeholders})`).run(...ids);
    }

    return messages;
  } finally {
    db.close();
  }
}

export function getOrchestratorStatus(orchestratorId: string): OrchestratorStatus | null {
  return withReadOnlyDb((db) => {
    const session = db
      .query("SELECT * FROM orchestrator_sessions WHERE id = ?")
      .get(orchestratorId) as OrchestratorSession | null;

    if (!session) return null;

    const unreadResult = db
      .query(
        `SELECT COUNT(*) as count FROM messages
         WHERE orchestrator_id = ? AND status = 'unread'`,
      )
      .get(orchestratorId) as { count: number };

    const totalResult = db
      .query(
        `SELECT COUNT(*) as count FROM messages
         WHERE orchestrator_id = ?`,
      )
      .get(orchestratorId) as { count: number };

    return {
      orchestrator_id: orchestratorId,
      unread_count: unreadResult.count,
      total_messages: totalResult.count,
      created_at: session.created_at,
    };
  }, null);
}

// Cleanup Operations

export function cleanupOldMessages(retentionDays: number): number {
  if (!dbExists()) return 0;

  const db = getDb();
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();

    // Delete old messages
    const messageResult = db.prepare("DELETE FROM messages WHERE created_at < ?").run(cutoffIso);

    // Delete orphaned orchestrator sessions (no messages and older than retention)
    db.prepare(
      `DELETE FROM orchestrator_sessions
       WHERE created_at < ?
       AND id NOT IN (SELECT DISTINCT orchestrator_id FROM messages)`,
    ).run(cutoffIso);

    return messageResult.changes;
  } finally {
    db.close();
  }
}

// Spawned Worker Operations

export function createSpawnedWorker(input: CreateSpawnedWorkerInput): SpawnedWorker {
  const db = getDb();
  try {
    const now = new Date().toISOString();

    const result = db
      .prepare(
        `INSERT INTO spawned_workers (orchestrator_id, branch, worktree_path, status, created_at)
       VALUES (?, ?, ?, 'active', ?)`,
      )
      .run(input.orchestrator_id, input.branch, input.worktree_path, now);

    return {
      id: Number(result.lastInsertRowid),
      orchestrator_id: input.orchestrator_id,
      branch: input.branch,
      worktree_path: input.worktree_path,
      status: "active",
      pr_url: null,
      created_at: now,
      completed_at: null,
    };
  } finally {
    db.close();
  }
}

export function updateSpawnedWorkerStatus(
  worktreePath: string,
  status: WorkerStatus,
  prUrl?: string,
): boolean {
  if (!dbExists()) return false;

  const db = getDb();
  try {
    const now = new Date().toISOString();
    const completedAt = status === "completed" || status === "ended" ? now : null;

    const result = db
      .prepare(
        `UPDATE spawned_workers
         SET status = ?, pr_url = COALESCE(?, pr_url), completed_at = COALESCE(?, completed_at)
         WHERE worktree_path = ? AND status = 'active'`,
      )
      .run(status, prUrl || null, completedAt, worktreePath);

    return result.changes > 0;
  } finally {
    db.close();
  }
}
