# FW-006: Structured Sync Logging (Info/Warn/Error Levels)

## Metadata

- **ID**: FW-006
- **Priority**: P2
- **Status**: not-started
- **Created**: 2026-03-06
- **Origin**: PR #293 review discussion

## Problem

The sync engine currently outputs all messages through `console.log` and `console.warn` without structured log levels. This makes it difficult to:

- Filter noise from actionable warnings during CI
- Pipe sync output to structured log aggregators
- Distinguish informational skip messages from genuine warnings or errors
- Configure verbosity levels for different environments (CI vs local dev)

## Current State

- `synchronize.mjs` uses `console.log()` for info/skip messages and `console.warn()` for warnings
- No error-level distinction — failures and warnings look the same in output
- Feature skip messages (e.g., "Skipping feature X (disabled)") are info-level but printed alongside actionable warnings
- No way to suppress verbose output in CI or increase verbosity for debugging

## Proposed Changes

1. **Create a logger utility** (`engines/node/src/logger.mjs`) with levels: `debug`, `info`, `warn`, `error`
2. **Default log level**: `info` (local), `warn` (CI — detected via `CI` env var)
3. **CLI flag**: `--log-level=debug|info|warn|error` or `--verbose` / `--quiet`
4. **Colour coding**: Use ANSI colours for terminal output (auto-detect TTY)
5. **Structured JSON mode**: Optional `--json-log` flag for CI pipelines that parse output
6. **Migrate existing output**: Replace all `console.log`/`console.warn` calls in the sync engine

## Classification of Current Output

| Current Output                        | Proposed Level |
| ------------------------------------- | -------------- |
| "Generating X for platform Y"         | `info`         |
| "Skipping feature X (disabled)"       | `debug`        |
| "Feature X: 13/22 enabled"            | `info`         |
| "File unchanged, skipping write"      | `debug`        |
| "Template not found, using fallback"  | `warn`         |
| "Failed to render template"           | `error`        |
| "Scaffold-once file exists, skipping" | `debug`        |
| Sync summary (files written/skipped)  | `info`         |

## Acceptance Criteria

- [ ] Logger utility with 4 levels (debug, info, warn, error)
- [ ] Log level configurable via CLI flag and environment variable
- [ ] All sync engine output migrated from console.log/warn to logger
- [ ] CI output is cleaner (only warnings and errors by default)
- [ ] Local dev output is unchanged at default level
- [ ] Unit tests for logger utility
- [ ] No breaking changes to sync CLI interface

## Effort Estimate

- **Size**: S (small)
- **Files affected**: ~3-5 (new logger + synchronize.mjs + CLI entry point)
- **Risk**: Low — additive change, no sync logic modification
