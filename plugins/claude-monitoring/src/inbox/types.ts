/**
 * Types for orchestrator-worker inbox communication
 */

/**
 * Message sent from worker to orchestrator when a task is complete
 */
export interface InboxMessage {
  /** Worker's git branch name */
  worker_branch: string;
  /** PR number if created */
  pr_number?: number;
  /** PR URL if created */
  pr_url?: string;
  /** Human-readable summary of completed work */
  summary?: string;
  /** ISO 8601 timestamp when message was created */
  timestamp: string;
  /** Whether the message has been read by orchestrator */
  read?: boolean;
  /** Worker's session ID for tracking */
  worker_session_id?: string;
}

/**
 * Inbox file structure for an orchestrator session
 */
export interface InboxFile {
  /** List of messages in the inbox */
  messages: InboxMessage[];
}

/**
 * Result of checking the inbox
 */
export interface InboxCheckResult {
  /** Number of unread messages */
  unread_count: number;
  /** List of unread messages */
  messages: InboxMessage[];
}
