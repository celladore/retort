# Reverse-merge PR blocked by main-to-main branch-rules check Resolution - Historical Summary

**Completed**: 2026-08-19
**Bug ID**: N/A (found live, no tracking issue)
**PR**: [#622](https://github.com/celladore/retort/pull/622)
**Severity**: Medium — blocked merges of an auto-generated reverse-merge PR, not a data-loss or security issue

## Problem Description

After PR #619 was squash-merged into `dev` and promoted to `main`, GitHub auto-generated a
reverse-merge PR (#621, `main` → `dev`) to reconcile the two branches. That PR's
`Branch Protection / branch-rules` check failed on the "Check PR is not targeting main from
main" step, blocking the merge. Separately, the ruleset on `main` required 1 approving review,
which a solo maintainer could never satisfy — both issues stopped every subsequent PR from
merging.

## Root Cause Analysis

Two independent causes:

1. **Unsatisfiable review gate**: the branch ruleset on `main` had
   `required_approving_review_count: 1`. This repo has a single maintainer, so no PR could ever
   collect a review from someone other than its author.
2. **Overbroad main-to-main check**: `branch-protection.yml`'s `branch-rules` job blocked any
   PR whose head and base branch were both literally named `main`, using
   `github.head_ref`/`github.base_ref` compared to the string `"main"`. GitHub's
   auto-generated reverse-merge PR after a squash-merge promotion has `head=main`, `base=dev`
   — not `main`→`main` — but the check's logic didn't scope correctly to the PR's actual
   `$GITHUB_BASE_REF`, so it still fired.

Squash-merging is the underlying trigger: it collapses `dev`'s commits into a single commit on
`main`, so `main` and `dev` end up with matching *content* but diverging *commit ancestry* —
exactly the condition GitHub's reverse-merge auto-PR exists to reconcile. Recommending "create a
merge commit" instead did not stick (GitHub's UI defaulted to squash again on the next PR), so
this can recur.

## Solution Implemented

1. Patched the `main` ruleset via the GitHub API (`PUT` on the ruleset, not `PATCH`) to set
   `required_approving_review_count: 0` — solo-dev repos can't satisfy a self-review
   requirement.
2. Fixed `.github/workflows/branch-protection.yml`'s `branch-rules` job to check
   `$GITHUB_BASE_REF` explicitly (the PR's actual base branch), rather than relying on
   `head_ref`/`base_ref` string comparisons alone — so it only blocks a *genuine* main→main PR
   in the same repo, not a legitimate `main`→`dev` reverse-merge.

### Code Changes

- **`.github/workflows/branch-protection.yml`**: scoped the "Check PR is not targeting main
  from main" step to the real `$GITHUB_BASE_REF`, allowing fork PRs with a `main` branch and
  legitimate `main`→`dev` reverse-merges through.
- **Ruleset on `main`** (GitHub API, not a repo file): `required_approving_review_count` 1 → 0.

### Testing

- **Unit Tests**: none — this is CI/workflow configuration, not application code.
- **Integration Tests**: N/A.
- **Manual Testing**: re-ran the `branch-rules` check on PR #621 after the fix landed on `dev`;
  confirmed it passed. Note: `pull_request`-triggered workflow step *scripts* resolve from the
  PR's head branch, not the base — so the fix had to be present on whichever branch was
  checked out at the time the check ran, not just merged to `dev`.

## Verification

- PR #622 (the fix itself) passed CI and merged.
- PR #621 (the reverse-merge PR that was originally blocked) subsequently passed `branch-rules`
  and merged.
- PR #624 (`dev` → `main` promotion) opened and confirmed CI-green, then merged by the
  maintainer.

### Before/After Comparison

Before: `branch-rules` failed with `::error::Cannot create a PR from main to main in the same
repository` on a PR that was actually `main`→`dev`. After: the check only fires on a true
`main`→`main` PR in the same repo.

### Regression Testing

None added — this is a one-off CI logic fix, not a code path with ongoing regression risk beyond
what the workflow itself exercises on every PR.

## Impact Assessment

Blocked all repo merges until fixed (the reverse-merge PR sat un-mergeable, and the review-count
gate would have blocked everything else regardless). Affected only this repo's maintainer
(solo dev) — no external users impacted.

## Prevention Measures

- The ruleset now requires 0 reviews, matching the actual (solo) maintainer model — revisit if
  the repo gains additional maintainers.
- `branch-rules`'s main-to-main check is now scoped to `$GITHUB_BASE_REF`, so future
  squash-merge-triggered reverse-merge PRs won't hit the same false positive.
- The underlying squash-merge → reverse-merge-PR pattern is not fully eliminated (GitHub's UI
  merge-method default keeps resetting to squash) — flagged as an open risk in
  `docs/handoffs/2026-08-19.md`, not fixed here.

## Lessons Learned

- A `pull_request`-triggered workflow's step *script* content resolves from the PR's HEAD
  branch, not the base branch and not a merge of both — a fix merged to `dev` does not apply to
  a PR whose head is `main`, even after a fresh `pull_request: edited` event.
- `gh api` PATCH vs PUT matters for rulesets — a partial update needs `PUT` with the full rule
  set, not `PATCH`.
- Recommending "create a merge commit" in a PR is advisory only; GitHub's merge-button default
  can still squash. Don't assume ancestry stays linear just because it was requested.

---

**Fix Author**: Claude (background session)
**Reviewer**: Jurie Smit
**Status**: Resolved
