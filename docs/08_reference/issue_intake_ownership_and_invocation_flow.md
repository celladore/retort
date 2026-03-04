# Issue Intake Ownership and Invocation Flow

## Purpose
Define a first-class, configurable issue intake model for GitHub and Linear, and map how intake behavior is invoked across supported agent platforms.

## Current Invocation Path

### Source-of-truth to generated outputs
1. Command and team intent are defined in `.agentkit/spec/commands.yaml` and `.agentkit/spec/teams.yaml`.
2. `pnpm -C .agentkit agentkit:sync` runs the sync engine (`.agentkit/engines/node/src/synchronize.mjs`).
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
2. Normalize fields (title, severity, labels, owner, component).
3. Map to team using scope rules.
4. Write/update local backlog records.
5. Emit events for audit trail and metrics.
6. Flag stale/unassigned issues for triage.

## Post-Sync Smoke Matrix

| Check | Command | Expected |
|---|---|---|
| Spec validation | `pnpm -C .agentkit agentkit:spec-validate` | Pass |
| Sync generation | `pnpm -C .agentkit agentkit:sync` | Completes without errors |
| Determinism | `pnpm -C .agentkit agentkit:sync && git status --short` | No unexpected drift on second run |
| Output validation | `pnpm -C .agentkit agentkit:validate` | Pass |
| Claude output parity | inspect `.claude/commands/sync-backlog.md` + `.claude/skills/sync-backlog/SKILL.md` | Intake semantics present |
| Copilot parity | inspect `.github/prompts/sync-backlog.prompt.md` | Intake semantics present |
| Cursor/Windsurf parity | inspect `.cursor/commands/sync-backlog.md` and `.windsurf/commands/sync-backlog.md` | Intake semantics present |
| Codex parity | inspect `.agents/skills/sync-backlog/SKILL.md` | Intake semantics present |

## Implementation Note
This repo protects source-of-truth paths under `.agentkit/spec`, `.agentkit/templates`, and `.agentkit/engines` from direct AI modification. Apply schema/template/engine changes via maintainer-driven updates, then run sync and validate using the matrix above.

## Maintainer Change List (Execution Checklist)
- `.agentkit/spec/project.yaml` — add/confirm configurable tracker selector semantics for intake.
- `.agentkit/spec/teams.yaml` — add intake owner/routing metadata.
- `.agentkit/spec/commands.yaml` — make `sync-backlog` tracker-neutral and ownership-aware.
- `.agentkit/engines/node/src/spec-validator.mjs` — validate new intake schema fields.
- `.agentkit/engines/node/src/synchronize.mjs` — propagate intake vars to templates.
- Platform templates for command/skill parity.

## Definition of Done
- GitHub and Linear are both documented and supported as first-class configurable trackers.
- Intake owner and escalation path are explicit.
- Sync output is deterministic and validated.
- Generated command/skill artifacts are semantically aligned across supported platforms.
