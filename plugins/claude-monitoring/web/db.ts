import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface Event {
  id: number;
  event_id: string;
  session_id: string;
  event_type: string;
  created_at: string;
  summary: string | null;
  tmux_session: string | null;
  tmux_window: number | null;
  git_branch: string | null;
}

export interface EventResponse {
  id: number;
  event_id: string;
  session_id: string;
  event_type: string;
  created_at: string;
  project_name: string;
  git_branch: string | null;
  summary: string;
  tmux_command: string | null;
}

const DB_PATH = join(homedir(), ".local/share/claude-monitoring/events.db");

export function getDbPath(): string {
  return DB_PATH;
}

export function dbExists(): boolean {
  return existsSync(DB_PATH);
}

export function getActiveEvents(): EventResponse[] {
  if (!dbExists()) {
    return [];
  }

  const db = new Database(DB_PATH, { readonly: true });
  try {
    const query = `
      SELECT
        id,
        event_id,
        session_id,
        event_type,
        created_at,
        summary,
        tmux_session,
        tmux_window,
        git_branch
      FROM events e1
      WHERE created_at = (
        SELECT MAX(created_at) FROM events e2
        WHERE e2.session_id = e1.session_id
      )
      AND event_type IN ('Stop', 'Notification')
      AND NOT EXISTS (
        SELECT 1 FROM events e3
        WHERE e3.session_id = e1.session_id
        AND e3.event_type = 'SessionEnd'
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
      project_name: row.tmux_session || "unknown",
      git_branch: row.git_branch || null,
      summary: row.summary || getDefaultSummary(row.event_type),
      tmux_command:
        row.tmux_session && row.tmux_window !== null
          ? `tmux switch-client -t '${row.tmux_session}:${row.tmux_window}'`
          : null,
    }));
  } finally {
    db.close();
  }
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
    const stat = Bun.file(DB_PATH);
    return stat.lastModified;
  } catch {
    return 0;
  }
}
