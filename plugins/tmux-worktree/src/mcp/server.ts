#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  type StartWorktreeSessionArgs,
  startWorktreeSession,
} from "./tools/start-worktree-session.js";

const TOOL_DEFINITIONS = [
  {
    name: "start_worktree_session",
    description:
      "Creates a git worktree and starts Claude Code in a new tmux window. Requires running inside a tmux session.",
    inputSchema: {
      type: "object" as const,
      properties: {
        branch: {
          type: "string",
          description: "Branch name for the worktree (e.g., 'feat/add-feature')",
        },
        fromRef: {
          type: "string",
          description: "Optional base branch/ref to create worktree from",
        },
        planMode: {
          type: "boolean",
          description: "Start Claude Code in plan mode (default: false)",
        },
        prompt: {
          type: "string",
          description: "Optional initial prompt for Claude Code",
        },
      },
      required: ["branch"],
    },
  },
];

const server = new Server({ name: "worktree", version: "3.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  if (name === "start_worktree_session") {
    return startWorktreeSession(args as unknown as StartWorktreeSessionArgs);
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
