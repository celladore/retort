# ADR-12: Restore Test Suite Reliability

**Status:** Proposed
**Date:** 2026-08-06
**Deciders:** JustAGhosT
**Related:** [ADR-11](./11-eliminate-sync-churn.md) (generated-file churn), `qa-e2e-stability` and `qa-no-sleep` conventions in `.agentkit/spec/rules.yaml`

## Context

The engine test suite runs 2152 tests across 73 files in roughly 730 seconds and fails
non-deterministically. Because failures move between runs, a red result carries no
information — the practical response has become "re-run it", which is the same failure mode
ADR-11 describes for the drift check.

### The failures are not regressions

Two consecutive full-suite runs of **identical code** produced different results:

| Run | Failed files | Skipped |
| --- | ------------ | ------- |
| 1   | 2            | 8       |
| 2   | 4            | 24      |

Running each reported-failing suite in isolation:

| Suite                          | Isolated result          |
| ------------------------------ | ------------------------ |
| `discover.test.mjs`            | 25/25 pass               |
| `sync-agent-features.test.mjs` | 21/21 pass               |
| `sync-integration.test.mjs`    | 94/95 pass (one timeout) |

The single remaining failure — `--overwrite flag > overwrites project-owned files` — was
verified against a baseline with all local engine changes stashed. It failed identically
(60s timeout) on the unmodified tree, confirming it is pre-existing rather than a regression.

Separately, `prettier.test.mjs` was genuinely red: three files
(`.claude/plans/tui-entry-point.md`, `.claude/rules/agent-delegation.md`,
`.claude/rules/hookify.md`) were unformatted. That has been fixed and is not part of this
decision.

### Root cause: sync is slow because it spawns subprocesses

A CPU profile of a single `retort sync` attributes **87.8% of sampled time (44.8s of 51s) to
`spawnSync`**. Everything else is below 5%:

```text
  44.81s   87.8%  spawnSync @ child_process:1103
   2.21s    4.3%  (idle)
   0.94s    1.8%  existsSync
   0.73s    1.4%  replacePlaceholders @ template-utils.mjs:137
```

The source is `runPostSyncPrettier` in `scaffold-engine.mjs:474`, which formats generated
output by spawning `node prettier.cjs --write <batch>` in batches of 50. A sync writes 628
files, so this is **13 Node process startups per sync**, each paying interpreter boot plus
Prettier module load before formatting anything.

Measured end-to-end sync cost:

| Condition  | Time    |
| ---------- | ------- |
| Cold cache | ~69s    |
| Warm cache | ~22–31s |

Tests call `runSync` repeatedly and many assert against a 15s, 30s, or 60s timeout. A sync
that costs 25s warm and 69s cold breaches those limits whenever the cache is cold or the
machine is under parallel load — which is exactly when the whole suite runs. This explains
both the flakiness and why one test fails even in isolation.

A measurement note for future readers: an initial comparison suggested `--overwrite` was 2.7×
faster than a normal sync. That was a cold-cache artifact of running the normal sync first.
With a warm cache and reversed ordering the two modes are equivalent, and within-mode variance
exceeds the between-mode difference.

## Decision

Adopt five changes, ordered by leverage.

### 1. Format in-process instead of spawning Prettier

Replace the `execFileSync` batching in `runPostSyncPrettier` with Prettier's Node API,
resolving the module once and formatting files in the existing process. This removes all 13
process startups per sync and targets the single dominant cost. Prettier failures on
individual files must remain non-fatal, matching current behaviour.

**Implemented (2026-08-06)**, jointly with ADR-11 decision 1 — they proved to be the same
change, since formatting had to move _before_ the content comparison for either to work. Sync
dropped from ~25s to 13s warm, and now writes zero files when nothing has changed. The
identified risk about config resolution was real and handled: Prettier's Node API does not
resolve `.prettierrc`/`.prettierignore` implicitly, so both are resolved against each file's
destination path. `prettier --check` passes project-wide afterwards, confirming parity with
CLI output.

Effect on the suite is **not cleanly measurable on this machine**. Wall times across runs of
essentially equivalent code:

| Run                             | Wall time |
| ------------------------------- | --------- |
| Baseline                        | 756s      |
| Baseline (repeat)               | 726s      |
| With decision 2 (reverted)      | 1294s     |
| After decision 1                | 386s      |
| After decision 1 (later, clean) | 857s      |

An earlier revision of this ADR claimed a 47% wall-time reduction from decision 1. That was a
single 386s sample, and the 857s run of equivalent code contradicts it. **The claim is
withdrawn.** Run-to-run variance on this Windows machine exceeds the effect being measured, so
no suite-level speedup should be asserted from these numbers.

The **sync-level** measurement is trustworthy by contrast — ~25s to 13s, repeated across several
runs of a single deterministic operation with a clear mechanism (13 removed process startups).
Suite wall time is simply the wrong instrument here.

