-- Migration: 004_remove_unused_columns
-- Description: Remove unused columns (tmux_session, cwd, event_data, tool_name, hostname)

ALTER TABLE events DROP COLUMN tmux_session;
ALTER TABLE events DROP COLUMN cwd;
ALTER TABLE events DROP COLUMN event_data;
ALTER TABLE events DROP COLUMN tool_name;
ALTER TABLE events DROP COLUMN hostname;
