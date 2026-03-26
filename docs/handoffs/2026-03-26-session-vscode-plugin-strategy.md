# Handoff: VS Code Plugin Strategy — Own vs Combine with codeflow-engine

**Date:** 2026-03-26
**Prepared for:** Next agent evaluating the VS Code plugin strategy
**Repos involved:**
- `C:\Users\smitj\repos\retort` — AgentKit Forge framework (this repo)
- `C:\Users\smitj\repos\codeflow-vscode-extension` — existing VS Code extension

---

## The Question

Should retort build its own VS Code extension, or should the `codeflow-vscode-extension` be extended/adapted to serve both purposes?

---

## What to Read First

**In `codeflow-vscode-extension`:**
```bash
cat README.md
cat CLAUDE.md 2>/dev/null || echo "(no CLAUDE.md)"
cat package.json | head -60   # extension manifest, activation events, contributes
ls src/                        # source structure
```

**In retort:**
```bash
cat .agentkit/spec/settings.yaml        # current tool targets (does it list vscode?)
ls .agentkit/templates/                 # what platforms retort currently generates for
cat docs/architecture/                  # any existing ADRs on tooling
```

---

## Evaluation Dimensions

### 1. What does codeflow-vscode-extension currently do?

Map its features:
- Commands it registers (`contributes.commands` in package.json)
- Activation events — when does it activate?
- Does it touch `.claude/` directories, agent files, or YAML specs?
- Does it depend on codeflow-engine Python runtime, or is it standalone?

**Critical question:** Is it already repo-aware (reads project metadata) or is it generic tooling?

### 2. What would a retort VS Code extension need to do?

Retort's natural VS Code integration points:
- **Sidebar panel** — show agent registry (`REGISTRY.json`) as a tree view
- **Command palette** — run `retort:sync`, `retort:validate`, `retort:check` without leaving VS Code
- **Status bar** — show sync drift status (generated files out of date?)
- **File decorations** — mark `.claude/agents/*.md` files as generated (read-only indicator)
- **Spec editing** — YAML schema validation for `.agentkit/spec/*.yaml` files (JSON schema)
- **Agent search** — quick-open by agent ID across the registry

### 3. Overlap analysis

After reading both codebases, fill in this matrix:

| Feature | codeflow-extension has it | retort needs it | Shared? |
|---|---|---|---|
| Command palette integration | ? | yes | ? |
| File system watching | ? | yes (drift detection) | ? |
| Project metadata reading | ? | yes | ? |
| Python runtime dependency | ? | no | incompatible |
| Agent/team awareness | ? | yes | ? |

### 4. Architecture options

Evaluate three options:

**Option A — Extend codeflow-vscode-extension**
- Add retort-specific commands and views to the existing extension
- Pro: one extension to install, shared activation, shared project-detection logic
- Con: couples two separate frameworks; codeflow may have conflicting assumptions; adds complexity to both

**Option B — New standalone retort extension**
- `retort-vscode` (new repo or subdirectory of retort)
- Pro: clean separation, retort-specific UX, no codeflow coupling
- Con: another extension to maintain and publish

**Option C — Shared extension host (monorepo)**
- Both extensions as separate packages under a shared VS Code extension monorepo
- Pro: shared utilities (project detection, YAML parsing), separate activation
- Con: highest initial setup cost

---

## Recommendation Format

Produce an ADR at:
```
docs/architecture/decisions/XX-vscode-plugin-strategy.md
```

The ADR should include:
- **Status:** proposed
- **Context:** what codeflow-extension does, what retort needs, overlap analysis
- **Decision:** chosen option with rationale
- **Consequences:** implementation scope, new repos/packages required, maintenance burden
- **Open questions:** anything that needs user input before proceeding

If the recommendation is Option A or C, also produce a feature list of what to add to the combined extension. If Option B, produce a rough extension manifest skeleton (`package.json` contributes section).

---

## Constraints

- Do not create any new repos or packages during this session — discovery and ADR only
- If a strong case exists for Option A, flag whether codeflow-vscode-extension needs to be migrated to a pnpm workspace first (it may currently be npm)
- The user's preferred package manager is pnpm
- Retort generates a `.vscode/settings.json` (editor theme) — any extension must not conflict with this
