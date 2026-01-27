# Plugin Development Conventions

## Plugin Manifest (plugin.json)
- Located at `.claude-plugin/plugin.json`
- Define hooks, version, description

## Component Types
- **Hooks**: Event-driven shell scripts (SessionStart, Stop, etc.)
- **Skills**: Non-invocable knowledge (SKILL.md with YAML frontmatter)
- **Commands**: User-invocable actions (Markdown with YAML frontmatter, declare allowed-tools)

## Configuration Hierarchy
env vars → settings file (~/.claude/<plugin>.local.md) → defaults
