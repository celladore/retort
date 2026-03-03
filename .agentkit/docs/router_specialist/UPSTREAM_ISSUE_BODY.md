# Router-Specialist Upstream Migration: Source-of-Truth Realignment (Issue/Spec First)

## Summary

Migrate router-specialist authoritative planning/docs ownership to `justaghost/agentkit-forge` and treat generated `.agentkit` router docs in consumer repositories as reference-only.

## Why

Consumer repos currently carry generated router-specialist content that can drift from source-of-truth and be overwritten by sync. This creates execution ambiguity, duplicate authority, and loss of traceability.

## Scope (this pass)

### Router core trio

- `.agentkit/docs/router_specialist/IMPLEMENTATION_PLAN_V3.md`
- `.agentkit/docs/router_specialist/IMPLEMENTATION_CHECKLIST.md`
- `.agentkit/docs/router_specialist/Roadmap-v3.4-to-v4.3.md`

### Architecture sync ownership docs

- `.agentkit/docs/ARCHITECTURE.md`
- `.agentkit/docs/PLAN-sync-ownership-v0.2.2.md`

### AgentKit command/hook contract alignment (upstream authoritative updates)

- `.agentkit/docs/COMMAND_REFERENCE.md`
- `.agentkit/docs/QUICK_START.md`
- `.agentkit/spec/commands.yaml`
- `.agentkit/templates/claude/hooks/guard-destructive-commands.sh`
- `.agentkit/templates/claude/hooks/protect-sensitive.sh`
- `.agentkit/templates/claude/hooks/session-start.sh`
- `.agentkit/templates/claude/hooks/setup-environment.sh`
- `.agentkit/templates/claude/hooks/warn-uncommitted.sh`
- `.agentkit/templates/claude/commands/delegate.md`
- `.agentkit/templates/claude/commands/mode.md`
- `.agentkit/templates/claude/commands/tasks.md`

## Repository Responsibility Model

| Concern | Primary Repo | Secondary/Consumer |
| --- | --- | --- |
| Router-specialist specs/templates/contracts | `justaghost/agentkit-forge` | Generated copies in consumer repos |
| Gateway runtime behavior and SLO operations | `phoenixvc/ai-gateway` | N/A |
| Consumer overlays and local integration notes | Consumer repos | N/A |
| Cost analytics and KPI dashboards | `phoenixvc/pvc-costops-analytics` | Downstream consumer |

## Deliverables

1. Upstream docs updated for source-of-truth ownership and phased runtime split.
2. Upstream checklist converted to authoritative execution tracker.
3. Upstream roadmap updated with repository execution model.
4. Upstream architecture docs include generated-artifact overwrite warning.
5. Consumer repos remain route-level references only (no authoritative router-specialist execution state).
6. Upstream command docs/spec/templates reflect current task-protocol command behavior and hook JSON output contract.

## Consumer Repo Policy (post-migration)

- Keep route-level references only in generated router-specialist docs.
- Do not accept authoritative router-specialist implementation edits in generated `.agentkit` files.
- Require upstream issue/PR linkage for any local tracking update.

## Downstream Integration Checkpoints (`phoenixvc/pvc-costops-analytics`)

- Event family mapping: `collaboration_*`, `reroute_*`, `rag_*`, compliance/eval events.
- Telemetry schema version compatibility contract.
- KPI compatibility between orchestration-estimated and runtime-metered cost.
- Dependency linkbacks from upstream tracker.

## Decision Gates

### Gate A — Ownership

- [ ] Source-of-truth repo confirmed (`agentkit-forge`).
- [ ] Consumer repos switched to reference-only mode for router-specialist docs.

### Gate B — Runtime handoff

- [ ] `ai-gateway` activation criteria documented.
- [ ] Cutover model decision recorded (`direct` vs `dual-runtime split`).

### Gate C — Analytics downstream

- [ ] `pvc-costops-analytics` ingestion contract version agreed.

### Gate D — Command/hook contract sync

- [ ] Upstream command docs/spec include `/mode`, `/delegate`, `/tasks` behavior and flags.
- [ ] Upstream hook templates consistently emit expected JSON contract fields (`additionalContext`, `systemMessage`, `decision`, `reason` where applicable).
- [ ] Consumer impact notes added for generated outputs.

## Implementation Sequence

### Wave A (now)

- Migrate core trio docs upstream.
- Migrate architecture sync ownership docs upstream.
- Add source-of-truth policy language.
- Migrate command/hook contract updates upstream for the 11 listed files.

### Wave B

- Keep/convert consumer-repo copies to route-level reference stubs.
- Link stubs to upstream canonical paths/PRs.

### Wave C

- Activate runtime handoff in `ai-gateway` as roadmap phases open.

## Acceptance Criteria

- Consumer docs do not claim authoritative implementation ownership for generated router-specialist artifacts.
- Upstream docs are sufficient to execute Waves 0–3.5 without relying on consumer copies.
- Runtime handoff and analytics checkpoints are explicitly represented in upstream checklist/tracker.
- Upstream `COMMAND_REFERENCE`, `QUICK_START`, `commands.yaml`, command templates, and hook templates are aligned with `/mode` + delegated-task protocol and hook output contract.

## Suggested labels

`router-specialist` `governance` `docs` `migration` `upstream-first`

## Suggested assignees

- Maintainers of `justaghost/agentkit-forge`
- Runtime owner for `phoenixvc/ai-gateway`
- Analytics owner for `phoenixvc/pvc-costops-analytics`
