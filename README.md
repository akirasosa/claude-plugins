# Claude Plugins

A collection of plugins for Claude Code.

## Installation

### Add Marketplace

```bash
claude plugin marketplace add https://github.com/akirasosa/claude-plugins
```

### Install Plugins

```bash
claude plugin install <plugin-name>
```

See each plugin's README for detailed usage.

## Available Plugins

| Plugin | Description |
|--------|-------------|
| [tmux-worktree](./plugins/tmux-worktree/) | Git worktree workflow with tmux integration |

## Uninstalling

```bash
# Remove a plugin
claude plugin uninstall <plugin-name>

# Remove marketplace
claude plugin marketplace remove akirasosa-claude-plugins
```
