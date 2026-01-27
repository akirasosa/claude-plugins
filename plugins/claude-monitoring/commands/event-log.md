---
name: event-log
description: Show active Claude Code sessions with tmux jump commands
allowed-tools:
  - Bash
---

# Event Log Command

Query the Claude Code events database and show active sessions.

## Instructions

1. Run the following SQL query against `~/.local/share/claude-monitoring/events.db`:

```sql
SELECT
  session_id,
  event_type,
  created_at,
  project_dir,
  summary,
  tmux_session,
  tmux_window,
  git_branch
FROM events e1
WHERE created_at = (
  SELECT MAX(created_at) FROM events e2
  WHERE e2.session_id = e1.session_id
)
AND event_type IN ('Stop', 'Notification')
AND NOT EXISTS (
  SELECT 1 FROM events e3
  WHERE e3.session_id = e1.session_id
  AND e3.event_type = 'SessionEnd'
)
ORDER BY created_at DESC;
```

2. Format the output as a Markdown table with the following columns:
   - **Project**: Use `tmux_session` if available, otherwise extract the last directory name from `project_dir`
   - **Status**: The `event_type` value
   - **Time**: Format `created_at` as `HH:MM` in local time
   - **Branch**: The `git_branch` value (show `-` if empty)
   - **Summary**: The `summary` value (truncate if too long)
   - **Jump**: If `tmux_session` and `tmux_window` exist, show: `` `tmux switch-client -t 'session:window'` ``

3. If the database doesn't exist or is empty, inform the user that no sessions have been recorded yet.

## Example Output

```
| Project | Status | Time | Branch | Summary | Jump |
|---------|--------|------|--------|---------|------|
| dotfiles | Stop | 10:30 | main | タスク完了 | `tmux switch-client -t 'dotfiles:1'` |
| work | Notification | 10:25 | feature/auth | 入力待ち | `tmux switch-client -t 'work:2'` |
```
