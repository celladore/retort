# SessionStart hook schema and duplicate Python detection Resolution - Historical Summary

**Completed**: 2026-08-06
**Bug ID**: #192, #247 (sub-issues of epic #304)
**PR**: [#PR-Number]
**Severity**: High

## Problem Description

Two defects in the generated Claude Code `SessionStart` hook, both affecting adopter
repositories rather than retort itself.

**#192 — schema-invalid hook output.** Every session start in an onboarded repo produced
`JSON validation failed: Hook JSON output validation failed: Invalid input`. The hook's
environment summary (toolchain versions, git state, conventions reminder) was therefore
discarded, so agents began sessions without the context the hook exists to supply.

**#247 — duplicate Python entries.** On any host with both `python3` and `python` on
PATH — the norm on Linux and common on Windows — the toolchain block listed `Python`
twice. Cosmetic, but it appeared in the same payload as #192 and made the hook output
look broken.

## Root Cause Analysis

**#192.** Claude Code requires `hookSpecificOutput.hookEventName` to be present and to
match the firing event. Both `session-start` templates emitted only `additionalContext`:

```json
{ "hookSpecificOutput": { "additionalContext": "..." } }
```

This was an isolated omission, not a misunderstanding of the schema — every other hook
template in `.agentkit/templates/claude/hooks/` already set the field
(`guard-destructive-commands`, `protect-sensitive`, `protect-templates` all emit
`hookEventName: "PreToolUse"`). `session-start` was the only template missing it, in
both the shell and PowerShell variants.

**#247.** The templates called the detection helper twice, unconditionally:

```bash
detect_tool "Python"   "python3"
detect_tool "Python"   "python"   # fallback if python3 is absent
```

The comment described behaviour that did not exist. `detect_tool` appends an entry
whenever the command resolves and reports a version — it has no awareness of prior
entries — so both calls appended when both interpreters were installed. The PowerShell
template had the same two unconditional `Test-Tool` calls with no comment.

## Solution Implemented

**#192.** Added `hookEventName: "SessionStart"` to all three emit paths. The shell
template has two, which is easy to miss: the primary `jq -n` branch and a hand-rolled
`printf` fallback used when `jq` is unavailable.

**#247.** Made the fallback real, using a **count probe** rather than the more obvious
`command -v python3` guard:

```bash
python_probe_count=${#tools_found[@]}
detect_tool "Python"   "python3"
if [[ ${#tools_found[@]} -eq $python_probe_count ]]; then
    detect_tool "Python"   "python"
fi
```

A `command -v` guard would have introduced a Windows regression. On Windows, `python3`
frequently resolves to a Microsoft Store alias stub: the command exists, so the guard
takes the `python3` branch, but the stub emits no usable version string and
`detect_tool` appends nothing — reporting **no Python at all** on a machine where
`python` works. Probing the count instead keys the fallback on "did we actually record
an entry", which is the condition we care about.

### Code Changes

- **`.agentkit/templates/claude/hooks/session-start.sh`**: `hookEventName` added to the
  `jq -n` payload and to the `printf` fallback; Python detection replaced with the
  count-probe fallback.
- **`.agentkit/templates/claude/hooks/session-start.ps1`**: `hookEventName` added to the
  hashtable passed to `ConvertTo-Json`; Python detection mirrors the shell logic using
  `$toolsFound.Count`.
- **`.claude/hooks/session-start.sh`**, **`.claude/hooks/session-start.ps1`**: regenerated
  via `pnpm -C .agentkit retort:sync`.

### Testing

- **Unit Tests**: `claude-hook-output-schema.test.mjs` — 170 assertions covering all 14
  hook templates. Authored via `/team-testing` per `.claude/rules/agent-delegation.md`.
  Each template is rendered with every conditional on and again with every conditional
  off, and each `hookSpecificOutput` payload is checked for the `hookEventName`
  discriminator, a known event name, agreement with the event the hook is wired to in
  `settings.json`, per-event required fields, and the absence of top-level-only fields.
  **The fixture immediately found a third instance of the same defect class — see
  "Third defect found by the fixture" below.**
- **Integration Tests**: not applicable; the hook contract is enforced by the Claude Code
  runtime, not by an in-repo integration suite.
- **Manual Testing**: see Verification.

## Verification

Ran `pnpm -C .agentkit retort:sync` (correctly resolving the `retort` overlay), then
against the regenerated `.claude/hooks/session-start.sh`:

```bash
bash -n .claude/hooks/session-start.sh
echo '{}' | bash .claude/hooks/session-start.sh \
  | jq -e '.hookSpecificOutput | has("hookEventName") and has("additionalContext")'
echo '{}' | bash .claude/hooks/session-start.sh | jq -r '.hookSpecificOutput.hookEventName'
```

Result: parses clean, assertion passes, emits `SessionStart`.

The Python fallback could not be exercised through retort's own generated output —
retort declares javascript/yaml/markdown, so `hasLanguagePythonEffective` is false and
the block does not render. The logic was therefore extracted and tested against a
stubbed `PATH`.

### Before/After Comparison

| Scenario                                     | Before                     | After                       |
| -------------------------------------------- | -------------------------- | --------------------------- |
| Hook output schema                           | rejected — `Invalid input` | accepted, context delivered |
| `python3` + `python` both present            | 2 `Python` entries         | 1                           |
| `python3` only                               | 1                          | 1                           |
| `python` only                                | 1                          | 1                           |
| Neither present                              | 0                          | 0                           |
| Windows `python3` Store stub + real `python` | 1 (both probed)            | 1 (falls through correctly) |

### Regression Testing

Verified that the four regenerated/edited files are the only content changes in the tree
(`git diff --stat` → 4 files, +18/−4). The other 19 files touched by sync were confirmed
byte-identical to `HEAD` via `md5sum` — sync rewrote identical content and only changed
mtimes.

## Third defect found by the fixture

The schema fixture failed on first run — 162 passing, 8 failing, every failure in
`warn-uncommitted`. Both variants emitted:

```json
{ "hookSpecificOutput": { "systemMessage": "WARNING: There are N uncommitted changes…" } }
```

Two problems in one payload. It omitted `hookEventName` (the #192 defect, in a second
hook nobody had looked at), and `systemMessage` is a **top-level** field — nested inside
`hookSpecificOutput` it parses as valid JSON and is then silently ignored, so the
uncommitted-changes warning never reached the user. `settings.json` wires this hook to
`PostToolUse`, whose `hookSpecificOutput` only carries `additionalContext`; a
user-facing warning belongs at the top level. Fixed by unnesting it in both templates.

This is the case for schema fixtures over targeted regression tests: a test written only
for #192 would have passed here.

## Impact Assessment

Every repository onboarded to Retort that runs Claude Code. The hook fires on every
session start, so the schema failure was continuous rather than intermittent, and silent
in the sense that the session proceeded — just without the environment context. Retort
itself was affected by #192 but not #247.

## Prevention Measures

1. **Schema fixture for hook output.** ✅ Landed in this change —
   `.agentkit/engines/node/src/__tests__/claude-hook-output-schema.test.mjs`. It found a
   third live defect on its first run. Runs in ~1.3s with no external binaries, so it is
   cheap to keep.
2. **Cross-template consistency check.** #192 was detectable by inspection — one template
   out of seven omitted a field all its siblings had. A lint asserting every hook template
   emits `hookEventName` is cheap.
3. **Coverage blind spot for unrendered blocks.** Conditional template blocks that do not
   render for retort's own stack (`hasLanguagePythonEffective`, `hasLanguageDotnetEffective`,
   `hasLanguageRustEffective`, `hasAnyInfraConfig`) are never exercised by dogfooding.
   Rendering templates under a matrix of synthetic language profiles would close this.

## Lessons Learned

- **A comment describing behaviour is not the behaviour.** The `# fallback if python3 is
absent` comment made the bug read as already-fixed on casual inspection, and likely
  contributed to it sitting open for three months.
- **Dogfooding has structural blind spots.** Retort generates config for stacks it is not
  itself written in. Any conditional block gated on a language retort does not declare is
  shipped untested by definition.
- **Verify staleness before scheduling work.** Three of the seven tickets triaged in this
  session (#246, #183, #184) had already been fixed by PR #480 and were still open. Half
  the nominal release-blocker list was not work at all.
- **The obvious guard is not always the correct one.** `command -v python3` reads as the
  natural fix and would have introduced a Windows regression on the exact platform this
  repo is primarily developed on.

---

**Fix Author**: Claude Code (Opus 5), session 1d467bc5
**Reviewer**: [Reviewer]
**Status**: Resolved
