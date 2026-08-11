# Real process spawns behind a mocked commandExists Resolution - Historical Summary

**Completed**: 2026-08-10
**Bug ID**: n/a — audit follow-up to PR #588
**PR**: [#590](https://github.com/phoenixvc/retort/pull/590)
**Severity**: Medium (test-suite reliability; no production impact)

## Problem Description

PR #588 fixed a test that spawned a real `black` process because its module mock
replaced `commandExists` but left `execCommand` real. That shape is general, so
this work audited the whole engine test suite for other instances, and for the
inverse case: tests that pass only because a binary happens to be absent.

The audit found the pattern occurs **exactly once** — the instance PR #588
already fixes. It found one adjacent defect of a different kind, fixed here, plus
three latent hazards recorded below.

## Root Cause Analysis

`check.mjs` guards each step with
`if (!isNpx && baseCmd && !commandExists(baseCmd))` → SKIP. A mock that forces
`commandExists` true removes exactly that guard, so any step naming an installed
binary is spawned for real by the still-real `execCommand`.

The consequence is inverted from the usual assumption: **fast on CI, slow on
developer machines**, because CI lacks the binaries the guard would have skipped.
This host has `black`, `cargo`, `dotnet`, `rustfmt`, `isort` and `flake8` on PATH.

The defect found here is the mirror image — a test that never reached its
subject. `runCheck() — additional branches > runs the coverage step when
--coverage is set` used a fixture whose `testCommand` was a bare `node -e ""`.
That matches no runner, so `resolveCoverageCommand` returned
`{ command: null }` and `check.mjs` skipped the coverage block entirely. The only
assertion, `expect(Array.isArray(result.coverage)).toBe(true)`, holds for the
`[]` that produced. The test passed without executing the code it names.

### The inverse cost: an unstubbed guard is more expensive than what it guards

A full-suite run after the fix above surfaced the mirror-image problem in the
same file, and it inverts the intuition that mocking `commandExists` is the
risky choice. Measured on this host under load, against the real runner:

| Call                                                | Cost        |
| --------------------------------------------------- | ----------- |
| `commandExists('node')` — spawns `where` on Windows | **4486 ms** |
| `execCommand('node -e ""')`                         | 1296 ms     |

The guard costs **3.5x the command it guards**. `runCheck` calls it once per
step, so a three-step fixture spends ~17.3s in process startup alone against a
20s budget — a coin flip that resolves differently under full-suite contention
than in isolation. This is why `check.test.mjs` timed out in the suite while
passing on its own, and why `healthcheck.test.mjs`, which stubs both functions in
all ten of its tests, never appears in the flaky set.

So the two failure modes pull in opposite directions: stubbing `commandExists`
true without also stubbing `execCommand` spawns real binaries (PR #588), while
not stubbing it at all pays `where` per step. The resolution is to stub **both**,
and to keep a real `execCommand` only where executing something is the point.

## Solution Implemented

Name a real runner in the fixture (`npx vitest run`) so coverage resolves, and
stub `execCommand` for that test so the branch runs without spawning anything.
Both halves are required: the coverage call site has **no** command-exists guard
at all, so an unstubbed runner would have spawned whatever
`resolveCoverageCommand` returned, under `execCommand`'s 300s default timeout
against the test's 20s budget.

### Code Changes

- **`.agentkit/engines/node/src/__tests__/check.test.mjs`**: added a
  `testCommand` option to `createCheckFixture`; rewrote the coverage test to
  stub `runner.execCommand` and assert the resolved command, parsed percentage,
  threshold and status. Added a `stubCommandExists()` `beforeEach` to both
  `runCheck` describes, and stubbed `execCommand` in
  `returns a structured result object`, whose assertions are purely structural.
  `resolves prettier path from agentkitRoot when roots are split` deliberately
  keeps a real `execCommand` — its PASS assertion is what proves the resolved
  path is executable, and the fixture's stub `prettier.cjs` keeps that cheap.

### Testing

- **Unit Tests**: no new files. The existing coverage test now asserts four
  concrete properties instead of one tautology.
- **Integration Tests**: unchanged.
- **Manual Testing**: `black .` and `black --check .` timed directly on this host
  to confirm the PR #588 mechanism (see Verification).

## Verification

`check.test.mjs`: **31/31 passed**, whole file 9.6s (down from 153s in the failing
suite run). Prettier clean on all changed files.

The PR #588 mechanism was reproduced independently before auditing, so the audit
started from a confirmed baseline rather than from the PR description:

| Measurement                                                           | Result                                      |
| --------------------------------------------------------------------- | ------------------------------------------- |
| `check-coverage.test.mjs > runs --fix command …` (unfixed, this host) | **11362 ms** against a 20s budget           |
| `black .`                                                             | 6.324 s                                     |
| `black --check .`                                                     | 5.180 s                                     |
| Sum                                                                   | 11.5 s — matches the observed test duration |

### Before/After Comparison

|                        | Before                             | After                                      |
| ---------------------- | ---------------------------------- | ------------------------------------------ |
| Coverage step executed | never                              | yes                                        |
| Assertions             | 1 (`Array.isArray`, true for `[]`) | 4 (command, percentage, threshold, status) |
| Runtime                | 2137 ms                            | 765 ms                                     |

Guard-stubbing removed the timeouts entirely. Same file, same host:

| Test                                 | Full suite (before)           | Isolation (before) | After            |
| ------------------------------------ | ----------------------------- | ------------------ | ---------------- |
| `returns a structured result object` | **timeout at 20s** (41740 ms) | 11163 ms           | **47 ms**        |
| `resolves prettier path …`           | **timeout at 20s** (43431 ms) | 10579 ms           | **990 ms**       |
| whole file                           | 153401 ms, 2 failed           | 58.9 s             | **9.6 s, 31/31** |

The slowest test in the file is now 990 ms against a 20 s budget — a 20x margin
rather than a coin flip.

Validated under real contention, not just in isolation — isolation is what these
tests already passed. Local full-suite runs, same host:

|              | Before  | After   |
| ------------ | ------- | ------- |
| Tests failed | 4       | **1**   |
| Files failed | 3       | **1**   |
| Duration     | 440.6 s | 427.4 s |

`check-coverage.test.mjs > runs --fix command …` — the PR #588 defect — passed in
the post-fix run at its borderline ~11-26s against a 20s budget, because
`check.test.mjs` no longer holds ~144s of CPU. That is a reprieve from reduced
contention, not a fix; #588 remains the fix.

### Regression Testing

Both rewrites were mutation-checked rather than assumed.

Restoring the old coverage fixture fails with:

```
AssertionError: expected [ 'node -e ""', 'node -e ""' ] to include 'npx vitest run --coverage'
```

Those two commands are the typecheck and test steps — direct evidence that the
coverage step previously never ran.

Removing the fixture's stub `prettier.cjs` fails with
`AssertionError: expected 'FAIL' to be 'PASS'`, confirming that test still
validates the resolved path end to end despite the 43s -> 1s drop.

## Impact Assessment

Test-suite only; `check.mjs` behaviour is unchanged. Developers with Python
tooling installed paid ~11s per run for the PR #588 instance; CI never did. The
coverage branch of `runCheck` was reported as covered while being untested.

## Prevention Measures

Audit scope and result, so this is not re-derived:

- **77** engine test files scanned, plus the **4** in `src/start/lib`.
- Only **three** engine test files reference `commandExists`:
  `check-coverage.test.mjs`, `healthcheck.test.mjs`, `runner.test.mjs`.
- Only **one** uses a spread-mock factory over `../runner.mjs` —
  `check-coverage.test.mjs`, the PR #588 instance. No second occurrence exists.
- `healthcheck.test.mjs` stubs both `commandExists` and `execCommand` in all ten
  tests, and `healthcheck.mjs` passes explicit 10s/120s timeouts. It is the
  reference-quality example.
- `handoff.test.mjs` and `review-runner.test.mjs` stub `execCommand`, though
  `review-runner.test.mjs` does so via an opt-in `mockGitAndEvents()` helper
  called by only two tests rather than a `beforeEach`.
- `src/start/lib` tests use full-replacement mocks
  (`vi.mock('node:child_process', () => ({ execSync: vi.fn() }))`) with no
  `...actual` spread, so no real implementation can leak. Unaffected.

Three latent hazards in `check.mjs`, none currently triggered by a test, all left
unchanged as out of scope:

1. **`isNpx` bypasses the guard.** `!isNpx && …` means an `npx …` command skips
   the command-exists check entirely and is always spawned, with or without a
   mock.
2. **The coverage step has no guard at all.** Whatever `resolveCoverageCommand`
   returns goes straight to `execCommand`. Reachable values include
   `cargo tarpaulin --out json` and `dotnet test --collect:"XPlat Code Coverage"`.
3. **No explicit timeout.** All three `execCommand` calls inherit the 300s
   default, versus the 20s budgets of the tests that drive them.

On (3): an explicit timeout was considered and **deliberately not added**. It
would not have prevented this defect class — the `black` spawn was 11.4s, under
any plausible cap — and `check` legitimately runs builds and full test suites
that can exceed `healthcheck`'s 120s. Shortening the cap would abort real work to
fix a problem that belongs in the tests. Recorded here rather than changed.

### Remaining suite failures, not addressed here

A local full-suite run showed four timeouts. Two were the `check.test.mjs` tests
fixed above. The other two are left alone deliberately:

- `check-coverage.test.mjs > runs --fix command …` — the PR #588 defect itself,
  still present because #588 is unmerged. Fixing it here would collide with that
  PR. It failed at 26312 ms against 20s, versus 11362 ms in isolation.
- `cli.test.mjs > every command can be invoked with --help …` — a different
  mechanism in a file outside this change: it spawns the CLI once per command,
  ~29 processes, and timed out at 62074 ms against a 30s budget.

`cli.test.mjs` is the one still failing after this change and is the obvious next
candidate. It is the same defect class — real spawns starving a test budget — but
the remedy differs, since spawning the CLI _is_ what that test asserts. The
options are invoking the CLI in-process, or sizing the budget to ~29 spawns at
the ~2s/spawn this host actually delivers.

## Lessons Learned

A mock that removes a guard inherits everything the guard was protecting. Forcing
`commandExists` true does not merely satisfy a condition; it hands the rest of
the function a live process spawner.

The two failure modes are mirror images and both hide in the same place. One test
ran a binary it never meant to run; the other never ran the code it claimed to
test. Neither was visible from the test name or its pass status — only from
timing the first and mutating the second. An assertion that holds for the empty
result is not a test, and `Array.isArray(x)` is the canonical shape of that
mistake.

The most useful number here was the one nobody thought to measure: `where` costs
more than the process it is asked about. The instinct after PR #588 is to treat
mocking `commandExists` as the dangerous move, but leaving it real is what put
two tests within 3 seconds of their budget. Stub both, and let a real
`execCommand` survive only where running something is the assertion.

---

**Fix Author**: Jurie Smit (with Claude Opus 5)
**Reviewer**: [Reviewer]
**Status**: Resolved
