---
name: event-log
description: Show active Claude Code sessions with tmux jump commands
allowed-tools:
  - Bash
---

# Event Log Command

Query the Claude Code events database and show active sessions.

## Instructions

1. Run the following command to get active sessions as JSON:

```bash
~/.claude/plugins/claude-monitoring/bin/claude-monitoring sessions --format json
```

2. Parse the JSON output and format it as a Markdown table with the following columns:
   - **Project**: The `project_name` value
   - **Status**: The `event_type` value
   - **Time**: Format `created_at` as `HH:MM` in local time
   - **Branch**: The `git_branch` value (show `-` if null)
   - **Summary**: The `summary` value (truncate if too long)
   - **Jump**: If `tmux_command` exists, show it in backticks

3. If the JSON array is empty, inform the user that no active sessions were found.

## Example Output

```
| Project | Status | Time | Branch | Summary | Jump |
|---------|--------|------|--------|---------|------|
| dotfiles | Stop | 10:30 | main | Task completed | `tmux switch-client -t '@1'` |
| work | Notification | 10:25 | feature/auth | Waiting for input | `tmux switch-client -t '@2'` |
```