Decision 1 also **did not make the suite green**. Failure counts have ranged 4 to 8 across runs
of the same code, all timeouts, all on Windows only.

### 2. Isolate sync-heavy suites from parallel execution

Split the Vitest run into two projects: `unit` (the ~67 fast files, parallel) and `sync-heavy`
(the suites performing full syncs, sequential). Preferred over a global thread cap, which would
slow the entire suite to stabilise a handful of files.

**Attempted and reverted (2026-08-06).** This was implemented ahead of decision 1 and measured
worse on both axes: wall time rose from ~730s to **1294s** and the suite still failed with 3
failed files. The cause is that `fileParallelism: false` serialises files only _within_ a
project — Vitest still runs the two projects concurrently, so the sync-heavy suites continued
to contend with all 2017 unit tests while losing the ability to spread across workers.

If revisited, the projects must be run sequentially at the script level
(`vitest run --project unit && vitest run --project sync-heavy`) rather than via
`fileParallelism`. But decision 1 should land and be re-measured first: `sync-integration`
alone makes 42 `runSync` calls, so at ~25s per sync no scheduling change can bring it inside
the hook timeouts. The cost per sync is the binding constraint, not the parallelism.

### 3. Move the Prettier check out of Vitest

`prettier.test.mjs` shells out to scan the entire repository from within the unit suite. It is
slow, it races with concurrently running tests — it already carries a retry-once workaround
documenting exactly that — and a whole-repo format check belongs in the lint job. Move it there
and delete the retry hack.

### 4. Give the git-log heuristic tests a fixture repository

`detectCommitConvention()` tests read ambient repository history, which is why they pass in
isolation and fail under load. They must construct a fixture repository with known commits.

### 5. Make flakes visible rather than silently retried

Emit a JUnit or JSON reporter artifact in CI and enable rerun-based flake detection so an
intermittent test is labelled rather than retried into green. Quarantine confirmed flakes with
tracking issues, per the existing `qa-e2e-stability` convention.

**Implemented (2026-08-10).** Deferred on 2026-08-07 as speculative — see the revision below
for the evidence that reversed that call.

### Sequencing

**1 before 2.** If in-process formatting removes enough cost, the timeouts may stop firing and
the parallelism split becomes a smaller optimisation rather than a correctness requirement.
Re-measure after 1 lands before committing to the project split.

**3, 4 and 5 are independent** and may land in any order.

## Revision (2026-08-07): the failures are Windows-only

PR #571 ran the full suite on CI and **all 15 checks passed, including `Test`**. None of the
four local failures reproduce on Linux runners. Every one was an I/O-contention timeout, and
Linux filesystem performance dissolves them.

This materially changes the problem statement above. The suite is not unreliable in CI — it is
unreliable **for developers on Windows**. The pipeline was never at risk, so the cost is
developer time and trust, not delivery. Priorities are revised accordingly.

| Decision                     | Revised position  | Why                                                                                                                                                                                                    |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. In-process formatting     | **Done**          | Landed. Sync ~25s to 13s (reliable). No suite-level speedup claimed — see withdrawn measurement above.                                                                                                 |
| 4. Fixture repo for git-log  | **Do first**      | Promoted. These tests read ambient repository history, which is wrong on any platform — they would also break on a shallow clone or a repo with different conventions. A correctness bug, not a flake. |
| 6. Raise sync-heavy timeouts | **New, cheapest** | The copilot `beforeAll` hooks fail at 30s on Windows. Sync is now ~2× faster, so a modest bump likely clears them outright, at zero CI cost and no architectural change.                               |
| 3. Prettier out of Vitest    | **Keep, lower**   | Rationale changed: no longer about flakiness, but about placement and ~90s of runtime. A whole-repo format scan duplicates the lint job.                                                               |
| 2. Isolate sync-heavy suites | **Drop**          | Measured worse (1294s vs 730s), and it targets a problem CI does not have. Script-level sequencing would slow CI for no CI benefit.                                                                    |
| 5. Flake visibility          | ~~**Defer**~~     | _Reversed 2026-08-10 — see below._ The reasoning was: there are no CI flakes to surface, so reporting for a green pipeline is speculative. It assumed a green summary means the suite ran.             |

The through-line: decision 1 fixed a real product defect that happened to be measurable in the
suite. What remains is mostly local developer ergonomics, and the two cheapest items (4 and 6)
address it. Decision 2 should be struck rather than deferred — it was measured and it lost.

## Consequences

### Positive

- Sync gets materially faster for every user, not only in tests — this is a product improvement
  that happens to fix the suite.
- A red suite becomes meaningful again, restoring the signal CI depends on.
- Removing the whole-repo Prettier scan from Vitest deletes both a flake source and its
  retry workaround.

### Negative / risks

