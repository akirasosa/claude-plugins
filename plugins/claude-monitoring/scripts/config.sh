#!/usr/bin/env bash
# Shared configuration for claude-monitoring plugin

DB_DIR="$HOME/.local/share/claude-monitoring"
DB_FILE="$DB_DIR/events.db"
RETENTION_DAYS=30

# Migration directory (relative to scripts/)
SCRIPT_DIR_CONFIG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR_CONFIG/migrations"
