# Overlay Settings Schema Validation Implementation - Historical Summary

**Completed**: 2026-08-20
**Duration**: Single session
**Status**: ✅ **SUCCESSFULLY COMPLETED**
**PR**: TBD

## Overview

`.agentkit/overlays/*/settings.yaml` previously had zero schema validation.
Unknown or typo'd keys (e.g. `windowsFrist`) and dead keys left over from
earlier engine versions could sit silently unvalidated — nothing read them,
and nothing warned that nothing read them. This work adds an explicit schema
and a `validateOverlaySettings()` check to the spec validator, and uses the
new coverage to introduce two overlay knobs that were previously hardcoded:
`agentBranchPrefix` and `worktreeIsolation`. It also fixes a Prettier bug
that had already shipped a broken template placeholder to every repo
consuming Retort.

## Implementation Summary

### Projects/Components Affected

- ✅ **`.agentkit/engines/node/src/spec-validator.mjs`** — new
  `validateOverlaySettings()` function and schema, wired into
  `validateSpec()`.
- ✅ **`.agentkit/engines/node/src/synchronize.mjs`** — new sync-context
  fields (`agentBranchPrefix`, `worktreeIsolation`,
  `worktreeIsolationEnforced`) derived from overlay settings.
- ✅ **`.agentkit/overlays/retort/settings.yaml`** and
  **`.agentkit/overlays/__TEMPLATE__/settings.yaml`** — declare the two new
  settings so both the live repo and future onboarded repos pick them up.
- ✅ **`.agentkit/templates/claude/rules/pr-base-branch.md`** and
  **`worktree-isolation.md`** — templates fixed/parameterized; regenerated
  output committed for `.claude/rules/`.
- ✅ **`.agentkit/engines/node/src/__tests__/spec-validator.test.mjs`** — 10
  new tests for `validateOverlaySettings()`.
- ✅ **`.agentkit/engines/node/src/__tests__/template-integrity.test.mjs`**
  (new) — regression guard against the Prettier mangling bug recurring.

### Key Changes Made

1. **Overlay settings schema** — `validateOverlaySettings()` declares every
   known key (`repoName`, `defaultBranch`, `integrationBranch`,
   `primaryStack`, `agentBranchPrefix`, `worktreeIsolation`,
   `renderTargets`, etc.) with a type. Type violations are hard errors;
   unknown keys and unknown render targets are warnings, not errors —
   overlays are user-owned and must stay forward-compatible with engine
   versions newer than the overlay itself.
2. **`agentBranchPrefix` overlay setting** — the Conventional Commits type
   prefix used for agent worktree branches (e.g. `feat/agent-backend/...`).
   Constrained to `^[a-z]+$` so a stray `/` in the value can't double-nest
   generated branch paths.
3. **`worktreeIsolation` overlay setting** — `advisory` (default) or
   `enforced`. Feeds a boolean companion,
   `worktreeIsolationEnforced`, into the sync context because the string
   form is truthy either way inside a template `{{#if}}` — templates need
   the actual boolean to branch correctly.
