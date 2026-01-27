import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { basename } from "path";
import { DB_DIR, DB_FILE } from "./config";
import type { Event, EventInput, EventResponse, FilterMode } from "../types";

export function getDbPath(): string {
  return DB_FILE;
}

export function dbExists(): boolean {
  return existsSync(DB_FILE);
}

export function ensureDbDir(): void {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }
}

export function getDb(readonly = false): Database {
  ensureDbDir();
  if (readonly) {
    return new Database(DB_FILE, { readonly: true });
  }
  return new Database(DB_FILE);
}

export function getActiveEvents(mode: FilterMode = "waiting"): EventResponse[] {
  if (!dbExists()) {
    return [];
  }

  const db = getDb(true);
  try {
    const eventTypeFilter =
      mode === "waiting" ? "AND event_type IN ('Stop', 'Notification')" : "";

    const query = `
      SELECT
        id,
        event_id,
        session_id,
        event_type,
        created_at,
        summary,
        project_dir,
        tmux_window_id,
        git_branch
      FROM events e1
      WHERE created_at = (
        SELECT MAX(created_at) FROM events e2
        WHERE e2.session_id = e1.session_id
      )
      ${eventTypeFilter}
      AND NOT EXISTS (
        SELECT 1 FROM events e3
        WHERE e3.session_id = e1.session_id
        AND e3.event_type = 'SessionEnd'
        AND e3.created_at > (
          SELECT COALESCE(MAX(created_at), '') FROM events e4
          WHERE e4.session_id = e1.session_id
          AND e4.event_type = 'SessionStart'
        )
      )
      ORDER BY created_at DESC
    `;

    const rows = db.query(query).all() as Event[];

    return rows.map((row) => ({
      id: row.id,
      event_id: row.event_id,
      session_id: row.session_id,
      event_type: row.event_type,
      created_at: row.created_at,
      project_name: row.project_dir ? basename(row.project_dir) : "unknown",
      git_branch: row.git_branch || null,
      summary: row.summary || getDefaultSummary(row.event_type),
      tmux_command: getTmuxCommand(row),
      tmux_window_id: row.tmux_window_id || null,
    }));
  } finally {
    db.close();
  }
}

function getTmuxCommand(row: Event): string | null {
  if (row.tmux_window_id) {
    return `tmux switch-client -t '${row.tmux_window_id}'`;
  }
  return null;
}

function getDefaultSummary(eventType: string): string {
  switch (eventType) {
    case "SessionStart":
      return "Session started";
    case "Stop":
      return "Task completed";
    case "Notification":
      return "Notification";
    default:
      return eventType;
  }
}

export function getDbLastModified(): number {
  if (!dbExists()) {
    return 0;
  }
  try {
    const stat = Bun.file(DB_FILE);
    return stat.lastModified;
  } catch {
    return 0;
  }
}

export function endSession(sessionId: string): boolean {
  if (!dbExists()) {
    return false;
  }

  const db = getDb();
  try {
    const eventId = crypto.randomUUID();
    const now = new Date().toISOString();
    const datePart = now.split("T")[0];

    db.prepare(
      `INSERT INTO events (event_id, session_id, event_type, created_at, summary, date_part)
       VALUES (?, ?, 'SessionEnd', ?, 'Manually terminated', ?)`
    ).run(eventId, sessionId, now, datePart);

    return true;
  } catch (err) {
    console.error("Failed to end session:", err);
    return false;
  } finally {
    db.close();
  }
}

export interface RecordEventOptions {
  eventType: string;
  summary: string;
  input: EventInput;
  tmuxWindowId?: string | null;
  gitBranch?: string | null;
}

export function recordEvent(options: RecordEventOptions): void {
  const { eventType, summary, input, tmuxWindowId, gitBranch } = options;

  ensureDbDir();
  const db = getDb();

  try {
    const eventId = crypto.randomUUID();
    const now = new Date().toISOString();
    const datePart = now.split("T")[0];

    db.prepare(
      `INSERT INTO events (
        event_id, session_id, event_type, created_at,
        project_dir, summary, tmux_window_id, date_part, git_branch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      eventId,
      input.session_id || "",
      eventType,
      now,
      input.cwd || "",
      summary,
      tmuxWindowId || null,
      datePart,
      gitBranch || ""
    );
  } finally {
    db.close();
  }
}

export function getTmuxWindowIdForSession(sessionId: string): string | null {
  if (!dbExists() || !sessionId) {
    return null;
  }

  const db = getDb(true);
  try {
    const result = db
      .query(
        "SELECT tmux_window_id FROM events WHERE session_id = ? AND event_type = 'SessionStart' LIMIT 1"
      )
      .get(sessionId) as { tmux_window_id: string | null } | null;
    return result?.tmux_window_id || null;
  } finally {
    db.close();
  }
}
