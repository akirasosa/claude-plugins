# Plugin Skill Slash Command Visibility Issue

## Summary

Plugin skills do not appear in Claude Code's slash command autocomplete (`/`), even though they are properly loaded and functional. This is a known bug affecting all plugin developers and users since Claude Code v2.1.3.

**Key distinction:**
- **Project/Personal skills** (in `~/.claude/skills/` or `.claude/skills/`) → Appear in `/` autocomplete ✅
- **Plugin skills** (from marketplace or directory-based plugins) → Do NOT appear in `/` autocomplete ❌

The skills ARE loaded and functional—they can be invoked via the `Skill` tool or by typing the full command name. The issue is purely **autocomplete visibility**.

## Symptoms

- Skills installed via plugins don't appear when typing `/` in the command prompt
- Skills from `~/.claude/skills/` appear and work correctly
- Plugin skills ARE functional when invoked via:
  - The `Skill` tool (e.g., `Skill("plugin-name:skill-name")`)
  - Typing the full command name directly
- `/help` shows the skills exist
- `/context` may show skills are loaded into context
- No error messages indicate a problem

## Root Cause (Technical Analysis)

The root cause was identified by contributor [@aaaaaandrew](https://github.com/aaaaaandrew) in [Issue #17271](https://github.com/anthropics/claude-code/issues/17271):

**The `name` frontmatter field strips the plugin namespace prefix.**

When a skill file has a `name` field in its YAML frontmatter:
1. Claude Code strips the plugin namespace prefix
2. Uses the `name` field value as the command identifier
3. Since skills **require** a `name` field (part of the skill format), they lose their plugin prefix
4. Without the proper `plugin:skill` prefix, the autocomplete system cannot match them

### Comparison Table

| File Format | Frontmatter | Result | Has Prefix? | In Autocomplete? |
|-------------|-------------|--------|-------------|------------------|
| Command (`.md`) | `description` only | `/plugin:name` | ✅ Yes | ✅ Yes |
| Skill (`SKILL.md`) | `name` + `description` | `/name` | ❌ No | ❌ No |

**Expected behavior:** `name: my-skill` in plugin `foo` → `/foo:my-skill`
**Actual behavior:** `name: my-skill` in plugin `foo` → `/my-skill` (prefix lost, breaks autocomplete)

## Affected Versions

- **Claude Code v2.1.3+** (when slash commands and skills were merged)
- All platforms (primarily reported on macOS)
- Both marketplace plugins and directory-based plugins

## Workarounds

### Method 1: Symlink (Simple)

Create a symlink from the plugin skill to your personal skills directory:

```bash
# Create the skills directory if it doesn't exist
mkdir -p ~/.claude/skills

# Create symlink (adjust paths for your plugin)
ln -s /path/to/marketplace/plugins/my-plugin/skills/my-skill ~/.claude/skills/my-skill
```

**Example for a marketplace plugin:**
```bash
ln -s ~/.claude/marketplace/plugins/my-plugin/skills/my-skill ~/.claude/skills/my-plugin-my-skill
```

**Pros:**
- Simple, one-line fix
- No changes to plugin files required

**Cons:**
- Must be done manually for each skill
- Symlink must be recreated if plugin is reinstalled
- Doesn't preserve the `plugin:skill` namespace in autocomplete

### Method 2: Dual Registration (Advanced)

For skills that need both **auto-activation** (via description matching) AND **slash menu visibility** with proper prefix:

1. **Remove** the `name` field from `SKILL.md` frontmatter
2. **Rename** `SKILL.md` to `<skillname>.md` (e.g., `sre.md`)
3. **Create symlink** for backward compatibility:
   ```bash
   ln -s <skillname>.md SKILL.md
   ```
4. **Update** `marketplace.json` to register as both skill and command:
   ```json
   {
     "skills": ["./skills/sre"],
     "commands": ["./skills/sre/sre.md"]
   }
   ```

**Pros:**
- Preserves proper `plugin:skill` namespace
- Works with both auto-activation and manual invocation
- Appears correctly in autocomplete

**Cons:**
- Requires file renaming and symlinks
- More complex setup per skill
- Must modify frontmatter

### Platform-Specific Notes

#### macOS / Linux
Symlinks work natively. Use the commands above directly.

#### Windows
May require Git configuration for symlinks:
```bash
git config --global core.symlinks true
```

Note: Some Windows environments (especially corporate/AD-managed) may have additional restrictions on symlink creation.

#### VSCode Extension
One user reported the VSCode extension may work without the workaround, but this is unconfirmed. Test in your environment.

## Related GitHub Issues

| Issue | Title | Status | Upvotes | Key Info |
|-------|-------|--------|---------|----------|
| [#17271](https://github.com/anthropics/claude-code/issues/17271) | Project skill display in slash command but plugin skill doesn't | Open | 25+ | **Primary issue**, has root cause analysis |
| [#18949](https://github.com/anthropics/claude-code/issues/18949) | Skills from marketplace plugins don't appear in slash command autocomplete | Open | 30+ | Marketplace-specific, many duplicates |
| [#16575](https://github.com/anthropics/claude-code/issues/16575) | User-defined plugin skills not appearing in available_skills | Closed (dup) | - | Namespace prefix issue |
| [#14929](https://github.com/anthropics/claude-code/issues/14929) | Commands from directory-based marketplaces not discovered | Open | - | Directory-based marketplace specific |
| [#14733](https://github.com/anthropics/claude-code/issues/14733) | User-provided skills in ~/.claude/skills/ not appearing in /skills command | Open | - | UI listing issue |
| [#20415](https://github.com/anthropics/claude-code/issues/20415) | Unknown fields in plugin.json break skill registration | Open | - | Silent partial failure |
| [#14836](https://github.com/anthropics/claude-code/issues/14836) | /skills command doesn't find skills in symlinked directories | Open | - | Symlink detection |
| [#15065](https://github.com/anthropics/claude-code/issues/15065) | Skill takes precedence over slash command with same name | Open | - | Naming collision |

## Impact Assessment

### Affected Users
- Plugin developers creating custom plugins
- Teams using private/local marketplaces
- Users installing community plugins from the marketplace
- Anyone expecting skills to appear in autocomplete after installation

### User Experience Impact
- **Confusion** about whether skills are properly installed
- **Need for manual workarounds** to enable autocomplete
- **Inconsistent behavior** between project skills and plugin skills
- **Reduced discoverability** of plugin features
- **Support burden** as users report "broken" plugins

### Official Plugins Also Affected
Even official plugins like `superpowers@claude-plugins-official` are partially affected for some skills, demonstrating this is a platform-level issue, not a plugin configuration problem.

## Debugging Tips

If your plugin skills aren't appearing:

1. **Check `/help`** - Skills should be listed even if not in autocomplete
2. **Run `/context`** - Verify skills are loaded into context budget
3. **Check character budget** - If many skills exceed 15,000 character budget:
   - Run `/context` to check for warnings
   - Increase with `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable
4. **Verify plugin structure**:
   - `skills/<skill-name>/SKILL.md` format required
   - YAML frontmatter must include `name` and `description`
5. **Test direct invocation** - Try invoking via `Skill` tool to confirm the skill is loaded

## Status

**Open bug with no announced fix timeline.**

Community workarounds are available (see above). The issue has significant engagement (25-30+ upvotes across related issues) and multiple duplicate reports, indicating widespread impact.

## References

- [Skills Documentation](https://code.claude.com/docs/en/skills) - Official Claude Code skills documentation
- [Plugins Documentation](https://code.claude.com/docs/en/plugins) - Official Claude Code plugins documentation
- [Issue #17271](https://github.com/anthropics/claude-code/issues/17271) - Primary discussion with root cause analysis
- [Issue #18949](https://github.com/anthropics/claude-code/issues/18949) - Marketplace-specific discussion

---

*Last updated: January 2026*