4. **Prettier interpolation bug fix** — Prettier rewrites `{{var}}` sitting
   inside a fenced ` ```yaml ` block in Markdown as `{ { var } }` (parsed as
   nested flow mappings), which silently breaks interpolation. This had
   already shipped: `.claude/rules/pr-base-branch.md` rendered
   `defaultBranch: { { defaultBranch } }` instead of the real branch name in
   every consuming repo. Fixed the template and wrapped the fenced block
   with `<!-- prettier-ignore -->`.

### Issues Resolved

- **Silent overlay drift**: typo'd or dead overlay keys previously had no
  feedback loop. `validateOverlaySettings()` now surfaces them as warnings
  during `retort:validate`.
- **Broken PR-base-branch guidance**: the mangled placeholder meant the
  generated rule literally told agents to target branch
  `{ { defaultBranch } }`. Fixed at the template source so it can't
  regenerate broken.
- **Hardcoded agent branch prefix**: `worktree-isolation.md` previously
  hardcoded `feat/` in prose with no way to override per repo; it's now
  driven by the overlay setting and defaults to `feat` when unset.

## Implementation Approach

### Phase 1: Schema and validation

Added the `overlaySettingsSchema` object and `validateOverlaySettings()`
function, matching the style of the existing `settingsSchema`/`validate()`
pair already in `spec-validator.mjs`. Wired the new check into
`validateSpec()` alongside the existing validation passes.

### Phase 2: New settings + template wiring

Added `agentBranchPrefix` and `worktreeIsolation` to both overlay files,
threaded them through `synchronize.mjs`'s sync context, and updated
`worktree-isolation.md` to render the live values and branch its
enforcement language (`**must**` vs `**should**`) on
`worktreeIsolationEnforced`.

### Phase 3: Bug fix + regression guard

Found and fixed the pre-existing Prettier-mangled placeholder in
`pr-base-branch.md` while touching the same file for `defaultBranch`/
`integrationBranch` rendering. Added `template-integrity.test.mjs` to scan
the whole template corpus for the mangled pattern so a future
`prettier --write` can't reintroduce it silently.

### Phase 4: Verification

Ran the two new/changed test files directly (109/109 passing), re-ran
`pnpm -C .agentkit retort:sync` to confirm zero drift between the
uncommitted change set and what sync actually produces, ran the full
`.agentkit` vitest suite (2250/2256 passing — 5 pre-existing Windows
subprocess-timeout failures in unrelated files, none touching changed
code), ran `prettier --check` against every changed file, and ran
`retort:validate` (PASSED, 16 pre-existing warnings unrelated to this
change).

## Results

### Metrics

- **Build Status**: `retort:validate` PASSED.
- **Tests**: 109/109 new/targeted tests passing;
  2250/2256 full-suite tests passing (5 pre-existing, unrelated timeout
  failures under Windows subprocess load).
- **Drift**: zero — `retort:sync` output before and after this change set
  is byte-identical to the committed diff.
- **Formatting**: all changed files pass `prettier --check`.

### Impact

- Future overlay typos surface immediately as validator warnings instead of
  silently doing nothing.
- Agent worktree branch naming and worktree-isolation enforcement are now
  configurable per repo instead of hardcoded in the template.
- The shipped Prettier placeholder bug is fixed at the source and can't
  silently recur.

## Lessons Learned

### Technical Insights

- Prettier's Markdown formatter treats `{{var}}` inside fenced code blocks
  as nested flow-mapping YAML syntax and rewrites it to `{ { var } }`,
  which no longer matches any template interpolation pattern. Any Retort
  template with a fenced block containing `{{var}}` needs
  `<!-- prettier-ignore -->` immediately above it.
- Template `{{#if}}` conditionals need an explicit boolean sync-context
  field — a string setting like `worktreeIsolation: "advisory"` is truthy
  in a boolean context, so `{{#if worktreeIsolation}}` would render as
  "enforced" even when set to `"advisory"`.

### Process Improvements

- A schema-and-warn (not schema-and-block) approach fits overlay files
  specifically because they're user-owned and versioned independently from
  the engine — errors for type violations, warnings for unknown keys, never
  a hard failure on an unrecognized key.

### Best Practices Established

- New overlay settings should always update both `overlays/retort/` (the
  live repo) and `overlays/__TEMPLATE__/` (the onboarding scaffold) in the
  same change, so newly onboarded repos don't start missing the setting.

## Future Considerations

- Consider promoting `validateOverlaySettings()`'s unknown-key warnings to
  errors in a future major version once overlay authors have had time to
  clean up drift, if that's ever desired — no action needed now.
- `template-integrity.test.mjs` only guards the mangled-brace pattern found
  in this bug; broader template-rendering smoke tests (actually running
  sync against a fixture overlay and diffing output) remain a possible
  follow-up but were out of scope here.

## Related Documentation

- **`.claude/rules/worktree-isolation.md`** — generated output documenting
  the new `agentBranchPrefix`/`worktreeIsolation` settings for agents.
- **`.claude/rules/pr-base-branch.md`** — generated output with the fixed
  interpolation.

---

**Implementation Team**: Claude Code (reviewed and shipped from an existing
worktree's uncommitted implementation)
**Review Status**: Reviewed — code read in full, targeted and full test
suites run, drift-checked, prettier/validate gates green
**Next Steps**: Open PR against `dev`; note CODEOWNERS review requirement
since this touches `.agentkit/`
