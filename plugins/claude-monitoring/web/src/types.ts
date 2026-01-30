// Client-side type definitions for the Web UI
// Note: Duplicated from src/types.ts because browser can't import server modules

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
  tmux_window_id: string | null;
}

export type FilterMode = "waiting" | "active" | "all";

export type ConnectionStatus = "connected" | "polling" | "disconnected";

export interface SessionStatusResponse {
  exists: boolean;
  process_pid: number | null;
  process_running: boolean;
}

export interface EventsApiResponse {
  events: EventResponse[];
  last_modified: number;
}

export interface CleanupCandidate {
  session_id: string;
  project_name: string | null;
}

export interface CleanupPreviewResponse {
  count: number;
  sessions: CleanupCandidate[];
}

export interface CleanupResponse {
  deleted_count: number;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