- Prettier's Node API differs from its CLI: the CLI resolves per-file configuration and ignore
  files automatically. An in-process implementation must call `resolveConfig` per file and
  honour `.prettierignore`, or generated output will be formatted inconsistently with
  `prettier --check` and CI will diverge from local runs.
- Running Prettier in-process means a malformed generated file can throw inside the sync process
  rather than in a child. Per-file try/catch is required to preserve the current
  "continue on failure" behaviour.
- The project split adds Vitest configuration surface and a second place where a new test file
  can land in the wrong bucket.

### Verification

Sync cost is the controlling variable, so it is the thing to assert:

```bash
# Warm-cache sync should complete well inside the tightest test timeout.
time node .agentkit/engines/node/src/cli.mjs sync
```

Re-run the full suite three times after change 1. The acceptance criterion is three consecutive
runs with an identical pass set — not merely three green runs, since a suite that passes for
different reasons each time has not been stabilised.

## Out of scope

Profiling surfaced a separate defect: `sync --overwrite` rewrites scaffold-once project-owned
files, and was observed modifying 24 tracked files including `AGENT_BACKLOG.md` and an existing
decision record (`02-fallback-policy-tokens-problem.md`).

A guard has since landed that aborts `--overwrite` on a dirty working tree, making the
operation recoverable via git and leaving `--force` as the explicit escape hatch. That closes
the data-loss hazard but not the underlying semantic question: whether `--overwrite` should
regenerate user-authored content such as decision records at all, or only the editor-theme and
config files it was introduced for. That question remains open and is not decided here.

## Revision (2026-08-08): decisions 3 and 4 landed, plus a cause not previously identified

Decisions 4 and 3 are implemented. A fourth problem surfaced while measuring them that was
not in the original analysis, and it explains the most alarming failure mode.

### The suite was exhausting the disk

`sync-integration.test.mjs` cleanup hooks called `rmSync(root, { recursive: true, force: true })`
bare. On Windows that throws `EBUSY`/`EPERM` whenever any handle is still open on a file in the
tree — an antivirus scan or the search indexer suffices — and `force` does not cover it, since
it only suppresses `ENOENT`. With no `try`/`catch`, the first undeletable tree threw and
stranded **every remaining root in the same hook**.

Each fixture is a full sync output tree of 600+ files. **126 of them had accumulated in
`%TEMP%`.** A subsequent full run then failed to load all 74 test files with `ENOSPC`, which
presents as total breakage rather than as a cleanup bug — and, being an out-of-space condition,
it is not reproducible once the disk drains.

This is worth recording because it invalidates naive failure-count comparisons: a run that
reports 60+ failed files may be reporting disk state, not code state. Cleanup now routes
through a `removeTree` helper with `maxRetries` and per-tree error isolation.

### Decision 4 — fixture repositories (done)

The premise in the original decision was slightly off: these tests already built fixture repos
rather than reading ambient history. The defect was **cost**, not correctness of source.
`initGitRepo` spawned 3 + 2N processes and measured **48s for an eight-commit fixture against a
15s timeout** — deterministically impossible under load, passing only on an idle machine.

Rebuilt on `git fast-import`: two subprocesses regardless of fixture size, ~3s. A 15× reduction
with a clear mechanism, which is the kind of measurement this ADR has learned to trust.

Two secondary gains: the length-prefixed `data` format removes a shell-quoting hack that only
escaped double quotes (any subject containing a backslash would have been mangled), and passing
identity via `git -c` removes the dependency on ambient user config — a machine with
`commit.gpgsign` enabled previously failed here.

The fixture-cost correction does not remove a separate product boundary defect found afterward:
`detectCommitConvention()` passed only `cwd` to `git log`, but inherited `GIT_DIR`,
`GIT_WORK_TREE`, `GIT_INDEX_FILE`, or `GIT_OBJECT_DIRECTORY` still override that directory.
Detection now removes those inherited overrides for the subprocess. A two-repository regression
fixture points `GIT_DIR` at a conventional decoy and confirms that discovery still reports the
non-conventional project repository.

### Decision 6 — raise sync-heavy timeouts (partly done, and re-scoped)

`hookTimeout` was already raised to 240s in #570, so the `beforeAll` half of this was addressed
before this revision. What remained were two **test-level** budgets, both verified failing on
unmodified `dev`:

| Test                              | Work                                              | Was | Now  |
| --------------------------------- | ------------------------------------------------- | --- | ---- |
| `--diff shows create/update/skip` | one full sync (13–25s)                            | 30s | 120s |
| `--no-clean preserves orphaned`   | two full syncs + recursive copy of spec/templates | 60s | 180s |

The pair now takes 100s of test time, comfortably above the old 60s — these were impossible
budgets, not marginal ones. 120s matches what the neighbouring `--overwrite` tests already use
for equivalent work.

### Decision 3 — Prettier out of Vitest (done)

