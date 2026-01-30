import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { sendMessage } from "../../db/database.js";

export interface SendCompletionArgs {
  summary: string;
  details?: string;
  pr_url?: string;
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

/**
 * Simplified completion notification tool for workers.
 * Automatically reads orchestrator ID from .claude/.orchestrator-id
 * and gets branch from git.
 */
export function sendCompletion(args: SendCompletionArgs): CallToolResult {
  const { summary, details, pr_url } = args;

  if (!summary) {
    return {
      content: [{ type: "text", text: "Error: summary is required" }],
      isError: true,
    };
  }

  const cwd = process.cwd();

  // Get orchestrator ID from file
  const orchestratorId = getOrchestratorId(cwd);
  if (!orchestratorId) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Not running as a worker session. No .claude/.orchestrator-id file found.",
        },
      ],
      isError: true,
    };
  }

  // Get current branch
  const branch = getCurrentBranch(cwd) || "unknown";

  // Send message
  try {
    const message = sendMessage({
      orchestrator_id: orchestratorId,
      message_type: "task_complete",
      content: {
        summary,
        details,
        pr_url,
        branch,
      },
    });

    return {
      content: [
        {
          type: "text",
          text: `Completion notification sent to orchestrator (${orchestratorId}).\nMessage ID: ${message.id}`,
        },
      ],
    };
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: `Error sending completion notification: ${(e as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}
