# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Plugin Marketplace - hosts plugins for enhancing Claude Code workflow (tmux-worktree, claude-monitoring).

## Development Commands

### Root project commands
```bash
bun run lint           # Check with Biome (linting + formatting)
bun run lint:fix       # Auto-fix lint issues
bun run format         # Format code with Biome
bun run typecheck      # TypeScript type checking
bun run knip           # Dead code detection
bun run knip:fix       # Auto-remove unused exports
bun run type-coverage  # Check type coverage (95% minimum)
```

### claude-monitoring plugin
```bash
cd plugins/claude-monitoring && bun test                        # Run tests
cd plugins/claude-monitoring && bun test --watch                # Watch mode
cd plugins/claude-monitoring/web && bun --watch run server.ts   # Dev server
bun run plugins/claude-monitoring/src/cli.ts <command>          # CLI execution
```

## Architecture

- Multi-plugin monorepo under `plugins/`
- Each plugin has `.claude-plugin/plugin.json` manifest
- Plugins integrate via Claude Code hooks: SessionStart, Stop, Notification, SessionEnd
- `${CLAUDE_PLUGIN_ROOT}` substituted at runtime for plugin paths

## Quality Standards

- **Biome**: Linting and formatting (see `biome.json`)
- **TypeScript**: Strict mode with 95% type coverage minimum
- **Knip**: Dead code detection for unused exports/dependencies
- **Pre-commit**: 9 automated checks on commit (see `.pre-commit-config.yaml`)

## Worktree Automation

The `.gtrconfig` file automatically runs `bun install` when creating new git worktrees, ensuring dependencies are ready immediately.
