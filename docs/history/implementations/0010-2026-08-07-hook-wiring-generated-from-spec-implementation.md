# Hook wiring generated from spec Implementation - Historical Summary

**Completed**: 2026-08-07
**Duration**: Single session, following #572
**Status**: ✅ **SUCCESSFULLY COMPLETED**
**PR**: [#575](https://github.com/phoenixvc/retort/pull/575) - feat(claude-hooks): generate settings hook wiring from spec

## Overview

`settings.yaml` has always declared Claude Code's lifecycle hook wiring under a
`hooks:` key. `syncClaudeSettings()` accepted that spec as a parameter named
`_settingsSpec` — the underscore marking it deliberately unused — and copied a
hand-maintained `hooks` block out of `templates/claude/settings.json` instead.

Two sources of truth, and they had drifted: `budget-guard-check` and
`pre-push-validate` were written to disk by `syncClaudeHooks()` but wired to no
event at all. They were unreachable dead output.

This is the orphan half of [#185](https://github.com/phoenixvc/retort/issues/185).
The dangling half — wiring that named scripts sync never emitted — was fixed in
[#572](https://github.com/phoenixvc/retort/pull/572). Same root cause, opposite
symptom.

## Implementation Summary

### Projects/Components Affected

- ✅ **`.agentkit/engines/node/src/platform-syncer.mjs`** — new
  `buildHooksFromSpec()`; `syncClaudeSettings()` now consumes `settingsSpec`
  rather than ignoring it
- ✅ **`.agentkit/templates/claude/settings.json`** — `hooks` block removed, so
  the template no longer competes with the spec
- ✅ **`.claude/settings.json`** — regenerated; gains the two hooks that were
  always meant to be wired

### Key Changes Made

1. **`buildHooksFromSpec()`** — maps `sessionStart` / `preToolUse` /
   `postToolUse` / `stop` onto the settings.json hook tree. Command forms are
   unchanged: `session-start` keeps its `pwsh` invocation with a shell
   fallback, everything else is invoked as `.sh`.
2. **Template `hooks` block deleted** — wiring is now declared in exactly one
   place. Returning `null` for a spec that declares no hooks leaves any
   existing wiring untouched, so the change is inert for a caller without a
   spec.

### Issues Resolved

- **Orphaned hooks**: `budget-guard-check` and `pre-push-validate` are now
  wired to the PreToolUse matchers their own script headers declare
  (`Bash|Write|Edit` and `Bash` respectively).
- **Spec ignored**: the `_settingsSpec` parameter is live, so editing
  `settings.yaml` now actually changes generated output.

## Implementation Approach

### Phase 1: Confirm the spec is right, not the template

Both orphaned scripts document their intended event in their own header
comments, and both match the `settings.yaml` entries verbatim. That settled the
direction: the spec was correct and the static template was what had drifted.
Because this activates hooks for every adopter, the direction was raised as an
explicit decision and confirmed before any code was written.

### Phase 2: Generate, then verify the diff is only the intent

The generator was written to reproduce the previous output exactly, so the
resulting diff to `.claude/settings.json` is _only_ the two added hooks — every
pre-existing entry is byte-identical. That made the behavioural change legible
in review rather than buried in a reformatted file.

## Results

### Metrics

- **Build Status**: green
- **Tests**: 50 in `claude-hook-wiring.test.mjs`; full suite 2198 passing
- **Validation**: `retort:validate` reports `Checked 9 hook script(s) wired in
settings.json` (8 stems; `session-start` counts for both `.ps1` and `.sh`)
  and passes with zero errors
- **Coverage**: new cases for command forms, matcher pass-through, declared
  order, stable event order, skipped entries, null-spec fallback, extension
  normalisation, and matcher omission

### Impact

Two PreToolUse hooks become active for adopters on default settings:

- `budget-guard-check` can deny a tool call once budgets are configured.
- `pre-push-validate` can block a `git push` on generated-file drift or a
  non-conforming commit message.

Both are gated by `permission-guards`, so `filterHooksToEmitted()` drops them
wherever that feature is disabled.

## Lessons Learned

### Technical Insights

A parameter named `_settingsSpec` is not a dormant hook for future work — it is
a silent contradiction. The spec claimed authority the code never granted it,
and nothing failed, because the two happened to agree on six of eight hooks.
The two they disagreed on produced files nobody ever ran.

The test fixture now builds wiring from the live `settings.yaml` instead of
reading a static file. That converts "the spec and the output agree" from a
thing someone has to notice into a thing CI asserts.

### Process Improvements

Reproducing prior output byte-for-byte and letting the diff carry only the
intended change made a behaviour-affecting PR reviewable at a glance. Worth
repeating whenever generated output changes.

### Best Practices Established

When two artifacts must agree, delete one. Reconciling them — even correctly —
leaves the next contributor two places to edit and one to forget.

## Future Considerations

- The `.ps1` variants of `protect-sensitive`, `protect-templates`,
  `guard-destructive-commands`, `warn-uncommitted`, and `stop-build-check` are
  emitted but never invoked; only `session-start` uses the `pwsh`-with-fallback
  form. On Windows without a shell those hooks silently do nothing. Making the
  command form depend on whether a `.ps1` exists would fix it, but changes
  invocation for five hooks and deserves its own change.
- `validate-numbering.sh` does not scan `issues/` or `lessons-learned/`.

## Related Documentation

- **[#185](https://github.com/phoenixvc/retort/issues/185)**: the originating issue — both halves
- **[docs/history/bug-fixes/0002-2026-08-07-dangling-hook-wiring-in-generated-claude-settings-bugfix.md](../bug-fixes/0002-2026-08-07-dangling-hook-wiring-in-generated-claude-settings-bugfix.md)**: the dangling half, fixed in #572

---

**Implementation Team**: Jurie Smit
**Review Status**: Copilot and CodeRabbit review addressed; awaiting merge
**Next Steps**: Consider the `.ps1` invocation gap noted above
