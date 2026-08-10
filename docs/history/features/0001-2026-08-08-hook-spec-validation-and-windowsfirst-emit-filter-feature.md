# Hook spec validation and windowsFirst emit filter - Historical Summary

**Launched**: 2026-08-08
**PR**: [#582](https://github.com/phoenixvc/retort/pull/582)
**Feature Type**: Enhancement (validation hardening + one new setting)

## Feature Overview

Closes the two follow-ups recorded at the end of #577.

1. The `hooks:` block in `.agentkit/spec/settings.yaml` is now schema-validated
   for shape. It was previously declared `{ type: 'object', required: true }` —
   "is an object" and nothing more.
2. `windowsFirst` — present in three overlays and documented for adopters, but
   read by no code or template — now controls whether the PowerShell variant of
   each hook is emitted and wired.

## User Problem Solved

**Unvalidated hook spec.** `buildHooksFromSpec()` skips malformed entries rather
than throwing, which is correct for robustness but means a spec mistake produces
a `settings.json` with the affected guard silently absent. Nothing failed; the
hook simply never ran. This is the same class of defect as the five orphaned
`.ps1` hooks in #577, and the missing schema is why it went unnoticed.

Verified against the old schema before changing it — this block produced **zero**
errors:

```yaml
hooks:
  preToolUsage: # mis-keyed event: dropped in silence
    - hoook: budget-guard-check # misspelled key: entry skipped
  sessionStart: 42 # not a string: hook unnamed, skipped
  preToolUse:
    - hook: 'guard;whoami' # unsafe stem: dropped by the syncer's own filter
```

**Dead config.** `windowsFirst` was inert. QUICK_START and ONBOARDING presented
it to adopters as a real knob, so setting it did nothing and the docs misled.

## Implementation Details

### Architecture

Both changes serve one principle: a mismatch between the spec and what ships
should fail loudly at sync time rather than degrade silently at runtime.

The `windowsFirst` filter is applied at two points that must agree — what sync
writes to disk, and what `settings.json` invokes. Both read the same `vars`, and
the bidirectional invariant test from #577 is asserted under both settings, so
they cannot drift apart the way the original defect did.

### Components

- **`spec-validator.mjs`**: `settingsSchema.hooks` now declares each lifecycle
  event. `hookEntrySchema` validates `{ matcher?, hook }`. Two primitives added
  to `validate()`: `pattern` (regex on strings) and `additionalProperties`
  (reject undeclared keys). Both are opt-in — every existing schema keeps
  accepting keys it does not declare, so nothing else changes behaviour.
- **`fs-utils.mjs`**: `SAFE_HOOK_STEM` moved here from `platform-syncer.mjs` so
  the validator and the syncer test the same regex. Duplicating it would have
  recreated the exact drift being closed. `fs-utils` already exists for this
  purpose — see the note on `isUnsafePathSegment`.
- **`platform-syncer.mjs`**: new `isWindowsFirst(vars)`. `collectHookExtensions()`
  takes optional `vars` and omits `.ps1` when the flag is false;
  `syncClaudeHooks()` skips writing `.ps1` under the same condition.
- **`synchronize.mjs`**: `windowsFirst` resolved into `vars` from the overlay,
  defaulting to `true`.

### The filter is one-directional — deliberately

`windowsFirst: false` drops `.ps1`. **Nothing drops `.sh`.** A symmetric filter
was considered and rejected: under `windowsFirst: true` it would have made
`session-start` pwsh-only, breaking this repo's own Linux CI, and would have
deleted `budget-guard-check` and `pre-push-validate` outright — they ship no
`.ps1` at all — removing a budget guard and a pre-push check in silence.

`.sh` is the universal baseline; `.ps1` is additive. Every `.ps1` template that
ships has a `.sh` sibling, so dropping the variant never removes a hook.

### API Changes

- `collectHookExtensions(hooksDir)` → `collectHookExtensions(hooksDir, vars?)`.
  Second argument optional; omitting it indexes both variants, so existing
  callers are unaffected.
- New export: `isWindowsFirst(vars)`.
- New overlay setting: `windowsFirst` (boolean, defaults `true`).

### Database Changes

None — this repository has no database.

## User Experience

A repo that never runs hooks on Windows sets `windowsFirst: false` in its overlay
and stops receiving `.ps1` files it would never execute. Wiring follows
automatically. Everyone else is unaffected: `true` is byte-for-byte the previous
behaviour, confirmed by a zero-drift sync.

A malformed `hooks:` block now fails `spec-validate` with a message naming the
offending key, instead of producing a `settings.json` missing that hook.

### UI Changes

None — no user interface in this project.

### Documentation

- `.agentkit/docs/getting-started/ONBOARDING.md` — describes what the setting
  does, the default, and that it never removes a hook (only a variant).
- `.agentkit/docs/getting-started/QUICK_START.md` — sample corrected to `true`
  (the default) with an inline note; it previously showed `false`, which would
  now silently opt a new adopter out of PowerShell hooks.
- Inline comments in `overlays/__TEMPLATE__/settings.yaml` and
  `overlays/retort/settings.yaml`.

## Rollout Plan

Single change, no phasing. `windowsFirst` defaults to `true`, so the feature is
inert until a repo opts in — there is no migration step for existing adopters.

### Monitoring

No runtime telemetry. The guarantees are enforced at build time by the
bidirectional wiring invariant and the CI drift check.

## Results

Not applicable in the product sense — this is framework-internal. Verification:

| Check                         | Result                            |
| ----------------------------- | --------------------------------- |
| `spec-validate`               | PASSED                            |
| `validate`                    | PASSED (16 pre-existing warnings) |
| Sync drift                    | Zero — generated output unchanged |
| `spec-validator.test.mjs`     | 96 passed (+16 new)               |
| `claude-hook-wiring.test.mjs` | 69 passed (+9 new)                |
| Prettier                      | Clean on all changed files        |

Local full-suite runs on this Windows machine remain untrustworthy: three tests
fail on 15s/30s/90s timeouts (`discover`, `sync-integration`, `prettier`) under
disk contention, and the failing set differs between runs. None report an
assertion failure. The Linux CI Test job is the real verification.

### Usage Statistics

Not tracked.

### User Feedback

None yet.

## Future Enhancements

- The `sync:` block in `spec/settings.yaml` is still unvalidated; only `hooks:`
  and `permissions:` have schemas. `additionalProperties` is now available if
  that is worth tightening.
- `.agentkit/.manifest.json` is gitignored, so a fresh clone has no prior
  manifest and orphan-pruning never fires. Unrelated to this change, but it is
  why stale generated output survives across clones.

## Related Work

- #577 — wired every shipped hook variant, pruned stale output; recorded both
  follow-ups closed here.
- #575 — introduced `buildHooksFromSpec()` and made the spec the single source
  of hook wiring.
- #185 — the original dangling-hook-reference defect.

---

**Product Manager**: n/a (framework-internal)
**Tech Lead**: Jurie Smit
**Status**: Live
