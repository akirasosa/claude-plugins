-- Migration: 003_add_window_id
-- Description: Replace tmux_window with tmux_window_id for stable window identification
-- The window_id (e.g., @75) is immutable unlike window index which can change

ALTER TABLE events ADD COLUMN tmux_window_id TEXT;
ALTER TABLE events DROP COLUMN tmux_window;
