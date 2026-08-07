# Orphaned hook scripts never wired in generated Claude settings Resolution - Historical Summary

**Completed**: 2026-08-07
**Bug ID**: Follow-up identified in [0002](0002-2026-08-07-dangling-hook-wiring-in-generated-claude-settings-bugfix.md)
**PR**: [#577](https://github.com/phoenixvc/retort/pull/577)
**Severity**: Medium

## Problem Description

Hook scripts were emitted into `.claude/hooks/` but wired to no lifecycle event,
making them dead output. `budget-guard-check.sh` and `pre-push-validate.sh`
shipped to every adopter and never ran — including `pre-push-validate`, whose
entire purpose is to gate `git push`.

This is the exact counterpart to the dangling references fixed in
[0002](0002-2026-08-07-dangling-hook-wiring-in-generated-claude-settings-bugfix.md):
the same root cause, the opposite symptom. That change reconciled wiring that
named absent scripts; this one reconciles scripts that no wiring named.

Unlike 0002, this defect was **not** conditional on feature configuration. Every
adopter received the dead files, and retort's own repository was affected.

## Root Cause Analysis

Hook wiring had two sources of truth that could not see each other:

- `spec/settings.yaml` declared a `hooks:` block — `sessionStart`, `preToolUse`,
  `postToolUse`, `stop` — naming eight hook stems with their matchers.
- `syncClaudeSettings()` received that spec as a parameter named `_settingsSpec`
  and deliberately ignored it, parsing the static
  `templates/claude/settings.json` and copying its `hooks` block through
  instead.

The static template named six stems. The spec named eight. Nothing reconciled
them, so the two the template omitted were emitted as files and wired nowhere.

Both orphaned scripts declare their intended event in their own headers —
`Hook: PreToolUse (matcher: Bash)` for `pre-push-validate`, and
`Hook: PreToolUse (matcher: Bash|Write|Edit)` for `budget-guard-check` — and
both match `spec/settings.yaml` exactly. The spec encoded real authored intent;
the static template was simply stale.

Two further orphan classes shared the same split:

| Class                                                                                                                             | Cause                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `.ps1` variants of `guard-destructive-commands`, `protect-sensitive`, `protect-templates`, `stop-build-check`, `warn-uncommitted` | template wired `.ps1` only for `session-start`, so five shipped unwired |
| `.claude/hooks/init-state.{sh,ps1}`                                                                                               | committed output with no template anywhere in `.agentkit/`              |

`init-state` survived for a mechanical reason worth recording:
`.agentkit/.manifest.json` is gitignored, so a fresh clone has no previous
manifest and the stale-file cleanup in `synchronize.mjs` never fires. Output
that stops being generated is therefore never pruned — it simply stays committed.

## Solution Implemented

`settings.hooks` is now generated from `spec/settings.yaml`, and the `hooks`
block is removed from the static template so the spec is the only source.

### Code Changes

- **`.agentkit/engines/node/src/platform-syncer.mjs`**: `_settingsSpec` renamed
  to `settingsSpec` and consumed. Added three exported helpers —
  `collectHookExtensions()` indexes hook templates by stem, recording which
  variants ship; `buildHookCommand()` renders the invocation, preferring `.ps1`
  with a `.sh` fallback when both exist; `buildHooksFromSpec()` maps the four
  lifecycle keys to Claude Code event names, accepting either a bare stem or a
  list of `{matcher, hook}` entries.
- **`.agentkit/templates/claude/settings.json`**: `hooks` block removed, leaving
  only `permissions`.
- **`.claude/settings.json`**: regenerated — eight stems across four events.
- **`.claude/hooks/init-state.{sh,ps1}`**: deleted.

The feature gate introduced in 0002 is preserved and strengthened.
`buildHooksFromSpec()` calls the same `isHookEmitted()` check that
`syncClaudeHooks()` uses, applied **at generation time** rather than as a
post-filter, so spec-driven wiring cannot reintroduce a dangling reference. An
entry naming a stem with no template on disk is skipped for the same reason.
`filterHooksToEmitted()` is retained for a spec that declares no hooks, with its
tests intact.

### Testing

- **Unit Tests**: `claude-hook-wiring.test.mjs` retargeted from the template to
  the spec — 53 tests. Added coverage for `buildHookCommand()`,
  `collectHookExtensions()`, and `buildHooksFromSpec()`, including the structural
  cases (unknown lifecycle key, entry naming a nonexistent hook, malformed list
  entry).
- **Integration Tests**: full suite green — 2205 passed, 0 failed.
- **Manual Testing**: `retort:sync` clean and idempotent across repeat runs;
  `retort:validate` reports _"Checked 14 hook script(s) wired in settings.json"_.

## Verification

The defining invariant was checked programmatically against generated output
rather than asserted by inspection:

```
wired: 14   on disk: 14
ORPHANS (emitted, never wired): none
DANGLING (wired, not emitted): none
```

A regression test enforces the same property from the other direction: every
stem in the hook template directory must appear in the generated wiring, so a
newly added hook template that nobody wires fails the suite.

### Before/After Comparison

| Aspect                | Before                        | After                |
| --------------------- | ----------------------------- | -------------------- |
| Source of hook wiring | static template               | `spec/settings.yaml` |
| Stems wired           | 6                             | 8                    |
| Hook files emitted    | 16 (incl. 2 with no template) | 14                   |
| Orphaned files        | 7                             | 0                    |

### Regression Testing

The "every shipped hook template is wired" assertion is derived from the
template directory rather than a hardcoded list, so it keeps holding as hooks
are added or removed.

## Impact Assessment

Every adopter is affected. Two hooks that previously did nothing now run:

- `pre-push-validate` (PreToolUse, matcher `Bash`) **blocks `git push`** when
  unpushed commits are not Conventional Commits, or the branch name does not
  match `type/description`. It requires `jq` and no-ops without it. Its
  generated-file drift check remains gated behind `autoSyncOnPush`, which
  defaults to `false`.
- `budget-guard-check` (PreToolUse, matcher `Bash|Write|Edit`) warns rather than
  blocks under the default `budgetPolicy.enforcement: warn`, but invokes `node`
  on every matching tool call.

Adopters who do not want either can disable `permission-guards`, which gates
both through its `claude/hooks/` directory claim, or remove the entries from
`spec/settings.yaml`.

Wiring the five previously dead `.ps1` variants fixed a latent Windows gap
rather than merely tidying: `protect-templates.ps1` matches both `\` and `/`
path separators while the `.sh` matches only `/`. On Windows, where tool input
carries backslashes, the `.sh` guard silently failed to block writes to
`.agentkit\templates\`.

## Prevention Measures

The `.ps1`-with-`.sh`-fallback pattern is safe **only** because every hook
signals its decision as JSON on stdout and exits 0 — a blocking `.ps1` still
exits 0, so `||` never double-runs the `.sh`, and the fallback fires only when
pwsh cannot launch. Switching any hook to exit-code signalling would silently
convert a block into an allow on Windows. That constraint is documented on
`buildHookCommand()` at the point where it would be violated.

## Lessons Learned

0002 concluded that when two code paths must agree, the durable fix is one
shared decision rather than two correct implementations. This change is the
evidence for the stronger form: reconciling the two paths was not enough while
two **sources** remained. 0002 filtered the template's wiring against the gate
and left the spec ignored, which fixed the dangling half and left the orphan
half untouched. Removing the second source is what closed the class.

Orphaned output is also structurally harder to notice than a dangling
reference: a dangling reference produces an error when the event fires, whereas
an orphan produces silence. `pre-push-validate` never ran and nothing ever said
so. Invariants worth testing therefore run in both directions — not only "is
everything referenced present?" but "is everything present referenced?".

Finally, a gitignored manifest quietly disables stale-output pruning. Anything
that stops being generated stays committed indefinitely, which is how two files
with no template source survived in `.claude/hooks/`.

## Follow-up Identified

Two configuration knobs are declared but read by nothing, the same family of
defect at a smaller scale, and deliberately out of scope here:

- `windowsFirst` in the repo overlay is referenced by no engine code and no
  template.
- The `settings.yaml` hook schema in `spec-validator.mjs` is
  `{ type: 'object', required: true }` — entirely unvalidated. Nothing
  cross-checks that a declared hook has a template, which is how the spec and
  template drifted apart unnoticed. `buildHooksFromSpec()` now skips such
  entries defensively, but the validator itself is unchanged.

---

**Fix Author**: Jurie Smit
**Reviewer**: Pending review on [#577](https://github.com/phoenixvc/retort/pull/577)
**Status**: Resolved
