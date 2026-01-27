#!/usr/bin/env bash
# Database migration runner for claude-monitoring
# Usage: db-migrate.sh [--check]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# MIGRATIONS_DIR is already defined in config.sh
CHECK_ONLY=false

if [[ "${1:-}" == "--check" ]]; then
    CHECK_ONLY=true
fi

# Get current database version
get_db_version() {
    if [[ ! -f "$DB_FILE" ]]; then
        echo "0"
        return
    fi
    sqlite3 "$DB_FILE" "PRAGMA user_version;" 2>/dev/null || echo "0"
}

# Set database version
set_db_version() {
    local version=$1
    sqlite3 "$DB_FILE" "PRAGMA user_version = $version;"
}

# Check if events table exists
table_exists() {
    local count
    count=$(sqlite3 "$DB_FILE" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='events';" 2>/dev/null || echo "0")
    [[ "$count" -gt 0 ]]
}

# Check if git_branch column exists
has_git_branch_column() {
    local count
    count=$(sqlite3 "$DB_FILE" "SELECT count(*) FROM pragma_table_info('events') WHERE name='git_branch';" 2>/dev/null || echo "0")
    [[ "$count" -gt 0 ]]
}

# Check if tmux_window_id column exists
has_window_id_column() {
    local count
    count=$(sqlite3 "$DB_FILE" "SELECT count(*) FROM pragma_table_info('events') WHERE name='tmux_window_id';" 2>/dev/null || echo "0")
    [[ "$count" -gt 0 ]]
}

# Check if tmux_session column exists (removed in migration 004)
has_tmux_session_column() {
    local count
    count=$(sqlite3 "$DB_FILE" "SELECT count(*) FROM pragma_table_info('events') WHERE name='tmux_session';" 2>/dev/null || echo "0")
    [[ "$count" -gt 0 ]]
}

# Detect version for existing databases without user_version set
detect_existing_version() {
    if ! table_exists; then
        echo "0"
        return
    fi

    # Check if unused columns were removed (migration 004)
    if ! has_tmux_session_column; then
        echo "4"
    elif has_window_id_column; then
        echo "3"
    elif has_git_branch_column; then
        echo "2"
    else
        echo "1"
    fi
}

# Get the version number from migration filename
get_migration_version() {
    local filename
    filename=$(basename "$1")
    echo "${filename%%_*}"
}

# Apply a single migration
apply_migration() {
    local migration_file=$1
    local version
    version=$(get_migration_version "$migration_file")

    echo "Applying migration $version: $(basename "$migration_file")"

    # Execute migration in a transaction
    sqlite3 "$DB_FILE" <<EOF
BEGIN TRANSACTION;
$(cat "$migration_file")
COMMIT;
EOF

    # Update version
    set_db_version "$version"
}

# Main migration logic
migrate() {
    local current_version
    current_version=$(get_db_version)

    # Handle legacy databases (user_version=0 but tables exist)
    if [[ "$current_version" == "0" ]] && [[ -f "$DB_FILE" ]]; then
        local detected
        detected=$(detect_existing_version)
        if [[ "$detected" != "0" ]]; then
            echo "Detected existing database at version $detected (setting user_version)"
            set_db_version "$detected"
            current_version="$detected"
        fi
    fi

    echo "Current database version: $current_version"

    # Get list of migrations sorted by version
    local migrations=()
    if [[ -d "$MIGRATIONS_DIR" ]]; then
        while IFS= read -r -d '' file; do
            migrations+=("$file")
        done < <(find "$MIGRATIONS_DIR" -name "*.sql" -print0 | sort -z)
    fi

    if [[ ${#migrations[@]} -eq 0 ]]; then
        echo "No migrations found in $MIGRATIONS_DIR"
        return 0
    fi

    # Find and apply pending migrations
    local pending=0
    for migration in "${migrations[@]}"; do
        local version
        version=$(get_migration_version "$migration")
        # Remove leading zeros for numeric comparison
        local version_num=$((10#$version))
        local current_num=$((10#$current_version))

        if [[ $version_num -gt $current_num ]]; then
            pending=$((pending + 1))
            if [[ "$CHECK_ONLY" == "true" ]]; then
                echo "Pending: $(basename "$migration")"
            else
                apply_migration "$migration"
            fi
        fi
    done

    if [[ $pending -eq 0 ]]; then
        echo "Database is up to date"
    elif [[ "$CHECK_ONLY" == "true" ]]; then
        echo "$pending migration(s) pending"
        return 1
    else
        echo "Applied $pending migration(s)"
    fi

    echo "Database version: $(get_db_version)"
}

# Create directory if needed
mkdir -p "$DB_DIR"

migrate
