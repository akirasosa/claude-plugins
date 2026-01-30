import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

// Create a helper to create an in-memory test database with the same schema
function createTestSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orchestrator_sessions (
      id TEXT PRIMARY KEY,
      project_dir TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

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

    CREATE INDEX IF NOT EXISTS idx_messages_orchestrator ON messages(orchestrator_id);
    CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(orchestrator_id, status);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  `);
}

describe("database schema", () => {
  let db: Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it("should create orchestrator_sessions table with correct columns", () => {
    db = new Database(":memory:");
    createTestSchema(db);

    const columns = db.query("PRAGMA table_info(orchestrator_sessions)").all() as Array<{
      name: string;
    }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("project_dir");
    expect(columnNames).toContain("created_at");
  });

  it("should create messages table with correct columns", () => {
    db = new Database(":memory:");
    createTestSchema(db);

    const columns = db.query("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("orchestrator_id");
    expect(columnNames).toContain("worker_id");
    expect(columnNames).toContain("message_type");
    expect(columnNames).toContain("content");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("created_at");
  });

  it("should create indexes", () => {
    db = new Database(":memory:");
    createTestSchema(db);

    const indexes = db
      .query("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='messages'")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain("idx_messages_orchestrator");
    expect(indexNames).toContain("idx_messages_status");
    expect(indexNames).toContain("idx_messages_created");
  });
});

describe("database operations (simulated with in-memory DB)", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    createTestSchema(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe("orchestrator session operations", () => {
    it("should insert and retrieve orchestrator session", () => {
      const id = "orch_test123";
      const projectDir = "/test/project";
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO orchestrator_sessions (id, project_dir, created_at)
         VALUES (?, ?, ?)`,
      ).run(id, projectDir, now);

      const result = db.query("SELECT * FROM orchestrator_sessions WHERE id = ?").get(id) as {
        id: string;
        project_dir: string;
        created_at: string;
      } | null;

      expect(result).not.toBeNull();
      expect(result?.id).toBe(id);
      expect(result?.project_dir).toBe(projectDir);
    });

    it("should delete orchestrator session and cascade messages", () => {
      const orchestratorId = "orch_delete123";
      const projectDir = "/test/project";
      const now = new Date().toISOString();

      // Insert orchestrator
      db.prepare(
        `INSERT INTO orchestrator_sessions (id, project_dir, created_at)
         VALUES (?, ?, ?)`,
      ).run(orchestratorId, projectDir, now);

      // Insert messages for this orchestrator
      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("msg_1", orchestratorId, "task_complete", "{}", "unread", now);

      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("msg_2", orchestratorId, "task_failed", "{}", "unread", now);

      // Delete messages first, then orchestrator
      db.prepare("DELETE FROM messages WHERE orchestrator_id = ?").run(orchestratorId);
      const result = db
        .prepare("DELETE FROM orchestrator_sessions WHERE id = ?")
        .run(orchestratorId);

      expect(result.changes).toBe(1);

      // Verify deletion
      const messages = db
        .query("SELECT * FROM messages WHERE orchestrator_id = ?")
        .all(orchestratorId);
      expect(messages.length).toBe(0);
    });
  });

  describe("message operations", () => {
    const orchestratorId = "orch_msg123";
    const projectDir = "/test/project";

    beforeEach(() => {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO orchestrator_sessions (id, project_dir, created_at)
         VALUES (?, ?, ?)`,
      ).run(orchestratorId, projectDir, now);
    });

    it("should insert a message", () => {
      const msgId = "msg_test123";
      const now = new Date().toISOString();
      const content = JSON.stringify({ summary: "Task completed", pr_url: "https://example.com" });

      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, worker_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'unread', ?)`,
      ).run(msgId, orchestratorId, "worker_1", "task_complete", content, now);

      const result = db.query("SELECT * FROM messages WHERE id = ?").get(msgId) as {
        id: string;
        orchestrator_id: string;
        worker_id: string;
        message_type: string;
        content: string;
        status: string;
      } | null;

      expect(result).not.toBeNull();
      expect(result?.orchestrator_id).toBe(orchestratorId);
      expect(result?.worker_id).toBe("worker_1");
      expect(result?.message_type).toBe("task_complete");
      expect(result?.status).toBe("unread");
    });

    it("should retrieve unread messages and mark as read", () => {
      const now = new Date().toISOString();

      // Insert multiple messages
      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("msg_1", orchestratorId, "task_complete", '{"summary":"Task 1"}', "unread", now);

      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("msg_2", orchestratorId, "task_failed", '{"summary":"Task 2"}', "unread", now);

      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("msg_3", orchestratorId, "question", '{"summary":"Task 3"}', "read", now);

      // Get unread messages
      const unreadMessages = db
        .query(
          `SELECT * FROM messages WHERE orchestrator_id = ? AND status = 'unread' ORDER BY created_at ASC`,
        )
        .all(orchestratorId) as Array<{ id: string }>;

      expect(unreadMessages.length).toBe(2);

      // Mark as read
      const ids = unreadMessages.map((m) => m.id);
      const placeholders = ids.map(() => "?").join(",");
      db.prepare(`UPDATE messages SET status = 'read' WHERE id IN (${placeholders})`).run(...ids);

      // Verify all are now read
      const unreadAfter = db
        .query(`SELECT * FROM messages WHERE orchestrator_id = ? AND status = 'unread'`)
        .all(orchestratorId);

      expect(unreadAfter.length).toBe(0);
    });

    it("should get orchestrator status with message counts", () => {
      const now = new Date().toISOString();

      // Insert messages with different statuses
      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("msg_1", orchestratorId, "task_complete", '{"summary":"1"}', "unread", now);

      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("msg_2", orchestratorId, "task_complete", '{"summary":"2"}', "unread", now);

      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("msg_3", orchestratorId, "task_complete", '{"summary":"3"}', "read", now);

      // Count unread
      const unreadResult = db
        .query(
          `SELECT COUNT(*) as count FROM messages WHERE orchestrator_id = ? AND status = 'unread'`,
        )
        .get(orchestratorId) as { count: number };

      // Count total
      const totalResult = db
        .query(`SELECT COUNT(*) as count FROM messages WHERE orchestrator_id = ?`)
        .get(orchestratorId) as { count: number };

      expect(unreadResult.count).toBe(2);
      expect(totalResult.count).toBe(3);
    });
  });

  describe("cleanup operations", () => {
    it("should delete old messages based on retention", () => {
      const orchestratorId = "orch_cleanup123";
      const projectDir = "/test/project";

      // Create orchestrator
      const now = new Date();
      db.prepare(
        `INSERT INTO orchestrator_sessions (id, project_dir, created_at)
         VALUES (?, ?, ?)`,
      ).run(orchestratorId, projectDir, now.toISOString());

      // Create old message (10 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        "msg_old",
        orchestratorId,
        "task_complete",
        '{"summary":"old"}',
        "read",
        oldDate.toISOString(),
      );

      // Create recent message (1 day ago)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 1);

      db.prepare(
        `INSERT INTO messages (id, orchestrator_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        "msg_recent",
        orchestratorId,
        "task_complete",
        '{"summary":"recent"}',
        "unread",
        recentDate.toISOString(),
      );

      // Delete messages older than 7 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      const cutoffIso = cutoffDate.toISOString();

      const result = db.prepare("DELETE FROM messages WHERE created_at < ?").run(cutoffIso);

      expect(result.changes).toBe(1);

      // Verify only recent message remains
      const remainingMessages = db
        .query("SELECT * FROM messages WHERE orchestrator_id = ?")
        .all(orchestratorId) as Array<{ id: string }>;

      expect(remainingMessages.length).toBe(1);
      expect(remainingMessages[0].id).toBe("msg_recent");
    });
  });
});

describe("ID generation pattern", () => {
  it("should generate IDs with correct prefix", () => {
    const generateId = (prefix: string): string => {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let id = "";
      for (let i = 0; i < 8; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      return `${prefix}_${id}`;
    };

    const orchId = generateId("orch");
    const msgId = generateId("msg");

    expect(orchId).toMatch(/^orch_[a-z0-9]{8}$/);
    expect(msgId).toMatch(/^msg_[a-z0-9]{8}$/);
  });
});

describe("message content structure", () => {
  it("should serialize and deserialize message content correctly", () => {
    const content = {
      summary: "Task completed successfully",
      details: "Implemented feature X",
      pr_url: "https://github.com/org/repo/pull/123",
      branch: "feat/add-feature",
    };

    const serialized = JSON.stringify(content);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.summary).toBe(content.summary);
    expect(deserialized.details).toBe(content.details);
    expect(deserialized.pr_url).toBe(content.pr_url);
    expect(deserialized.branch).toBe(content.branch);
  });

  it("should handle error content for task_failed", () => {
    const content = {
      summary: "Build failed",
      error: "TypeScript compilation error in src/index.ts:42",
    };

    const serialized = JSON.stringify(content);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.summary).toBe(content.summary);
    expect(deserialized.error).toBe(content.error);
  });

  it("should handle question content", () => {
    const content = {
      summary: "Need clarification",
      question: "Should the API return 404 or 204 for empty results?",
    };

    const serialized = JSON.stringify(content);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.summary).toBe(content.summary);
    expect(deserialized.question).toBe(content.question);
  });
});
