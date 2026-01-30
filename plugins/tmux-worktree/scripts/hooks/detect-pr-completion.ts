#!/usr/bin/env bun
// Immediate debug log - before any imports
import { appendFileSync } from "node:fs";

const LOG_FILE = "/tmp/hook-debug.log";
const log = (msg: string) => {
  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch {}
};
log("=== Hook script started ===");

/**
 * PostToolUse hook: Detects gh pr create command and sends notification to orchestrator
 *
 * Receives JSON on stdin:
 * {
 *   "tool_name": "Bash",
 *   "tool_input": { "command": "gh pr create ..." },
 *   "tool_response": { "stdout": "https://github.com/.../pull/123", ... }
 * }
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sendMessage, updateSpawnedWorkerStatus } from "../../src/db/database";

interface ToolInput {
  command?: string;
}

interface ToolResponse {
  stdout?: string;
  exit_code?: number;
}

interface HookPayload {
  tool_name: string;
  tool_input: ToolInput;
  tool_response: ToolResponse;
  session_id: string;
  cwd: string;
}

function extractPrUrl(stdout: string): string | null {
  // GitHub PR URLs: https://github.com/owner/repo/pull/123
  const match = stdout.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
  return match ? match[0] : null;
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
  const debugLog = (msg: string) => {
    try {
      appendFileSync("/tmp/detect-pr-completion-debug.log", `${new Date().toISOString()} ${msg}\n`);
    } catch {}
  };

  // Read hook payload from stdin
  const input = await Bun.stdin.text();

  debugLog(`Input length: ${input.length}`);
  if (input.length < 1000) {
    debugLog(`Input: ${input}`);
  }

  if (!input.trim()) {
    debugLog("Empty input, exiting");
    process.exit(0);
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(input);
  } catch {
    // Invalid JSON, ignore
    process.exit(0);
  }

  // Only process Bash tool calls
  if (payload.tool_name !== "Bash") {
    process.exit(0);
  }

  const command = payload.tool_input?.command || "";
  const stdout = payload.tool_response?.stdout || "";
  const exitCode = payload.tool_response?.exit_code;

  // Check if this is a gh pr create command
  if (!command.includes("gh pr create")) {
    process.exit(0);
  }

  // Check if command succeeded
  if (exitCode !== 0) {
    process.exit(0);
  }

  // Extract PR URL from stdout
  const prUrl = extractPrUrl(stdout);
  if (!prUrl) {
    process.exit(0);
  }

  // Get orchestrator ID from .claude/.orchestrator-id
  const cwd = payload.cwd || process.cwd();
  const orchestratorId = getOrchestratorId(cwd);
  if (!orchestratorId) {
    // No orchestrator ID means this session wasn't spawned by an orchestrator
    process.exit(0);
  }

  // Get current branch
  const branch = getCurrentBranch(cwd) || "unknown";

  // Update spawned worker status in database
  updateSpawnedWorkerStatus(cwd, "completed", prUrl);

  // Send completion message to orchestrator
  sendMessage({
    orchestrator_id: orchestratorId,
    message_type: "task_complete",
    content: {
      summary: `PR created: ${prUrl}`,
      pr_url: prUrl,
      branch,
    },
  });

  // Log for debugging (visible in hook output)
  console.error(
    `[detect-pr-completion] Notified orchestrator ${orchestratorId} about PR: ${prUrl}`,
  );
}

main().catch((err) => {
  console.error("[detect-pr-completion] Error:", err);
  process.exit(0); // Don't fail the hook
});
