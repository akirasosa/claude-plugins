# tmux-worktree Plugin

Git worktree workflow with tmux integration for parallel Claude Code sessions.

## Overview

This plugin enables a powerful workflow for running multiple Claude Code sessions in parallel using git worktrees. Each worktree gets its own tmux window, allowing you to work on multiple features or fixes simultaneously.

## Prerequisites

- **tmux**: Must be running inside a tmux session
- **[git-gtr](https://github.com/coderabbitai/git-worktree-runner)**: Git worktree runner tool
- **jq**: For JSON manipulation (used by start script)
- **Claude Code**: Installed and configured

## Installation

```bash
# Install plugin from local path
claude plugin install /path/to/tmux-worktree

# Or if published to a marketplace
claude plugin install tmux-worktree
```

## What it does

- **SessionStart hook**: Auto-configures `gtr.hook.preRemove` via `git config --local` for tmux cleanup
- **Command**: Provides Orchestrator Mode (`/orchestrator-mode`) for task delegation

## Scripts

| Script | Description |
|--------|-------------|
| `start <branch> [prompt]` | Create worktree + open tmux window + start Claude Code |
| `cleanup` | Kill tmux windows when removing worktree (preRemove hook) |

### Usage

After installing the plugin, find the scripts in your plugin directory:

```bash
# Get plugin path
PLUGIN_PATH=$(claude plugin path tmux-worktree)

# Create worktree and start Claude Code
$PLUGIN_PATH/scripts/start feat/add-feature
$PLUGIN_PATH/scripts/start fix/bug "Fix the login bug"
$PLUGIN_PATH/scripts/start --plan feat/new-feature "Implement new feature"
```

## Workflow

1. Start a tmux session in your main repository
2. Use the `start` script to create a worktree and launch Claude Code
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

## Uninstalling

```bash
claude plugin uninstall tmux-worktree
```
