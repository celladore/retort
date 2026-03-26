# Agent Decision-Model Metadata and agents.yaml Directory Split — Implementation

**Completed**: 2026-03-26
**Status**: ✅ SUCCESSFULLY COMPLETED

---

## Overview

Two parallel workstreams delivered in one session:

1. **agents.yaml split** — the 3,234-line / 127 KB monolithic `agents.yaml` was replaced with a directory of 11 category files under `.agentkit/spec/agents/`. The sync engine was updated to load from the directory with backward-compatible fallback to a single file (supporting other repos that haven't migrated yet).

2. **Decision-model metadata** — six new optional fields (`decision-model`, `retry-policy`, `belief-system`, `confidence`, `negotiation`, `lookahead`) were added to all 39 agent definitions in the spec, rendered into every agent persona `.md` file via new Handlebars blocks in the template.

---

## Key Changes

### Spec

- `agents.yaml` deleted; replaced by `agents/engineering.yaml`, `agents/design.yaml`, `agents/marketing.yaml`, `agents/operations.yaml`, `agents/product.yaml`, `agents/testing.yaml`, `agents/project-management.yaml`, `agents/feature-management.yaml`, `agents/team-creation.yaml`, `agents/strategic-operations.yaml`, `agents/cost-operations.yaml`
- All 39 agents updated with `decision-model`, `retry-policy`, `belief-system`, `confidence`, `negotiation`, `lookahead` fields
- Stale `.agentkit/spec/agents.yaml` path references in `operations.yaml`, `team-creation.yaml`, `cost-operations.yaml` updated to `.agentkit/spec/agents/**`

### Engine (`synchronize.mjs`)

- `loadAgentsSpec(agentkitRoot)` — new exported function; loads from directory, falls back to monolithic file, returns `{ agents: {...} }` in both cases
- `buildAgentRegistry(agentsSpec)` — new exported function; returns `Map<id, { id, name, category, roleSummary, accepts }>`
- `buildCollaboratorsSection(agent, registry)` — new exported function; builds `## Collaborators` section from `depends-on`, `notifies`, and `can-negotiate-with` relationship graph
- Six `buildAgent*Section()` helpers for rendering new metadata fields
- `buildAgentVars()` extended to accept registry and emit all new section variables
- `syncAgentRegistry()` — generates `.claude/agents/REGISTRY.md` and `REGISTRY.json` on every sync; refactored to reuse `buildAgentRegistry` (removing duplicated truncation logic)
- `buildAgentLookaheadSection()` — fixed to return `''` when `enabled: false`, preventing noise sections in all 39 personas

### Callers updated (agents.yaml → loadAgentsSpec)

- `agent-integration.mjs` — `loadAgentNotifies`
- `agent-analysis.mjs` — `loadFullAgentGraph`
- `expansion-analyzer.mjs` — `analyzeExpansion`
- `spec-validator.mjs` — `validateSpec`
- `__tests__/wave1-pm-overhaul.test.mjs` — integration test

### Template

- `templates/claude/agents/TEMPLATE.md` — added `{{#if agentCollaborators}}` and six `{{#if agent*}}` blocks for new metadata sections

### Tests

- `__tests__/synchronize-agents.test.mjs` — 17 new tests covering `loadAgentsSpec`, `buildAgentRegistry`, `buildCollaboratorsSection`; formatted with Prettier

### Generated output

- All 39 `.claude/agents/*.md` persona files regenerated with Collaborators + Decision Model + Retry Policy + Belief System + Confidence + Negotiation sections; Lookahead suppressed (all agents currently `enabled: false`)
- `.claude/agents/REGISTRY.md` and `REGISTRY.json` added

---

## Results

| Metric | Before | After |
|---|---|---|
| `agents.yaml` size | 3,234 lines / 127 KB | Deleted — 11 files, largest 545 lines |
| Agent metadata fields | 8 fields | 14 fields |
| Callers reading deleted file | 4 | 0 |
| Test count | 1,243 passing | 1,260 passing (+17) |
| Broken test files | 7 (pre-session) | 2 (pre-existing copilot timeouts, unrelated) |
| `## Lookahead` noise sections | 39 (every agent) | 0 |

---

## Lessons Learned

- **Splitting large YAML files**: Use a Node.js one-liner with `js-yaml` to split programmatically — avoids copy-paste errors and preserves YAML integrity. Check all callers with `grep` before deleting the original.
- **Backward-compatible loaders**: The directory-vs-fallback pattern in `loadAgentsSpec` means other repos can migrate at their own pace without a simultaneous engine upgrade.
- **Template conditionals and truthy strings**: `buildAgentLookaheadSection` returned a non-empty string even when `enabled: false`, making the Handlebars `{{#if}}` always truthy. Always check that section builders return `''` for disabled/empty state.
- **DRY in generators**: `syncAgentRegistry` and `buildAgentRegistry` independently implemented the same first-sentence truncation. Centralising in `buildAgentRegistry` and delegating from `syncAgentRegistry` removed the duplication cleanly.

---

## Follow-On Work

See handoff documents in `docs/handoffs/` for the next sessions:

- `2026-03-26-session-engine-architecture.md` — split `synchronize.mjs` (3,200 lines), class-based refactor (GH#406–409), fix copilot test timeouts
- `2026-03-26-session-oversized-files.md` — split `commands.yaml` (91 KB) and `rules.yaml` (55 KB) using the same directory pattern
- `2026-03-26-strategic-auto-sync-opt-in.md` — GH#410
- `2026-03-26-strategic-telemetry.md` — GH#374
- `2026-03-26-strategic-ecosystem-map.md` — GH#375
