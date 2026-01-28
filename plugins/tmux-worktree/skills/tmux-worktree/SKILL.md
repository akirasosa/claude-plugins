---
name: tmux-worktree
description: Git worktree workflow with tmux integration for parallel Claude Code sessions
user-invocable: true
disable-model-invocation: false
---

# Tmux Worktree Workflow

## When to Create a Worktree

**Create a worktree as soon as a topic/task is defined.** No need to wait for the plan to be finalized.

Workflow stages:
1. Topic is given ← Create worktree here
2. Exploration and investigation
3. Implementation planning
4. Implementation

## Start Script

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/start [--plan] [--from <ref>] <branch> [prompt]

# Examples
${CLAUDE_PLUGIN_ROOT}/scripts/start feat/add-metrics
${CLAUDE_PLUGIN_ROOT}/scripts/start --from develop feat/add-metrics
${CLAUDE_PLUGIN_ROOT}/scripts/start fix/bug "Fix the login bug"
${CLAUDE_PLUGIN_ROOT}/scripts/start --plan feat/new-feature "Implement..."
```

This creates a worktree → opens a new tmux window → starts Claude Code.

## Cleanup

### Removing a Single Worktree

Use `git gtr rm <branch>` to remove a worktree. The tmux window is automatically cleaned up via the preRemove hook.

### Removing Multiple Merged Worktrees

```bash
# 1. List merged worktrees (dry run)
git gtr clean --merged -n

# 2. Remove each worktree individually
git gtr rm <branch> --yes
```

⚠️ **Warning**: Do not use `git gtr clean --merged` directly. It bypasses the preRemove hook and leaves tmux windows orphaned. Always remove worktrees individually with `git gtr rm`.
