import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STOP_DEDUP_INTERVAL_MS = 30 * 1000; // 30 seconds

function getStateFilePath(sessionId: string): string {
  return join(tmpdir(), `claude-monitoring-last-stop-${sessionId}`);
}

/**
 * Check if a stop notification should be shown.
 * Returns false if a stop notification was shown for the same session within 30 seconds.
 * Updates the state file with the current timestamp if returning true.
 */
export function shouldNotifyStop(sessionId: string): boolean {
  const stateFile = getStateFilePath(sessionId);
  const now = Date.now();

  if (existsSync(stateFile)) {
    try {
      const lastTimeStr = readFileSync(stateFile, "utf-8").trim();
      const lastTime = parseInt(lastTimeStr, 10);
      if (!Number.isNaN(lastTime) && now - lastTime < STOP_DEDUP_INTERVAL_MS) {
        return false; // Skip notification (consecutive Stop)
      }
    } catch {
      // Ignore read errors, proceed with notification
    }
  }

  // Update state file with current timestamp
  try {
    writeFileSync(stateFile, now.toString());
  } catch {
    // Ignore write errors
  }

  return true;
}
