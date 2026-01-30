# tmux-worktree Plugin

Git worktree workflow with tmux integration for parallel Claude Code sessions.

## Overview

This plugin enables a powerful workflow for running multiple Claude Code sessions in parallel using git worktrees. Each worktree gets its own tmux window, allowing you to work on multiple features or fixes simultaneously.

## Prerequisites

- **tmux**: Must be running inside a tmux session
- **[git-gtr](https://github.com/coderabbitai/git-worktree-runner)**: Git worktree runner tool
- **Claude Code**: Installed and configured

## Installation

```bash
# Install plugin from local path
claude plugin install /path/to/tmux-worktree

# Or if published to a marketplace
claude plugin install tmux-worktree
```

## What it does

- **MCP Server**: Provides tools for worktree management and orchestrator-worker messaging
- **SessionStart hook**: Auto-configures `gtr.hook.preRemove` for tmux cleanup
- **PostToolUse hook**: Auto-detects `gh pr create` and notifies orchestrator
- **Command**: Provides Orchestrator Mode (`/orchestrator-mode`) for task delegation

## MCP Tools

### `start_worktree_session`

Creates a git worktree and starts Claude Code in a new tmux window.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| branch | string | Yes | Branch name (e.g., `feat/add-feature`) |
| fromRef | string | No | Base branch/ref to create worktree from |
| planMode | boolean | No | Start Claude Code in plan mode (default: false) |
| prompt | string | No | Initial prompt for Claude Code |
| orchestratorId | string | No | Orchestrator session ID for auto-notifications |

### `create_orchestrator_session`

Creates an orchestrator session for coordinating worker tasks.

### `poll_messages`

Polls for unread messages from workers.

### `get_orchestrator_status`

Gets orchestrator status including unread message count.

### `send_message`

Sends a message from worker to orchestrator.

## Usage

```
mcp__plugin_tmux-worktree_worktree__start_worktree_session({
  branch: "feat/add-feature",
  planMode: true,
  prompt: "Implement user authentication..."
})
```

Or use the `/orchestrator-mode` command for a guided workflow with automatic PR notifications.

## Workflow

1. Start a tmux session in your main repository
2. Use the `start_worktree_session` MCP tool to create a worktree and launch Claude Code
3. Work on multiple features in parallel across different tmux windows
4. When done, use `git gtr rm <branch>` to clean up (tmux windows are auto-killed)

## Note

When using orchestrator mode, the plugin creates `.claude/.orchestrator-id` in worktrees. Ensure your `.gitignore` includes `.claude/*` (with appropriate exceptions) to avoid committing this file.

## Uninstalling

```bash
claude plugin uninstall tmux-worktree
```
