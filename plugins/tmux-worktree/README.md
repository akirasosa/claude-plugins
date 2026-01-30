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

- **MCP Server**: Provides `start_worktree_session` tool for creating worktrees
- **SessionStart hook**: Auto-configures `gtr.hook.preRemove` via `git config --local` for tmux cleanup
- **Command**: Provides Orchestrator Mode (`/orchestrator-mode`) for task delegation

## MCP Tool: `start_worktree_session`

Creates a git worktree and starts Claude Code in a new tmux window.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| branch | string | Yes | Branch name (e.g., `feat/add-feature`) |
| fromRef | string | No | Base branch/ref to create worktree from |
| planMode | boolean | No | Start Claude Code in plan mode (default: false) |
| prompt | string | No | Initial prompt for Claude Code |

### Usage

After installing the plugin, use the MCP tool directly:

```
mcp__plugin_tmux-worktree_worktree__start_worktree_session({
  branch: "feat/add-feature",
  planMode: true,
  prompt: "Implement user authentication..."
})
```

Or use the `/orchestrator-mode` command for a guided workflow.

## Workflow

1. Start a tmux session in your main repository
2. Use the `start_worktree_session` MCP tool to create a worktree and launch Claude Code
3. Work on multiple features in parallel across different tmux windows
4. When done, use `git gtr rm <branch>` to clean up (tmux windows are auto-killed)

## Tips

Creating a `CLAUDE.local.md` file in your repository root can help streamline handoff prompts when delegating tasks to worktrees:

```markdown
Hand off your work to Claude Code on a separate worktree using tmux-worktree as soon as the task theme is identified. Generally, ensure that Claude Code is always running in plan mode.

## Handoff Prompt Requirements

Include the following in your handoff prompt:

1. **Objective**: What needs to be accomplished
2. **Context**: Why this task is needed
3. **Findings**: What has been discovered so far
4. **Relevant files**: Files to modify or reference
5. **Decisions made**: What has already been decided
6. **Expected output**: Deliverable format (PR, docs, etc.)
```

## Testing

This plugin currently has no automated tests. The functionality can be verified manually:

1. Ensure you're in a tmux session
2. Run `mcp__plugin_tmux-worktree_worktree__start_worktree_session` with test parameters
3. Verify a new tmux window is created with Claude Code

To add tests in the future, create `*.test.ts` files and run:

```bash
cd plugins/tmux-worktree && bun test
```

## Uninstalling

```bash
claude plugin uninstall tmux-worktree
```
