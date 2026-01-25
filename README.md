# Claude Plugins

A collection of plugins for Claude Code.

## Installation

### Add Marketplace

```bash
claude plugin marketplace add https://github.com/akirasosa/claude-plugins
```

### Install Plugins

```bash
# tmux-worktree: Git worktree workflow with tmux integration
claude plugin install tmux-worktree --scope local
```

## Available Plugins

| Plugin | Description |
|--------|-------------|
| [tmux-worktree](./plugins/tmux-worktree/) | Git worktree workflow with tmux integration for parallel Claude Code sessions |

## Uninstalling

```bash
# Remove a plugin
claude plugin uninstall tmux-worktree --scope local

# Remove marketplace
claude plugin marketplace remove akirasosa-claude-plugins
```
