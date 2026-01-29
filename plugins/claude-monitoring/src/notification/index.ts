import { shouldNotify } from "./dedup";
import { generateSummary } from "./gemini";
import { showNotification } from "./platform-notify";

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
  notificationShown: boolean;
}

/**
 * Handle a stop event: generate summary, log to DB, and show notification
 */
async function handleStop(
  input: NotificationInput,
  logToDb: (eventType: string, summary: string) => void,
): Promise<HandleEventResult> {
  const transcriptPath = input.transcript_path || "";
  const sessionId = input.session_id || "";

  const summary = await generateSummary(transcriptPath, "stop");
  const displaySummary = summary || "Task completed";

  // Always log to DB
  logToDb("Stop", displaySummary);

  // Only show notification if not recently notified
  let notificationShown = false;
  if (shouldNotify(sessionId)) {
    await showNotification("Claude Code", `[Stop] ${displaySummary}`);
    notificationShown = true;
  }

  return {
    eventType: "Stop",
    summary: displaySummary,
    notificationShown,
  };
}

/**
 * Handle a notification event: generate summary, log to DB, and show notification
 */
async function handleNotification(
  input: NotificationInput,
  logToDb: (eventType: string, summary: string) => void,
): Promise<HandleEventResult> {
  const transcriptPath = input.transcript_path || "";
  const sessionId = input.session_id || "";
  const notificationType = input.notification_type || "unknown";

  const summary = await generateSummary(transcriptPath, "notification");
  const displaySummary = summary || "Waiting for input";

  // Include notification type in the event type for better tracking
  // notification_type can be: idle_prompt, permission_prompt, elicitation_dialog, auth_success
  const eventType = `Notification:${notificationType}`;

  // Always log to DB
  logToDb(eventType, displaySummary);

  // Only show notification if not recently notified
  let notificationShown = false;
  if (shouldNotify(sessionId)) {
    await showNotification("Claude Code", `[${notificationType}] ${displaySummary}`);
    notificationShown = true;
  }

  return {
    eventType,
    summary: displaySummary,
    notificationShown,
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
    notificationShown: false,
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
    notificationShown: false,
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
        notificationShown: false,
      };
  }
}
