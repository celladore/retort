# Dangling hook wiring in generated Claude settings Resolution - Historical Summary

**Completed**: 2026-08-07
**Bug ID**: [#185](https://github.com/phoenixvc/retort/issues/185)
**PR**: [#572](https://github.com/phoenixvc/retort/pull/572)
**Severity**: Medium

## Problem Description

Generated `.claude/settings.json` wired lifecycle hooks to scripts that sync
never wrote. When the lifecycle event fired, Claude Code invoked a nonexistent
path — degrading or blocking normal Write/Edit/Bash flows depending on the hook
failure policy.

The failure was invisible in this repository: every feature that gates a hook
defaults to `true`, so retort's own output was always internally consistent.
Only adopters who disabled a feature received broken output, which is why the
defect survived undetected.

## Root Cause Analysis

Two halves of the same decision were made in two places that could not see each
other:

- `syncClaudeHooks()` **skips** any hook whose owning feature is disabled. The
  hook→feature mapping is derived at sync time from `features.yaml`
  `affectsTemplates` via `buildHookFeatureMap()`.
- `.claude/settings.json` was rendered from a **static** template
  (`templates/claude/settings.json`) that wired six hook scripts
  unconditionally. `syncClaudeSettings()` overrode `permissions` and copied
  `hooks` through verbatim.

Nothing reconciled the two, so disabling a feature removed the script but left
the reference. Three gating features each produce dangling references:

| Feature disabled            | Claims                 | Hooks left dangling                                                                    |
| --------------------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| `quality-gates`             | `stop-build-check.sh`  | `stop-build-check`                                                                     |
| `sensitive-file-protection` | `protect-sensitive.sh` | `protect-sensitive`                                                                    |
| `permission-guards`         | `claude/hooks/` (dir)  | `session-start`, `protect-templates`, `guard-destructive-commands`, `warn-uncommitted` |

`permission-guards` is the widest: it claims the hooks directory, so it gates
every hook no more specifically claimed — four of the six wired scripts.

A second, independent instance of the same assumption lived in `validate.mjs`,
which hardcoded a six-hook required list. That list failed repos where a hook
was _legitimately_ absent, reporting a missing file the adopter was never meant
to receive — the inverse error, from the same missing link.

## Solution Implemented

A single shared gate now decides hook emission, and both the file writer and the
settings writer consult it, so the two cannot drift.

### Code Changes

- **`.agentkit/engines/node/src/platform-syncer.mjs`**: Added three exported
  helpers — `extractHookStems()` (parses hook script names out of a command
  string), `isHookEmitted()` (the shared feature gate), and
  `filterHooksToEmitted()` (drops hook entries whose scripts will not be
  emitted, then prunes matcher groups and events left empty). `syncClaudeHooks()`
  was rewritten to call `isHookEmitted()` rather than re-implement the gate
  inline, and `syncClaudeSettings()` gained an optional `hookFeatureMap`
  parameter and filters `settings.hooks` through it.
- **`.agentkit/engines/node/src/synchronize.mjs`**: Passes the existing
  `hookFeatureMap` into `syncClaudeSettings()`.
- **`.agentkit/engines/node/src/validate.mjs`**: Phase 5 no longer hardcodes a
  required-hook list. It derives the required set from the scripts actually
  wired in `.claude/settings.json` and fails only when a wired script is missing
  from disk — the real invariant, which self-adjusts to any feature
  configuration.

Two deliberate choices are worth recording:

- An entry is kept only when **every** script it names is emitted. A
  partially-resolvable command is still a broken command.
- Omitting `hookFeatureMap` leaves hook wiring untouched, so callers predating
  the change keep their existing behaviour.

### Testing

- **Unit Tests**: `.agentkit/engines/node/src/__tests__/claude-hook-wiring.test.mjs`
  — 37 tests across the three new helpers and the rewritten validator phase,
  including malformed-input cases (null matchers, non-array hook lists) that
  must be skipped rather than abort the phase.
- **Integration Tests**: The validator tests scaffold a real project tree under
  `.test-tmp/` and run `runValidate()` end-to-end against it.
- **Manual Testing**: `pnpm -C .agentkit retort:validate` against this
  repository reports `Checked 7 hook script(s) wired in settings.json` and
  passes with zero errors. (Seven, not six: `session-start` is wired for both
  `.ps1` and `.sh`.)

## Verification

The gating scenarios in the test suite are derived from the live `features.yaml`
rather than hardcoded, so re-homing a hook under a different feature fails the
suite instead of silently shipping a dangling reference. One test iterates every
feature that owns a hook, disables it, and asserts that no surviving reference
points at a skipped script.

### Before/After Comparison

| Scenario                        | Before (wired → emitted) | After                                       |
| ------------------------------- | ------------------------ | ------------------------------------------- |
| All features on                 | 6 → 6, consistent        | unchanged — 6 → 6                           |
| `quality-gates` off             | 6 → 5, **1 dangling**    | 5 → 5; `Stop` event dropped entirely        |
| `sensitive-file-protection` off | 6 → 5, **1 dangling**    | 5 → 5; sibling `protect-templates` retained |
| `permission-guards` off         | 6 → 2, **4 dangling**    | 2 → 2; only `PreToolUse` and `Stop` survive |

The default configuration is byte-identical, confirmed by running
`retort:sync` and observing no drift — so no adopter on defaults sees any change.

### Regression Testing

The suite was run against the unfixed code with the fix stashed: every test
fails. With the fix applied, all pass. The malformed-input cases were verified
the same way — reverting just the guards fails five of the six. The full suite
(excluding the known-flaky `sync-integration.test.mjs`) reports 2250 passing.

## Impact Assessment

Affects adopters who disabled `quality-gates`, `sensitive-file-protection`, or
`permission-guards`. Because all three default to enabled, repos on default
configuration were never affected — including retort itself, which is why no
existing test caught it.

## Prevention Measures

The duplicated gate is gone: `syncClaudeHooks()` and `syncClaudeSettings()` now
call the same `isHookEmitted()`, so a future change to gating semantics applies
to both automatically. `validate.mjs` enforces the same invariant from the
opposite end — every wired script must exist — catching any future divergence in
generated output rather than in an adopter's session.

## Lessons Learned

A defaults-clean configuration hides whole classes of defect. Every gating
feature here defaults to `true`, so the repository's own generated output was
permanently consistent and no amount of testing _the default_ would have found
this. The bug was only reachable through configurations the project never
exercises on itself — the same blind spot that let issue #247 survive three
months, and the reason the test scenarios here are synthetic rather than
observational.

Relatedly: when two code paths must agree, the durable fix is to give them one
shared decision to call, not two correct implementations to maintain.

## Follow-up Identified

`spec/settings.yaml` declares hook wiring as spec — including
`budget-guard-check` and `pre-push-validate` — but `syncClaudeSettings()` takes
`_settingsSpec` and ignores it, wiring from the static template instead. Those
two hooks are therefore emitted as files but never wired to any event. This is
the orphan counterpart to the dangling references fixed here and is deliberately
left out of scope: generating `settings.hooks` from the spec would change hook
behaviour for every adopter and warrants its own change.

---

**Fix Author**: Jurie Smit
**Reviewer**: Pending review on [#572](https://github.com/phoenixvc/retort/pull/572)
**Status**: Resolved
