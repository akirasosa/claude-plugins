-- Migration: 002_add_git_branch
-- Description: Add git_branch column for tracking git branch per event

ALTER TABLE events ADD COLUMN git_branch TEXT;
