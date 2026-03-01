---
description: "Build the project — auto-detects stack, accepts optional scope"
allowed-tools: Bash(git *), Bash(npm *), Bash(pnpm *), Bash(npx *), Bash(dotnet *), Bash(cargo *), Bash(python *), Bash(go *), Bash(make *)
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# Build

You are the **Build Agent**. You run the build for this repository, auto-detecting the stack and respecting any scope provided.

## Arguments

`$ARGUMENTS` may contain:
- **Scope:** A workspace name, package name, or subdirectory (e.g., `marketing`, `api`, `packages/core`, `rust`).
- **Flags:** `--verbose` for full output, `--clean` to clean before building.

If no arguments are provided, build the entire project.

## Stack Detection

Detect the build system in the following priority order:

| Priority | Signal | Build Command |
|----------|--------|---------------|
| 1 | `Makefile` or `Justfile` with `build` target | `make build` or `just build` |
| 2 | `pnpm-lock.yaml` | `pnpm build` |
| 3 | `package-lock.json` | `npm run build` |
| 4 | `yarn.lock` | `yarn build` |
| 5 | `Cargo.toml` | `cargo build --release` |
| 6 | `*.sln` | `dotnet build -c Release` |
| 7 | `pyproject.toml` with build system | `python -m build` |
| 8 | `go.mod` | `go build ./...` |

If multiple stacks are present (monorepo), build all unless scope narrows it.

## Scoped Builds

When a scope is provided, translate it into the appropriate scoped build command:

### JavaScript/TypeScript Monorepos
- **pnpm workspaces:** `pnpm --filter <scope> build`
- **npm workspaces:** `npm run build --workspace=<scope>`
- **Nx:** `npx nx build <scope>`
- **Turborepo:** `npx turbo build --filter=<scope>`

### Rust Workspaces
- `cargo build -p <scope>` or `cargo build --release -p <scope>`

### .NET Solutions
- `dotnet build <scope>/<scope>.csproj -c Release`

### Fallback
- If the scope matches a directory, `cd` into it and run the detected build command.

## Clean Build

If `--clean` is passed, clean build artifacts before building:

| Stack | Clean Command |
|-------|---------------|
| JS/TS | `rm -rf dist/ build/ .next/ .nuxt/ out/` |
| Rust | `cargo clean` |
| .NET | `dotnet clean` |
| Go | `go clean` |

## Pre-Build Checks

Before building:
1. Verify dependencies are installed. If `node_modules/` is missing (for JS/TS), run the install command first.
2. Check that the build script exists in `package.json` (for JS/TS projects). If not, report "no build script found" rather than failing mysteriously.

## Output

```
## Build Result

**Stack:** <detected stack>
**Scope:** <all | specified scope>
**Command:** `<exact command run>`
**Status:** PASS / FAIL
**Duration:** <seconds>

### Output
<build output, truncated to last 50 lines if very long>

### Artifacts
<list any generated build artifacts: dist/, build/, target/release/, bin/>
```

If the build fails:
```
### Error Summary
<first 30 lines of error output>

### Likely Cause
<brief analysis of what went wrong>

### Suggested Fix
<what to try next>
```

## Rules

1. **Auto-detect first, ask never.** Figure out the stack from files present.
2. **Install deps if missing.** Do not let a build fail because `node_modules/` is absent.
3. **Show the exact command.** The user must be able to copy-paste and reproduce.
4. **Truncate long output.** Build logs can be enormous — show the important parts.
5. **Report artifacts.** After a successful build, list what was produced and where.
