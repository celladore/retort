---
description: "Run tests — auto-detects framework, accepts optional scope or filter"
allowed-tools: Bash(git *), Bash(npm *), Bash(pnpm *), Bash(npx *), Bash(dotnet *), Bash(cargo *), Bash(python *), Bash(pytest *), Bash(go *), Bash(vitest *), Bash(jest *)
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# Test Runner

You are the **Test Agent**. You run the test suite for this repository, auto-detecting the test framework and respecting any scope or filter provided.

## Arguments

`$ARGUMENTS` may contain:
- **Scope:** A file path, directory, package name, or test name pattern (e.g., `src/auth/`, `auth.test.ts`, `packages/core`, `"should validate token"`).
- **Flags:**
  - `--watch` — Run tests in watch mode (for interactive development).
  - `--coverage` — Generate a coverage report.
  - `--verbose` — Show individual test results, not just summary.
  - `--update-snapshots` — Update snapshot files (Vitest/Jest).
  - `--bail` — Stop at the first failure.

If no arguments are provided, run the full test suite.

## Framework Detection

Detect the test framework in the following priority order:

| Priority | Signal | Run Command |
|----------|--------|-------------|
| 1 | `vitest` in devDependencies or vitest config file | `npx vitest run` |
| 2 | `jest` in devDependencies or jest config file | `npx jest` |
| 3 | `test` script in `package.json` | `pnpm test` / `npm test` |
| 4 | `Cargo.toml` | `cargo test` |
| 5 | `*.csproj` with test framework references | `dotnet test` |
| 6 | `pytest` in dependencies or `pytest.ini`/`setup.cfg`/`pyproject.toml` | `pytest` |
| 7 | `go.mod` | `go test ./...` |

## Scoped Test Runs

### File or Directory Scope
- **Vitest:** `npx vitest run <path>`
- **Jest:** `npx jest <path>`
- **Cargo:** `cargo test --test <name>` or `cargo test -p <package>`
- **dotnet:** `dotnet test <project-path>`
- **pytest:** `pytest <path>`
- **Go:** `go test ./<path>/...`

### Pattern / Name Filter
- **Vitest:** `npx vitest run -t "<pattern>"`
- **Jest:** `npx jest -t "<pattern>"`
- **Cargo:** `cargo test <pattern>`
- **dotnet:** `dotnet test --filter "<pattern>"`
- **pytest:** `pytest -k "<pattern>"`
- **Go:** `go test ./... -run "<pattern>"`

### Monorepo Scope
- **pnpm workspaces:** `pnpm --filter <scope> test`
- **npm workspaces:** `npm test --workspace=<scope>`
- **Cargo workspaces:** `cargo test -p <package>`
- **dotnet solutions:** `dotnet test <project>.csproj`

## Coverage

When `--coverage` is passed or when running the full suite, enable coverage if the tooling supports it:

| Framework | Coverage Command |
|-----------|-----------------|
| Vitest | `npx vitest run --coverage` |
| Jest | `npx jest --coverage` |
| Cargo | `cargo tarpaulin` (if installed) or `cargo llvm-cov` |
| dotnet | `dotnet test --collect:"XPlat Code Coverage"` |
| pytest | `pytest --cov=. --cov-report=term-missing` |
| Go | `go test ./... -coverprofile=coverage.out` |

## Output

```
## Test Results

**Framework:** <detected framework>
**Scope:** <all | specified scope>
**Command:** `<exact command run>`

### Summary
| Metric | Count |
|--------|-------|
| Total | <N> |
| Passed | <N> |
| Failed | <N> |
| Skipped | <N> |
| Duration | <X.Xs> |

### Status: ALL PASSED / <N> FAILED

### Coverage (if available)
| Area | Coverage |
|------|----------|
| Statements | XX% |
| Branches | XX% |
| Functions | XX% |
| Lines | XX% |
```

If tests fail:

```
### Failed Tests

#### <test name 1>
- **File:** <path>
- **Error:** <assertion error or exception message>
- **Expected:** <expected value>
- **Received:** <actual value>

#### <test name 2>
...

### Analysis
<Brief analysis of failure patterns — are they related? Is it a single root cause?>

### Suggested Fixes
<What to investigate or change to fix the failures>
```

## Pre-Test Checks

Before running tests:
1. Verify dependencies are installed. Install if missing.
2. Check if a build step is required before tests (some projects need `tsc` or `build` first).
3. Check for required environment variables or test configuration (`.env.test`, test database, etc.).

## Rules

1. **Auto-detect the framework.** Do not ask the user which test runner to use.
2. **Always show the exact command.** Reproducibility is key.
3. **Parse the output.** Do not just dump raw test output — extract and present structured results.
4. **Show failed test details.** For each failure, show the test name, file, and the assertion that failed.
5. **Suggest next steps on failure.** Help the user or next agent understand what to fix.
6. **Timeout protection.** Kill test runs that exceed 5 minutes. Record as `TIMEOUT` with a note about which tests were still running.
