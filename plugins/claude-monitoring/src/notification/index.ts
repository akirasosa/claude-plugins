import { generateSummary } from "./gemini";

export type EventType = "stop" | "notification" | "sessionstart" | "sessionend";

export interface NotificationInput {
  session_id?: string;
  cwd?: string;
  transcript_path?: string;
  reason?: string;
  // Notification-specific fields (from Claude Code hooks)
  notification_type?: string; // permission_prompt, idle_prompt, auth_success, elicitation_dialog
  message?: string;
  // Stop-specific fields
  stop_hook_active?: boolean;
  // Common hook fields
  hook_event_name?: string;
  permission_mode?: string;
}

export interface HandleEventResult {
  eventType: string;
  summary: string;
}

/**
 * Handle a stop event: generate summary and log to DB
 */
async function handleStop(
  input: NotificationInput,
  logToDb: (eventType: string, summary: string) => void,
): Promise<HandleEventResult> {
  const transcriptPath = input.transcript_path || "";

  const summary = await generateSummary(transcriptPath, "stop");
  const displaySummary = summary || "Task completed";

  logToDb("Stop", displaySummary);

  return {
    eventType: "Stop",
    summary: displaySummary,
  };
}

/**
 * Handle a notification event: generate summary and log to DB
 */
async function handleNotification(
  input: NotificationInput,
  logToDb: (eventType: string, summary: string) => void,
): Promise<HandleEventResult> {
  const transcriptPath = input.transcript_path || "";
  const notificationType = input.notification_type || "unknown";

  const summary = await generateSummary(transcriptPath, "notification");
  const displaySummary = summary || "Waiting for input";

  // Include notification type in the event type for better tracking
  // notification_type can be: idle_prompt, permission_prompt, elicitation_dialog, auth_success
  const eventType = `Notification:${notificationType}`;

  logToDb(eventType, displaySummary);

  return {
    eventType,
    summary: displaySummary,
  };
}

/**
 * Handle a session start event: log to DB only
 */
async function handleSessionStart(
  _input: NotificationInput,
  logToDb: (eventType: string, summary: string) => void,
): Promise<HandleEventResult> {
  logToDb("SessionStart", "Session started");

  return {
    eventType: "SessionStart",
    summary: "Session started",
  };
}

/**
 * Handle a session end event: log to DB with reason
 */
async function handleSessionEnd(
  input: NotificationInput,
  logToDb: (eventType: string, summary: string) => void,
): Promise<HandleEventResult> {
  const reason = input.reason || "unknown";
  const summary = `reason=${reason}`;

  logToDb("SessionEnd", summary);

  return {
    eventType: "SessionEnd",
    summary,
  };
}

/**
 * Main event handler that dispatches to specific handlers
 */
export async function handleEvent(
  eventType: EventType,
  input: NotificationInput,
  logToDb: (eventType: string, summary: string) => void,
): Promise<HandleEventResult> {
  switch (eventType) {
    case "stop":
      return handleStop(input, logToDb);
    case "notification":
      return handleNotification(input, logToDb);
    case "sessionstart":
      return handleSessionStart(input, logToDb);
    case "sessionend":
      return handleSessionEnd(input, logToDb);
    default:
      // Unknown event type, log as-is
      logToDb(eventType, "Unknown event");
      return {
        eventType,
        summary: "Unknown event",
      };
  }
}
