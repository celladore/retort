# Sync File Modes — Which Files Are Scaffold-Once vs Managed

This document clarifies which files `retort:sync` overwrites on every run, which
it merges carefully, and which it writes only once and then leaves alone. Use it
to understand what is safe to hand-edit and what will be overwritten.

See also [`13_template_system.md`](./13_template_system.md) for a detailed
description of the rendering pipeline and three-way merge algorithm.

---

## Quick Reference

| Mode      | On first sync | On later syncs           | Safe to hand-edit? |
| --------- | ------------- | ------------------------ | ------------------ |
| `always`  | Write         | **Overwrite**            | No — edits lost    |
| `managed` | Write         | Hash-check + 3-way merge | Yes — edits kept   |
| `once`    | Write         | **Skip**                 | Yes — never reset  |

---

## `always` — Overwritten on Every Sync

These files are regenerated from spec on **every** `retort:sync` run. Hand-edits
are lost the next time sync runs. Do not edit them directly; change the spec and
re-sync instead.

| Output path                                 | Template source                                       |
| ------------------------------------------- | ----------------------------------------------------- |
| `AGENTS.md`                                 | `.agentkit/templates/claude/AGENTS.md`                |
| `COMMAND_GUIDE.md`                          | `.agentkit/templates/docs/COMMAND_GUIDE.md`           |
| `GEMINI.md`                                 | `.agentkit/templates/gemini/GEMINI.md`                |
| `WARP.md`                                   | `.agentkit/templates/warp/WARP.md`                    |
| `.claude/commands/**`                       | `.agentkit/templates/claude/commands/`                |
| `.claude/agents/**`                         | `.agentkit/templates/claude/agents/`                  |
| `.claude/rules/languages/**`                | `.agentkit/templates/language-instructions/`          |
| `.cursor/rules/**`                          | `.agentkit/templates/cursor/rules/`                   |
| `.clinerules/**`                            | `.agentkit/templates/cline/`                          |
| `.roo/**`                                   | `.agentkit/templates/roo/`                            |
| `.windsurf/rules/**`                        | `.agentkit/templates/windsurf/`                       |
| `.github/instructions/**`                   | `.agentkit/templates/copilot/instructions/`           |
| `.github/agents/**`                         | `.agentkit/templates/github/agents/`                  |
| `.github/chatmodes/**`                      | `.agentkit/templates/github/chatmodes/`               |
| `.github/prompts/**`                        | `.agentkit/templates/github/prompts/`                 |
| `.github/copilot-instructions.md`           | `.agentkit/templates/copilot/copilot-instructions.md` |
| `.github/PULL_REQUEST_TEMPLATE.md`          | `.agentkit/templates/github/PULL_REQUEST_TEMPLATE.md` |
| `.github/workflows/branch-protection.yml`   | `.agentkit/templates/github/workflows/`               |
| `.github/workflows/drift-check.yml`         | `.agentkit/templates/github/workflows/`               |
| `.github/workflows/template-protection.yml` | `.agentkit/templates/github/workflows/`               |
| `.vscode/settings.json` (theme section)     | `.agentkit/templates/vscode/settings.json`            |
| `.gitattributes` (generated section)        | `.agentkit/templates/root/gitattributes`              |
| `UNIFIED_AGENT_TEAMS.md`                    | `.agentkit/templates/docs/UNIFIED_AGENT_TEAMS.md`     |
| `AGENT_TEAMS.md`                            | `.agentkit/templates/docs/AGENT_TEAMS.md`             |
| `QUALITY_GATES.md`                          | `.agentkit/templates/docs/QUALITY_GATES.md`           |
| `CLAUDE.md`                                 | `.agentkit/templates/claude/CLAUDE.md`                |

> **Note on `.gitattributes`**: The section between the
> `>>> Retort merge drivers` / `<<< Retort merge drivers` markers is generated.
> Content outside those markers is user-owned.

---

## `managed` — Hash-checked, Three-Way Merged

These files are written on first sync and then **merged carefully** on subsequent
syncs. Retort computes a SHA-256 hash of the on-disk file and compares it to the
hash stored in `.agentkit/.manifest.json`.

