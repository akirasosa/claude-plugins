import { showNotification } from "./platform-notify";
import { shouldNotifyStop } from "./dedup";
import { generateSummary } from "./gemini";

export { showNotification } from "./platform-notify";
export { shouldNotifyStop } from "./dedup";
export { generateSummary } from "./gemini";
export { getGcpProject, getGcpLocation } from "./config";

export type EventType = "stop" | "notification" | "sessionstart" | "sessionend";

export interface NotificationInput {
  session_id?: string;
  cwd?: string;
  transcript_path?: string;
  reason?: string;
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
  logToDb: (eventType: string, summary: string) => void
): Promise<HandleEventResult> {
  const transcriptPath = input.transcript_path || "";
  const sessionId = input.session_id || "";

  const summary = await generateSummary(transcriptPath, "stop");
  const displaySummary = summary || "Task completed";

  // Always log to DB
  logToDb("Stop", displaySummary);

  // Only show notification if not a consecutive Stop
  let notificationShown = false;
  if (shouldNotifyStop(sessionId)) {
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
  logToDb: (eventType: string, summary: string) => void
): Promise<HandleEventResult> {
  const transcriptPath = input.transcript_path || "";

  const summary = await generateSummary(transcriptPath, "notification");
  const displaySummary = summary || "Waiting for input";

  await showNotification("Claude Code", `[Notification] ${displaySummary}`);
  logToDb("Notification", displaySummary);

  return {
    eventType: "Notification",
    summary: displaySummary,
    notificationShown: true,
  };
}

/**
 * Handle a session start event: log to DB only
 */
async function handleSessionStart(
  _input: NotificationInput,
  logToDb: (eventType: string, summary: string) => void
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
  logToDb: (eventType: string, summary: string) => void
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
  logToDb: (eventType: string, summary: string) => void
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
