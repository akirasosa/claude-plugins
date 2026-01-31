# Plugin Path Resolution Design

This document describes the path resolution problem in Claude Code plugins and the solution implemented in tmux-worktree v3.3.0.

## Problem Analysis

### Root Cause

The `orchestrator-mode.md` command documentation originally referenced a hardcoded path:

```bash
bun run ~/.claude/plugins/tmux-worktree/scripts/cli/wait-for-message.ts
```

But the actual installed path is:

```
~/.claude/plugins/cache/akirasosa-claude-plugins/tmux-worktree/3.2.0/scripts/cli/wait-for-message.ts
```

### Why This Happens

1. **`${CLAUDE_PLUGIN_ROOT}` substitution only works in `plugin.json`** - Claude Code substitutes this variable when executing hooks defined in the manifest
2. **Skills/commands are injected as prompt text** - The markdown content becomes part of Claude's context
3. **Claude follows documentation literally** - When it sees the command in the docs, it generates that exact bash command
4. **No runtime substitution in markdown** - Unlike hooks, there's no mechanism to resolve paths in skill content

### Impact

- Background message watcher fails with "Module not found"
- Orchestrator mode cannot receive automatic worker notifications
- Manual workaround requires users to know the actual cache path

## Research Findings

### Working Path Resolution Patterns

| Component | Method | Status |
|-----------|--------|--------|
| Hook commands (`plugin.json`) | `${CLAUDE_PLUGIN_ROOT}` substitution | Works |
| TypeScript hooks | `process.env.CLAUDE_PLUGIN_ROOT` | Works |
| MCP server args | `${CLAUDE_PLUGIN_ROOT}` in args array | Works |
| Git hooks | Absolute paths via `ensure-gtrconfig.ts` | Works |

### Problematic Patterns

| Component | Issue |
|-----------|-------|
| Skills/commands markdown | No path substitution mechanism |
| CLI tools in documentation | Hardcoded paths become stale |

### Existing MCP Tools

The plugin already had these MCP tools:

- `start_worktree_session` - Creates worktree + starts Claude
- `create_orchestrator_session` - Creates orchestrator session
- `send_message` - Worker sends message to orchestrator
- `poll_messages` - Instant poll (non-blocking)
- `get_orchestrator_status` - Check unread count

The `poll_messages` tool is non-blocking (returns immediately). The missing functionality was **blocking wait with timeout**.

## Solution: `wait_for_messages` MCP Tool

### Why This Approach

1. **No path resolution needed** - MCP tools are called by name, not path
2. **Reuses existing logic** - The `wait-for-message.ts` CLI has the complete implementation
3. **Aligned with plugin architecture** - Extends the existing MCP server
4. **Zero user setup** - Works immediately after plugin install
5. **Future-proof** - Survives plugin updates and path changes

### Alternative Approaches Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **MCP tool (chosen)** | No paths, native integration | Implementation effort | Best fit |
| Environment variable injection | Simple | Shell modification, persistence issues | Fragile |
| Dynamic path resolution | Accurate | Adds jq/bun dependency to docs | Complex |
| Symlink creation | Familiar pattern | Conflicts with plugin system | Hacky |
| Task subagent polling | Uses existing tools | Different execution model | Workaround |

## Implementation Details

### New MCP Tool Definition

```typescript
{
  name: "wait_for_messages",
  description: "Waits for worker messages to arrive. Blocks until messages received or timeout. Uses fs.watch() for instant notification.",
  inputSchema: {
    type: "object",
    properties: {
      orchestrator_id: {
        type: "string",
        description: "The orchestrator session ID to wait for messages",
      },
      timeout_seconds: {
        type: "number",
        description: "Timeout in seconds (default: 300, max: 600)",
      },
    },
    required: ["orchestrator_id"],
  },
}
```

### Tool Behavior

1. **Validates orchestrator exists** - Returns error if session not found
2. **Checks for existing messages** - Returns immediately if messages already waiting
3. **Waits with fs.watch()** - Uses filesystem notifications for instant response
4. **Fallback polling** - 30-second interval as backup for missed fs events
5. **Timeout handling** - Returns timeout status after specified duration (capped at 600s)

### Return Value Structure

```json
{
  "status": "messages" | "timeout" | "error",
  "orchestrator_id": "orch_xxx",
  "message_count": 1,
  "messages": [
    {
      "id": "msg_xxx",
      "message_type": "task_complete",
      "worker_id": "worker_xxx",
      "content": {
        "summary": "PR created for feature",
        "pr_url": "https://github.com/...",
        "branch": "feat/add-feature"
      },
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

## Files Modified

1. **`src/mcp/tools/wait-for-messages.ts`** (NEW) - Blocking wait implementation
2. **`src/mcp/server.ts`** - Register new tool, bump version to 3.3.0
3. **`commands/orchestrator-mode.md`** - Replace CLI with MCP tool call
4. **`.claude-plugin/plugin.json`** - Bump version to 3.3.0

## Usage in Documentation

### Before (broken)

```
Task({
  subagent_type: "Bash",
  prompt: `Run: bun run ~/.claude/plugins/tmux-worktree/scripts/cli/wait-for-message.ts \
    --orchestrator-id=<ID> --timeout=600`
})
```

### After (working)

```
Task({
  subagent_type: "general-purpose",
  prompt: `Call the MCP tool:
mcp__plugin_tmux-worktree_worktree__wait_for_messages({
  orchestrator_id: "<ID>",
  timeout_seconds: 600
})`
})
```

## Key Insight

The fundamental issue is that Claude Code plugins have two different execution contexts:

1. **Hook context** - Executed by Claude Code runtime with variable substitution
2. **Prompt context** - Injected as text into Claude's context without processing

MCP tools elegantly bridge this gap because they're invoked by name through the MCP protocol, not by filesystem path. This makes them immune to path resolution issues.

## Future Considerations

For future plugin development, prefer MCP tools over CLI scripts when the functionality needs to be referenced in documentation or skill content. Reserve CLI scripts for:

- Development/debugging tools
- One-off operations
- Tools meant for direct human use

Use MCP tools for:

- Functionality referenced in commands/skills
- Operations Claude needs to invoke programmatically
- Any feature that should work regardless of installation location
