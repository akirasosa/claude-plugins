# Claude Plugins

A collection of plugins for Claude Code.

## Prerequisites

- [Bun](https://bun.sh/) - Required to run plugin scripts

## Quick Start

```bash
# Add marketplace
claude plugin marketplace add https://github.com/akirasosa/claude-plugins

# Install plugins
claude plugin install claude-monitoring
claude plugin install tmux-worktree
```

## Available Plugins

| Plugin | Description | Requirements |
|--------|-------------|--------------|
| [claude-monitoring](./plugins/claude-monitoring/) | Event monitoring with desktop notifications and DB logging | - |
| [tmux-worktree](./plugins/tmux-worktree/) | Git worktree workflow with tmux integration | tmux, [git-worktree-runner](https://github.com/coderabbitai/git-worktree-runner) |

## Web UI (Optional)

```bash
git clone https://github.com/akirasosa/claude-plugins
cd claude-plugins && bun install
bun run --cwd plugins/claude-monitoring/web start  # starts on port 3847
```

Or download pre-built binary from [Releases](https://github.com/akirasosa/claude-plugins/releases).

## Tips

**Serena users**: Include `.serena` in worktrees: `git config --global --add gtr.copy.includeDirs .serena`

## Uninstalling

```bash
claude plugin uninstall claude-monitoring
claude plugin marketplace remove akirasosa-claude-plugins
```
