export interface Event {
  id: number;
  event_id: string;
  session_id: string;
  event_type: string;
  created_at: string;
  summary: string | null;
  project_dir: string | null;
  tmux_window_id: string | null;
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
  tmux_window_id: string | null;
}

export type FilterMode = "waiting" | "active";

export interface EventInput {
  session_id?: string;
  cwd?: string;
}
