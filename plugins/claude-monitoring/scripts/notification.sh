#!/usr/bin/env bash
set -euo pipefail
# Thin wrapper for TypeScript notification handler
# Reads stdin and backgrounds the TypeScript process for non-blocking hook execution

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVENT_TYPE="${1:-notification}"

# Read stdin with timeout (5 seconds)
INPUT=$(timeout 5 cat 2>/dev/null || echo "{}")

# Run TypeScript handler in background
(
    echo "$INPUT" | bun run "$SCRIPT_DIR/../src/cli.ts" notification "$EVENT_TYPE"
) </dev/null >/dev/null 2>&1 &
disown 2>/dev/null || true

exit 0