- If the hash **matches** (file is pristine) → safe to overwrite with new template output.
- If the hash **differs** (user has edited) → three-way merge using `git merge-file`:
  - _Ours_ = current disk file (your edits)
  - _Base_ = scaffold cache (`.agentkit/.scaffold-cache/`)
  - _Theirs_ = new template output
  - Clean merge → applied silently. Conflict → written with `<<<<<<< YOUR_EDITS` markers.

| Output path                         | Notes                 |
| ----------------------------------- | --------------------- |
| `docs/*/README.md`                  | Category README files |
| `.claude/rules/*.md` (non-language) | Top-level rule files  |

---

## `once` — Written Once, Never Overwritten

These files are written on the **first** sync only. Once they exist on disk, sync
skips them entirely — even if the template changes. They are fully user-owned.

| Output path                              | Notes                               |
| ---------------------------------------- | ----------------------------------- |
| `docs/**` (most files)                   | Project documentation, ADRs, guides |
| `AGENT_BACKLOG.md`                       | Tactical backlog                    |
| `CHANGELOG.md`                           | Keep-a-Changelog log                |
| `CONTRIBUTING.md`                        | Contribution guide                  |
| `.github/ISSUE_TEMPLATE/**`              | Issue templates                     |
| `.vscode/settings.json` (non-theme keys) | User VS Code settings               |
| `scripts/` (most)                        | Project scripts                     |

---

## Overriding Defaults via `project.yaml`

You can force a different mode for specific files using
`automation.languageProfile.scaffoldOverrides` in `.agentkit/spec/project.yaml`:

```yaml
automation:
  languageProfile:
    scaffoldOverrides:
      alwaysRegenerate:
        - docs/api/README.md # Force always mode for this file
      scaffoldOnce:
        - scripts/deploy.sh # Force once mode — never regenerate
```

---

## Known Churn Issues and Workarounds

### #417 — `last_updated` date churn

Every `retort:sync` run stamps `last_updated: YYYY-MM-DD` (via `{{syncDate}}`)
into generated file headers, producing a diff even when nothing changed.

**Status**: Fixed. The engine honours `syncDateMode` (three modes: `run | version | none`).
Set `syncDateMode: none` in your repo overlay to eliminate date churn entirely.

**How to fix for your repo** — add to `.agentkit/overlays/<repoName>/settings.yaml`:

```yaml
syncDateMode: none
```

Then re-run `pnpm --dir .agentkit retort:sync`. Generated file headers will no longer
contain a date stamp, so repeated syncs produce no diff when inputs are unchanged.

**Mode reference:**

| Mode            | `{{syncDate}}` value          | Stable?                               |
| --------------- | ----------------------------- | ------------------------------------- |
| `run` (default) | Today's ISO date (YYYY-MM-DD) | No — changes every day                |
| `version`       | Spec VERSION string           | Yes — stable until spec version bumps |
| `none`          | Empty string                  | Yes — date field removed entirely     |

**Temporary workaround** (if you cannot update the overlay yet) — reset files where
only the date line changed:

```bash
git diff --name-only | xargs -I{} sh -c \
  'git diff "$1" | grep -v "^[-+]last_updated:" | grep -q "^[+-]" || git checkout -- "$1"' -- {}
```

### #418 — Unresolved placeholder warnings lack file context

When sync prints `Warning: unresolved placeholders: {{someKey}}`, it does not
report which output file the placeholder came from.

**Status**: Engine fix pending (issue #418). A `sync.placeholderWarnings: with-path`
setting has been proposed in `.agentkit/spec/settings.yaml`.

**Current workaround**: Run sync with verbose output and pipe through grep to
correlate warnings with the file being written:

```bash
pnpm --dir .agentkit retort:sync 2>&1 | grep -E "Warning:|Writing|Rendering"
```

---

## Manifest File

The `.agentkit/.manifest.json` file records every file written by sync along with
its SHA-256 hash. Inspecting it shows the current scaffold mode recorded for each
output:

```json
{
  "files": {
    ".claude/commands/orchestrate.md": {
      "hash": "abc123...",
      "mode": "always"
    },
    "docs/engineering/README.md": {
      "hash": "def456...",
      "mode": "managed"
    }
  }
}
```

If a file is missing from the manifest, sync treats it as untracked and uses the
template's declared mode (or path-based default).
