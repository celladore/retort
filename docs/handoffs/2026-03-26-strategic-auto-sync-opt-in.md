# Handoff: Make Auto-Sync Opt-In (GH#410)

**Date:** 2026-03-26
**Issue:** [GH#410](https://github.com/phoenixvc/retort/issues/410)
**Prepared for:** Agent implementing the auto-sync opt-in feature
**Branch:** `feat/auto-sync-opt-in` from `dev`

---

## The Problem

Retort currently enforces sync as a hard gate in two places:

1. **`pre-push-validate` hook** — runs before every `git push` via Claude Code's `preToolUse` hook. Blocks the push if generated files are out of sync with the spec.
2. **CI drift check** — a GitHub Actions workflow that fails the build if spec and generated output have diverged.

This is appropriate for the retort repo itself (where drift is always a bug) but is too aggressive when imposed on **adopter repos**. Adopters may want to:

- Run sync manually rather than on every push
- Batch spec changes across a work session before syncing
- Disable sync enforcement entirely in early exploration phases
- Use a separate CI job for sync rather than a push gate

The mandatory model is also the root cause of friction reported in GH#421 (scaffold-once propagation) and GH#420 (Windows LF/CRLF churn) — if sync is forced on every push, any noise in sync output becomes a blocker.

---

## Current Auto-Sync Touch Points

**Hook (generated, enforced per-repo):**

- `.claude/hooks/pre-push-validate.sh` — blocks `git push` if drift detected
- Configured via `settings.yaml` → `hooks.preToolUse` matcher `Bash` → hook `pre-push-validate`

**CI (generated template):**

- `.github/workflows/` — drift check workflow (grep for `agentkit:sync --check` or equivalent in the templates)

**Settings spec:**

- `.agentkit/spec/settings.yaml` — `hooks.preToolUse` is where the pre-push hook is registered

---

## Proposed Design

### 1. New field in `settings.yaml`

```yaml
sync:
  auto-sync:
    pre-push: enforce # enforce | warn | off
    ci-drift-check: enforce # enforce | warn | off
    on-spec-change: prompt # prompt | auto | off  — future
```

- `enforce` — current behaviour (blocks push / fails CI)
- `warn` — runs the check, emits output, but does not block
- `off` — skips the check entirely

Default for new adopters via `agentkit init`: `pre-push: warn`, `ci-drift-check: enforce` (CI is safer than blocking local pushes).

### 2. Template changes

The `pre-push-validate.sh` template needs to read the `autoSync.prePush` setting and change its `decision` output accordingly:

- `enforce` → `{ "decision": "block", "reason": "..." }`
- `warn` → `{ "decision": "allow" }` + print warning to stderr
- `off` → exit 0 immediately

The CI drift check workflow template needs equivalent gating.

### 3. `agentkit init` wizard update

`init.mjs` should ask: _"Should sync be enforced on every push? (recommended: warn for new projects, enforce when stable)"_ and write the chosen value into `settings.yaml`.

---

## Files to Change

| File                                                         | Change                                       |
| ------------------------------------------------------------ | -------------------------------------------- |
| `.agentkit/spec/settings.yaml`                               | Add `sync.auto-sync` block with defaults     |
| `.agentkit/templates/claude/hooks/pre-push-validate.sh`      | Read setting, gate block vs warn vs skip     |
| `.agentkit/templates/github/workflows/` drift check template | Read setting, gate fail vs warn vs skip      |
| `.agentkit/engines/node/src/init.mjs`                        | Add prompt for auto-sync preference          |
| `.agentkit/engines/node/src/synchronize.mjs`                 | Pass `autoSync` vars into template rendering |

**Do not touch** `.claude/hooks/pre-push-validate.sh` directly — it is generated. Change only the template.

---

## Verification

```bash
# 1. Verify new settings.yaml field is accepted by spec validator
pnpm -C .agentkit retort:sync
pnpm -C .agentkit run validate

# 2. Verify pre-push hook respects the setting
# Set pre-push: warn, make a spec change without syncing, attempt push — should warn not block
# Set pre-push: off — push should proceed without any sync check

# 3. Run test suite
pnpm -C .agentkit test
```

---

## Constraints

- Default for **retort itself** must remain `enforce` — set this in `.agentkit/overlays/retort/settings.yaml`
- Default for **adopter repos** via `agentkit init` should be `warn` to reduce friction
- Backward compatible — existing `settings.yaml` files without the new field must behave as `enforce` (current behaviour unchanged)
- PR target: `dev` · Commit: `feat(sync): make pre-push sync check opt-in via settings.yaml`
