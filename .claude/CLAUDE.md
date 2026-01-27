# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Plugin Marketplace - hosts plugins for enhancing Claude Code workflow (tmux-worktree, claude-monitoring).

## Development Commands

### claude-monitoring plugin
cd plugins/claude-monitoring && bun test                        # Run tests
cd plugins/claude-monitoring/web && bun --watch run server.ts   # Dev server
bun run plugins/claude-monitoring/src/cli.ts <command>          # CLI execution

## Architecture

- Multi-plugin monorepo under `plugins/`
- Each plugin has `.claude-plugin/plugin.json` manifest
- Plugins integrate via Claude Code hooks: SessionStart, Stop, Notification, SessionEnd
- `${CLAUDE_PLUGIN_ROOT}` substituted at runtime for plugin paths
