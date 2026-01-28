# Quality Standards

## Pre-commit Checks
The following checks run automatically on every commit:

1. **Block protected branches** - Prevents direct commits to main/develop
2. **Trailing whitespace** - Removes trailing spaces (except .md)
3. **End of file fixer** - Ensures newline at EOF (except .md)
4. **Check YAML** - Validates YAML syntax
5. **Check JSON** - Validates JSON syntax (except tsconfig)
6. **Mixed line ending** - Enforces LF line endings
7. **Biome check** - Linting and formatting
8. **TypeScript check** - Type validation
9. **Security audit** - `bun audit --audit-level=high`
10. **Knip check** - Dead code detection
11. **Type coverage** - 95% minimum coverage

## Biome Configuration
See `biome.json`:
- Formatter: 2-space indent, 100 char line width, double quotes, semicolons
- Linter: Recommended rules + strict import/assertion checks
- Auto-organize imports on save

## Knip Dead Code Detection
See `knip.json`:
- Detects unused exports, dependencies, and files
- Entry points: CLI, web server, barrel exports, test files
- Run `bun run knip` to check, `bun run knip:fix` to auto-remove

## Type Coverage
- Minimum 95% coverage enforced
- Run `bun run type-coverage:detail` to find untyped code
- Focus on eliminating `any` types and adding explicit annotations
