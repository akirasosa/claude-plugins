---
paths: plugins/claude-monitoring/**/*.ts
---

# TypeScript Conventions (claude-monitoring)

- Runtime: Bun (native SQLite, fast startup)
- Error handling: try-catch with graceful fallbacks (return null instead of throwing)
- Async: Use Promise.race for timeout protection
- Database: SQLite with PRAGMA user_version for migrations
- Exports: Single index.ts re-exports all public functions per module
