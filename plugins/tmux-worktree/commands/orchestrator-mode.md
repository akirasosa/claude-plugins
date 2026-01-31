---
description: Orchestrator mode for delegating tasks to parallel Claude Code sessions via git worktrees
allowed-tools:
  - Bash
  - Task
  - mcp__plugin_tmux-worktree_worktree__start_worktree_session
  - mcp__plugin_tmux-worktree_worktree__create_orchestrator_session
  - mcp__plugin_tmux-worktree_worktree__poll_messages
  - mcp__plugin_tmux-worktree_worktree__get_orchestrator_status
  - mcp__plugin_tmux-worktree_worktree__wait_for_messages
---

# Orchestrator Mode

You are now in **Orchestrator Mode**. Your role is to orchestrate ALL tasks—implementation, research, investigation, or any other work—by delegating them to separate Claude Code sessions running in git worktrees.

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Orchestrator Mode (this session)                           │
│                                                             │
│  1. Create orchestrator session (get ID)                    │
│  2. Start background message polling                        │
│  3. Discuss task with user → Create worktree (with ID)      │
│  4. Receive AUTOMATIC notification when worker completes    │
│  5. Review PR → Merge → Update main → Cleanup               │
│  6. Repeat                                                  │
└─────────────────────────────────────────────────────────────┘
         │                          ▲
         │ delegate                 │ AUTOMATIC (via hooks)
         ▼                          │
┌─────────────────────────────────────────────────────────────┐
│  Worker Session (separate tmux window)                      │
│                                                             │
│  - Runs in plan mode                                        │
│  - Executes the task (implementation, research, etc.)       │
│  - Creates pull request                                     │
│  - PostToolUse hook detects `gh pr create` → auto-notifies  │
└─────────────────────────────────────────────────────────────┘
```

## How Automatic Notifications Work

When you pass `orchestratorId` to `start_worktree_session`, the system automatically:

1. **Records the worker** in a tracking database
2. **Creates `.claude/.orchestrator-id`** file in the worktree
3. **Configures hooks** via the plugin:
   - **PostToolUse hook**: Detects `gh pr create` commands and sends completion notification

This means **workers don't need to manually call `send_message`**—notifications happen automatically!

## Phase 0: Initialize Orchestrator Session

**CRITICAL: Do this FIRST before delegating any tasks.**

### Step 1: Create Orchestrator Session

```
mcp__plugin_tmux-worktree_worktree__create_orchestrator_session({})
```

This returns an `orchestrator_id` (e.g., `orch_abc12345`). **Save this ID** for use with all worker sessions.

### Step 2: Start Background Message Watcher

Start a background task to wait for worker messages. Uses `fs.watch()` for instant notification when a message arrives.

```
Task({
  subagent_type: "general-purpose",
  description: "Wait for worker messages",
  run_in_background: true,
  prompt: `Call the MCP tool to wait for messages:

mcp__plugin_tmux-worktree_worktree__wait_for_messages({
  orchestrator_id: "<ORCHESTRATOR_ID>",
  timeout_seconds: 600
})

When the tool returns, report the result. The output is JSON with this structure:
- status: "messages" (got messages), "timeout" (no messages within timeout), or "error"
- messages: array of messages if status is "messages"
- error: error message if status is "error"

Each message contains:
- message_type: "task_complete", "task_failed", or "question"
- content.summary: Brief description
- content.pr_url: PR URL if present
- content.branch: Branch name if present
`
})
```

**CRITICAL: When the background task exits**, immediately:
1. Read the output file to see the message
2. Process the message (review PR, answer question, etc.)
3. **Restart the background watcher immediately** (use the same Task command above)

**Always keep the watcher running.** Restart it every time it exits.

## Phase 1: Task Delegation

When the user describes what they want to accomplish:

1. **Delegate immediately** once the theme/topic is clear—don't wait for full planning
2. **Never assume specifics you're unsure of**—keep ambiguity intact or ask briefly
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

### Start Worktree Session (via MCP tool)

Use the `mcp__plugin_tmux-worktree_worktree__start_worktree_session` tool:

| Parameter | Description |
|-----------|-------------|
| branch | Branch name (required) |
| planMode | true for plan mode (default: false) |
| prompt | Initial prompt for Claude Code |
| fromRef | Base branch to create from |
| orchestratorId | **Required** - The orchestrator session ID for auto-notifications |

**IMPORTANT**: Always pass `orchestratorId` so automatic notifications are enabled.

**Examples:**

```
# Standard task (will auto-notify when PR is created)
mcp__plugin_tmux-worktree_worktree__start_worktree_session({
  branch: "feat/add-auth",
  planMode: true,
  orchestratorId: "orch_abc12345",
  prompt: "Objective: Add user authentication..."
})

# From a specific base branch
mcp__plugin_tmux-worktree_worktree__start_worktree_session({
  branch: "feat/add-metrics",
  fromRef: "develop",
  planMode: true,
  orchestratorId: "orch_abc12345",
  prompt: "Objective: Add metrics collection..."
})
```

This creates a worktree, opens a new tmux window, and starts Claude Code.
**Automatic notification hooks are configured**—when the worker runs `gh pr create`, you'll be notified automatically.

## Phase 2: PR Review and Merge

When notified that a PR is ready:

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

4. **Report findings and ASK the user**
   - Summarize the PR changes to the user
   - **ALWAYS ask the user for confirmation before merging**
   - Do NOT merge automatically—wait for explicit user approval

5. **Merge only after user approval**
   ```bash
   gh pr merge <number> --squash
   ```
   Note: Do NOT use `--delete-branch` here. The worktree still references the branch.

6. **Update main branch**
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

| Action | Tool/Command |
|--------|--------------|
| Create orchestrator session | `mcp__plugin_tmux-worktree_worktree__create_orchestrator_session` |
| Wait for messages (blocking) | `mcp__plugin_tmux-worktree_worktree__wait_for_messages` |
| Poll messages (instant) | `mcp__plugin_tmux-worktree_worktree__poll_messages` |
| Check status | `mcp__plugin_tmux-worktree_worktree__get_orchestrator_status` |
| Create worktree | `mcp__plugin_tmux-worktree_worktree__start_worktree_session` |
| List PRs | `gh pr list` |
| View PR | `gh pr view <number>` |
| Merge PR | `gh pr merge <number> --squash` |
| Update main | `git fetch origin && git pull origin main` |
| List merged worktrees | `git gtr clean --merged -n` |
| Remove worktree | `git gtr rm <branch> --yes` |

## Important Notes

- **Always keep polling running**: Restart the polling agent immediately every time it exits
- **Initialize first**: Always call `create_orchestrator_session` and start polling before delegating
- **Always pass `orchestratorId`**: This enables automatic notification hooks
- **Automatic PR detection**: When a worker runs `gh pr create`, the orchestrator is notified automatically
- Always use `planMode: true` when starting worker sessions
- Workers should create PRs, not push directly to main
- Review PRs and ask user before merging
- Clean up worktrees after merging to avoid clutter
- The orchestrator session stays on the main branch
- **Delegate research tasks too**—don't execute WebSearch or exploration yourself
- **Ambiguous but correct > Specific but wrong**; workers can investigate