Moved to a `Prettier` job in `ci.yml`, removing ~90s of suite runtime, one whole-repo I/O scan
that contended with the sync-heavy suites, and the retry-once workaround whose own comment
blamed "parallel tests creating and deleting files mid-scan".

One implementation note for anyone revisiting it: the job runs from the **repository root**, not
`.agentkit`. Prettier resolves `.prettierignore` relative to the working directory, so invoking
it from `.agentkit` silently ignores the root ignore file and begins flagging `pnpm-lock.yaml`.

The job is deliberately **not** in `branchProtection.requiredStatusChecks`. Formatting
previously blocked merges as part of `Test`; making it block again is a separate decision, and
the `ci.yml` comment says so rather than leaving the change silent.

### Status of the acceptance criterion

The criterion above — three consecutive runs with an identical pass set — was demonstrated on
2026-08-09 on the Windows host where the flake occurred (Microsoft Windows build
`10.0.28120.2546`), after merging Retort `dev` through `f5262097` into PR #584. Dependencies
were installed from the frozen lockfile using the warm local pnpm store before the focused
preflight; the three acceptance runs then used the same installed dependency tree and unchanged
source. The tested code head was `e2ca93a2` (tree `cc2c68e9`):

| Run | Test files | Tests        | Skipped | Duration |
| --- | ---------- | ------------ | ------- | -------- |
| 1   | 74 passed  | 2,251 passed | 1       | 303.92s  |
| 2   | 74 passed  | 2,251 passed | 1       | 303.49s  |
| 3   | 74 passed  | 2,251 passed | 1       | 295.57s  |

All three Windows runs exited zero with the same pass set and no fixture-cleanup warning. This
closes the PR #584 repeatability gate on the environment that exposed the defect; it does not
claim that every remaining Windows-only contention source in the wider suite has been
eliminated.

### The criterion does not hold on merged `dev`

Re-running the gate on 2026-08-09 against `dev` at `6848f3f7` — that is, after #584 merged and
after #583, #585 and #581 landed on top of it — **all three runs failed**, with a different
failure set each time:

| Run | Exit | Files failed | Tests failed | Note                       |
| --- | ---- | ------------ | ------------ | -------------------------- |
| 1   | 1    | 6            | 10           | plus one worker-fork crash |
| 2   | 1    | 2            | 2            |                            |
| 3   | 1    | 1            | 1            |                            |

The moving failure set is the exact condition this ADR opens by describing, so the problem
statement stands rather than being closed.

Two measurement notes matter more than the numbers, because both produce false green:

**Exit codes must not be read through a pipe.** An earlier attempt at this gate ran
`vitest | perl | grep` and captured `$?`, which is _grep's_ status. Grep matched on every run, so
it reported success every time regardless of what Vitest did. The runs above capture Vitest's
status directly. Any future evidence added to this ADR must do the same — the pass/fail counts
in Vitest's own summary are trustworthy, a piped exit code is not.

This applies retroactively to the preceding section: its "all three runs exited zero" was
produced before the flaw was found and cannot now be re-verified, so read that block as
counts-only evidence. The counts themselves come from Vitest's summary and stand.

**A crashed worker still prints a passing summary.** One run logged
`Error: Worker exited unexpectedly`, silently dropped 53 tests and a whole file — `2273 passed`
against a `2327` total — and summarised as passing. Vitest's own warning for this is that it
"might cause false positive tests". Treat any run whose passed + skipped does not reconcile with
the total as void, whatever the summary says. This is what decision 5 (make flakes visible) is
for, and it is not yet implemented.

### Headroom: the suite needs ~27 GB of free disk

Re-running the gate surfaced the quantity that made the original ENOSPC inevitable, which none
of the decisions above had put a number to. Sampling free space every 30s through a full run
shows it dropping ~27 GB below idle and then holding flat for the rest of the run: fixture trees
are created and reclaimed continuously, so the figure is a **steady-state working set**, not a
slow climb.

That reframes the failure this ADR opens with. The attempt that produced it began with 17.4 GB
free, so it could not have finished regardless of any timeout budget — every test file failed to
_load_, which reads as catastrophic breakage rather than as a full disk. A run starting below
roughly 30 GB free should be treated as unable to produce a valid result, and a suite-wide
failure with no meaningful assertion output should prompt a `df` before any code is suspected.

The cleanup fix is what holds that working set flat. Across three consecutive full suites, free
space moved 17,780 MB → 17,731 MB — a 49 MB net change, with leaked fixture directories going
41 → 36 rather than climbing. Before the fix, 126 stranded trees of 600+ files each had
accumulated.

### Headroom: the page file is the second capacity limit

Verifying an unrelated fix produced `ERR_DLOPEN_FAILED` loading Rollup's native module, caused by
`The paging file is too small for this operation to complete` — not by the change under test.

