// API client functions

import type {
  CleanupPreviewResponse,
  CleanupResponse,
  EventsApiResponse,
  FilterMode,
  SessionStatusResponse,
} from "./types";

/**
 * Check session status (for process tracking)
 */
export async function checkSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/status`);
    return response.ok
      ? await response.json()
      : { exists: false, process_pid: null, process_running: false };
  } catch {
    return { exists: false, process_pid: null, process_running: false };
  }
}

/**
 * Delete a session
 */
export async function deleteSessionApi(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get cleanup preview (sessions that would be deleted)
 */
export async function getCleanupPreview(): Promise<CleanupPreviewResponse> {
  try {
    const response = await fetch("/api/cleanup/preview");
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.error("Failed to get cleanup preview:", err);
  }
  return { count: 0, sessions: [] };
}

/**
 * Perform cleanup (delete dead sessions)
 */
export async function performCleanup(): Promise<CleanupResponse> {
  try {
    const response = await fetch("/api/cleanup", { method: "POST" });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.error("Failed to perform cleanup:", err);
  }
  return { deleted_count: 0 };
}

/**
 * Poll events from API
 */
export async function fetchEvents(mode: FilterMode): Promise<EventsApiResponse | null> {
  try {
    const response = await fetch(`/api/events?mode=${mode}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.error("Failed to fetch events:", err);
  }
  return null;
}
