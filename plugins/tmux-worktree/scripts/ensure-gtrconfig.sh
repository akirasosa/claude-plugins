#!/usr/bin/env bash
# Wrapper for TypeScript gtr config setup
# Called by SessionStart hook to configure gtr hooks via git config --local
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec bun run "$SCRIPT_DIR/../src/ensure-gtrconfig.ts"