The host has 32 GB of RAM and a **fixed 8 GB page file**. A full run forks a worker per test file,
and committed memory across that fleet can exceed physical plus page file even while plenty of
physical RAM appears free. When it does, forks die — which is the most likely mechanism behind
the `Worker exited unexpectedly` crash recorded above, and behind run 1's six-file failure set.

This matters because it is invisible in the symptom. A dead fork surfaces as unrelated tests
failing in varying combinations, which reads as flaky application code. Before attributing a
moving failure set to the suite, confirm the run was not memory-starved: `Win32_PageFileUsage`
reports allocated size and peak usage, and a peak far below the allocation (160 MB against 8 GB
here) means the ceiling being hit is the commit limit, not the page file's working size.

Neither capacity limit is a code defect, and neither is fixed by a timeout budget. Both belong in
whatever runbook precedes the next attempt at the acceptance criterion.

### A real defect: mocking `commandExists` can start spawning real binaries

`check-coverage.test.mjs > runs --fix command before the check command` failed in two of the
three `dev` runs and passed in isolation (58/58 in 5.9s), which is the signature of contention
rather than a logic error. The mechanism generalises decision 4 from ambient _git history_ to
ambient _binaries_.

The file's mock factory spreads `...actual` and replaces only `commandExists`, so `execCommand`
stays real. The test then sets `formatter: "black"` and forces `commandExists` to true — and that
second step is what does the damage, because the guard it removes is precisely the one that stops
an absent binary being spawned. The test's own comment notes the guard is bypassed but reads it as
harmless.

It is harmless only where `black` is missing. On a machine that has it — this host does, via
Python 3.13 — `black .` and `black --check .` genuinely execute: two Python interpreter startups
against a 20s test budget. `execCommand`'s default timeout is 300s, 15× the test's, so the inner
budget can never rescue the outer one. The test is therefore _fast on CI and slow on developer
machines_, which is the opposite of the usual assumption and explains why it had not been
attributed before.

Fixed by stubbing `execCommand` for that test alone: it asserts which steps get built, not that
formatting happens, so no real process is needed. The mock is wrapped
(`vi.fn(actual.execCommand)`) rather than replaced, and `beforeEach` restores the real
implementation, so the file's other tests are unaffected. Test-phase time for the file fell from
4.83s to 2.04s.

The general rule: forcing `commandExists` true removes a guard, and every step behind that guard
must then be checked for whether it spawns something real.

## Revision (2026-08-10): decision 5 landed — the deferral was wrong

The section above closes with "this is what decision 5 (make flakes visible) is for, and it is
not yet implemented." It is now implemented. This revision records why the 2026-08-07 deferral
was wrong, since the reasoning error is more reusable than the code.

Decision 5 was deferred on the grounds that "there are no CI flakes to surface", so building
reporting for a green pipeline was speculative. The hole: that assumed a green summary means the
suite ran. **A run can drop tests and still print a passing summary**, and no amount of "the
pipeline is green" tells you otherwise — which made the deferral self-confirming. The
`2273 passed` against a `2327` total recorded above is the counter-example, and it was sitting in
CI-adjacent scrollback the whole time, unnoticed because nothing added the numbers up.

### What landed

| Change                                                                     | Where                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| JUnit + JSON reporters, uploaded as a CI artifact (14-day retention)       | `.agentkit/vitest.config.mjs`, `Upload test results` step in `ci.yml`           |
| Reconciliation gate — fails when outcomes do not sum to the reported total | `.agentkit/scripts/reconcile-test-results.mjs`, `Reconcile test results` step   |
| Run-integrity reporter — unhandled errors, unreported tests, flake labels  | `.agentkit/scripts/vitest-run-integrity-reporter.mjs`                           |
| Rerun-based flake labelling (`retry: 1`, CI only)                          | `.agentkit/vitest.config.mjs`                                                   |
| Quarantine registry + non-blocking `Quarantined Tests` job                 | `.agentkit/test-quarantine.json`, `.agentkit/scripts/run-quarantined-tests.mjs` |
| `qa-run-reconciliation` convention                                         | `.agentkit/spec/rules.yaml`                                                     |

The gate encodes the rule stated above — a run that does not reconcile is **void, not green**. It
runs with `if: always()`, so it fails the required `Test` check even when Vitest itself exits
zero. Beyond the headline sum it checks four more things: that the summary and the per-file
detail agree on the count and on each bucket; that no test carries a non-terminal status (the
precise signature of a dropped test, reported by name and file); that no unhandled error escaped
the run; and that a report claiming `success: true` while failing to reconcile is called out as
such.

Two deliberate choices about where the numbers come from. The reconciliation is computed against
**Vitest's own `json` reporter output**, not against a record this repo produces, so the primary
guard cannot be defeated by a bug in the tooling added here. The integrity record is
supplementary, and covers exactly the two things the JSON report omits: unhandled errors never
attach to a test, and retry diagnostics are not serialised.

