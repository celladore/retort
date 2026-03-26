# Handoff: Split Oversized Spec Files

**Date:** 2026-03-26
**Prepared for:** Next agent working on retort
**Branch base:** `chore/migrate-to-pnpm` (or branch from `dev`)

---

## What Was Done in the Prior Session

`agents.yaml` (3,234 lines / 127 KB) was split into 11 category files under `.agentkit/spec/agents/`. The sync engine was updated to support directory-based loading via `loadAgentsSpec()` with backward-compatible fallback. All 4 callers of the old direct-read were updated. Tests pass.

---

## The Problem

Two spec files remain oversized and have the same problems `agents.yaml` had:

| File | Lines | Size | Problem |
|---|---|---|---|
| `commands.yaml` | 2,408 | 91 KB | Every command (40+) in one file; hard to review, AI context-heavy |
| `rules.yaml` | 1,445 | 55 KB | Every rule domain (15+) in one file; same issue |

When an AI agent or human reviewer reads these files, they receive context for all commands/rules regardless of what they're working on. Splitting mirrors what was done for agents.

---

## What Needs to Be Done

### Phase 1 — Split `commands.yaml`

`commands.yaml` structure is `{ commands: [...] }` — a flat list, not categorised.

Likely split strategy: by command category/type (team commands vs skill commands vs meta commands). First inspect the file to understand the structure:

```bash
head -60 .agentkit/spec/commands.yaml
```

Create `.agentkit/spec/commands/` directory. Write a Node.js split script (same pattern used for agents — see git log for the agents split commit). Update `synchronize.mjs` to add a `loadCommandsSpec(agentkitRoot)` function mirroring `loadAgentsSpec`.

### Phase 2 — Split `rules.yaml`

`rules.yaml` structure is `{ rules: { <domain>: { ... } } }` — already keyed by domain.

Split into `.agentkit/spec/rules/` — one file per domain (same pattern as agents). Add `loadRulesSpec(agentkitRoot)` to `synchronize.mjs`.

### Phase 3 — Update callers

Grep for every place that reads `commands.yaml` or `rules.yaml` directly:

```bash
grep -r "commands\.yaml\|rules\.yaml" .agentkit/engines/node/src/ --include="*.mjs"
```

Update each caller to use the new loader functions.

### Phase 4 — Tests

Add test files mirroring `synchronize-agents.test.mjs`:
- `synchronize-commands.test.mjs`
- `synchronize-rules.test.mjs`

Cover: directory loading, fallback to monolithic file, merging, non-yaml file ignoring.

### Phase 5 — Sync and verify

```bash
pnpm -C .agentkit retort:sync
pnpm -C .agentkit test
```

---

## Key Files to Read First

- `.agentkit/engines/node/src/synchronize.mjs` lines 177–230 — `loadAgentsSpec` implementation (use as pattern)
- `.agentkit/engines/node/src/__tests__/synchronize-agents.test.mjs` — test pattern to follow
- `.agentkit/spec/commands.yaml` — understand structure before splitting
- `.agentkit/spec/rules.yaml` — understand structure before splitting

---

## Constraints

- `.agentkit/templates/`, `.agentkit/engines/`, `.agentkit/overlays/`, `.agentkit/bin/` are **protected** — do not edit directly; only `.agentkit/spec/` and `.agentkit/engines/` as code (the engine is editable source, templates are not)
- Wait — the engine IS editable: `synchronize.mjs` is in `.agentkit/engines/node/src/` which you can edit
- After any spec change, run `pnpm -C .agentkit retort:sync` before committing
- PR target is `dev`, not `main`
- Conventional commit format: `refactor(spec): split commands.yaml into directory`
