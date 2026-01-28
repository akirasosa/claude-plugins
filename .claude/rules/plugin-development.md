# Plugin Development Conventions

## Plugin Manifest (plugin.json)
- Located at `.claude-plugin/plugin.json`
- Define hooks, version, description

## Component Types
- **Hooks**: Event-driven shell scripts
- **Skills**: Non-invocable knowledge (SKILL.md with YAML frontmatter)
- **Commands**: User-invocable actions (Markdown with YAML frontmatter, declare allowed-tools)

## Hook Events
- `SessionStart`: Claude Code session begins
- `Stop`: Claude pauses (awaiting input or completed task)
- `Notification`: Claude sends a notification
- `SessionEnd`: Claude Code session terminates

## Process Tracking
Hooks can capture and track process PIDs for safer session management:

```bash
# Capture PID in SessionStart hook
CLAUDE_PID=$PPID
```

Database stores `process_pid` in SessionStart events. Use `getSessionStatus()` to check if a session's process is still running before operations like deletion.

## CLI Architecture
- Entry point: `plugins/claude-monitoring/src/cli.ts`
- Commands: `record`, `list`, `delete`, `web`
- Database: SQLite in `~/.claude-monitoring/events.db`

## Configuration Hierarchy
env vars → settings file (~/.claude/<plugin>.local.md) → defaults