The unhandled-error check earns its place from the capacity findings above. A fork killed by the
commit limit produces no test failure at all — it surfaces as unrelated tests failing in varying
combinations, which reads as flaky application code. That check turns it into a named, fatal
condition instead.

### Verification

The failure mode was reproduced end-to-end rather than argued from the schema. A fixture whose
second test calls `process.abort()` under `--pool=forks` produces the same
`[vitest-pool]: Worker forks emitted error`, the same passing-looking summary
(`Test Files 1 passed (2)`, `Tests 1 passed (5)`), and `success: true` in the JSON report with
both files marked `passed`. The gate fails it with `count-mismatch`, `unreported-tests`,
`success-inconsistent` and `unhandled-errors`, and names all four dropped tests. Against a
healthy run it exits zero, and against a run with genuine failures it also exits zero — a failing
suite is informative, and only a suite that has lost tests is void. The quarantine mechanism was
exercised with a real entry: the file is excluded from the blocking suite and executed by the
quarantine runner, and the gate rejects an entry lacking a tracking issue or pointing at a
deleted file.

### What the gate does not catch

The reconciliation is computed over the tests present in Vitest's task tree at run end. A file
that vanished from that tree entirely — never collected at all — would take its tests out of both
the total and the buckets, and would therefore still reconcile. That is not the observed
incident: the console reported 2327 collected against 2274 accounted for, which proves the
dropped tests were in the tree. The residual case is covered by the unhandled-error check rather
than by the sum, because a worker that dies always produces one. Worth stating explicitly so the
next reader does not assume the sum alone is a complete guarantee.

### On enabling `retry`

`retry: 1` is enabled **in CI only**. Blanket retry is what this decision's own title warns
against, so it is paired with labelling that cannot be missed: anything rescued by a rerun is
recorded in the integrity artifact, surfaced by the gate as a `::warning::` annotation and a
step-summary section, and is expected to be quarantined with a tracking issue. It is deliberately
not enabled locally — the failures this ADR chased were Windows contention timeouts on developer
machines, and retrying them there would hide the exact signal a developer needs while iterating.

The quarantine registry is empty at time of writing, which is the correct state. What landed is
the mechanism, so that quarantining the next confirmed flake is an entry in a JSON file rather
than a design exercise.

### The remaining Windows failures are unchanged by this

Three full-suite runs on this branch, on the Windows host, before #588 was merged in: 7 failures
(416s), 1 failure (771s), 3 failures (553s). All were 20s or 30s timeouts, concentrated in
`check.test.mjs`, `check-coverage.test.mjs` and `cli.test.mjs`; all 106 tests in those three
files pass in isolation in 42s. The 771s run used the **pre-change** `vitest.config.mjs` via
`--config`, which is what establishes that decision 5 neither caused nor cured them.

#588 has since fixed the `check-coverage` case at its root. `check.test.mjs` and `cli.test.mjs`
remain, and both spawn Node subprocesses per assertion — the same shape decision 1 and decision 4
resolved elsewhere by removing the spawn rather than raising the budget. Tracked separately; the
acceptance criterion stays open, as the section above already records.

All three runs reconciled, which is the correct answer and the point of the exercise: the gate
distinguishes "this suite has real failures" from "this suite lost tests", and only the second
one voids a run.

## Revision (2026-08-10): the residual flake is subprocess startup cost, and it is measurable

The moving failure set recorded above narrowed to three files — `check.test.mjs`,
`check-coverage.test.mjs` and `cli.test.mjs`. Four full runs of identical code on the same Windows
host (build `10.0.28120`) produced 7 failures / 416s, 1 / 771s and 3 / 553s, every one a 20s or 30s
`Test timed out`, while all 106 tests in those files passed in isolation.

The 1-failure run used the **pre-change** `vitest.config.mjs` via `--config`, which rules out
PR #589 as the cause and confirms this is the same pre-existing condition, not a regression.

### The cost is process startup on this host, and it is far larger than assumed

Measured directly, at idle, with 79 entries on `PATH`:

| Spawn                                   | Cost per call   |
| --------------------------------------- | --------------- |
| `where <cmd>` (Windows `commandExists`) | **1.2 – 2.6 s** |
| `node -e ""`                            | **0.7 – 1.9 s** |
| `node cli.mjs <cmd> --help`             | **~1.6 s**      |

These are the "cheap no-op" primitives the fixtures were built on. `where` costing over a second is
the load-bearing surprise: `runCheck` calls `commandExists` **and** `execCommand` per step
(`check.mjs:444`, `check.mjs:460`), so the default three-step fixture pays **six spawns**, 6–12s,
against a 20s budget — before any contention.

### The failing set is exactly the set with the least headroom

Per-test timings from a JSON reporter run of the three files in isolation, against each test's own
budget:

