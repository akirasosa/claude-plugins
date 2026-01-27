#!/usr/bin/env bash
# Start the Claude Monitoring Web UI server
# Note: DB initialization is now handled in server.ts
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$SCRIPT_DIR/../web"

cd "$WEB_DIR"
exec bun run server.ts
