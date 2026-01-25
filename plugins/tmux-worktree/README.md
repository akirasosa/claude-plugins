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
claude plugin install /path/to/tmux-worktree --scope local

# Or if published to a marketplace
claude plugin install tmux-worktree --scope local
```

## What it does

- **SessionStart hook**: Auto-configures `.gtrconfig` with `preRemove` hook for tmux cleanup
- **Skill**: Provides worktree workflow knowledge to Claude

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

Or use directly if you know the plugin location:

```bash
~/.claude/plugins/tmux-worktree/scripts/start feat/add-feature
```

## Workflow

1. Start a tmux session in your main repository
2. Use the `start` script to create a worktree and launch Claude Code
3. Work on multiple features in parallel across different tmux windows
4. When done, use `git gtr rm <branch>` to clean up (tmux windows are auto-killed)

## Uninstalling

```bash
claude plugin uninstall tmux-worktree --scope local
```
