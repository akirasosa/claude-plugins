export interface OrchestratorSession {
  id: string;
  project_dir: string;
  created_at: string;
}

export type MessageType = "task_complete" | "task_failed" | "question";

export type MessageStatus = "unread" | "read";

export interface Message {
  id: string;
  orchestrator_id: string;
  worker_id: string | null;
  message_type: MessageType;
  content: string; // JSON string
  status: MessageStatus;
  created_at: string;
}

export interface MessageContent {
  summary: string;
  details?: string;
  pr_url?: string;
  branch?: string;
  error?: string;
  question?: string;
}

export interface CreateOrchestratorInput {
  project_dir: string;
}

export interface SendMessageInput {
  orchestrator_id: string;
  worker_id?: string;
  message_type: MessageType;
  content: MessageContent;
}

export interface OrchestratorStatus {
  orchestrator_id: string;
  unread_count: number;
  total_messages: number;
  created_at: string;
}
