# Colliding history doc numbers and broken changelog links Resolution - Historical Summary

**Completed**: 2026-08-07
**Bug ID**: n/a — reported directly, no tracking issue
**PR**: [#576](https://github.com/phoenixvc/retort/pull/576)
**Severity**: Medium

## Problem Description

`scripts/create-doc.sh` produced two defects on **every** invocation:

1. **Colliding sequence numbers.** New history documents were given a number
   already taken on disk, which made `bash scripts/validate-numbering.sh` — and
   therefore CI — fail. Observed on 2026-08-07: the script emitted `0001` for a
   new bugfix even though `bug-fixes/0001-2026-03-04-infra-eval-review-fixes-bugfix.md`
   already existed.
2. **Broken CHANGELOG links.** Every `[history](…)` link appended to
   `CHANGELOG.md` 404'd.

Both were silent at authoring time and only surfaced later — the first in CI, the
second only when a reader clicked the link. The workaround was to fix both by hand
after each run, which [PR #572](https://github.com/phoenixvc/retort/pull/572) did.

The numbering bug had also already left a duplicate on `dev`: two implementation
docs both carrying the `0001-` prefix, which `validate-numbering.sh` reported on
every run.

## Root Cause Analysis

**Numbering.** The next number was read solely from the `sequences` counter in
`docs/history/.index.json`. That counter is not derived from what is on disk, and
documents created before the index existed were never registered — so it
under-reported. A second, compounding error: after use, the counter advanced from
its own (stale) value rather than from the number actually issued, so it never
caught up.

**CHANGELOG link.** `create-doc.sh` passed `"$SUBDIR/$FILENAME"` to
`update-changelog.sh`. That path is relative to `docs/history/`, but
`CHANGELOG.md` lives at the repo root. `update-changelog.sh`'s own usage
documentation and examples already specified a repo-root-relative path — the
caller simply did not honour it.

**Duplicate on disk.** A direct consequence of the numbering bug, committed before
anyone noticed.

## Solution Implemented

The next number is now `max(index counter, highest NNNN- prefix on disk + 1)`.
The directory scan makes the result self-correcting regardless of how far the
counter has drifted; the index is still written so it remains a usable audit
trail, but is no longer trusted as the sole source. The index write was also
corrected to advance past the number actually used.

The changelog path was fixed in the caller rather than in `update-changelog.sh`,
whose documented contract was already correct.

### Code Changes

Source of truth is `.agentkit/templates/scripts/`; the generated `scripts/` copies
were produced by `pnpm --dir .agentkit retort:sync`.

- **`.agentkit/templates/scripts/create-doc.sh`**: `DEST_DIR` now resolves before
  numbering; the node snippet scans the target directory for `^(\d{4})-` and takes
  `max(counter, highest + 1)`. The index read and the directory scan are
  individually `try`-wrapped, so a malformed index or a missing directory degrades
  rather than aborts. Index write advances to `Number(seqNum) + 1`. Changelog path
  is now `docs/history/$SUBDIR/$FILENAME`. The PR reference renders as a markdown
  link via the `githubSlug` template variable, falling back to a bare `#123` when
  the slug is unset.
- **`.agentkit/templates/scripts/validate-numbering.sh`**: also scans `issues/`
  and `lessons-learned/`, which are numbered the same way and previously went
  unchecked. Dropped the unused per-subdir `TYPE` mapping.
- **`.agentkit/templates/scripts/create-doc.ps1`**: same three fixes — the
  PowerShell variant carried every defect identically.
- **`scripts/create-doc.sh`, `scripts/create-doc.ps1`, `scripts/validate-numbering.sh`**:
  regenerated sync output.
- **`docs/history/implementations/0001-2026-03-20-kit-based-…`** → **`0009-…`**:
  renumbered the pre-existing duplicate.
- **`docs/history/.index.json`**: `sequences.implementation` corrected from `1` to
  `10` to match disk.

### Testing

- **Unit Tests**: none added — these are shell/PowerShell scripts with no existing
  harness in `.agentkit/engines/node/src/__tests__/`. Behaviour was verified by
  direct invocation (below). Adding script-level coverage is a reasonable follow-up
  for TESTING.
- **Integration Tests**: existing suite run in full — 2190 passed, 1 failed. The
  failure is `prettier.test.mjs` against three files this change does not touch; it
  is a Windows-local `core.autocrlf` artifact (see Verification).
- **Manual Testing**: probe invocations covering both the happy path and the
  specific failure mode, all reverted afterwards.

## Verification

| Check                                       | Result                                                     |
| ------------------------------------------- | ---------------------------------------------------------- |
| `bash scripts/validate-numbering.sh`        | zero errors (was 1)                                        |
| `./scripts/create-doc.sh bugfix "Test" 999` | `0003-…` — no collision                                    |
| CHANGELOG link                              | `[history](docs/history/bug-fixes/0003-….md)`              |
| PR field                                    | `[#999](https://github.com/phoenixvc/retort/pull/999)`     |
| **Stale-counter override**                  | counter reset to `1`, disk highest `0009` → emitted `0010` |
| No-PR invocation                            | falls back cleanly, no crash                               |

The stale-counter row is the one that actually exercises the fix: under the old
code that same state produced `0001` and collided.

This document itself was generated by the fixed script with `576` passed as the
third argument — the number, the changelog link, and the PR field above are all
live output, not hand-written.

### Before/After Comparison

| Behaviour                                 | Before                      | After                              |
| ----------------------------------------- | --------------------------- | ---------------------------------- |
| Number with stale counter (1) + 9 on disk | `0001` — collision          | `0010`                             |
| CHANGELOG link                            | `bug-fixes/0003-….md` (404) | `docs/history/bug-fixes/0003-….md` |
| PR field with arg `576`                   | `#576`                      | `[#576](…/pull/576)`               |
| `validate-numbering.sh` coverage          | 4 subdirectories            | 6 subdirectories                   |

### Regression Testing

`validate-numbering.sh` already runs in CI via `documentation-quality.yml` and
`documentation-validation.yml`, so a reintroduced collision fails the build. Its
widened scope now also covers `issues/` and `lessons-learned/`.

## Impact Assessment

Anyone running `create-doc.sh` — which `CLAUDE.md` makes mandatory after
significant work. Each run cost a manual renumber, a manual `.index.json` edit,
and a manual CHANGELOG link correction, or else a red CI check. Already-merged
CHANGELOG entries created before this fix still carry broken links; they were not
retroactively corrected, as that is a separate cleanup.

## Prevention Measures

The general lesson is encoded in the fix: **a counter that is not derived from the
thing it counts will drift.** Deriving from disk and treating the counter as a hint
means the script is now correct from any starting state, including a deleted or
corrupted index.

Widening `validate-numbering.sh` closes the matching gap in detection — previously
two of six numbered directories were unchecked, so the guard was narrower than the
thing it guarded.

## Lessons Learned

- The CHANGELOG bug lived in the **caller**, not in `update-changelog.sh` — whose
  usage examples already showed the correct repo-root-relative form. Reading the
  callee's documented contract identified the right place to fix within minutes.
- One reported symptom did not reproduce: `[#PR-Number]` was already being
  substituted correctly. Probing the unmodified script first prevented a fix to
  working code and redirected the effort to the actual gap (plain `#N` rather than
  a link).
- The stated renumber target `0002-` was already occupied, so following it
  literally would have traded one duplicate for another. `0009-` was used instead.
- Both defects existed identically in the PowerShell variant. Any fix to a
  `.sh` template in this repo should check its `.ps1` sibling.

---

**Fix Author**: Claude Opus 5 (agent session), for Jurie Smit
**Reviewer**: pending — see [#576](https://github.com/phoenixvc/retort/pull/576)
**Status**: Resolved
