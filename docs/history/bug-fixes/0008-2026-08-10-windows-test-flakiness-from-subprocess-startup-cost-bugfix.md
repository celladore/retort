# Windows test flakiness from subprocess startup cost Resolution - Historical Summary

**Completed**: 2026-08-10
**Bug ID**: [ADR-12](../../architecture/decisions/12-test-suite-reliability.md)
**PR**: [#PR-Number]
**Severity**: Medium (developer experience; CI was never affected)

## Problem Description

Under full-suite load on Windows, tests in `check.test.mjs`, `check-coverage.test.mjs` and
`cli.test.mjs` timed out non-deterministically, with a different failure set every run. Four full
runs of identical code on the same host produced 7 failures / 416s, 1 / 771s and 3 / 553s — all of
them 20s or 30s `Test timed out` errors, while all 106 tests in those files passed in isolation.

A moving failure set makes a red suite carry no information, so the practical response had become
"re-run it". The failures do not reproduce on Linux CI.

## Root Cause Analysis

Process startup on the affected Windows host is far more expensive than the fixtures assumed.
Measured at idle, with 79 entries on `PATH`:

| Spawn                                   | Cost per call |
| --------------------------------------- | ------------- |
| `where <cmd>` (Windows `commandExists`) | 1.2 – 2.6 s   |
| `node -e ""`                            | 0.7 – 1.9 s   |
| `node cli.mjs <cmd> --help`             | ~1.6 s        |

These were the "cheap no-op" primitives the tests were built on. `runCheck` spawns twice per step —
`commandExists` then `execCommand` — so the default three-step fixture paid six spawns and 6–12s
against a 20s budget before any contention. `cli.test.mjs` spawned the CLI once per command,
26 startups measuring 21.7s against a 30s budget.

Ranking each test by isolated cost against its own budget reproduces the reported failure set
exactly, in order. Which tests tip over on a given run is a scheduling accident, which is why the
set moves.

Two secondary defects surfaced:

- The `--help` loop could not detect what its name promised. `main()` short-circuits `--help`
  before it calls `loadCommandFlags()`/`parseFlags()`, so no option table is ever built and no flag
  configuration error can surface. Verified: `cli.mjs sync --bogus-flag --help` emits no
  unrecognized-flag warning, which only `parseFlags` produces.
- `cli.test.mjs`'s `run()` helper capped each child at 10s, below the 6.8s idle cost of the
  heaviest command it spawns. When it fired, `execFileSync` reported the killed child with a `null`
  status, so the failure read `expected null to be +0` — a timeout presenting as a wrong exit code.

## Solution Implemented

Remove the spawns rather than raise the budgets, following ADR-12 decisions 1 and 4.

### Code Changes

- **`.agentkit/engines/node/src/__tests__/check.test.mjs`**: mock `commandExists` and `execCommand`
  for the whole file. Assertions are about which steps get built and how exit codes map to
  statuses, so no real process is needed. The split-roots prettier test now asserts the resolved
  path reaches the runner rather than only that the step reported `PASS`, and a `FAIL`-mapping test
  was added — cheap once exit codes are controllable.
- **`.agentkit/engines/node/src/__tests__/check-coverage.test.mjs`**: default `execCommand` to a
  stub instead of the real implementation. The previous fix stubbed it for one test and restored
  the real one in `beforeEach`, which left every other `runCheck` test still spawning per step.
- **`.agentkit/engines/node/src/cli-flags.mjs`** (new): the flag tables, `loadCommandFlags` and a
  new `buildParseOptions` helper, extracted so they can be imported by a test. `cli.mjs` calls
  `main()` at import and exits via `process.exit`, so it cannot be imported directly.
- **`.agentkit/engines/node/src/cli.mjs`**: consumes `cli-flags.mjs`; `parseFlags` now calls
  `buildParseOptions`. No behaviour change.
- **`.agentkit/engines/node/src/__tests__/cli.test.mjs`**: the 26-spawn loop is replaced by
  in-process assertions over every command in `VALID_COMMANDS`, plus a guard that fails if
  `commands.yaml` silently failed to load. The sibling test that scraped `cli.mjs` source with
  regexes is replaced by a direct assertion over the real objects. The child cap is raised to 60s
  with its reasoning recorded, and `run()` now reports a killed child as `timedOut`.
- **`docs/architecture/decisions/12-test-suite-reliability.md`**: 2026-08-10 revision.

### Testing

- **Unit Tests**: net +4 assertions. The new flag-configuration tests cover the `commands.yaml`
  flag surface and all 30 registry commands, neither of which the spawn-based version reached.
- **Integration Tests**: unchanged. Real end-to-end `execCommand` behaviour stays in
  `runner.test.mjs`, which exercises it against actual processes in nine cases.
- **Manual Testing**: CLI parity checked directly — `sync --help`, unknown-flag warning,
  `tasks --status` with no value, and an unknown command all behave as before the extraction.

## Verification

Three consecutive full-suite runs on the Windows host where the flake occurs, on the merged tree,
using the repository's own PR #589 tooling exactly as CI invokes it — `pnpm test` for the run,
`pnpm test:reconcile` for the integrity gate:

| Run | `vitest` | `test:reconcile` | Tests                    | Wall   |
| --- | -------- | ---------------- | ------------------------ | ------ |
| 1   | 0        | 0                | 2,379 passed / 1 skipped | 493.0s |
| 2   | 0        | 0                | 2,379 passed / 1 skipped | 581.2s |
| 3   | 0        | 0                | 2,379 passed / 1 skipped | 249.7s |

Run 1 against runs 2 and 3 are identical test-for-test — same 2,380 IDs, same status on each. That
is ADR-12's stated criterion, which had not previously been met on merged `dev`, and this is the
first time it has been demonstrated with the reconciliation gate enforcing it rather than a
hand-rolled check.

An earlier set of three runs on the pre-merge tree gave the same result (2,329 passed / 1 skipped
of 2,330, identical across runs) using equivalent hand-written reconciliation.

Both false-green modes ADR-12 records were guarded rather than assumed away: exit codes come from
the process directly with nothing piped, and every run is reconciled so a crashed worker silently
dropping tests cannot pass as green.

CI is green on all checks, including the required `Test`, `Validate` and `branch-rules` — the
Linux `Test` job confirms the change is not a Windows-specific workaround.

### Before/After Comparison

| Measure                                   | Before | After    |
| ----------------------------------------- | ------ | -------- |
| `check.test.mjs` test-phase time          | 53.1s  | **1.2s** |
| `check-coverage.test.mjs` test-phase time | 16.8s  | **3.1s** |
| Worst test in the three files             | 21.65s | **5.4s** |
| Tightest headroom against budget          | 1.4×   | **16×**  |

About 90 process spawns are removed from the suite: ~50 from `check.test.mjs`, ~12 from
`check-coverage.test.mjs`, 26 from `cli.test.mjs`.

### Regression Testing

The `commands.yaml` guard in `cli.test.mjs` fails loudly if `loadCommandFlags` silently falls back
to the CLI-internal tables, which would otherwise let the flag assertions pass while covering a
fraction of the surface.

## Impact Assessment

Developers on Windows, who could not trust a red local suite. CI was never affected — the
2026-08-07 revision established that none of these failures reproduce on Linux runners, which is
also why quarantine was rejected: it would have removed real coverage on the platform the pipeline
actually runs to fix a local-only symptom.

## Prevention Measures

- Treat `commandExists` and `execCommand` as expensive on Windows, not as free guards. Forcing
  `commandExists` true removes the guard that prevents a real binary being spawned.
- Real-process behaviour belongs in `runner.test.mjs`. Tests about orchestration logic should stub
  the runner.
- An inner child timeout is a backstop, not a budget. It is only useful when it sits clearly
  outside the budget it protects — and because `execFileSync` blocks the worker synchronously,
  Vitest's per-test timeout cannot pre-empt it.

## Lessons Learned

Ranking tests by isolated cost against their own budget identified the failing set exactly, in
order, without needing to reproduce the flake. Headroom is the diagnostic; the timeout is only the
symptom.

A test can be expensive and still not test what its name says. The `--help` loop spent 26 process
startups asserting command-name membership, and raising its budget would have preserved both the
cost and the gap.

The 30 GB free-disk precondition from the previous revision is too strong: six full suites ran for
this fix, starting from 11.6 GB free and ending at 8.7 GB, and every one produced a valid,
reconciled result. The peak working set was not re-measured, so only the operational rule is
corrected, not the earlier figure.

---

**Fix Author**: JustAGhosT
**Reviewer**: [Reviewer]
**Status**: Resolved
