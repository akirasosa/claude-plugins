#!/usr/bin/env bash
# Start the Claude Monitoring Web UI server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$SCRIPT_DIR/../web"
CLI="$SCRIPT_DIR/../bin/claude-monitoring"

# Initialize DB and run migrations
"$CLI" init >/dev/null 2>&1 || true

cd "$WEB_DIR"
exec bun run server.ts
