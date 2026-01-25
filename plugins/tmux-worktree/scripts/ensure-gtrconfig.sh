#!/usr/bin/env bash
# Called by SessionStart hook to configure .gtrconfig with preRemove hook
# Updates existing file or creates a minimal one if it doesn't exist
set -euo pipefail

GTRCONFIG=".gtrconfig"
# CLAUDE_PLUGIN_ROOT is set when the hook runs
HOOK_PATH="${CLAUDE_PLUGIN_ROOT}/scripts/cleanup"

# Create .gtrconfig with preRemove hook if it doesn't exist
if [[ ! -f "$GTRCONFIG" ]]; then
    cat > "$GTRCONFIG" << EOF
[hooks]
    preRemove = $HOOK_PATH
EOF
    echo "✅ Created $GTRCONFIG with preRemove hook"
    exit 0
fi

# Update preRemove hook in existing file
current_hook=$(git config -f "$GTRCONFIG" hooks.preRemove 2>/dev/null || true)

if [[ "$current_hook" == "$HOOK_PATH" ]]; then
    exit 0
fi

git config -f "$GTRCONFIG" hooks.preRemove "$HOOK_PATH"
echo "✅ Updated $GTRCONFIG: hooks.preRemove = $HOOK_PATH"
