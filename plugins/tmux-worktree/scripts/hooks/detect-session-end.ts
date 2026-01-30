#!/usr/bin/env bun
/**
 * SessionEnd hook: Notifies orchestrator when worker session ends
 *
 * Receives JSON on stdin:
 * {
 *   "session_id": "...",
 *   "cwd": "..."
 * }
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getSpawnedWorkerByPath,
  sendMessage,
  updateSpawnedWorkerStatus,
} from "../../src/db/database";

interface HookPayload {
  session_id: string;
  cwd: string;
}

function getOrchestratorId(cwd: string): string | null {
  const orchestratorIdPath = join(cwd, ".claude", ".orchestrator-id");
  if (!existsSync(orchestratorIdPath)) {
    return null;
  }
  try {
    return readFileSync(orchestratorIdPath, "utf-8").trim();
  } catch {
    return null;
  }
}

function getCurrentBranch(cwd: string): string | null {
  try {
    const result = Bun.spawnSync(["git", "branch", "--show-current"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode === 0) {
      return result.stdout.toString().trim();
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  // Read hook payload from stdin
  const input = await Bun.stdin.text();
  if (!input.trim()) {
    process.exit(0);
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(input);
  } catch {
    // Invalid JSON, ignore
    process.exit(0);
  }

  const cwd = payload.cwd || process.cwd();

  // Get orchestrator ID from .claude/.orchestrator-id
  const orchestratorId = getOrchestratorId(cwd);
  if (!orchestratorId) {
    // No orchestrator ID means this session wasn't spawned by an orchestrator
    process.exit(0);
  }

  // Check if this worker already completed (PR was created)
  const worker = getSpawnedWorkerByPath(cwd);
  if (!worker || worker.status === "completed") {
    // Already completed via PR creation hook, don't send duplicate
    process.exit(0);
  }

  // Get current branch
  const branch = getCurrentBranch(cwd) || "unknown";

  // Update spawned worker status in database
  updateSpawnedWorkerStatus(cwd, "ended");

  // Send session ended message to orchestrator
  sendMessage({
    orchestrator_id: orchestratorId,
    message_type: "task_complete",
    content: {
      summary: `Worker session ended (branch: ${branch})`,
      branch,
      details:
        "Session ended without creating a PR. The task may still be in progress or was cancelled.",
    },
  });

  // Log for debugging
  console.error(`[detect-session-end] Notified orchestrator ${orchestratorId} about session end`);
}

main().catch((err) => {
  console.error("[detect-session-end] Error:", err);
  process.exit(0); // Don't fail the hook
});
