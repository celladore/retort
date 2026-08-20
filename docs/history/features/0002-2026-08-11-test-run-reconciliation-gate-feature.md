# Test-run reconciliation gate Launch - Historical Summary

**Launched**: 2026-08-11
**PR**: [#589](https://github.com/phoenixvc/retort/pull/589)
**Feature Type**: New Feature (CI integrity gate + reporting artifacts + quarantine mechanism)
**ADR**: [ADR-12 decision 5](../../architecture/decisions/12-test-suite-reliability.md) — "make flakes visible rather than silently retried"

## Feature Overview

A Vitest run can drop tests and still print a passing summary. This adds machine-readable
test artifacts and a gate that fails the build when the reported outcomes do not add up to
the reported total, plus a quarantine mechanism for confirmed flakes.

The governing rule the gate encodes: **a run that does not reconcile is void, not green.**

## User Problem Solved

**A green summary did not mean the suite ran.** A full-suite run on Windows against `dev` at
`6848f3f7` logged `Error: Worker exited unexpectedly` and then printed:

```text
Test Files  75 passed | 1 skipped (77)
Tests       2273 passed | 1 skipped (2327)
```

2273 + 1 is 2274, not 2327. Fifty-three tests and a whole file were silently dropped, and the
summary reported it as a pass. Vitest's own warning for this condition is that it "might cause
false positive tests". Nothing downstream noticed, because every number that _was_ printed
looked healthy — the discrepancy is only visible if you add the buckets up and compare, which
nothing did.

**Console scrollback is not evidence.** Before this, the only record of a run was terminal
output. Comparing two runs test-for-test — which ADR-12's acceptance criterion requires —
meant eyeballing thousands of lines.

**Decision 5 had been deferred on a circular premise.** On 2026-08-07 it was deferred because
"there are no CI flakes to surface", which assumed a green summary means the suite ran. The
incident above is the counter-example, and it made the deferral self-confirming.

## Implementation Details

### Architecture

Three cooperating pieces, deliberately separated by provenance:

1. **Vitest's own reporters** (`junit`, `json`) write the primary record. The gate computes
   reconciliation against Vitest's JSON output rather than anything this repo produces, so the
   primary guard cannot be defeated by a bug in the tooling added here.
2. **A custom reporter** supplies only what the JSON report omits — unhandled errors never
   attach to a test, and retry diagnostics are not serialised.
3. **The gate** reads both, plus the quarantine registry, and decides.

### Components

- **`.agentkit/scripts/reconcile-test-results.mjs`**: the gate. Pure functions
  (`reconcileTestResults`, `applyRunIntegrity`, `formatText`, `formatMarkdown`, `parseArgs`)
  plus a CLI. Exit 0 = reconciles, 1 = void, 2 = usage error. Emits GitHub `::error::` /
  `::warning::` annotations and a step-summary table when running under Actions.
- **`.agentkit/scripts/vitest-run-integrity-reporter.mjs`**: records per-run integrity —
  counts, tests with no reported outcome, tests that passed only on retry, and unhandled
  errors. `collectRunIntegrity` is pure and unit-tested against synthetic modules.
- **`.agentkit/scripts/test-quarantine.mjs`**: registry load + validation. Structural checks
  throw (they run inside `vitest.config.mjs`, where a malformed registry must fail loudly
  rather than silently run quarantined files in the blocking suite); policy checks return
  problems so a stale entry fails CI without breaking every local run.
- **`.agentkit/scripts/run-quarantined-tests.mjs`**: runs only the quarantined files. Exits 0
  without invoking Vitest when the registry is empty, which is the healthy state.
- **`.agentkit/test-quarantine.json`**: the registry. Empty at launch.

### What the gate checks

Beyond the headline sum:

| Check                  | Catches                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `count-mismatch`       | passed + failed + skipped + todo ≠ reported total                  |
| `detail-mismatch`      | summary and per-file detail disagree on the count                  |
| `tally-mismatch`       | a summary bucket disagrees with the per-file tally                 |
| `unreported-tests`     | a test carrying a non-terminal status — the dropped-test signature |
| `unhandled-errors`     | an error escaped the run; part of the suite did not execute        |
| `success-inconsistent` | the report claims `success: true` while failing to reconcile       |
| `report-missing`       | no machine-readable result at all — an unverifiable run            |
| `report-empty`         | zero tests collected                                               |
| `quarantine-*`         | an entry lacking a tracking issue, stale, duplicated, or undated   |

### API Changes

Two new package scripts in `.agentkit/package.json`:

- `pnpm test:reconcile` — run the gate against the last run's artifacts
- `pnpm test:quarantine` — run only the quarantined files

`.agentkit/vitest.config.mjs` gains `reporters`, `outputFile`, a quarantine-driven `exclude`,
and `retry: 1` **in CI only**. `RETORT_TEST_QUARANTINE=off` runs quarantined files inline.

### Database Changes

n/a.

## User Experience

Every `pnpm test` writes `.agentkit/test-results/{results.json,junit.xml,run-integrity.json}`
(gitignored). CI uploads them as a 14-day artifact, so a run stays inspectable per-test after
the fact instead of only as scrollback.

### UI Changes

The `Test` job gains `Upload test results` and `Reconcile test results` steps, both
`if: always()` so evidence survives a failing gate. A new non-blocking `Quarantined Tests` job
runs the registry. On failure the gate writes a totals table and the names of every dropped
test to the job summary.

`Quarantined Tests` is deliberately **not** a required check: a quarantined test is a known
flake with a tracking issue, and making it block would be indistinguishable from leaving the
flake in the blocking suite.

### Documentation

`qa-run-reconciliation` added to `.agentkit/spec/rules.yaml` and synced to all render targets,
so the convention reaches every AI tool's rule set. ADR-12 decision 5 marked implemented, with
a revision recording why the deferral was wrong.

## Rollout Plan

### Phasing

- **Phase 1**: reporters + gate + quarantine mechanism, registry empty (this PR).
- **Phase 2**: none planned. The mechanism exists so that quarantining the next confirmed
  flake is an entry in a JSON file rather than a design exercise.

### Monitoring

The gate is the monitor. Flaky tests surface as `::warning::` annotations rather than
failures — a test rescued by a retry is not a failure, but it must not pass unnoticed.

## Results

The failure mode was reproduced end-to-end rather than argued from the schema. A fixture whose
second test calls `process.abort()` under `--pool=forks` produces the same
`[vitest-pool]: Worker forks emitted error`, the same passing-looking summary
(`Test Files 1 passed (2)`, `Tests 1 passed (5)`), and `success: true` in the JSON report with
both files marked `passed`. The gate fails it with `count-mismatch`, `unreported-tests`,
`success-inconsistent` and `unhandled-errors`, and names all four dropped tests.

Behaviour on real runs, all correct:

| Run                                   | Outcome                              |
| ------------------------------------- | ------------------------------------ |
| Healthy suite                         | exit 0                               |
| Suite with 7 genuine timeout failures | exit 0 — informative, not void       |
| Suite with 3 genuine timeout failures | exit 0 — informative, not void       |
| Synthetic worker abort                | exit 1 — void, 4 dropped tests named |

That distinction is the whole point: a failing suite is informative, and only a suite that has
lost tests is void.

### Usage Statistics

50 unit tests across the three new modules, including CLI-level exit-code coverage.

### User Feedback

The gate became the sanctioned instrument for ADR-12's acceptance criterion within a day.
[#591](https://github.com/phoenixvc/retort/pull/591) used `pnpm test` plus `pnpm test:reconcile`
— "exactly as CI invokes them", rather than a bespoke harness — to demonstrate three
consecutive full runs of 2,379 passed / 1 skipped, identical test-for-test, closing a criterion
that had been open since 2026-08-06.

## Future Enhancements

- The reconciliation is computed over tests present in Vitest's task tree at run end. A file
  that vanished from the tree entirely would take its tests out of both the total and the
  buckets and would still reconcile. That case is covered by the unhandled-error check rather
  than by the sum, since a dying worker always produces one — but the sum alone is not a
  complete guarantee, and a future version could cross-check the collected file list.
- `retry: 1` is CI-only by design. If flaky labelling proves useful locally, it could be
  opt-in via an env var rather than enabled by default.

## Related Work

- [ADR-12](../../architecture/decisions/12-test-suite-reliability.md) — decisions 1, 3, 4 and 6
  preceded this; decision 2 was measured and struck.
- [#588](https://github.com/phoenixvc/retort/pull/588) — recorded the motivating incident and
  the "not yet implemented" note this PR answers.
- [#591](https://github.com/phoenixvc/retort/pull/591) —
  [history](../bug-fixes/0008-2026-08-10-windows-test-flakiness-from-subprocess-startup-cost-bugfix.md)
  — removed the residual Windows flakiness and used this gate to prove it.
- [#592](https://github.com/phoenixvc/retort/pull/592) — promoted `Prettier` to a required
  check; `Quarantined Tests` deliberately stays optional.

---

**Product Manager**: n/a (framework-internal)
**Tech Lead**: Jurie Smit
**Status**: Live
