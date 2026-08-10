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
  threshold and status.

### Testing

- **Unit Tests**: no new files. The existing coverage test now asserts four
  concrete properties instead of one tautology.
- **Integration Tests**: unchanged.
- **Manual Testing**: `black .` and `black --check .` timed directly on this host
  to confirm the PR #588 mechanism (see Verification).

## Verification

`check.test.mjs`: **31/31 passed**, whole file 34.5s. Prettier clean on the
changed file.

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

### Regression Testing

The new assertions were mutation-checked. Restoring the old fixture fails with:

```
AssertionError: expected [ 'node -e ""', 'node -e ""' ] to include 'npx vitest run --coverage'
```

Those two commands are the typecheck and test steps — direct evidence that the
coverage step previously never ran.

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

---

**Fix Author**: Jurie Smit (with Claude Opus 5)
**Reviewer**: [Reviewer]
**Status**: Resolved
