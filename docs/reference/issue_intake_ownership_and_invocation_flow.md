# Issue Intake Ownership and Invocation Flow

## Purpose

Define a first-class, configurable issue intake model for GitHub and Linear, and map how intake behavior is invoked across supported agent platforms.

## Current Invocation Path

### Source-of-truth to generated outputs

1. Command and team intent are defined in `.agentkit/spec/commands.yaml` and `.agentkit/spec/teams.yaml`.
2. `pnpm --dir .agentkit agentkit:sync` runs the sync engine (`.agentkit/engines/node/src/synchronize.mjs`).
3. Templates are rendered into platform artifacts:
   - Claude commands/skills (`.claude/commands`, `.claude/skills`)
   - Copilot prompts/instructions (`.github/prompts`, `.github/copilot-instructions.md`)
   - Cursor commands (`.cursor/commands`)
   - Windsurf commands (`.windsurf/commands`)
   - Codex skills (`.agents/skills`)

### Runtime invocation examples

- Claude: `/sync-backlog`
- Copilot: `sync-backlog.prompt.md`
- Cursor/Windsurf: generated command markdown
- Codex: `sync-backlog` skill

## Ownership Model (Target)

### Intake owner

- Primary owner: **Product team** (triage authority)
- Operational executor: **Quality team** (routing and hygiene)
- Domain assignees: backend/frontend/data/infra/devops/testing/security/docs by scope mapping

### Cadence

- Daily pull sync from tracker(s)
- On-demand sync after discovery/review/healthcheck
- Weekly stale/unassigned audit

### Escalation

- Critical security intake: route to Security + DevOps immediately
- Blocked cross-team items: escalate to Product for priority arbitration

## Tracker Configuration (Target)

`process.issueTracker` remains the selector and must support both as first-class:

- `github`
- `linear`

Selection is repository-configurable and must not require template edits.

## Canonical Intake Flow

1. Pull open issues from configured tracker (`github` or `linear`).
2. Normalize fields (title, severity, labels, owner, component) via `issue-normalizer.mjs`.
3. Map to team using `process.intake.importTeamMap` scope rules.
4. Deduplicate against existing `backlog.json` by `externalId`.
5. Write/update local backlog records (`.claude/state/backlog.json` + `AGENT_BACKLOG.md`).
6. Emit events for audit trail (`events.log`) and metrics.
7. Flag stale/unassigned issues for triage.

## Runtime Commands

| Command         | CLI                                        | Slash            | Description                                          |
| --------------- | ------------------------------------------ | ---------------- | ---------------------------------------------------- |
| `import-issues` | `pnpm --dir .agentkit agentkit:import-issues` | `/import-issues` | One-time or incremental import from external tracker |
| `backlog`       | `pnpm --dir .agentkit agentkit:backlog`       | `/backlog`       | Consolidated view with filters and output formats    |
| `sync-backlog`  | `pnpm --dir .agentkit agentkit:sync-backlog`  | `/sync-backlog`  | Full orchestrated sync (external + local sources)    |

## Auto-Import on Adoption

When `process.intake.autoImport: true` in `project.yaml`, `agentkit init` will automatically run `import-issues` after overlay setup. This is the recommended path for adopting repos with existing GitHub/Linear issues.

## Post-Sync Smoke Matrix

| Check                  | Command                                                                             | Expected                          |
| ---------------------- | ----------------------------------------------------------------------------------- | --------------------------------- |
| Spec validation        | `pnpm --dir .agentkit agentkit:spec-validate`                                          | Pass                              |
| Sync generation        | `pnpm --dir .agentkit agentkit:sync`                                                   | Completes without errors          |
| Determinism            | `pnpm --dir .agentkit agentkit:sync && git status --short`                             | No unexpected drift on second run |
| Output validation      | `pnpm --dir .agentkit agentkit:validate`                                               | Pass                              |
| Import issues          | `pnpm --dir .agentkit agentkit:import-issues -- --dry-run --force`                     | Lists issues without errors       |
| Backlog view           | `pnpm --dir .agentkit agentkit:backlog -- --format json`                               | Valid JSON output                 |
| Claude output parity   | inspect `.claude/commands/sync-backlog.md` + `.claude/skills/sync-backlog/SKILL.md` | Intake semantics present          |
| Copilot parity         | inspect `.github/prompts/sync-backlog.prompt.md`                                    | Intake semantics present          |
| Cursor/Windsurf parity | inspect `.cursor/commands/sync-backlog.md` and `.windsurf/commands/sync-backlog.md` | Intake semantics present          |
| Codex parity           | inspect `.agents/skills/sync-backlog/SKILL.md`                                      | Intake semantics present          |

## Implementation Note

This repo protects source-of-truth paths under `.agentkit/spec`, `.agentkit/templates`, and `.agentkit/engines` from direct AI modification. Apply schema/template/engine changes via maintainer-driven updates, then run sync and validate using the matrix above.

## Maintainer Change List (Execution Checklist)

- [x] `.agentkit/spec/project.yaml` — add `process.intake.autoImport`, `importLabelsMap`, `importStateMap`, `importTeamMap`.
- [x] `.agentkit/spec/commands.yaml` — add `import-issues` and `backlog` commands; `sync-backlog` already present.
- [x] `.agentkit/engines/node/src/spec-validator.mjs` — validate new intake schema fields (priorities, statuses, autoImport+tracker warning).
- [x] `.agentkit/engines/node/src/project-mapping.mjs` — add `hasAutoImport` template variable.
- [x] `.agentkit/engines/node/src/github-adapter.mjs` — GitHub issue fetcher via `gh` CLI.
- [x] `.agentkit/engines/node/src/linear-adapter.mjs` — Linear stub with clear interface.
- [x] `.agentkit/engines/node/src/issue-normalizer.mjs` — field normalization, priority inference, team routing, dedup.
- [x] `.agentkit/engines/node/src/backlog-store.mjs` — dual JSON + Markdown persistence with filter/sort.
- [x] `.agentkit/engines/node/src/import-issues.mjs` — runtime handler for import command.
- [x] `.agentkit/engines/node/src/backlog-viewer.mjs` — consolidated view (table/json/yaml/csv).
- [x] `.agentkit/engines/node/src/sync-backlog-runner.mjs` — orchestrated multi-source sync.
- [x] `.agentkit/engines/node/src/cli.mjs` — wire new commands + flags.
- [x] `.agentkit/engines/node/src/init.mjs` — auto-import on adoption when flag is enabled.
- [x] Platform templates for `import-issues` and `backlog` commands.
- [ ] `.agentkit/spec/teams.yaml` — intake routing already present; no changes needed.

## Definition of Done

- [x] GitHub is supported as a first-class configurable tracker with runtime adapter.
- [x] Linear is documented with a clear stub interface for future implementation.
- [x] Intake owner and escalation path are explicit.
- [x] Sync output is deterministic and validated.
- [x] Generated command/skill artifacts are semantically aligned across supported platforms.
- [x] Auto-import triggers on adoption when `process.intake.autoImport: true`.
- [x] Consolidated backlog view available via `agentkit backlog` with multiple output formats.
- [x] All tests pass, including dedicated coverage for the normalizer and store (see CI for current count).
