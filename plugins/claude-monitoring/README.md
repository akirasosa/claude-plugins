# Claude Monitoring Plugin

Claude Code event monitoring plugin with desktop notifications and database logging.

## Overview

This plugin tracks Claude Code events and provides desktop notifications when tasks complete or require input. All events are logged to a SQLite database for session tracking and querying.

## Prerequisites

- **bun**: TypeScript runtime
- **gcloud**: Gemini API authentication (optional - only for summaries)
- **osascript** (macOS) or **notify-send** (Linux): Desktop notifications

## Installation

```bash
claude plugin install /path/to/claude-monitoring
```

For development:

```bash
claude --plugin-dir /path/to/claude-monitoring
```

## What it does

- **Event Logging**: Records all Claude Code events to SQLite database
- **Desktop Notifications**: Alerts when tasks complete or require input
- **Session Tracking**: Monitor active sessions via Web UI
- **Tmux Integration**: Quick jump to Claude Code sessions running in tmux
- **Auto Cleanup**: Records older than 30 days are automatically deleted
- **Inbox System**: Inter-session messaging for orchestrator-worker communication

## Events Tracked

| Event | Notification | Description |
|-------|--------------|-------------|
| `Stop` | Yes | Task completed |
| `Notification` | Yes | Waiting for user input |
| `SessionStart` | No | Session started |
| `SessionEnd` | No | Session ended |

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

## CLI Commands

### Inbox (Orchestrator-Worker Communication)

The inbox system enables communication between orchestrator and worker Claude Code sessions:

```bash
# Check for unread messages
bun run src/cli.ts inbox check <session_id>

# Add a message (from worker)
echo '{"worker_branch":"feat/xxx","pr_url":"..."}' | bun run src/cli.ts inbox add <session_id>

# Mark messages as read
bun run src/cli.ts inbox mark-read <session_id>

# Clear all messages
bun run src/cli.ts inbox clear <session_id>

# List all inbox files
bun run src/cli.ts inbox list
```

**Note**: The inbox system is primarily used by the `tmux-worktree` plugin's orchestrator mode.

## Data Storage

- **Database**: `~/.local/share/claude-monitoring/events.db`
- **Inbox**: `~/.claude/orchestrator-inbox/` (JSON files)
- **Retention**: 30 days (older records are automatically deleted)

## Database Schema

```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    project_dir TEXT,
    summary TEXT,
    tmux_window_id TEXT,
    date_part TEXT,
    git_branch TEXT
);
```

## Migration from Existing Setup

If you were using the scripts from dotfiles (`~/.claude/hooks/notification.sh`), remove the hook configuration from `~/.claude/settings.json` after installing this plugin to avoid duplicate notifications.

**Database Migration**: If you have an existing database at `~/.local/share/claude-code/events.db`, you can migrate it manually:

```bash
mkdir -p ~/.local/share/claude-monitoring
mv ~/.local/share/claude-code/events.db ~/.local/share/claude-monitoring/events.db
```

## Uninstalling

```bash
claude plugin uninstall claude-monitoring
```
