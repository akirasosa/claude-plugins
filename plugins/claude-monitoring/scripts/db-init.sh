#!/usr/bin/env bash
# Initialize Claude Code events database
# Usage: db-init.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Create directory if it doesn't exist
mkdir -p "$DB_DIR"

# Run migrations
"$SCRIPT_DIR/db-migrate.sh"

# Run cleanup
"$SCRIPT_DIR/db-cleanup.sh" 2>/dev/null || true

echo "Database initialized: $DB_FILE"
