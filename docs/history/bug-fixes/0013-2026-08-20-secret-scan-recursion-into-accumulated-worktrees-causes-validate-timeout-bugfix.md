# Secret scan recursion into accumulated worktrees causes validate timeout Resolution - Historical Summary

**Completed**: 2026-08-20
**Bug ID**: N/A — discovered via Stop-hook test failure during an unrelated session
**PR**: [#627](https://github.com/celladore/retort/pull/627)
**Severity**: Medium — deterministic CI/local test timeout, not a runtime or security issue

## Problem Description

`validate.test.mjs`'s `runValidate()` integration test ("runs all validation
phases against the real project") intermittently failed with
`Test timed out in 30000ms` against this repo's own long-lived checkout. The
failure blocked session completion via the repo's Stop hook (`/check` gate)
and looked, at first glance, like ordinary Vitest/Windows parallel-run
contention — the kind of flakiness the `test-quarantine.json` mechanism
exists for.

## Root Cause Analysis

`scanForPatterns()` — the recursive directory walker backing Phase 8
("Secret Scan") of `validate.mjs` — had **no directory exclusions at all**,
not even the conventional `node_modules` / `.git`. It walked every
subdirectory of `.claude`, `.cursor`, `.windsurf`, `.ai`, and `docs`
unconditionally.

This repo's own worktree-isolation convention
(`.claude/rules/worktree-isolation.md`) nests a **full repo copy** —
including its own `.claude/` and `docs/` trees — under
`.claude/worktrees/<name>/` per active worktree. On a long-lived checkout
with ~20 accumulated worktrees, that recursion visited **16,300+
scan-eligible files under `.claude` alone**, each nested worktree
re-scanning its own copy of the same `.claude/worktrees/` structure to
another level. This pushed a single `runValidate()` call from a normal
sub-second walk to 47s+ in isolation and 118s+ under full-suite Windows
process contention — comfortably past the 30s Vitest test timeout.

The bug was deterministic, not flaky: it reproduced consistently against
the bloated checkout and did not reproduce at all against a clean worktree
checkout at the same commit. Diffing behavior between the two (same code,
different accumulated `.claude/worktrees/` state) isolated the actual
environmental variable and ruled out "just parallel contention" as the
cause.

## Solution Implemented

Excluded `node_modules`, `.git`, and `worktrees` directory names from the
recursive walk in `scanForPatterns()`, matching this repo's own worktree
convention and standard scan-exclusion practice.

### Code Changes

- **`.agentkit/engines/node/src/validate.mjs`**: Added a
  `SCAN_SKIP_DIRS = new Set(['node_modules', '.git', 'worktrees'])`
  constant and a `continue` guard in `scanForPatterns()`'s directory-entry
  loop so matching directory names are never recursed into.

### Testing

- **Unit Tests**: No new test added — the existing real-project integration
  test in `validate.test.mjs` already exercises `scanForPatterns()` against
  the live repo tree and is the regression guard; per this repo's
  delegation convention, new test authoring for this fix is left to
  `/team-testing` rather than written inline.
- **Integration Tests**: Full `.agentkit` suite run post-fix: 2700 passed,
  1 pre-existing skip, 0 failed.
- **Manual Testing**: Ran a standalone benchmark script
  (`bench-validate.mjs`) against the actual affected checkout, both before
  and after the fix, to measure real-world impact rather than relying on
  the test timeout boundary alone.

## Verification

Benchmarked `runValidate()` directly against the real, bloated shared
checkout (the same one that produced the original 30s+ timeout), and ran
the full `.agentkit` test suite to confirm no regressions.

### Before/After Comparison

| Scenario                                   | Before  | After  |
| ------------------------------------------- | ------- | ------ |
| `runValidate()` vs. real bloated checkout    | 47,007ms (isolated) / ~118,744ms (full-suite contention) | 949ms |
| Full `.agentkit` suite                       | 1 timeout failure | 2700 passed / 1 skipped / 0 failed |

### Regression Testing

Ran the complete `.agentkit` engine test suite (not just `validate.test.mjs`
in isolation) after applying the fix to confirm no other phase or test
depended on the unfiltered recursion behavior.

## Impact Assessment

Affected any contributor or CI run validating this repo from a checkout
with several accumulated `.claude/worktrees/` entries — a state this repo's
own agent tooling actively encourages (`worktree-isolation.md` recommends
per-task worktrees). Long-lived development/agent sessions were the most
exposed, since worktree accumulation compounds over time without manual
pruning.

## Prevention Measures

- The fix is a general directory-exclusion rule, so any future growth in
  `.claude/worktrees/` (or reintroduction of `node_modules`/`.git` in scan
  roots) no longer degrades secret-scan performance.
- Regular worktree cleanup (via the `repo-cleanup` skill / `clean_gone`)
  remains the complementary mitigation for checkout bloat generally, but
  the scanner itself should no longer be sensitive to it.

## Lessons Learned

- A deterministic root cause can masquerade as flakiness when it's
  environment-dependent (accumulated local state) rather than purely
  timing-dependent — reproducing in isolation and diffing against a clean
  checkout at the same commit was what separated the two.
- Prefer the minimal, root-cause fix over a symptomatic one: a test-timeout
  bump (following the existing `hookTimeout: 240_000` precedent for
  `sync-integration.test.mjs`) was considered and prototyped first, but
  abandoned once the real fix brought the operation back under a second —
  well inside the existing 30s budget — per this repo's own
  "make the minimum change necessary" conduct rule.
- Any tool that recursively walks a repository tree should default to
  excluding `node_modules`, `.git`, and this repo's own `worktrees`
  convention; this was previously true only by accident for phases that
  happened to scan narrower directory sets.

---

**Fix Author**: Claude Code (background session)
**Reviewer**: Pending — PR #627 open, CI green, mergeable, awaiting maintainer review
**Status**: Resolved (fix verified and shipped); Monitoring pending merge
