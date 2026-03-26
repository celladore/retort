# Sync Safety Guide

> **Related issue:** [#397 — prevent file loss during sync](https://github.com/phoenixvc/retort/issues/397)

This guide explains how to safely run `retort sync`, especially for first-time adoption and when you have hand-edited files in your repo.

---

## TL;DR

```bash
# Always preview before applying
./scripts/retort-sync.sh

# Or preview-only (never writes)
./scripts/retort-sync.sh --dry-run

# Apply directly (CI / trusted automation)
./scripts/retort-sync.sh --apply

# Apply with a backup of overwritten files
./scripts/retort-sync.sh --apply --backup
```

---

## Why Sync Can Lose Files

`retort sync` generates AI tool configurations from `.agentkit/spec/` YAML files. It writes output into directories like `.claude/`, `.cursor/`, `.github/instructions/`, etc.

Three risk scenarios:

| Scenario | Risk |
|----------|------|
| Re-syncing after hand-editing a managed file | Your edits are overwritten by the regenerated content |
| First-time adoption on an existing repo | Existing files (e.g. a custom `.claude/agents/` file) may be replaced |
| Sync triggered by a hook on git push | Working tree is modified unexpectedly mid-session |

---

## Safe Adoption Workflow (First Time)

1. **Preview what sync will generate:**
   ```bash
   ./scripts/retort-sync.sh --dry-run
   ```

2. **Back up your existing AI tool configs:**
   ```bash
   ./scripts/retort-sync.sh --backup --apply
   ```
   Backup is written to `.sync-backup/<timestamp>/`.

3. **Review the diff:**
   ```bash
   git diff --stat
   git diff
   ```

4. **Recover any hand-edited content** from the backup if needed.

5. **Commit the sync output:**
   ```bash
   git add .
   git commit -m "chore(sync): apply initial retort sync output"
   ```

---

## File Modes: What Gets Overwritten vs Preserved

Retort uses three file modes. Check `.agentkit/sync-manifest.json` for the mode of each file.

| Mode | Behaviour | Examples |
|------|-----------|---------|
| `managed` | Regenerated on every sync. User edits are preserved via three-way merge. | `.claude/rules/*.md`, `.cursor/rules/*.mdc` |
| `scaffold-once` | Written only when the file does not exist. Never overwritten. | `docs/`, `AGENT_BACKLOG.md`, `CONTRIBUTING.md` |
| `always` | Always overwritten, no merge. | `.claude/hooks/*.sh`, `.claude/commands/*.md` |

> **Tip:** If you need to customise an `always`-mode file, use an overlay in `.agentkit/overlays/<repo-name>/` instead of hand-editing the output. See the overlays guide.

---

## Hooks That Trigger Sync

The `pre-push-validate.sh` hook runs sync before every `git push` to check for generated-file drift. This is the most common source of unexpected working-tree modifications.

**Known issue:** The hook runs sync in write mode rather than using `--dry-run`. A fix to the hook template is tracked in [#397](https://github.com/phoenixvc/retort/issues/397) and requires a change to the upstream agentkit-forge template.

**Workaround:** Run `./scripts/retort-sync.sh --apply` before pushing to ensure the working tree is clean before the hook fires.

---

## Render Target Verification

Before writing output, `./scripts/retort-sync.sh` checks whether the render target directories exist. If a target directory is missing (e.g. `.windsurf/` when Windsurf is not installed), it warns but does not block — sync will create the directory.

To suppress output for tools you don't use, remove them from your targets in `.agentkit/spec/settings.yaml`:

```yaml
# .agentkit/spec/settings.yaml
sync:
  targets:
    - claude      # keep
    - cursor      # keep
    # - windsurf  # remove if not used
    # - copilot   # remove if not used
```

Then re-sync:
```bash
./scripts/retort-sync.sh --apply
```

---

## Using `--dry-run` Directly

The underlying engine supports `--dry-run` natively:

```bash
# Via pnpm
pnpm --dir .agentkit retort:sync -- --dry-run

# Via node directly
node .agentkit/engines/node/src/cli.mjs sync --dry-run
```

The `scripts/retort-sync.sh` wrapper always runs `--dry-run` first and then prompts before applying.
