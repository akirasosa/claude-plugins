# MCP Tool Namespace Improvement

## Problem Statement

MCP tools from plugins displayed with redundant naming when the plugin name matched the MCP server name:

```
mcp__plugin_tmux-worktree_tmux-worktree__start_worktree_session
             ^^^^^^^^^^^^:^^^^^^^^^^^^
             (plugin)     (server) - REDUNDANT
```

This redundancy reduced readability and increased token usage in tool invocations.

## Research Findings

### Current Structure (Before Fix)

| File | Value |
|------|-------|
| `plugins/tmux-worktree/.claude-plugin/plugin.json` | `mcpServers: { "tmux-worktree": {...} }` |
| `plugins/tmux-worktree/src/mcp/server.ts` | `Server({ name: "tmux-worktree", ... })` |

### Plugins in Repository

| Plugin | Has MCP Server? | Redundancy Issue? |
|--------|----------------|-------------------|
| `tmux-worktree` | Yes | **Yes** (fixed) |
| `claude-monitoring` | No (hooks only) | N/A |

## Solution Implemented

Changed the MCP server key from `"tmux-worktree"` to `"worktree"`.

**Result:**
- Before: `mcp__plugin_tmux-worktree_tmux-worktree__start_worktree_session`
- After: `mcp__plugin_tmux-worktree_worktree__start_worktree_session`

### Changes Made

1. **plugin.json** - Updated MCP server key
2. **server.ts** - Updated server name and bumped version to 2.1.0
3. **README.md** - Updated tool invocation examples
4. **commands/orchestrator-mode.md** - Updated all tool references

## Trade-offs Analysis

| Aspect | Impact |
|--------|--------|
| **Readability** | Improved - no redundancy |
| **Backwards Compatibility** | Breaking change for existing tool invocations |
| **Discoverability** | Shorter tool paths |
| **Multi-server Ready** | Naturally supports adding more servers |

## Why This Approach

1. **Immediate fix** - No platform changes required
2. **Plugin is early-stage** - Limited adoption, safe to change
3. **Semantic naming** - "worktree" describes the capability
4. **Future-proof** - Can add more servers later (e.g., `"session"`, `"monitoring"`)

## Alternatives Considered

### Option A: Keep As-Is
- Accept redundancy as the cost of a consistent naming scheme
- Appropriate if backwards compatibility is critical

### Option B: Claude Code Platform Change
- Request Claude Code to auto-flatten single-server plugins
- Would solve globally but requires platform changes

## Naming Convention Guidelines for Future Plugins

For new plugins, follow this pattern:

| Component | Purpose | Example |
|-----------|---------|---------|
| **Plugin name** | Overall plugin purpose | `tmux-worktree` |
| **Server key** | Specific capability domain | `worktree`, `session`, `api` |
| **Tool name** | Specific action | `start_worktree_session` |

**Avoid:**
- Repeating the plugin name in the server key
- Generic server names like `server` or `main`

**Prefer:**
- Descriptive capability names
- Names that would make sense if more servers are added later
