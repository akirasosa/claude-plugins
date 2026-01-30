import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createSpawnedWorker } from "../../db/database.js";
import type { TaskType } from "../../db/types.js";
import { getMcpServersFromProject, updateClaudeConfig } from "../utils/claude-config.js";
import { exec, execOrThrow } from "../utils/exec.js";
import { createWindow, isTmuxAvailable, sendKeys, waitForShellInit } from "../utils/tmux.js";

export interface StartWorktreeSessionArgs {
  branch: string;
  fromRef?: string;
  planMode?: boolean;
  prompt?: string;
  orchestratorId?: string;
  taskType?: TaskType;
  pluginDir?: string; // Temporary: for local plugin testing
}

/**
 * Gets the plugin root directory (where plugin.json is located)
 * This file is at src/mcp/tools/start-worktree-session.ts
 * Plugin root is 3 levels up
 */
function getPluginRoot(): string {
  return dirname(dirname(dirname(import.meta.dir)));
}

/**
 * Writes orchestrator ID file to worktree's .claude directory
 * This file is read by hooks (defined in plugin.json) to determine if
 * this session is a worker spawned by an orchestrator.
 */
function writeOrchestratorIdFile(worktreePath: string, orchestratorId: string): void {
  const claudeDir = join(worktreePath, ".claude");
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }
  writeFileSync(join(claudeDir, ".orchestrator-id"), orchestratorId);
}

/**
 * Creates a git worktree and starts Claude Code in a new tmux window
 */
export async function startWorktreeSession(
  args: StartWorktreeSessionArgs,
): Promise<CallToolResult> {
  const { branch, fromRef, planMode, prompt, orchestratorId, taskType, pluginDir } = args;

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

  // If orchestratorId is provided, set up worker tracking
  if (orchestratorId) {
    // 1. Record spawned worker in database
    try {
      createSpawnedWorker({
        orchestrator_id: orchestratorId,
        branch,
        worktree_path: worktreePath,
        task_type: taskType,
      });
    } catch (e) {
      // Log but don't fail - DB might not be initialized
      console.error("Failed to record spawned worker:", e);
    }

    // 2. Write orchestrator ID file (hooks read this to send notifications)
    writeOrchestratorIdFile(worktreePath, orchestratorId);
  }

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

  // Build claude command
  const planModeFlag = planMode ? "--permission-mode plan" : "";
  // Always pass plugin directory so hooks are available in worker sessions
  // Use provided pluginDir or auto-detect from current plugin location
  // IMPORTANT: Always resolve to absolute path since worker runs in a different directory
  const effectivePluginDir = pluginDir ? resolve(pluginDir) : getPluginRoot();
  const pluginDirFlag = `--plugin-dir ${effectivePluginDir}`;

  if (prompt) {
    // Use base64 encoding to safely transfer prompts with special characters
    // IMPORTANT: Prompt must come BEFORE --plugin-dir flag for Claude to receive it
    const encoded = Buffer.from(prompt).toString("base64");
    sendKeys(
      windowId,
      `"claude ${planModeFlag} \\"\\$(echo '${encoded}' | base64 -d)\\" ${pluginDirFlag}"`,
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
