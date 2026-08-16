# Orphaned hook scripts never wired in generated Claude settings Resolution - Historical Summary

**Completed**: 2026-08-07
**Bug ID**: Orphan half of [#185](https://github.com/phoenixvc/retort/issues/185)
**PR**: [#577](https://github.com/phoenixvc/retort/pull/577)
**Severity**: Medium

## Problem Description

Hook scripts shipped into `.claude/hooks/` and were wired to no lifecycle event,
making them dead output.

[#575](https://github.com/phoenixvc/retort/pull/575) moved hook wiring to
`spec/settings.yaml` and closed the largest instance of this —
`budget-guard-check` and `pre-push-validate`, which had never run. Two smaller
instances survived that change:

| Orphan                                                                                                                            | Why it survived                                                              |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `.ps1` variants of `guard-destructive-commands`, `protect-sensitive`, `protect-templates`, `stop-build-check`, `warn-uncommitted` | `buildHooksFromSpec()` hardcoded `session-start` as the only pwsh-wired hook |
| `.claude/hooks/init-state.{sh,ps1}`                                                                                               | committed output with no template anywhere in `.agentkit/`                   |

Five `.ps1` hooks were therefore generated on every sync and invoked by nothing.

## Root Cause Analysis

`buildHooksFromSpec()` decided the command form from a per-event boolean rather
than from what each hook actually ships:

```js
addSingle('sessionStart', 'SessionStart', true); // pwsh + .sh fallback
addMatched('preToolUse', 'PreToolUse'); // .sh only
addMatched('postToolUse', 'PostToolUse'); // .sh only
addSingle('stop', 'Stop', false); // .sh only
```

The flag encoded a fact about one hook — that `session-start` ships both
variants — as a property of its lifecycle event. Every other hook shipping a
`.ps1` was invoked as `.sh` regardless, so its `.ps1` was emitted and ignored.

`init-state` survived for a separate mechanical reason worth recording:
`.agentkit/.manifest.json` is gitignored, so a fresh clone has no previous
manifest and the stale-file cleanup in `synchronize.mjs` never fires. Output
that stops being generated is therefore never pruned — it stays committed
indefinitely.

## Solution Implemented

Command form is now derived from the hook templates on disk rather than declared
per event.

### Code Changes

- **`.agentkit/engines/node/src/platform-syncer.mjs`**: added
  `collectHookExtensions()`, which indexes the hook templates by stem and
  records which extensions ship. `buildHooksFromSpec()` takes that index as an
  optional second argument and picks the form per hook: `.ps1` with a `.sh`
  fallback when both ship, `.sh` alone when only it ships, `.ps1` alone
  otherwise. Without an index the previous per-event behaviour is retained, so
  the single-argument contract used throughout the tests still holds.
- **`.claude/settings.json`**: regenerated — five hooks now invoke their `.ps1`
  with a `.sh` fallback.
- **`.claude/hooks/init-state.{sh,ps1}`**: deleted.

### Testing

- **Unit Tests**: added `collectHookExtensions()` coverage and a variant-
  selection suite over all four combinations, including the absent-from-index
  case that preserves the old contract. 59 tests in the file.
- **Integration Tests**: full suite green.
- **Manual Testing**: `retort:sync` clean and idempotent; `retort:validate`
  reports _"Checked 14 hook script(s) wired in settings.json"_.

## Verification

The defining invariant is checked programmatically against generated output
rather than asserted by inspection:

```text
wired: 14   on disk: 14
ORPHANS (emitted, never wired): none
DANGLING (wired, not emitted): none
```

### Before/After Comparison

| Aspect             | Before (post-#575) | After |
| ------------------ | ------------------ | ----- |
| Hook files wired   | 9                  | 14    |
| Hook files emitted | 16                 | 14    |
| Orphaned files     | 7                  | 0     |

### Regression Testing

A new test asserts that every variant of every hook template appears in the
generated wiring. It is derived from the template directory rather than a fixed
list, so a hook added later that nobody wires fails the suite.

## Impact Assessment

On machines with `pwsh`, five hooks now execute their PowerShell implementation
instead of the shell one. The two are behaviourally equivalent with one
exception, which is the reason this matters beyond tidiness:

`protect-templates.ps1` matches both `\` and `/` path separators, while
`protect-templates.sh` matches only `/`:

```bash
PROTECTED_PATTERNS=( '\.agentkit/templates/' ... )   # .sh
```

```powershell
$protectedPatterns = @( '\.agentkit[\\/]templates[\\/]' ... )  # .ps1
```

Where tool input carries Windows-style paths, the `.sh` guard does not match and
the write is allowed. Wiring the `.ps1` closes that gap on Windows.

This was not verified empirically in this repository, because
`protect-templates` exempts the Retort source repo itself — the hook exits early
when `.agentkit/package.json` names `retort-runtime`, so the protected path is
never evaluated here.

On machines without `pwsh` nothing changes: the `||` falls through to the `.sh`.

## Prevention Measures

The `.ps1`-with-`.sh`-fallback pattern is safe **only** because every hook
signals its decision as JSON on stdout and exits 0. A blocking `.ps1` still
exits 0, so `||` never double-runs the `.sh`, and the fallback fires only when
pwsh cannot launch. Switching any hook to exit-code signalling would silently
convert a block into an allow on Windows. That constraint is documented in
`buildHooksFromSpec()` at the point where it would be violated.

## Lessons Learned

A dangling reference and an orphan are the same defect observed from opposite
ends, but they are not equally visible. #185 and #572 dealt with wiring that
named an absent script — that errors when the event fires, so it surfaces.
An orphan is silent: `pre-push-validate` never ran and nothing reported it, and
five `.ps1` hooks were regenerated on every sync for as long as they existed.

Invariants worth testing therefore run in both directions. "Is everything
referenced present?" caught #185. Only "is everything present referenced?"
catches this.

Separately, a boolean that encodes a fact about one specific item as a property
of its category will be wrong for the second item that joins the category.
`crossPlatform: true` was accurate for `session-start` and became the reason
five other hooks were mis-wired.

## Follow-up Identified

Two configuration knobs are declared but read by nothing — the same family of
defect at a smaller scale, deliberately out of scope here:

- `windowsFirst` in the repo overlay is referenced by no engine code and no
  template.
- The `settings.yaml` hook schema in `spec-validator.mjs` is
  `{ type: 'object', required: true }` — entirely unvalidated. Nothing
  cross-checks that a declared hook has a template.

Also unaddressed: the gitignored `.manifest.json` means stale generated output
is never pruned on a fresh clone. `init-state` is removed here by hand, but the
mechanism that let it persist remains.

---

**Fix Author**: Jurie Smit
**Reviewer**: Pending review on [#577](https://github.com/phoenixvc/retort/pull/577)
**Status**: Resolved
