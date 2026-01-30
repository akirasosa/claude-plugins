import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getMcpServersFromProject, updateClaudeConfig } from "../utils/claude-config.js";
import { exec, execOrThrow } from "../utils/exec.js";
import { createWindow, isTmuxAvailable, sendKeys, waitForShellInit } from "../utils/tmux.js";

export interface StartWorktreeSessionArgs {
  branch: string;
  fromRef?: string;
  planMode?: boolean;
  prompt?: string;
  orchestratorId?: string;
  pluginDir?: string; // Temporary: for local plugin testing
}

/**
 * Generates notification instructions for worker sessions
 */
function buildOrchestratorInstructions(orchestratorId: string, branch: string): string {
  return `

---
## IMPORTANT: Orchestrator Notification

You are running as a WORKER session spawned by an orchestrator (ID: ${orchestratorId}).

**When you complete your task (PR created or task done), notify the orchestrator:**

\`\`\`
mcp__plugin_tmux-worktree_worktree__send_message({
  orchestrator_id: "${orchestratorId}",
  message_type: "task_complete",
  content: {
    summary: "Brief description of what was done",
    pr_url: "https://github.com/...",  // if PR was created
    branch: "${branch}"
  }
})
\`\`\`

CRITICAL: Send this notification before ending your session!
---

`;
}

/**
 * Creates a git worktree and starts Claude Code in a new tmux window
 */
export async function startWorktreeSession(
  args: StartWorktreeSessionArgs,
): Promise<CallToolResult> {
  const { branch, fromRef, planMode, prompt, orchestratorId, pluginDir } = args;

  // Validate branch parameter
  if (!branch || typeof branch !== "string") {
    return {
      content: [{ type: "text", text: "Error: branch parameter is required" }],
      isError: true,
    };
  }

  // Check if running inside a tmux session
  if (!isTmuxAvailable()) {
    return {
      content: [{ type: "text", text: "Error: Must be run inside a tmux session" }],
      isError: true,
    };
  }

  // Create worktree
  const gtrNewCommand = fromRef
    ? `git gtr new "${branch}" --from "${fromRef}"`
    : `git gtr new "${branch}"`;

  const createResult = exec(gtrNewCommand);
  if (!createResult.success) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Failed to create worktree for branch '${branch}': ${createResult.error}`,
        },
      ],
      isError: true,
    };
  }

  // Get worktree path
  let worktreePath: string;
  try {
    worktreePath = execOrThrow(`git gtr go "${branch}"`);
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Failed to get worktree path: ${(e as Error).message}`,
        },
      ],
      isError: true,
    };
  }

  if (!worktreePath) {
    return {
      content: [{ type: "text", text: "Error: Failed to get worktree path" }],
      isError: true,
    };
  }

  // Get MCP servers from the current project's .mcp.json
  const mcpServers = getMcpServersFromProject(process.cwd());

  // Update ~/.claude.json to trust the worktree and enable MCP servers
  updateClaudeConfig(worktreePath, mcpServers);

  // Window name (remove branch prefix like feat/, fix/, etc.)
  const windowName = branch.includes("/") ? branch.split("/").pop() || branch : branch;

  // Create new tmux window
  let windowId: string;
  try {
    windowId = createWindow(windowName, worktreePath);
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Failed to create tmux window: ${(e as Error).message}`,
        },
      ],
      isError: true,
    };
  }

  // Wait for shell initialization
  await waitForShellInit();

  // Build the final prompt, optionally adding orchestrator instructions
  let finalPrompt = prompt || "";
  if (orchestratorId) {
    finalPrompt = finalPrompt + buildOrchestratorInstructions(orchestratorId, branch);
  }

  // Build claude command
  const planModeFlag = planMode ? "--permission-mode plan" : "";
  const pluginDirFlag = pluginDir ? `--plugin-dir '${pluginDir}'` : "";

  if (finalPrompt) {
    // Write prompt to a temp file in the worktree directory
    // This avoids complex shell escaping issues with base64/command substitution
    const promptFile = join(worktreePath, ".claude-worker-prompt.txt");
    writeFileSync(promptFile, finalPrompt);

    // Use single quotes around the entire command so the parent shell doesn't expand $(...)
    // The target shell (fish/bash/zsh) will evaluate it when the command runs
    sendKeys(
      windowId,
      `'claude ${planModeFlag} ${pluginDirFlag} "$(cat .claude-worker-prompt.txt)"'`,
    );
  } else {
    sendKeys(windowId, `"claude ${planModeFlag} ${pluginDirFlag}"`);
  }

  return {
    content: [
      {
        type: "text",
        text: `Started Claude Code in worktree: ${worktreePath}`,
      },
    ],
  };
}