| Test                                           | Isolated | Budget | Headroom |
| ---------------------------------------------- | -------- | ------ | -------- |
| `cli` — every command … `--help`               | 21.65s   | 30s    | **1.4×** |
| `check` — resolves prettier path …             | 10.78s   | 20s    | **1.9×** |
| `check` — logs unresolved placeholder findings | 8.84s    | 20s    | 2.3×     |
| `check` — returns a structured result object   | 8.68s    | 20s    | 2.3×     |
| `check` — respects `--fast` flag structure     | 6.67s    | 20s    | 3.0×     |
| `check` — runs the coverage step               | 6.02s    | 20s    | 3.3×     |

Every reported-flaky test appears here, and the ranking matches how often each was seen failing.
Nothing else was needed to explain the moving failure set: under full-suite parallelism these
budgets are consumed by process startup, and which ones tip over is a scheduling accident. That is
precisely why the set moves.

### Decision 7: remove the spawns rather than raise the budgets

Following decisions 1 and 4, the fix is to delete the cost.

**`check.test.mjs` and `check-coverage.test.mjs` — stub the runner.** Neither file asserts that a
real process ran; the assertions are about which steps get built and how exit codes map to
statuses. Both now mock `commandExists` and `execCommand` for the whole file. This generalises the
per-test fix from the previous revision: that one stubbed `execCommand` for a single test and
`beforeEach` restored the real implementation, which left every other `runCheck` test in both files
still spawning `node -e ""` per step. Real end-to-end `execCommand` behaviour is covered by
`runner.test.mjs`, which exercises it against actual processes in nine cases — that is where it
belongs, and no coverage moves or is lost.

#590 reached the same root cause independently and landed first, stubbing `commandExists` per
describe block and `execCommand` per test in `check.test.mjs` alone. The file-wide mock supersedes
that mechanism and extends it to the tests #590 left spawning, but its substantive change is kept
and is better than what this work had: the coverage-step test now names a real runner, so
`resolveCoverageCommand` returns a command instead of null, and it asserts the built coverage
command and the parsed percentage rather than merely that a coverage array exists. Worth recording
because the two changes look like duplicates and are not — one replaced a mechanism, the other
fixed a test that was not exercising the path it named.

| File                      | Test-phase time  |
| ------------------------- | ---------------- |
| `check.test.mjs`          | 53.1s → **1.2s** |
| `check-coverage.test.mjs` | 16.8s → **3.1s** |

Two assertions got stronger as a side effect. `resolves prettier path when roots are split` now
asserts the resolved path reaches the runner, instead of only that the step reported `PASS` — a
status check cannot distinguish the `agentkitRoot` copy from any other prettier that happened to
run. And controlling exit codes made a `FAIL`-mapping test cheap enough to add, which the
real-spawn version was not.

**`cli.test.mjs` — the `--help` loop could not detect what its name promised.** It spawned the CLI
once per command, 26 startups, 21.65s at idle against a 30s budget: an impossible budget in the
sense of decision 6, not a marginal one. But raising it would have been the wrong fix, because
`main()` short-circuits `--help` **before** it calls `loadCommandFlags()`/`parseFlags()`
(`cli.mjs:499`), so `<cmd> --help` never builds an option table and no flag configuration error can
surface. Verified directly: `cli.mjs sync --bogus-flag --help` emits no unrecognized-flag warning,
and only `parseFlags` produces that warning. The test was spending 26 process startups to assert
command-name membership and that `cli.mjs` boots.

`cli.mjs` cannot be imported by a test — it calls `main()` at import and exits via `process.exit`.
So the flag tables, `loadCommandFlags` and the option-table builder moved to a side-effect-free
`cli-flags.mjs`, and the test now calls `buildParseOptions` in-process for every command in
`VALID_COMMANDS`. This spawns nothing, tests what the name promises, and covers two things the old
version never reached: the flags contributed by `commands.yaml`, and all 30 registry commands
rather than a hand-maintained list of 26. The sibling test that scraped `cli.mjs` source with
regexes to compare the two tables is replaced by a direct assertion over the real objects.

### A second budget that was inverted, not merely tight

`cli.test.mjs`'s `run()` helper capped each child at 10s via `execFileSync`. The heaviest command in
the file, `harness doctor --json`, measures **6.8s at idle** — so the cap sat below the work under
any contention at all. It fired during this investigation and the test failed **in isolation**,
which is how it was found.

Worse, it failed illegibly. `execFileSync` reports a killed child with a `null` status, so the
assertion read `expected null to be +0` — a timeout presenting as a wrong exit code. This is the
mirror image of the `execCommand` finding in the previous revision: there the inner timeout was
300s and too loose to ever rescue the outer budget; here it was 10s and tight enough to pre-empt
it. An inner timeout is a backstop, and it is only useful when it sits clearly outside the budget
it is protecting.

