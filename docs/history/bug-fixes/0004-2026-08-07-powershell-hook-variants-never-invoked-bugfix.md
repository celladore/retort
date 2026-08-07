# PowerShell hook variants never invoked Resolution - Historical Summary

**Completed**: 2026-08-07
**Bug ID**: Found while closing [#185](https://github.com/phoenixvc/retort/issues/185)
**PR**: [#578](https://github.com/phoenixvc/retort/pull/578)
**Severity**: High

## Problem Description

Six Claude hooks ship a `.ps1` alongside their `.sh`, but only `session-start`
was wired with the `pwsh`-with-shell-fallback command. The other five were
invoked as `.sh` only:

- `protect-sensitive`
- `protect-templates`
- `guard-destructive-commands`
- `warn-uncommitted`
- `stop-build-check`

Their PowerShell variants were generated, shipped, and never executed. On a
Windows machine without a shell on PATH, all five hooks silently did nothing —
including both file-protection guards and the destructive-command guard.

Nothing failed loudly. The `.sh` invocation simply did not resolve, and the
hook produced no output, which is indistinguishable from a hook that ran and
allowed the operation.

## Root Cause Analysis

The command form was hardcoded rather than derived. `buildHooksFromSpec()` took
a `crossPlatform` boolean, and exactly one call site passed `true`:

```js
addSingle('sessionStart', 'SessionStart', true); // pwsh + fallback
addMatched('preToolUse', 'PreToolUse'); // .sh only
addMatched('postToolUse', 'PostToolUse'); // .sh only
addSingle('stop', 'Stop', false); // .sh only
```

`session-start` was never special. It was simply the hook someone had wired by
hand, and the flag preserved that accident when the wiring moved to the spec in
[#575](https://github.com/phoenixvc/retort/pull/575).

This is the same defect class as #185 — a fact about the hooks (which ones have
a PowerShell variant) recorded in a second place that could drift from the
files on disk — one layer further down. #185 was about _which hooks are wired_;
this was about _how they are invoked_.

## Solution Implemented

Derive the command form from which variants actually exist.

### Code Changes

- **`.agentkit/engines/node/src/platform-syncer.mjs`**: added
  `findPs1HookStems(templatesDir)`, which reads the hook template directory and
  returns the stems that have a `.ps1`. `buildHooksFromSpec()` now takes that
  set instead of a per-call `crossPlatform` flag and prefers the `.ps1` with a
  `.sh` fallback for any stem in it. `syncClaudeSettings()` passes the set.
- **`.claude/settings.json`**: regenerated — five commands change, nothing else.

Adding or removing a `.ps1` now changes the generated command on the next sync,
with no second list to keep in step.

### Testing

- **Unit Tests**: `claude-hook-wiring.test.mjs` — 55 tests. New cases cover
  `findPs1HookStems()` against the real template directory (exact stem set, and
  an empty set for a missing directory), plus a hook with a variant and one
  without.
- **Integration Tests**: a case walks every hook the spec wires and asserts its
  command form matches whether that stem has a `.ps1` — so a newly added
  variant that goes unwired fails here.
- **Manual Testing**: `retort:validate` reports `Checked 14 hook script(s)
wired in settings.json`, up from 9, and passes with zero errors — every one
  of the 14 resolves on disk.

## Verification

### Before/After Comparison

| Hook                         | Ships `.ps1` | Before          | After           |
| ---------------------------- | ------------ | --------------- | --------------- |
| `session-start`              | yes          | pwsh + fallback | unchanged       |
| `protect-sensitive`          | yes          | **`.sh` only**  | pwsh + fallback |
| `protect-templates`          | yes          | **`.sh` only**  | pwsh + fallback |
| `guard-destructive-commands` | yes          | **`.sh` only**  | pwsh + fallback |
| `warn-uncommitted`           | yes          | **`.sh` only**  | pwsh + fallback |
| `stop-build-check`           | yes          | **`.sh` only**  | pwsh + fallback |
| `budget-guard-check`         | no           | `.sh`           | unchanged       |
| `pre-push-validate`          | no           | `.sh`           | unchanged       |

### Regression Testing

The invariant test derives its expectation from `findPs1HookStems()` rather
than a literal list, so it cannot drift from the shipped templates.

## Impact Assessment

Affects Windows users without a shell on PATH. Both `PreToolUse` file guards
and the destructive-command guard were inert for them, which is the worst
subset to lose — those are the hooks that block unsafe writes.

Adopters on macOS or Linux are unaffected either way: `pwsh` is typically
absent, so the command falls through to the same `.sh` that ran before.

## Prevention Measures

The command form is now a function of the template directory's contents. The
only way to reintroduce this is to add a `.ps1` and delete the discovery call,
which the invariant test would catch.

## Lessons Learned

A boolean parameter with one `true` call site is usually a fact about the data
wearing a flag's clothing. `crossPlatform: true` looked like configuration; it
was really the statement "session-start has a .ps1", which the filesystem
already knew and could answer for every hook.

Worth noting how this surfaced: it was found while writing the "Future
Considerations" section of the #575 history doc — the act of writing down what
was deliberately left undone is what made the size of it visible.

## Future Considerations

The `.ps1` and `.sh` variants of each hook are maintained in parallel by hand.
Nothing asserts they behave equivalently — only that both exist and are
schema-conformant. A differential test would close that.

## Related Documentation

- **[#185](https://github.com/phoenixvc/retort/issues/185)**: the originating issue
- **[0002-…-dangling-hook-wiring-…](0002-2026-08-07-dangling-hook-wiring-in-generated-claude-settings-bugfix.md)**: dangling references, fixed in #572
- **[0010-…-hook-wiring-generated-from-spec](../implementations/0010-2026-08-07-hook-wiring-generated-from-spec-implementation.md)**: orphaned hooks, fixed in #575 — this gap is named in its Future Considerations

---

**Fix Author**: Jurie Smit
**Reviewer**: Pending review on [#578](https://github.com/phoenixvc/retort/pull/578)
**Status**: Resolved
