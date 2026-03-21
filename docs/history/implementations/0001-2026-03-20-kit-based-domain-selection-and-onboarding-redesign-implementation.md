# Kit-Based Domain Selection and Onboarding Redesign — Implementation

**Completed**: 2026-03-20
**Duration**: 2 sessions
**Status**: ✅ **SUCCESSFULLY COMPLETED**
**PR**: #432 — `feat/kit-domain-selection-onboarding`

## Overview

Retort was generating rules, agents, and commands for all 16 domains regardless of the
adopter's tech stack. A TypeScript-only project received dotnet, rust, python, and blockchain
rules it would never use. This implementation adds stack-aware domain filtering, an interactive
init wizard, a CLI-spec parity validator, and resolves the agentkit-forge → retort identity
rename.

## Key Changes

| Commit | Change |
|--------|--------|
| `chore(spec)` | Renamed `agentkit-forge` → `retort` across all 10 spec YAML files |
| `feat(engine)` | `filterDomainsByStack()` + `filterTechStacks()` in `template-utils.mjs` + `synchronize.mjs` |
| `feat(engine)` | 16 fixture-based generation tests in `__tests__/generation.test.mjs` |
| `feat(init)` | Interactive kit wizard with dry-run mode, stack detection, optional kit selection |
| `fix(hooks)` | Truncate `run_check()` output to prevent `jq: Argument list too long` (ARG_MAX crash) |
| `perf(hooks)` | Stop hook: removed full sync + full test suite; lint-only per stack |
| `perf(hooks)` | Changed-files gating — hook costs <0.1s when nothing relevant changed |
| `feat(validate)` | Phase 10 CLI-spec parity check in `validate.mjs` |
| `chore(spec)` | `skills.yaml` spec for skill distribution model |
| `docs` | TRAE compatibility audit stub — `docs/integrations/trae-compatibility.md` |

## Implementation Approach

### Phase 1 — Identity rename
Replaced all 16 `agentkit-forge` references in `.agentkit/spec/` with `retort`.

### Phase 2+3 — Domain filtering
Added `filterDomainsByStack(rules, vars, project)` and `filterTechStacks(stacks, vars)` to
`template-utils.mjs`. Applied at all domain generation call sites in `synchronize.mjs`.
`languageProfile.mode: heuristic` preserves backward-compatible all-domains behaviour.

### Phase 4 — Init wizard
`init.mjs` now runs an interactive flow: detect stack → show active kits → prompt for
opt-in extras → write `project.yaml` → run sync → validate. `--dry-run` shows the plan
without writing.

### Phase 6 — Generation tests
4 fixture scenarios (`js-only`, `fullstack`, `explicit-domains`, `heuristic`) assert the
correct domains appear/are absent after a sync run.

### Stop hook fixes (cross-cutting)
- ARG_MAX fix: `run_check()` truncates output to 3000 chars before passing to `jq --arg`
- Performance: replaced 30s+ drift sync + full test suite with lightweight `git diff` warn
  and lint-only checks; changed-files gating skips all checks when nothing relevant changed

### Phase 5 — Issue tracking
- Issue 006: `validate.mjs` Phase 10 CLI-spec parity; all checkboxes closed
- Issue 040: elegance-guidelines sync compatibility; final checkbox closed
- `/cicd-optimize` command added to `commands.yaml`
- `init` added as `type: framework`; `FRAMEWORK_COMMANDS` documented

## Results

- **Stop hook**: worst-case 277s → <5s; unchanged-code path <0.1s
- **Domain noise**: JS-only projects now receive 9 domains instead of 16
- **Test suite**: 1243 tests, all passing (1 skipped Prettier formatting check)
- **Issues closed**: 006 (fully), 040 (fully)
- **Identity**: zero `agentkit-forge` references remain in `.agentkit/spec/`

## Deferred

- **TRAE format audit** (Issues 025/026/027): requires WebFetch — blocked this session.
  Tracking doc at `docs/integrations/trae-compatibility.md` with 4 URLs and audit questions.

## Lessons Learned

- `jq --arg` silently fails on ARG_MAX-sized strings — truncate before passing
- Stop hooks must be <5s to avoid blocking interactive sessions; test suites are never appropriate
- Changed-files gating is the right pattern for all language checks in stop hooks
- `languageProfile.mode` as a three-way switch (heuristic / hybrid / configured) gives
  clean backward-compat story for domain filtering

---

**Implementation Team**: Claude Sonnet 4.6 + JustAGhosT
**Review Status**: PR #432 open, pending merge
**Next Steps**: Merge PR #432; TRAE audit in next session with web access
