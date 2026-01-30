---
description: Orchestrator mode for delegating tasks to parallel Claude Code sessions via git worktrees
allowed-tools:
  - Bash
  - Task
  - mcp__plugin_tmux-worktree_worktree__start_worktree_session
  - mcp__plugin_tmux-worktree_worktree__create_orchestrator_session
  - mcp__plugin_tmux-worktree_worktree__poll_messages
  - mcp__plugin_tmux-worktree_worktree__get_orchestrator_status
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
│  - SessionEnd hook notifies if session ends without PR      │
└─────────────────────────────────────────────────────────────┘
```

## How Automatic Notifications Work

When you pass `orchestratorId` to `start_worktree_session`, the system automatically:

1. **Records the worker** in a tracking database
2. **Creates `.claude/.orchestrator-id`** file in the worktree
3. **Configures hooks** in the worktree's `settings.local.json`:
   - **PostToolUse hook**: Detects `gh pr create` commands and sends completion notification
   - **SessionEnd hook**: Notifies if the session ends without creating a PR

This means **workers don't need to manually call `send_message`**—notifications happen automatically!

## Phase 0: Initialize Orchestrator Session

**CRITICAL: Do this FIRST before delegating any tasks.**

### Step 1: Create Orchestrator Session

```
mcp__plugin_tmux-worktree_worktree__create_orchestrator_session({})
```

This returns an `orchestrator_id` (e.g., `orch_abc12345`). **Save this ID** for use with all worker sessions.

### Step 2: Start Background Message Polling

Start a background subagent to poll for worker messages. When a message arrives, the agent exits and notifies you.

```
Task({
  subagent_type: "general-purpose",
  description: "Poll worker messages",
  run_in_background: true,
  prompt: `You are a message polling agent for orchestrator ID: <ORCHESTRATOR_ID>

Your job is to poll for messages and EXIT when one arrives.

## Instructions

Loop:
1. Call the poll_messages MCP tool:
   mcp__plugin_tmux-worktree_worktree__poll_messages({ orchestrator_id: "<ORCHESTRATOR_ID>" })

2. If message_count > 0:
   - Output the message summary in this format:
     📬 Worker notification received!
     - Type: <message_type>
     - Summary: <content.summary>
     - PR URL: <content.pr_url> (if present)
     - Branch: <content.branch> (if present)
   - EXIT immediately (this notifies the orchestrator)

3. If no messages, wait 30 seconds: sleep 30

4. Repeat from step 1

IMPORTANT: Exit as soon as you receive a message so the orchestrator can process it.
`
})
```

**When the background agent exits**, you'll be notified. Read the output file to see the message, then:
1. Process the message (review PR, answer question, etc.)
2. Restart the background polling agent if more workers are running

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
| taskType | Task type: 'pr' (default), 'research', or 'docs' |

**IMPORTANT**: Always pass `orchestratorId` so automatic notifications are enabled.

**Examples:**

```
# Implementation task (will auto-notify when PR is created)
mcp__plugin_tmux-worktree_worktree__start_worktree_session({
  branch: "feat/add-auth",
  planMode: true,
  orchestratorId: "orch_abc12345",
  taskType: "pr",
  prompt: "Objective: Add user authentication..."
})

# Research task (worker should use send_completion manually)
mcp__plugin_tmux-worktree_worktree__start_worktree_session({
  branch: "research/skill-visibility",
  planMode: true,
  orchestratorId: "orch_abc12345",
  taskType: "research",
  prompt: "Objective: Research why plugin skills don't appear in slash commands..."
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

| Action | Tool/Command |
|--------|--------------|
| Create orchestrator session | `mcp__plugin_tmux-worktree_worktree__create_orchestrator_session` |
| Poll messages | `mcp__plugin_tmux-worktree_worktree__poll_messages` |
| Check status | `mcp__plugin_tmux-worktree_worktree__get_orchestrator_status` |
| Create worktree | `mcp__plugin_tmux-worktree_worktree__start_worktree_session` |
| List PRs | `gh pr list` |
| View PR | `gh pr view <number>` |
| Merge PR | `gh pr merge <number> --squash` |
| Update main | `git fetch origin && git pull origin main` |
| List merged worktrees | `git gtr clean --merged -n` |
| Remove worktree | `git gtr rm <branch> --yes` |

## Worker Tools (for manual notification)

Workers in research/docs tasks can manually notify using:

```
mcp__plugin_tmux-worktree_worktree__send_completion({
  summary: "Research complete: findings about X",
  details: "Detailed findings..."
})
```

This tool automatically reads the orchestrator ID from `.claude/.orchestrator-id` and the branch from git.

## Important Notes

- **Initialize first**: Always call `create_orchestrator_session` and start polling before delegating
- **Always pass `orchestratorId`**: This enables automatic notification hooks
- **Automatic PR detection**: When a worker runs `gh pr create`, the orchestrator is notified automatically
- **Session end detection**: If a worker session ends without creating a PR, you'll be notified
- Always use `planMode: true` when starting worker sessions
- Workers should create PRs, not push directly to main
- Review PRs before merging, even if briefly
- Clean up worktrees after merging to avoid clutter
- The orchestrator session stays on the main branch
- **Delegate research tasks too**—don't execute WebSearch or exploration yourself
- **Ambiguous but correct > Specific but wrong**; workers can investigate
