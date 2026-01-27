---
name: event-log
description: Show active Claude Code sessions with tmux jump commands
allowed-tools:
  - Bash
---

# Event Log Command

Query the Claude Code events database and show active sessions.

## Instructions

1. Run the following SQL query against `~/.local/share/claude-code/events.db`:

```sql
SELECT
  session_id,
  event_type,
  created_at,
  project_dir,
  summary,
  tmux_session,
  tmux_window
FROM events e1
WHERE created_at = (
  SELECT MAX(created_at) FROM events e2
  WHERE e2.session_id = e1.session_id
)
AND event_type <> 'SessionEnd'
ORDER BY created_at DESC;
```

2. Format the output as a Markdown table with the following columns:
   - **Project**: Extract the last directory name from `project_dir` (e.g., `/path/to/myproject` -> `myproject`)
   - **Status**: The `event_type` value
   - **Time**: Format `created_at` as `HH:MM` in local time
   - **Summary**: The `summary` value (truncate if too long)
   - **Jump**: If `tmux_session` and `tmux_window` exist, show: `` `tmux switch-client -t 'session:window'` ``

3. If the database doesn't exist or is empty, inform the user that no sessions have been recorded yet.

## Example Output

```
| Project | Status | Time | Summary | Jump |
|---------|--------|------|---------|------|
| dotfiles | Stop | 10:30 | タスク完了 | `tmux switch-client -t 'dotfiles:1'` |
| work | Notification | 10:25 | 入力待ち | `tmux switch-client -t 'work:2'` |
| claude-plugins | SessionStart | 10:20 | Session started | `tmux switch-client -t 'plugins:0'` |
```
