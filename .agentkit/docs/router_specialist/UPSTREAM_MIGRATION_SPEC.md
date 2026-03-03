# Router Specialist Upstream Migration Spec

> Delivery mode: issue/spec first.
> Target source-of-truth repo: `https://github.com/justaghost/agentkit-forge`.
> Scope for this migration pass: router core trio + architecture sync ownership docs.

## 1) Objective

Move router-specialist authoritative planning/docs ownership to `justaghost/agentkit-forge` and treat generated `.agentkit` router docs in consumer repos as reference-only.

## 2) In-Scope Files (this pass)

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

## 3) Repository Responsibility Model

| Concern                                       | Primary Repo                         | Secondary/Consumer                         |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------ |
| Router-specialist specs/templates/contracts   | `justaghost/agentkit-forge`          | Generated copies in consumer repos         |
| Gateway runtime behavior and SLO operations   | `phoenixvc/ai-gateway`               | N/A                                        |
| Consumer overlays and local integration notes | Consumer repo (`phoenixvc/chaufher`) | N/A                                        |
| Cost analytics and KPI dashboards             | `phoenixvc/pvc-costops-analytics`    | Downstream consumer of canonical contracts |

## 4) Migration Deliverables

1. Upstream docs updated to reflect source-of-truth ownership and phased runtime split.
2. Upstream checklist converted to authoritative execution tracker.
3. Upstream roadmap gains repository execution model section.
4. Upstream architecture docs include generated artifact overwrite warning.
5. Consumer repo docs replaced/maintained as route-level references only.
6. Upstream command reference/spec/templates reflect the current task protocol commands and hook JSON contract output shape.

## 5) Consumer Repo Policy (post-migration)

- Keep route-level references only in generated router-specialist docs.
- Do not accept authoritative router-specialist implementation edits in generated `.agentkit` files.
- Require upstream PR/issue links for all tracking updates in consumer repos.

## 6) Integration Impact: `phoenixvc/pvc-costops-analytics`

Treat as downstream consumer in this phase, with the following checkpoints:

- Event family mapping for `collaboration_*`, `reroute_*`, `rag_*`, compliance/eval events.
- Telemetry schema version compatibility contract.
- KPI compatibility between estimated orchestration cost and runtime metered cost.
- Integration backlog links from upstream tracker.

## 7) Decision Gates

### Gate A — Ownership

- [ ] Source-of-truth repo confirmed (`agentkit-forge`).
- [ ] Consumer repos set to reference-only mode for router-specialist docs.

### Gate B — Runtime handoff

- [ ] `ai-gateway` phase activation criteria documented.
- [ ] Cutover model decision recorded (`direct` vs `dual-runtime split`).

### Gate C — Analytics downstream

- [ ] `pvc-costops-analytics` ingestion contract version agreed.

### Gate D — Command/hook contract sync

- [ ] Upstream command docs/spec include `/mode`, `/delegate`, `/tasks` behavior and flags.
- [ ] Upstream hook templates consistently emit the expected output contract (`additionalContext`, `systemMessage`, `decision`, `reason` where applicable).
- [ ] Compatibility impact on consumer-generated output is documented.

## 8) Implementation Sequence

### Wave A (now)

- Migrate core trio docs upstream.
- Migrate architecture sync ownership docs upstream.
- Add source-of-truth policy language.
- Migrate command/hook contract updates upstream for the 11 listed files.

### Wave B

- Replace consumer repo copies with route-level reference stubs.
- Link stubs to upstream canonical paths/PRs.

### Wave C

- Activate runtime handoff items in `ai-gateway` as roadmap phases open.

## 9) Acceptance Criteria

- No authoritative section in consumer docs claims implementation ownership over generated router-specialist artifacts.
- Upstream docs are sufficient to execute Waves 0–3.5 without relying on consumer-repo copies.
- Runtime handoff and analytics integration checkpoints are explicitly represented in the upstream checklist.
- Upstream `COMMAND_REFERENCE`, `QUICK_START`, `commands.yaml`, command templates, and hook templates are aligned with the intended `/mode` + delegated-task protocol and hook output contract.
