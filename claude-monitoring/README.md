# Claude Monitoring Plugin

Claude Code event monitoring plugin with desktop notifications and database logging.

## Features

- **Desktop Notifications**: Get notified when Claude Code tasks complete or require input
- **Database Logging**: All events are logged to SQLite for tracking and querying
- **Session Tracking**: Track active sessions with `/event-log` command
- **Tmux Integration**: Quick jump to Claude Code sessions running in tmux
- **Auto Cleanup**: Records older than 30 days are automatically deleted

## Installation

```bash
claude plugin install /path/to/claude-monitoring
```

Or for development:

```bash
claude --plugin-dir /path/to/claude-monitoring
```

## Events Tracked

| Event | Notification | Description |
|-------|--------------|-------------|
| `Stop` | Yes | Task completed |
| `Notification` | Yes | Waiting for user input |
| `SessionStart` | No | Session started |
| `SessionEnd` | No | Session ended |

## Commands

### /event-log

Show active Claude Code sessions with tmux jump commands.

```
| Project | Status | Time | Summary | Jump |
|---------|--------|------|---------|------|
| dotfiles | Stop | 10:30 | タスク完了 | `tmux switch-client -t 'dotfiles:1'` |
```

## Configuration

### GCP Project (for Gemini API summaries)

Summary generation uses Gemini API via Google Cloud. Configure in one of two ways:

**Option 1: Environment variable**
```bash
export GEMINI_GCP_PROJECT=your-project-id
export GEMINI_GCP_LOCATION=asia-northeast1  # optional, defaults to asia-northeast1
```

**Option 2: Settings file** (`~/.claude/claude-monitoring.local.md`)
```yaml
---
gcp_project: your-project-id
gcp_location: asia-northeast1
---
```

If neither is configured, the gcloud default project (`gcloud config get-value project`) will be used. If no project is available at all, notifications will show default messages ("Task completed", "Waiting for input") instead of AI-generated summaries.

**Note**: Add `claude-monitoring.local.md` to `.gitignore` as it may contain project-specific settings.

## Data Storage

- **Database**: `~/.local/share/claude-monitoring/events.db`
- **Retention**: 30 days (older records are automatically deleted)

## Dependencies

- `jq` - JSON parsing
- `sqlite3` - Database operations
- `uuidgen` - UUID generation
- `gcloud` - Gemini API authentication (optional - only for summaries)
- `osascript` (macOS) or `notify-send` (Linux) - Desktop notifications

## Database Schema

```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    project_dir TEXT,
    cwd TEXT,
    event_data TEXT,
    tool_name TEXT,
    summary TEXT,
    tmux_session TEXT,
    tmux_window INTEGER,
    hostname TEXT,
    date_part TEXT
);
```

### event_data Fields

The `event_data` column stores only essential fields to minimize database size:
- `session_id`
- `project_directory`
- `cwd`
- `tool_name`
- `reason`

## Migration from Existing Setup

If you were using the scripts from dotfiles (`~/.claude/hooks/notification.sh`), remove the hook configuration from `~/.claude/settings.json` after installing this plugin to avoid duplicate notifications.

**Database Migration**: If you have an existing database at `~/.local/share/claude-code/events.db`, you can migrate it manually:

```bash
# Move old database to new location
mkdir -p ~/.local/share/claude-monitoring
mv ~/.local/share/claude-code/events.db ~/.local/share/claude-monitoring/events.db
```
