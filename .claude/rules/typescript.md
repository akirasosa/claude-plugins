---
paths: plugins/**/*.ts
---

# TypeScript Conventions

## Runtime
- Bun (native SQLite, fast startup)

## Biome Rules
- `noUnusedImports`: error - remove unused imports
- `noUnusedVariables`: warn - flag unused variables
- `noNonNullAssertion`: error - avoid `!` operator, use proper null checks
- `noExplicitAny`: warn - prefer typed alternatives
- `useImportType`: warn - use `import type` for type-only imports

## Type Coverage
- Minimum 95% coverage required
- Run `bun run type-coverage:detail` to find untyped code

## Error Handling
- Try-catch with graceful fallbacks
- Return `null` instead of throwing for recoverable errors
- Example:
  ```typescript
  export function getData(): Data | null {
    try {
      return fetchData();
    } catch {
      return null;
    }
  }
  ```

## Async Patterns
- Use `Promise.race` for timeout protection:
  ```typescript
  const result = await Promise.race([
    operation(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 5000)
    ),
  ]);
  ```

## Database
- SQLite with `PRAGMA user_version` for migrations
- In-memory databases for testing (`:memory:`)

## Exports
- Single `index.ts` re-exports all public functions per module (barrel exports)
- Example: `plugins/claude-monitoring/src/db/index.ts`
