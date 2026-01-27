-- Migration: 003_add_window_id
-- Description: Add tmux_window_id column for stable window identification
-- The window_id (e.g., @75) is immutable unlike window index which can change

ALTER TABLE events ADD COLUMN tmux_window_id TEXT;
