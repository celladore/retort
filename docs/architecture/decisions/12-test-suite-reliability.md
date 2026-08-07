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

Effect on the suite, measured over a full run:

| Metric       | Baseline | After decision 1 |
| ------------ | -------- | ---------------- |
| Wall time    | ~730s    | **386s**         |
| Failed files | 2–4      | 3                |

A 47% reduction in wall time with no new failures. **It did not make the suite green.** The
remaining failures are the same pre-existing ones — `discover`'s git-log heuristic (which passes
in isolation) and the copilot `beforeAll` hooks, both present in the baseline run. Decision 1 was
necessary but not sufficient; decisions 3, 4 and 5 still apply, and decision 2 should only be
reconsidered using the script-level sequencing noted above.

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
