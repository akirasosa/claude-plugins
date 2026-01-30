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

## Using the Web UI (Optional)

The `claude-monitoring` plugin can send events to a Web UI for real-time visualization. This is entirely optional - the plugins work great without it.

### Download

Download the pre-built binary for your platform from [GitHub Releases](https://github.com/akirasosa/claude-plugins/releases):

- `claude-monitoring-darwin-arm64` (57 MB) - macOS Apple Silicon
- `claude-monitoring-darwin-x64` (61 MB) - macOS Intel
- `claude-monitoring-linux-x64` (97 MB) - Linux x64

### Run

```bash
chmod +x claude-monitoring-<platform>
./claude-monitoring-<platform>
```

The server starts on port **3847** by default. Use `--port` to change:

```bash
./claude-monitoring-darwin-arm64 --port 8080
```

## Tips

### For tmux-worktree Users

- **Must run inside a tmux session** - The plugin creates new tmux windows for worktrees
- **Requires git-worktree-runner** - Install from: https://github.com/coderabbitai/git-worktree-runner

### For Serena Users

If you use Serena for semantic code navigation, include the `.serena` directory when creating worktrees:

```bash
git config --global --add gtr.copy.includeDirs .serena
```

## Available Plugins

| Plugin | Description |
|--------|-------------|
| [tmux-worktree](./plugins/tmux-worktree/) | Git worktree workflow with tmux integration |
| [claude-monitoring](./plugins/claude-monitoring/) | Claude Code event monitoring with desktop notifications and DB logging |

## Uninstalling

```bash
# Remove a plugin
claude plugin uninstall <plugin-name>

# Remove marketplace
claude plugin marketplace remove akirasosa-claude-plugins
```
