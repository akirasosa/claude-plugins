#!/usr/bin/env bash
# Called by SessionStart hook to configure gtr preRemove hook via git config --local
# Uses git config --local for personal override (higher precedence than .gtrconfig)
set -euo pipefail

# CLAUDE_PLUGIN_ROOT is set when the hook runs
HOOK_PATH="${CLAUDE_PLUGIN_ROOT}/scripts/cleanup"

# Check current local config
current_hook=$(git config --local gtr.hook.preRemove 2>/dev/null || true)

if [[ "$current_hook" == "$HOOK_PATH" ]]; then
    exit 0
fi

git config --local gtr.hook.preRemove "$HOOK_PATH"
echo "Configured gtr.hook.preRemove in .git/config"
