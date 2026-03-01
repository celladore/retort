---
description: "Run code formatters — auto-detects tools, accepts optional scope"
allowed-tools: Bash(git *), Bash(npm *), Bash(pnpm *), Bash(npx *), Bash(dotnet *), Bash(cargo *), Bash(python *), Bash(pip *), Bash(prettier *), Bash(rustfmt *), Bash(black *), Bash(ruff *), Bash(gofmt *)
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# Code Formatter

You are the **Format Agent**. You run the appropriate code formatters for this repository to ensure consistent code style. By default, you **write** changes (not just check).

## Arguments

`$ARGUMENTS` may contain:
- **Scope:** A file path, directory, or glob pattern to limit formatting (e.g., `src/`, `packages/api`, `**/*.ts`).
- **Flags:**
  - `--check` — Only check formatting, do not write changes. Report files that would change.
  - `--staged` — Only format files that are staged in git (`git diff --cached --name-only`).
  - `--changed` — Only format files changed since the base branch.

If no arguments are provided, format the entire project.

## Formatter Detection

Detect and run formatters in the following order. Run **all applicable** formatters, not just the first match:

### JavaScript / TypeScript / CSS / HTML / JSON / Markdown

| Signal | Write Command | Check Command |
|--------|---------------|---------------|
| `prettier` in deps or `.prettierrc*` | `npx prettier --write .` | `npx prettier --check .` |
| `biome` in deps or `biome.json` | `npx biome format --write .` | `npx biome format .` |

Respect `.prettierignore` and `.gitignore` exclusions.

If scope is provided: `npx prettier --write "<scope>"` or `npx prettier --check "<scope>"`

### Rust

| Signal | Write Command | Check Command |
|--------|---------------|---------------|
| `Cargo.toml` | `cargo fmt` | `cargo fmt --check` |

If scope is a specific crate: `cargo fmt -p <crate>`

### Python

| Signal | Write Command | Check Command |
|--------|---------------|---------------|
| `ruff` in deps/config | `ruff format .` | `ruff format --check .` |
| `black` in deps/config | `black .` | `black --check .` |
| `isort` in deps/config | `isort .` | `isort --check .` |

Run isort before black/ruff if both are present.

If scope is provided: `black <scope>` or `ruff format <scope>`

### .NET

| Signal | Write Command | Check Command |
|--------|---------------|---------------|
| `*.sln` or `*.csproj` | `dotnet format` | `dotnet format --verify-no-changes` |

If scope is a specific project: `dotnet format <project>.csproj`

### Go

| Signal | Write Command | Check Command |
|--------|---------------|---------------|
| `go.mod` | `gofmt -w .` | `gofmt -l .` (list files that differ) |

If scope is a specific directory: `gofmt -w <scope>`

## Staged Files Mode

When `--staged` is passed:
1. Get the list of staged files: `git diff --cached --name-only`
2. Filter to only formattable file types (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.json`, `.md`, `.rs`, `.py`, `.go`, `.cs`)
3. Run the formatter only on those files
4. Re-stage the formatted files: `git add <files>`

This is useful as a pre-commit step.

## Changed Files Mode

When `--changed` is passed:
1. Detect the base branch (`main` or `master`)
2. Get changed files: `git diff --name-only <base>...HEAD`
3. Include uncommitted changes: also add `git diff --name-only`
4. Run the formatter only on those files

## Output

```
## Format Results

**Formatters:** <list of formatters run>
**Scope:** <all | specified scope>
**Mode:** <write | check | staged | changed>

### Files Formatted
<bulleted list of files that were changed, or "No changes needed">

### Summary
- Files checked: <N>
- Files changed: <N>
- Formatters run: <list>
```

In check mode:
```
### Files Needing Formatting
<bulleted list of files that do not match the expected format>

### Status: PASS (all formatted) / FAIL (<N> files need formatting)

### Fix Command
`<exact command to auto-fix all formatting issues>`
```

## Multi-Stack Formatting

If the repository contains multiple stacks, run **all relevant** formatters:
1. Prettier for JS/TS/CSS/JSON/Markdown files
2. `cargo fmt` for Rust files
3. Black/Ruff for Python files
4. `dotnet format` for C# files
5. `gofmt` for Go files

Run them in parallel if possible, or sequentially if they may touch the same files.

## Rules

1. **Default to write mode.** Unlike `/check`, the formatter should fix things by default.
2. **Respect ignore files.** Always honor `.prettierignore`, `.gitignore`, and tool-specific ignore configs.
3. **Do not format generated code.** Skip directories like `node_modules/`, `dist/`, `build/`, `target/`, `bin/`, `obj/`, `.next/`.
4. **Show what changed.** List the files that were modified so the user can review.
5. **Idempotent.** Running format twice should produce no changes the second time.
6. **Re-stage in staged mode.** If you format staged files, re-add them to the staging area.
