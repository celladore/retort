# Handoff — 2026-03-27: Budget Guard + Engine Fixes

## Session Summary

Branch: `fix/budget-guard-328` (→ PR #466, target `dev`)

---

## What Was Done

### 1. Fixed three pre-existing engine test failures

**Root cause analysis** — all failures existed before this branch:

| Failure | Root cause | Fix |
|---|---|---|
| `sync-integration` — all tests | Windows async `fs.rm` ENOTEMPTY race on tmpDir cleanup | Replaced `await rm(...)` with `rmSync(...)` in `finally` block — `synchronize.mjs` |
| `sync-integration` — `insertHeader` RangeError | Legacy `AgentKit Forge` header check matched body text in rule docs, causing infinite recursion | Scoped check to `content.slice(0, 500)` — `template-utils.mjs` |
| `sync-integration` — stale assertion | `[agentkit:sync]` prefix renamed to `[retort:sync]` but test was never updated | Updated assertion — `sync-integration.test.mjs` |
| `wave1-pm-overhaul` (21 tests) | Same ENOTEMPTY + recursion as above | Fixed automatically by the two engine fixes above |
| Prettier gate | `cli.mjs`, `validate.mjs`, overlay YAMLs, ~90 docs files never formatted | Ran `prettier --write` across all affected files |

**Result:** 47 test files pass, 1 skipped — 1250/1251 tests green.

### 2. Fixed `pnpm -C .agentkit` Windows failure

`pnpm -C` on Windows Git Bash parses `.agentkit` as a package name, not a directory.
The cross-platform equivalent is `pnpm --dir`.

- Replaced `pnpm -C .agentkit` → `pnpm --dir .agentkit` in:
  - 103 template files under `.agentkit/templates/`
  - `.agentkit/spec/commands.yaml`, `rules.yaml`, `sections.yaml`
  - `.agentkit/engines/node/src/init.mjs` (help text)
  - `getGeneratedHeader()` in `template-utils.mjs` (affects all generated file headers)
  - ~690 generated output files (`.claude/`, `docs/`, root `.md` files)
- Same fix for `npm run -C` → `npm run --prefix` for npm users

### 3. Renamed `wave1-pm-overhaul.test.mjs`

The name referenced an internal planning phase. Renamed to `sync-agent-features.test.mjs` — describes the four describe blocks accurately (feature-gated shared sections, resolveTeamAgents, sync integration for agent personas, concurrency protocol simplification).

### 4. Filed GH#467 — Agent usage metrics

New local observability issue covering:
- Per-agent invocation counts + task outcome rates in `agent-metrics.json`
- Health scores in `agent-health.json` (derived by retrospective-analyst)
- Structured `[METRICS]` events in `events.log` as the write path
- **Session-closure `stop` hook** that merges session counters into persistent cumulative store
- `/handoff` utilisation table + `/doctor` idle/at-risk warnings
- Additive merge semantics across sessions; `windowStart` reset controlled by `metricsWindow` setting

---

## Open PRs

| PR | Branch | Status | Notes |
|---|---|---|---|
| #466 | `fix/budget-guard-328` | Ready to merge → `dev` | Engine fixes, test rename, backlog update |
| #464 | `chore/migrate-to-pnpm` | Needs review → `dev` | pnpm migration (may be superseded by #466 bulk replace) |

---

## Pending / Not Done This Session

| Item | Detail |
|---|---|
| Budget-guard test gaps (Phase 3) | `corrupt/truncated session JSON`, `commandsRun: null`, `logBudgetEvent` dir creation, `runBudgetStatus` output metrics — delegate to `/team-testing` |
| `mystira-quartermaster` not found | Downstream `mystira-workspace` issue — add agent to `.claude/settings.json` `agentDefinitions` in that repo |
| Agent Decision-Model Metadata plan | Plan exists at `C:\Users\smitj\.claude\plans\elegant-foraging-eclipse.md` — not started |
| GH#467 implementation | Spec complete; no code written yet |

---

## Key Files Changed This Session

```
.agentkit/engines/node/src/synchronize.mjs          rmSync fix
.agentkit/engines/node/src/template-utils.mjs        insertHeader + syncCmd fix
.agentkit/engines/node/src/__tests__/sync-integration.test.mjs  stale assertion
.agentkit/engines/node/src/__tests__/sync-agent-features.test.mjs  (renamed)
.agentkit/templates/**  (103 files)                  pnpm --dir
.agentkit/spec/{commands,rules,sections}.yaml        pnpm --dir
~690 generated output files                          pnpm --dir + prettier
AGENT_BACKLOG.md                                     GH#467 added
```

---

## Next Session Starting Point

1. Review + merge PR #466 → `dev`
2. Delegate Phase 3 budget-guard test gaps to `/team-testing`
3. Decide whether to start Agent Decision-Model Metadata plan (6 fields across 40 agents in `agents.yaml`)
4. GH#467 implementation — start with P0: emit structured `[METRICS]` events in team workflow template
