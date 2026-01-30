# tmux-worktree Plugin

Git worktree workflow with tmux integration for parallel Claude Code sessions.

## Overview

Delegate tasks to parallel Claude Code sessions running in separate git worktrees. When a worker creates a PR, the orchestrator is automatically notified.

## Prerequisites

- **tmux**: Must be running inside a tmux session
- **[git-gtr](https://github.com/coderabbitai/git-worktree-runner)**: Git worktree runner tool
- **Claude Code**: Installed and configured

## Installation

```bash
claude plugin install /path/to/tmux-worktree
```

## Usage

```
/orchestrator-mode
```

That's it. The orchestrator handles everything:
1. Creates orchestrator session
2. Starts background polling for notifications
3. Delegates tasks to worker sessions in separate worktrees
4. Receives automatic notification when workers create PRs
5. Reviews and merges PRs

## How it works

```
You (human)
    │
    └─► /orchestrator-mode
            │
            ▼
        Orchestrator (Claude)
            │
            ├─► Creates worktree + worker session
            │
            └─► Polls for messages
                    ▲
                    │ automatic notification
                    │
        Worker (Claude in worktree)
            │
            └─► gh pr create
                    │
                    ▼
                PostToolUse hook detects PR → sends notification
```

## Note

The plugin creates `.claude/.orchestrator-id` in worktrees. Ensure your `.gitignore` includes `.claude/*` (with appropriate exceptions) to avoid committing this file.

## Uninstalling

```bash
claude plugin uninstall tmux-worktree
```