The cap is now 60s with the reason recorded at the constant, `run()` reports a killed child as
`timedOut` rather than as an exit code, and the one test that spawns the heavy command carries a
90s budget justified by the 6.8s measurement. This is the only budget raised in this revision.

`execFileSync` blocks the worker synchronously, so Vitest's per-test timeout cannot pre-empt it —
the child cap is the budget that actually governs. That is why it needs stating rather than
inferring.

### Net effect

Roughly 90 process spawns are removed from the suite — about 50 from `check.test.mjs`, 12 from
`check-coverage.test.mjs`, 26 from `cli.test.mjs`. At the measured per-spawn costs that is two to
four minutes of idle-machine subprocess time, and more under load, since these spawns were also a
contention source for every other file running concurrently.

The worst per-test cost across the three files falls from 21.65s to **5.4s** (`harness doctor`, now
on a 90s budget). The slowest test remaining anywhere in this group is `runner.test.mjs`'s
`returns true for existing commands` at 7.0s against 30s — a real `where` call, in the file whose
job is to exercise real processes.

### Quarantine was considered and rejected

`.agentkit/test-quarantine.json` would have excluded these files from the blocking suite
everywhere. They pass reliably on Linux CI, so quarantining would have traded real coverage on the
platform where the pipeline runs for a local-only symptom. The Windows-only framing from the
2026-08-07 revision is what makes quarantine the wrong instrument here.

### Fixture-leak status

The `removeTree` cleanup from the previous revision is holding: `%TEMP%` held **17** leaked fixture
trees totalling **20 MB**, against the 126 trees of 600+ files each that preceded the fix. Leakage
is no longer a plausible contributor and should not be re-investigated without fresh evidence.

### The acceptance criterion now holds

Three consecutive full-suite runs on the Windows host where the flake occurs (build
`10.0.28120`), on the merged tree — this change on top of decision 5's tooling — using that
tooling rather than a bespoke harness: `pnpm test` for the run, `pnpm test:reconcile` for the
integrity gate, exactly as CI invokes them.

| Run | `vitest` | `test:reconcile` | Tests                    | Wall   |
| --- | -------- | ---------------- | ------------------------ | ------ |
| 1   | 0        | 0                | 2,379 passed / 1 skipped | 493.0s |
| 2   | 0        | 0                | 2,379 passed / 1 skipped | 581.2s |
| 3   | 0        | 0                | 2,379 passed / 1 skipped | 249.7s |

Run 1 against run 2 and run 1 against run 3 are **identical test-for-test** — same 2,380 test
IDs, same status on every one. That is the criterion this ADR set out, not merely three green
runs. The single skip is `fresh-install.test.mjs > auto-installs dependencies and runs sync
--dry-run`, pre-existing and untouched.

Both false-green modes recorded in the 2026-08-09 section are now guarded by the repository's own
machinery rather than by the care of whoever runs the gate:

- **Exit codes are Vitest's own.** Captured directly from the process, with nothing piped, so
  there is no repeat of the `vitest | perl | grep` failure that reported grep's status.
- **Every run is reconciled** by `pnpm test:reconcile` — decision 5's gate, computed against
  Vitest's own JSON reporter output. All three runs exit zero from it, so none is the "crashed
  worker still prints a passing summary" case that silently dropped 53 tests before.

This is the first time the criterion has been demonstrated with the reconciliation gate enforcing
it rather than a hand-rolled check, which is the arrangement decision 5 was built for. An earlier
set of three runs on the pre-merge tree gave the same result (2,329 passed / 1 skipped of 2,330,
identical across runs) using equivalent hand-written reconciliation; the table above supersedes it
because it tests the code that will actually merge.

Wall time varies 250s to 581s across the three runs, which is consistent with everything this ADR
has learned about this host: suite wall time is not a usable instrument here, and no speedup is
claimed from it. The per-test measurements above are the trustworthy ones, for the same reason
decision 1's sync-level numbers were trustworthy while its suite-level numbers were withdrawn.

### The ~30 GB free-disk precondition does not hold as written

The previous revision advised that "a run starting below roughly 30 GB free should be treated as
unable to produce a valid result". **Six** full suites were run for this revision — three on the
pre-merge tree, three on the merged tree — starting from **11.6 GB** free and ending at
**8.7 GB**. Every one produced a valid, reconciled result, and both sets of three were identical
test-for-test. That precondition is therefore too strong to use as a gate.

Sampled before and after, the heaviest run moved free space by 0.7 GB and the lightest by 0.0 GB.
This does **not** refute the earlier 27 GB figure: that came from sampling every 30s through a
run, whereas these are before/after samples and would miss a mid-run trough that recovers. The
peak working set was not re-measured. The correction is to the operational rule only — free disk
below 30 GB is not grounds for discarding a run, and the ENOSPC episode that motivated the rule
predates the `removeTree` cleanup fix, when 126 fixture trees were stranded rather than the 17
seen now.
