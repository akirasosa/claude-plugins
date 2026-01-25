#!/usr/bin/env bash
# Called by SessionStart hook to configure gtr hooks via git config --local
# Uses git config --local for personal override (higher precedence than .gtrconfig)
set -euo pipefail

# CLAUDE_PLUGIN_ROOT is set when the hook runs

# Configure preRemove hook (cleanup tmux windows)
PREREMOVE_HOOK_PATH="${CLAUDE_PLUGIN_ROOT}/scripts/cleanup"
current_preremove=$(git config --local gtr.hook.preRemove 2>/dev/null || true)

if [[ "$current_preremove" != "$PREREMOVE_HOOK_PATH" ]]; then
    git config --local gtr.hook.preRemove "$PREREMOVE_HOOK_PATH"
    echo "Configured gtr.hook.preRemove in .git/config"
fi

# Configure postCreate hook (setup symlinks)
POSTCREATE_HOOK_PATH="${CLAUDE_PLUGIN_ROOT}/scripts/setup-symlinks"
current_postcreate=$(git config --local gtr.hook.postCreate 2>/dev/null || true)

if [[ "$current_postcreate" != "$POSTCREATE_HOOK_PATH" ]]; then
    git config --local gtr.hook.postCreate "$POSTCREATE_HOOK_PATH"
    echo "Configured gtr.hook.postCreate in .git/config"
fi
