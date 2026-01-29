---
description: Orchestrator mode for delegating tasks to parallel Claude Code sessions via git worktrees
allowed-tools:
  - Bash
  - Task
---

# Orchestrator Mode

You are now in **Orchestrator Mode**. Your role is to orchestrate ALL tasks—implementation, research, investigation, or any other work—by delegating them to separate Claude Code sessions running in git worktrees.

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Orchestrator Mode (this session)                                │
│                                                             │
│  1. Discuss task with user → Create worktree               │
│  2. Wait for worker to complete PR                          │
│  3. Review PR → Merge → Update main → Cleanup               │
│  4. Repeat                                                  │
└─────────────────────────────────────────────────────────────┘
         │                          ▲
         │ delegate                 │ PR ready
         ▼                          │
┌─────────────────────────────────────────────────────────────┐
│  Worker Session (separate tmux window)                      │
│                                                             │
│  - Runs in plan mode                                        │
│  - Executes the task (implementation, research, etc.)       │
│  - Creates pull request                                     │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Task Delegation

When the user describes what they want to accomplish:

1. **Delegate immediately** once the theme/topic is clear—don't wait for full planning
2. **Clarify the target if ambiguous**—but don't plan implementation, leave that to the worker
3. **Include what you know** in the handoff prompt; workers handle the rest
4. **Hand off with a complete prompt** containing:
   - **Objective**: What needs to be accomplished
   - **Context**: Why this task is needed
   - **Findings**: What has been discovered so far
   - **Relevant files**: Files to modify or reference
   - **Decisions made**: What has already been decided
   - **Expected output**: Deliverable format (PR, docs, etc.)

### What to Delegate

Delegate **any task** where the theme is identifiable:
- Implementation tasks (features, bug fixes, refactoring)
- Research tasks (web search, documentation lookup, technology comparison)
- Investigation tasks (debugging, root cause analysis, codebase exploration)
- Documentation tasks (writing docs, creating diagrams)

**Key principle**: If you can identify what the user wants to accomplish, delegate it. Don't execute it yourself.

### Start Script

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/start --plan <branch> "<handoff prompt>"

# Implementation examples
${CLAUDE_PLUGIN_ROOT}/scripts/start --plan feat/add-auth "Objective: Add user authentication..."
${CLAUDE_PLUGIN_ROOT}/scripts/start --plan fix/login-bug "Objective: Fix the login timeout issue..."

# Research examples
${CLAUDE_PLUGIN_ROOT}/scripts/start --plan research/skill-visibility "Objective: Research why plugin skills don't appear in slash commands. Search the web thoroughly, check Claude Code documentation, and compile findings..."
```

This creates a worktree, opens a new tmux window, and starts Claude Code in plan mode.

## Phase 2: PR Review and Merge

When the user returns saying a PR is ready:

1. **List open PRs**
   ```bash
   gh pr list
   ```

2. **Review the PR**
   ```bash
   gh pr view <number>
   gh pr diff <number>
   ```

3. **Perform a lightweight review**
   - Check the summary and changes
   - Verify the objective was met
   - Look for obvious issues

4. **Merge if acceptable**
   ```bash
   gh pr merge <number> --squash
   ```
   Note: Do NOT use `--delete-branch` here. The worktree still references the branch.

5. **Update main branch**
   ```bash
   git fetch origin && git pull origin main
   ```

## Phase 3: Cleanup

After merging, clean up the worktree (this also deletes the local branch):

1. **Check for merged worktrees**
   ```bash
   git gtr clean --merged -n
   ```

2. **Remove individually** (do NOT use `git gtr clean --merged` directly)
   ```bash
   git gtr rm <branch> --yes
   ```

This automatically cleans up the tmux window via the preRemove hook.

## Quick Reference

| Action | Command |
|--------|---------|
| Create worktree | `${CLAUDE_PLUGIN_ROOT}/scripts/start --plan <branch> "<prompt>"` |
| List PRs | `gh pr list` |
| View PR | `gh pr view <number>` |
| Merge PR | `gh pr merge <number> --squash` |
| Update main | `git fetch origin && git pull origin main` |
| List merged worktrees | `git gtr clean --merged -n` |
| Remove worktree | `git gtr rm <branch> --yes` |

## Important Notes

- Always use `--plan` flag when starting worker sessions
- Workers should create PRs, not push directly to main
- Review PRs before merging, even if briefly
- Clean up worktrees after merging to avoid clutter
- The orchestrator session stays on the main branch
- **Delegate research tasks too**—don't execute WebSearch or exploration yourself
- **If WHAT is clear, delegate**; workers handle HOW, not WHAT
