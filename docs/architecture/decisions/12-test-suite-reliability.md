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
| 5. Flake visibility          | **Defer**         | There are no CI flakes to surface. Building JUnit reporting and rerun detection for a green pipeline is speculative. Revisit if CI actually starts flaking.                                            |

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
2026-08-09 after merging Retort `dev` through `f5262097` into PR #584. The tested code head was
`e2ca93a2` (tree `cc2c68e9`), with no source or dependency changes between runs:

| Run | Test files | Tests        | Skipped | Duration |
| --- | ---------- | ------------ | ------- | -------- |
| 1   | 74 passed  | 2,251 passed | 1       | 303.92s  |
| 2   | 74 passed  | 2,251 passed | 1       | 303.49s  |
| 3   | 74 passed  | 2,251 passed | 1       | 295.57s  |

All three runs exited zero with the same pass set and no fixture-cleanup warning. This closes
the repeatability gate for the decisions implemented by PR #584; it does not claim that every
remaining Windows-only contention source in the wider suite has been eliminated.
