# Handoff: Engine Architecture Review

**Date:** 2026-03-26
**Prepared for:** Agent reviewing and improving the retort sync engine
**Branch base:** branch from `dev`

---

## What the Engine Is

The sync engine lives in `.agentkit/engines/node/src/`. It reads YAML specs from `.agentkit/spec/` and renders configurations for 15+ AI platforms into the project directory. The entry point is `runSync()` in `synchronize.mjs`.

All of this is **working code** — the task here is architectural review and improvement, not feature work.

---

## Current Module Map

| File                     | Lines | Role                                                                                |
| ------------------------ | ----- | ----------------------------------------------------------------------------------- |
| `synchronize.mjs`        | 3,203 | Core sync engine — all platform renderers, spec loaders, template vars, `runSync()` |
| `spec-validator.mjs`     | 1,319 | Validates all spec YAML before sync                                                 |
| `discover.mjs`           | 1,242 | Codebase discovery — detects stack, tools, dependencies                             |
| `agent-integration.mjs`  | 1,211 | Agent task notification, handoff chains, event emission                             |
| `init.mjs`               | 1,171 | Interactive project initialisation wizard                                           |
| `orchestrator.mjs`       | 1,155 | Orchestrator state machine — task dispatch, dependency resolution                   |
| `template-utils.mjs`     | 1,144 | Handlebars rendering, `{{placeholder}}` resolution, merge driver                    |
| `task-protocol.mjs`      | 1,036 | Task file lifecycle (submitted → accepted → working → completed)                    |
| `feature-manager.mjs`    | 961   | Feature flag management and `affects-templates` validation                          |
| `agent-analysis.mjs`     | 921   | Agent/team relationship graph — orphan detection, cycle detection, bottlenecks      |
| `expansion-analyzer.mjs` | 825   | Read-only gap analysis — missing docs, tests, security measures                     |
| `check.mjs`              | 631   | Quality gate runner (lint, typecheck, test)                                         |
| `cost-tracker.mjs`       | 613   | LLM session cost tracking                                                           |
| `review-runner.mjs`      | 616   | Code review — secret scan, TODO scan, large file detection, coverage delta          |
| `cli.mjs`                | ~400  | CLI entry — routes commands to engine functions                                     |

**Total engine source:** ~21,900 lines across 14 modules

---

## Known Architectural Problems

### 1. `synchronize.mjs` is a god module (3,203 lines)

It contains:

- Spec loaders (`loadAgentsSpec`, `loadSpecDefaults`, `readYaml`)
- Platform renderers (20+ `sync*` functions — `syncClaudeAgents`, `syncCopilotPrompts`, `syncCursorCommands`, etc.)
- Template variable builders (`buildAgentVars`, `buildTeamsList`, `buildRuleVars`, etc.)
- Agent registry (`buildAgentRegistry`, `buildCollaboratorsSection`)
- Output utilities (`writeOutput`, `walkDir`, `ensureDir`, `runConcurrent`)
- The main orchestrator `runSync()`

All exported from a single file with 19 export points. This makes it hard to test in isolation and impossible to tree-shake.

**What to do:** Identify cohesive groups and propose a module split. Candidates:

- `spec-loaders.mjs` — `loadAgentsSpec`, `loadSpecDefaults`, `readYaml`, `readText`
- `agent-vars.mjs` — `buildAgentVars`, `buildAgentRegistry`, `buildCollaboratorsSection`, all `buildAgent*Section()` helpers
- `sync-utils.mjs` — `writeOutput`, `walkDir`, `ensureDir`, `runConcurrent`, `insertHeader`
- `platform-renderers/claude.mjs`, `platform-renderers/cursor.mjs`, etc. — each `sync*` function family

Do not split blindly — map the import graph first to understand what each function actually depends on.

### 2. `sync-integration.test.mjs` — copilot tests hit `beforeAll` timeout

Two test suites (`syncCopilotPrompts`, `syncCopilotAgents`) time out because `beforeAll` calls `runSync()` which now renders 39 agent personas and takes >30s. The vitest config sets `hookTimeout: 30_000`.

**What to do:** Either raise `hookTimeout` for these specific suites (pass `{ timeout: 90_000 }` to the `beforeAll` call), or mock the agents spec in these tests to use a 3-agent fixture instead of the full 39-agent real spec.

### 3. `template-utils.mjs` has known TODOs (1,144 lines)

Grep for `TODO`/`FIXME`/`HACK` in this file and `task-protocol.mjs` before starting. At least one section of `template-utils.mjs` has a workaround comment — identify and resolve it.

### 4. No `loadCommandsSpec` / `loadRulesSpec` yet

`commands.yaml` (91 KB) and `rules.yaml` (55 KB) are still monolithic. The agents split (this session's work) created the pattern — these two files should follow. A separate session handoff covers this (`2026-03-26-session-oversized-files.md`) but the engine architecture agent should be aware of it and can implement the loaders as part of a broader refactor if it makes sense to batch.

### 5. Spec loader inconsistency

Three different styles of reading spec files exist in the codebase:

- `loadAgentsSpec(agentkitRoot)` — new, handles directory or monolithic fallback
- `loadYamlSpec(agentkitRoot, filename)` — async, used in `expansion-analyzer.mjs`
- `readYaml(filePath)` — synchronous, used in tests and older code paths

These should be unified. `loadYamlSpec` is a local private function in `expansion-analyzer.mjs` that duplicates `readYaml`. Consolidate.

---

## What This Session Should Produce

### Required output: Architecture ADR

`docs/architecture/decisions/XX-engine-module-split.md`

The ADR should answer:

- What modules should `synchronize.mjs` be split into?
- What is the proposed import graph after splitting?
- What is the migration order (which extract first, which last)?
- What tests need updating when each module moves?

### Required output: Fix the copilot test timeouts

Patch `sync-integration.test.mjs` to resolve the 2 failing suites. Preferred approach: inject a small fixture `agentsSpec` rather than loading the real 39-agent spec in these tests. Check how `wave1-pm-overhaul.test.mjs` constructs mock `agentsSpec` objects — use the same pattern.

### Optional output: Unified spec loader

Consolidate `loadYamlSpec`, `readYaml`, and similar helpers into a single `spec-loaders.mjs` that all engine modules import. Only do this if it falls naturally out of the module split — don't do it as a standalone refactor if it requires touching 10+ files.

---

## How to Read the Codebase

Start with the public API surface:

```bash
grep -n "^export" .agentkit/engines/node/src/synchronize.mjs
```

Then trace `runSync()` — it is the single entry point that calls all platform renderers. Understand the call tree before proposing any split.

To see what each test suite actually exercises:

```bash
grep -n "describe\|it(" .agentkit/engines/node/src/__tests__/sync-integration.test.mjs | head -40
```

---

## Constraints

- Do not change public export names — other modules import from `synchronize.mjs` and tests import specific named exports
- Any split must maintain backward compatibility for external callers (other repos using retort as a dependency)
- After any engine change, run `pnpm -C .agentkit retort:sync` then `pnpm -C .agentkit test`
- PR target is `dev`; conventional commit: `refactor(engine): extract spec-loaders from synchronize.mjs`
- The copilot timeout fix is a `test(engine): fix copilot beforeAll timeout` commit — separate from any refactor PR
