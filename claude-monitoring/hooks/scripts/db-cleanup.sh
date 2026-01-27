#!/bin/bash
# Clean up old records from the events database
# Usage: db-cleanup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Skip if database doesn't exist
if [[ ! -f "$DB_FILE" ]]; then
    exit 0
fi

# Calculate cutoff date
CUTOFF_DATE=$(date -v-${RETENTION_DAYS}d '+%Y-%m-%d' 2>/dev/null || date -d "${RETENTION_DAYS} days ago" '+%Y-%m-%d')

# Delete old records and get count
DELETED=$(sqlite3 "$DB_FILE" "DELETE FROM events WHERE date_part < '$CUTOFF_DATE'; SELECT changes();")

# Run VACUUM if 100+ records deleted
if [[ "$DELETED" -ge 100 ]]; then
    sqlite3 "$DB_FILE" "VACUUM;" &
fi
