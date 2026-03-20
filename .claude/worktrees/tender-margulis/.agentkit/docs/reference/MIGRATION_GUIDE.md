# Migration Guide

How to upgrade AgentKit Forge when a new version introduces breaking or notable
changes.

---

## Upgrade Process

AgentKit Forge uses a git-merge upgrade model. Your repo's `.agentkit/`
directory tracks an upstream template, and you pull in updates via merge.

### 1. Fetch and Merge

```bash
git fetch agentkit-forge
git merge agentkit-forge/main --allow-unrelated-histories
```

If you haven't added the remote yet:

```bash
git remote add agentkit-forge https://github.com/<org>/agentkit-forge.git
```

### 2. Install Dependencies

```bash
pnpm -C .agentkit install
```

### 3. Re-sync

```bash
pnpm -C .agentkit agentkit:sync
```

### 4. Validate

```bash
pnpm -C .agentkit agentkit:validate
```

### 5. Commit

```bash
git add .agentkit/ .gitignore .gitattributes
git commit -m "chore: upgrade agentkit-forge to latest"
```

---

## What Merges Cleanly

- **`.agentkit/engines/`** — Auto-merges unless you modified engine source.
- **`.agentkit/spec/`** — Auto-merges; new teams/commands appear automatically.
- **`.agentkit/templates/`** — Auto-merges; new template files appear, existing ones update.
- **`.agentkit/overlays/__TEMPLATE__/`** — Auto-merges; your repo-specific overlay is untouched.
- **`.agentkit/overlays/<your-repo>/`** — Never touched by upstream.

## What May Need Manual Resolution

- **`.agentkit/package.json`** — May conflict if both sides changed dependency versions.
- **`.agentkit/spec/*.yaml`** — May conflict if you modified the canonical spec files directly (prefer putting customizations in your overlay instead).

---

## Migration: Pre-renderTargets → renderTargets

If you adopted AgentKit Forge before the `renderTargets` feature was added, sync
previously generated all 11 tool outputs unconditionally. After upgrading:

1. Run `agentkit init --non-interactive` (or `--preset team`) to create a proper
   overlay with `renderTargets`.
2. Or manually add `renderTargets` to your existing overlay's `settings.yaml`:

```yaml
# .agentkit/overlays/<your-repo>/settings.yaml
renderTargets:
  - claude
  - cursor
```

If `renderTargets` is missing or empty, sync falls back to generating all
targets (backward compatibility). No output changes until you explicitly set the
field.

---

## Migration: Pre-project.yaml → project.yaml

If you adopted AgentKit Forge before `project.yaml` was introduced:

1. Run `agentkit init --non-interactive` to auto-generate `project.yaml` from
   discovery. This fills in tech stacks, frameworks, testing tools, and
   cross-cutting concerns.
2. Review `.agentkit/spec/project.yaml` and correct/extend as needed.
3. Run `agentkit sync` — your generated configs (`AGENTS.md`, `CLAUDE.md`, etc.)
   will now include project-specific context instead of generic boilerplate.

If `project.yaml` is missing or has all-null fields, sync still works — it just
produces generic output without project-specific conditionals.

---

## Migration: Pre-init → init Workflow

If you previously ran `sync` manually without `init`:

1. Run `agentkit init --repoName <your-repo> --non-interactive` to:
   - Create the overlay directory
   - Write `project.yaml`
   - Create the `.agentkit-repo` marker
   - Run sync
2. This enables `agentkit add/remove/list` for incremental tool management.

---

## Migration: Pre-manifest → Manifest Cleanup

Older versions of sync did not write a `.manifest.json`. After upgrading, the
first sync will create the manifest. Subsequent syncs will use it for stale file
cleanup — if you remove a render target, orphaned files from the previous sync
will be automatically deleted.

No action required; the manifest is created automatically.

---

## Migration: New Scaffold-Once Files

When an upgrade adds new scaffold-once files (e.g., new documentation templates,
new editor configs), they appear as untracked files after the first `sync`.

- If the file already exists in your repo, sync skips it (scaffold-once behavior).
- If it's new, sync creates it. Review and `git add` the ones you want to keep.

---

## Checking Your Version

```bash
node -e "console.log(require('./.agentkit/package.json').version)"
```

Compare with the upstream version to see if an upgrade is available.

---

## References

- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — Internal architecture details
- [CUSTOMIZATION.md](../configuration/CUSTOMIZATION.md) — Overlay system and settings
- [PROJECT_YAML_REFERENCE.md](../configuration/PROJECT_YAML_REFERENCE.md) — project.yaml schema
