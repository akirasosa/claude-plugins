#!/usr/bin/env bash
# Start the Claude Monitoring Web UI server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$SCRIPT_DIR/../web"

# Source config for DB paths
source "$SCRIPT_DIR/config.sh"

# Initialize DB if not exists or run migrations if needed
if [[ ! -f "$DB_FILE" ]]; then
    "$SCRIPT_DIR/db-init.sh" >/dev/null 2>&1 || true
else
    # Run migrations silently if there are pending ones
    "$SCRIPT_DIR/db-migrate.sh" >/dev/null 2>&1 || true
fi

cd "$WEB_DIR"
exec bun run server.ts
