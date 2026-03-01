---
description: "Universal quality gate — format, lint, typecheck, test, build in one pass"
allowed-tools: Bash(git *), Bash(npm *), Bash(pnpm *), Bash(npx *), Bash(dotnet *), Bash(cargo *), Bash(python *), Bash(pip *), Bash(pytest *), Bash(go *), Bash(rustfmt *), Bash(prettier *), Bash(eslint *), Bash(ruff *), Bash(black *), Bash(mypy *)
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# Universal Quality Gate

You are the **Check Agent**. You run every available quality check for this repository in a single pass, in the correct order, and report the results. You auto-detect the stack and adapt accordingly.

## Arguments

`$ARGUMENTS` may contain:
- A scope (e.g., `frontend`, `backend`, `packages/api`) to limit checks to a subdirectory.
- `--fix` to enable auto-fix mode where supported (formatter writes, lint auto-fix).
- `--fast` to skip the build step and only run format + lint + typecheck.

## Check Order

Always run checks in this order. Each step depends on the previous being meaningful, but do **not** skip later steps if earlier ones fail.

### Step 1: Format

Auto-detect and run the appropriate formatter:

| Stack | Detection | Check Command | Fix Command |
|-------|-----------|---------------|-------------|
| JS/TS | `package.json` with prettier | `npx prettier --check .` | `npx prettier --write .` |
| Rust | `Cargo.toml` | `cargo fmt --check` | `cargo fmt` |
| Python | `pyproject.toml` with black/ruff | `ruff format --check .` or `black --check .` | `ruff format .` or `black .` |
| .NET | `*.sln` or `*.csproj` | `dotnet format --verify-no-changes` | `dotnet format` |
| Go | `go.mod` | `gofmt -l .` | `gofmt -w .` |

If `--fix` is passed, use the fix command. Otherwise, use the check command.

Record: pass/fail, files that would change (in check mode) or files changed (in fix mode).

### Step 2: Lint

| Stack | Detection | Command |
|-------|-----------|---------|
| JS/TS | `.eslintrc*` or `eslint.config.*` | `npx eslint . --max-warnings 0` |
| Rust | `Cargo.toml` | `cargo clippy -- -D warnings` |
| Python | ruff in deps/config | `ruff check .` |
| .NET | analyzers enabled | `dotnet build /warnaserror` |
| Go | golangci-lint installed | `golangci-lint run` |

If `--fix` is passed and the tool supports auto-fix, add the fix flag (e.g., `--fix` for ESLint, `--fix` for Ruff).

Record: pass/fail, error count, warning count, first 20 issues.

### Step 3: Typecheck

| Stack | Detection | Command |
|-------|-----------|---------|
| TypeScript | `tsconfig.json` | `npx tsc --noEmit` |
| Python | mypy/pyright config | `mypy .` or `pyright` |
| Rust | (included in clippy) | — |
| .NET | (included in build) | — |
| Go | (included in build) | — |

Record: pass/fail, error count, first 20 errors.

### Step 4: Unit Tests

| Stack | Detection | Command |
|-------|-----------|---------|
| JS/TS (Vitest) | vitest in deps | `npx vitest run` |
| JS/TS (Jest) | jest in deps | `npx jest` |
| Rust | `Cargo.toml` | `cargo test` |
| .NET | test projects | `dotnet test` |
| Python | pytest | `pytest` |
| Go | `go.mod` | `go test ./...` |

If scope is provided, pass it as a filter to the test runner where supported.

Record: pass/fail, total tests, passed, failed, skipped, duration.

### Step 5: Build

Skip if `--fast` is passed.

| Stack | Detection | Command |
|-------|-----------|---------|
| JS/TS | `build` script in `package.json` | `pnpm build` / `npm run build` |
| Rust | `Cargo.toml` | `cargo build` |
| .NET | `*.sln` | `dotnet build` |
| Python | build config | `python -m build` |
| Go | `go.mod` | `go build ./...` |

Record: pass/fail, duration, output size.

## Multi-Stack Support

If the repository contains multiple stacks (e.g., a TypeScript frontend and a Rust backend), run checks for **all detected stacks** unless a scope is specified.

For monorepos with workspace configuration, respect workspace boundaries:
- `pnpm -r run build` for pnpm workspaces
- `cargo build --workspace` for Cargo workspaces
- `dotnet build <solution>.sln` for .NET solutions

## Output Format

```
## Quality Gate Results

**Timestamp:** <ISO-8601>
**Scope:** <all | specified scope>
**Mode:** <check | fix>

| Step | Status | Duration | Details |
|------|--------|----------|---------|
| Format | PASS/FAIL | Xs | <N files need formatting> |
| Lint | PASS/FAIL | Xs | <N errors, M warnings> |
| Typecheck | PASS/FAIL | Xs | <N errors> |
| Tests | PASS/FAIL | Xs | <N passed, M failed> |
| Build | PASS/FAIL/SKIPPED | Xs | <notes> |

### Overall: PASS / FAIL

### Exact Commands Run
1. `<command 1>` — <result>
2. `<command 2>` — <result>
3. ...

### Failures (Detail)
<For each failing step, show the first 30 lines of error output>

### Auto-Fixed (if --fix was used)
- <list of files auto-formatted or auto-fixed>
```

## State Updates

Append to `.claude/state/events.log`:

```
[<timestamp>] [CHECK] [ORCHESTRATOR] Gate: <PASS|FAIL>. Format: <P/F>. Lint: <P/F>. Types: <P/F>. Tests: <passed>/<total>. Build: <P/F>.
```

## Rules

1. **Run all steps.** Do not stop at the first failure.
2. **Use exact commands.** Every command must be copy-paste reproducible.
3. **Respect scope.** If a scope is given, only check files within that scope.
4. **Do not modify code unless `--fix` is passed.** Check mode is read-only.
5. **Timeout protection.** Kill any single step that runs longer than 5 minutes. Record as `TIMEOUT`.
6. **Exit with clear status.** The overall result is PASS only if ALL steps pass.
