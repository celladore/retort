---
name: 'feat: add /doc-audit slash command'
about: 'Add a repeatable documentation audit command to agentkit-forge'
title: 'feat: add /doc-audit slash command for repeatable documentation audits'
labels: enhancement, documentation
---

## Summary

Add a dedicated `/doc-audit` command to agentkit-forge that provides repeatable, systematic documentation audits. Currently, documentation auditing is either a manual one-off exercise or a narrow subset of `/project-review --focus docs`.

## Context

During the documentation audit session on 2026-03-04 (branch `claude/documentation-audit-AAygZ`), we identified that:

- 5 commands were completely undocumented
- 9 commands had incomplete flag documentation
- Cross-document counts were inconsistent (command counts, agent counts)
- No automated way exists to detect these issues going forward

A detailed proposal has been committed at `docs/06_engineering/doc-audit-command-proposal.md`.

## What Needs To Be Done

### 1. Add spec entry to `.agentkit/spec/commands.yaml`

New `doc-audit` command entry (type: `workflow`) with flags:

- `--scope` — limit audit to specific doc categories
- `--fix` — auto-fix safe issues (counts, broken links)
- `--output` — report format (markdown/json)
- `--save` — persist report to `.agentkit/docs/DOCUMENTATION_AUDIT.md`

### 2. Create template at `.agentkit/templates/claude/commands/doc-audit.md`

The template implements a 6-phase (optionally 7-phase with `--fix`) audit:

| Phase                         | Purpose                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| 1. Inventory                  | Scan docs/ structure, verify 8-category completeness                                 |
| 2. Spec–Doc Cross-Reference   | Compare commands.yaml, agents.yaml, teams.yaml against published docs                |
| 3. Link & Reference Integrity | Check all internal markdown links resolve                                            |
| 4. Content Freshness          | Detect stale counts, outdated versions, lingering TODOs                              |
| 5. Quality Assessment         | Evaluate API docs, ADR coverage, onboarding path                                     |
| 6. Report                     | Structured findings with `DOC-GAP-*`, `DOC-DRIFT-*`, `DOC-LINK-*`, `DOC-STALE-*` IDs |
| 7. Auto-Fix (--fix only)      | Safe corrections: counts, broken links, stale markers                                |

### 3. Run `pnpm -C .agentkit agentkit:sync`

Generates `.claude/commands/doc-audit.md` and equivalents for all 15+ platform targets.

## Why Not Just Use `/project-review --focus docs`?

| Aspect               | `/project-review --focus docs` | `/doc-audit`                                                                   |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Spec cross-reference | No                             | Yes — systematically compares spec YAML against docs                           |
| Link checking        | No                             | Yes                                                                            |
| Count validation     | No                             | Yes — verifies command/agent/team counts match spec                            |
| Auto-fix             | No                             | Yes — `--fix` flag                                                             |
| Standalone report    | Embedded in broader review     | Dedicated `DOCUMENTATION_AUDIT.md`                                             |
| Finding taxonomy     | Generic `DOC-*`                | Specific: `DOC-GAP-*`, `DOC-DRIFT-*`, `DOC-LINK-*`, `DOC-STALE-*`, `DOC-DUP-*` |

## Implementation Details

The full spec YAML entry and complete Handlebars template (with all 7 phases) are in `docs/06_engineering/doc-audit-command-proposal.md`. Copy-paste ready.

## Acceptance Criteria

- [ ] `commands.yaml` entry passes `spec-validate`
- [ ] Template renders correctly via `agentkit sync`
- [ ] `/doc-audit` produces a structured report when run
- [ ] `--fix` mode safely corrects count mismatches and broken links
- [ ] `--scope` filters to specific doc categories
- [ ] Report is saved to `.agentkit/docs/DOCUMENTATION_AUDIT.md` by default
