# Tests passing without executing their subject Resolution - Historical Summary

**Completed**: 2026-08-11
**Bug ID**: baton 7605b72e-3529-485c-b5a6-99e3947f2fe0
**PR**: [#594](https://github.com/phoenixvc/retort/pull/594)
**Severity**: Medium

## Problem Description

Six tests in the engine suite passed while never exercising the code they named.
They contributed green checks and coverage percentage without testing anything,
which is worse than having no test: the named behaviour looked covered, so nobody
went looking.

This was a sweep, not a single bug. Three earlier instances were found by hand in
one small area (#590, #591), which is what established the class as real and
motivated a systematic pass.

## Root Cause Analysis

Every instance shares one shape: **an assertion that also holds when the subject
does nothing.**

`expect(Array.isArray(x)).toBe(true)` holds for `[]`. `toBeDefined()` holds for
any object. `not.toThrow()` holds for a function that returns immediately. When
that is the _only_ assertion in a test, the test cannot distinguish working code
from absent code.

The weak matcher alone is not the defect — most uses are legitimate, and a
robustness test whose claim genuinely _is_ "does not throw" is correct as written.
The defect is the combination of a weak sole assertion with a subject that can
silently no-op: a resolver returning null, an early return, a guard that skips, or
a loop over an empty list.

Two secondary causes showed up repeatedly:

- **Fixtures that did not produce the condition under test.** `agent-analysis`
  asserted consolidation opportunities were found, but its fixture gave every team
  a distinct scope, so the result was always `[]`. The test's own comment admitted
  this while the title claimed the opposite.
- **Broken fixtures hidden by the weak assertion.** `spec-accessor` called its
  fixture "a valid spec" while omitting `aliases.yaml` and `docs.yaml`, so
  `validate()` always returned two errors. Asserting only `Array.isArray` meant
  nobody noticed for as long as the test existed.

## Solution Implemented

Grep was used only to shortlist; **mutation decided every verdict**. For each
candidate: break the thing the test claims to exercise, run the test, and observe
whether it goes red. A test that stays green never reached its subject.

Two controls kept the method honest:

1. **A control mutation was run first** — the `default: throw` in `createAdapter`
   was removed and the test asserting it throws was run. It went red. Without this,
   a misconfigured harness that silently ran nothing would have reported every test
   as vacuous.
2. **Every survivor was re-run against its whole test file.** This separates a
   genuine coverage hole (nothing anywhere tests this) from a merely weak test that
   a sibling already covers. Two verdicts changed on this check.

### Code Changes

- **`__tests__/tracker-adapter.test.mjs`**: both adapters expose `fetchIssues`, so
  asserting only that could not tell them apart — swapping `GitHubAdapter` for
  `LinearAdapter` kept the whole file green. Now asserts the instance type.
- **`__tests__/agent-analysis.test.mjs`**: added an `OVERLAPPING_TEAMS` fixture with
  a duplicated scope and asserted the found pair, ratio, and overlapping scope. Kept
  the disjoint case as an explicit `toEqual([])` rather than deleting it.
- **`__tests__/template-utils.test.mjs`**: replaced two `typeof === 'string'` tests
  with assertions on the actual labels, covering the directory-prefix branches, the
  well-known root files, the Windows-separator normalisation, and the `root` fallback.
- **`__tests__/spec-accessor.test.mjs`**: completed the fixture with `aliases.yaml`
  and `docs.yaml` so the spec is genuinely valid, then asserted `toEqual([])`.
- **`__tests__/sync-guard.test.mjs`**: retitled to describe what it actually does
  (a clean tree, not a short porcelain line) and asserted the exact result object.

### Testing

- **Unit Tests**: no new subjects; five existing test files strengthened so their
  assertions match their titles. Net +6 test cases.
- **Integration Tests**: unchanged.
- **Manual Testing**: 22 mutation runs across 9 shortlisted candidates plus 1 control.

## Verification

Each fix was verified by **re-applying the original mutation** and confirming the
test now fails. All six went red. This is the step that proves a fix works — a test
that merely passes proves nothing, since it passed before the fix too.

### Before/After Comparison

|                                                          | Before       | After   |
| -------------------------------------------------------- | ------------ | ------- |
| `tracker-adapter` — swap adapter classes                 | green        | **red** |
| `agent-analysis` — `findConsolidationOpps` returns `[]`  | green        | **red** |
| `template-utils` — `categorizeFile` returns one constant | green        | **red** |
| `spec-accessor` — `validate()` returns a non-empty array | green        | **red** |
| `sync-guard` — remove the short-line filter              | green (test) | **red** |

Triage counts over the 77-file engine suite:

| Outcome                                               | Count |
| ----------------------------------------------------- | ----- |
| Test cases containing a weak matcher                  | 155   |
| Shortlist — no strong assertion at all                | 44    |
| Mutation-tested (plus 1 control)                      | 9     |
| Confirmed and fixed                                   | 6     |
| Cleared by mutation (mutant killed)                   | 3     |
| Cleared by inspection (weak assertion _is_ the claim) | 35    |

Full suite after the fixes: **2382 passed, 1 skipped**. All 18 CI checks green.

### Regression Testing

The strengthened assertions are themselves the regression guard: each now fails if
its subject is removed, which was not true before.

## Impact Assessment

No production behaviour was affected — every finding was in test code, and no
engine source was changed. The impact was on confidence: `categorizeFile`'s entire
17-branch mapping table was unverified, and `createAdapter` could have routed
`github` to the Linear adapter without any test noticing.

## Prevention Measures

Mutation testing is the systematic answer, and it is already the repo's own advisory
rule (`qa-mutation-testing`). Stryker was costed against this suite with a real
scoped run:

- `@stryker-mutator/vitest-runner@9.6.1` peers `vitest >=2.0.0` — compatible with
  the repo's Vitest 4.1.0.
- Measured density: **157 mutants from 192 LOC (0.82/LOC)** → roughly **22,500
  mutants** across the 27.4k-LOC engine.
- Stryker's dry run executes the full suite (~135s) before mutating anything.
- **Blocker:** the dry run fails inside Stryker's sandbox.
  `sync-agent-features.test.mjs:337` asserts `<repo>/docs/orchestration/concurrency-protocol.md`
  exists; `docs/` lives outside `.agentkit`, so the sandbox never copies it. This is
  a sandboxing gap rather than a test defect, and it will affect any sandboxed or
  containerised runner — not only Stryker.

A full-engine run is therefore not viable as a blocking gate on this hardware. The
recommended path is Stryker in `--incremental` mode scoped to files changed in a PR,
after the sandbox blocker is fixed. Tracked as baton task
`9be88861-f4c8-4d0b-bfd6-32631c5e3dbd`; adding the dependency and CI time is a
maintainer decision.

## Lessons Learned

- **A test that has never failed has never been verified.** The fastest way to check
  a test is to break its subject on purpose and confirm it goes red.
- **Always run a control mutation first.** Otherwise a harness that silently runs
  nothing reports every test as vacuous, and the whole sweep is noise.
- **Test-level and file-level results answer different questions.** Surviving at test
  level means the named test is weak; surviving at file level means nothing tests the
  behaviour at all. Only the second is a coverage hole, and conflating them inflates
  the finding count.
- **Read the test's own comments.** Two instances were self-documenting: the comment
  explained why the fixture produced nothing while the title claimed it produced
  something.
- **A weak assertion can hide a broken fixture.** `spec-accessor` only revealed its
  incomplete spec once the assertion was tightened enough to fail.

---

**Fix Author**: Claude Opus 5 (agent session)
**Reviewer**: pending
**Status**: Resolved
