# SPEC: PM Capability Overhaul

**Status**: In Progress
**Created**: 2026-03-05
**Author**: AI-assisted (Claude)
**Relates to**: ADR-09 (PM Agent Loader)

## Problem Statement

The three PM agent personas (product-manager, project-shipper, release-manager) are
spec-level declarations with no runtime entry point. Team commands delegate to team
scopes but never load agent personas. Additionally:

- ~60% of each agent file is duplicated boilerplate
- No unified PM dashboard exists
- Focus areas overlap between PM agents
- Delivery metrics and risk tracking are claimed but not implemented
- No documentation explains how orchestration, teams, agents, and commands fit together

## Solution Overview

9 gaps (P0–P8) addressed across 4 implementation waves:

| Wave | Items      | Scope                                                                    | Status      |
| ---- | ---------- | ------------------------------------------------------------------------ | ----------- |
| 1    | P2, P7, P0 | Engine: feature-gated sections, concurrency simplification, agent loader | Complete    |
| 2    | P3, P5, P1 | Spec: tighten focus areas, risk register, /project-status command        | Complete    |
| 3    | P4         | Spec: delivery metrics in project-status                                 | Complete    |
| 4    | P8         | Docs: orchestration guide, PM guide, ADR, diagrams, migration            | In Progress |

## Architecture Changes

### P2 — Feature-Gated Shared Sections

Extracted ~70 lines of identical boilerplate from agent templates into `sections.yaml`.
Each section has a `gate` field referencing a feature templateVar. The engine populates
`shared_<key>` template variables — empty when the gate is disabled, full content when
enabled.

**Files modified:**

- `.agentkit/spec/sections.yaml` (new)
- `.agentkit/engines/node/src/synchronize.mjs` — section injection in `runSync()`
- `.agentkit/engines/node/src/template-utils.mjs` — RAW_TEMPLATE_VARS extended
- `.agentkit/templates/claude/agents/TEMPLATE.md` — boilerplate replaced with `{{shared_xxx}}`

### P7 — Concurrency Simplification

Full flock/fstat/inode protocol moved to reference doc (`docs/orchestration/concurrency-protocol.md`).
Agent files now contain a 10-line summary linking to the reference.

### P0 — Agent Loader

Team commands now inject agent persona context via `resolveTeamAgents()`. Resolution
logic: explicit `agents` field in teams.yaml → fallback to category-name match.

**Files modified:**

- `.agentkit/engines/node/src/synchronize.mjs` — `resolveTeamAgents()`, `buildTeamVars()`
- `.agentkit/templates/claude/commands/team-TEMPLATE.md` — `{{#if teamHasAgents}}` block
- `.agentkit/spec/teams.yaml` — optional `agents: [id1, id2]` per team

### P3 — Tighten Project Shipper Focus

Removed `docs/**` overlap. New focus: `.github/ISSUE_TEMPLATE/**`, `.github/PULL_REQUEST_TEMPLATE/**`,
`docs/handoffs/**`, `.claude/state/**`, `AGENT_BACKLOG.md`.

### P5 — Risk Register

Added risk register responsibilities to project-shipper agent. Schema defined for
`orchestrator.json` risks array with id, severity, category, description, mitigation,
owner, status, and raisedDate fields.

### P1 — /project-status Command

New workflow command that aggregates orchestrator state, backlog, tasks, events, and
git log into a unified markdown or JSON dashboard. Feature-gated behind `project-status`
(depends on `team-orchestration`). Supports `--format` and `--team` flags.

### P4 — Delivery Metrics

Extended project-status with 6 metrics: commit frequency, throughput, WIP count,
lead time, block rate, and cycle time. Computed from git log and task files, with
support for pre-computed values cached in orchestrator.json.

## Testing

21 unit and integration tests covering:

- Section gating logic (enabled/disabled per feature)
- `resolveTeamAgents()` (8 unit tests: category match, explicit agents, edge cases)
- Integration via `runSync()` (team-product has agents, team-backend doesn't)
- Concurrency simplification verification

All tests pass. Pre-existing failures (prettier on generated skills, discover commit
convention) are unrelated.

## Deferred

**P6 — Notion Integration**: Optional `--notify` flag on `/project-status` that pushes
reports to Notion via MCP tools. Tracked as GitHub issue.
