# FW-002: Investigate and Refactor All Scripts and Configuration Files

## Metadata

- **ID**: FW-002
- **Priority**: P2
- **Status**: not-started
- **Created**: 2026-03-06

## Problem Statement

The repository has accumulated scripts and configuration files across multiple locations. A comprehensive audit and refactoring is needed to ensure consistency, remove duplication, and improve maintainability.

## Scope

### Scripts to Audit

- `scripts/` directory — shell scripts (`.sh`, `.ps1`)
- `.agentkit/bin/` — CLI scripts (protected — requires maintainer)
- Root-level scripts or config referenced in `package.json`
- CI/CD workflow scripts in `.github/workflows/`
- Any ad-hoc scripts in `docs/` or other locations

### Configuration to Audit

- `.agentkit/spec/*.yaml` — spec configuration files
- Root-level configs (`package.json`, `tsconfig.json`, `vitest.config.*`, etc.)
- Tool-specific configs (`.eslintrc`, `.prettierrc`, `renovate.json`, etc.)
- CI/CD configuration (`.github/workflows/*.yml`)
- Editor configs (`.vscode/`, `.cursor/`, `.windsurf/`)

## Investigation Steps

1. **Inventory** — Catalog all scripts and config files with purpose, owner, and last-modified date
2. **Duplication analysis** — Identify overlapping or redundant scripts/configs
3. **Consistency check** — Verify naming conventions, error handling, cross-platform support (sh + ps1)
4. **Dead code** — Find scripts that are no longer referenced or needed
5. **Modernization** — Identify scripts that could be consolidated or replaced with package.json scripts
6. **Documentation** — Ensure all scripts have usage comments and are referenced from appropriate docs

## Deliverables

- [ ] Complete inventory spreadsheet/table
- [ ] Prioritized refactoring plan
- [ ] Identified quick wins (dead scripts, duplicates)
- [ ] Identified larger refactors (consolidation, modernization)

## Acceptance Criteria

- [ ] All scripts documented with purpose and usage
- [ ] No dead/unreferenced scripts remain
- [ ] Cross-platform parity (sh/ps1) where applicable
- [ ] Consistent error handling and exit codes
