# Claude Plugins

A collection of plugins for Claude Code.

## Quick Start

```bash
# Add marketplace
claude plugin marketplace add https://github.com/akirasosa/claude-plugins

# Install plugins
claude plugin install claude-monitoring
claude plugin install tmux-worktree
```

## Available Plugins

| Plugin | Description |
|--------|-------------|
| [claude-monitoring](./plugins/claude-monitoring/) | Event monitoring with desktop notifications and DB logging |
| [tmux-worktree](./plugins/tmux-worktree/) | Git worktree workflow with tmux integration |

## Web UI (Optional)

Download binary from [Releases](https://github.com/akirasosa/claude-plugins/releases) and run:

```bash
chmod +x claude-monitoring-darwin-arm64
./claude-monitoring-darwin-arm64  # starts on port 3847
```

## Tips

**tmux-worktree**: Must run inside tmux. Requires [git-worktree-runner](https://github.com/coderabbitai/git-worktree-runner).

**Serena users**: Include `.serena` in worktrees: `git config --global --add gtr.copy.includeDirs .serena`

## Uninstalling

```bash
claude plugin uninstall claude-monitoring
claude plugin marketplace remove akirasosa-claude-plugins
```
