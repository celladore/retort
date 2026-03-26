# Handoff: Ecosystem Integration Map — codeflow-engine + cognitive-mesh (GH#375)

**Date:** 2026-03-26
**Issues:** [GH#375](https://github.com/phoenixvc/retort/issues/375), [GH#369](https://github.com/phoenixvc/retort/issues/369)
**Prepared for:** Agent mapping integration touchpoints across the three repos
**This is a research + documentation session — no code changes**

---

## The Three Repos

| Repo                | Path                      | Stack             | Purpose                                                                |
| ------------------- | ------------------------- | ----------------- | ---------------------------------------------------------------------- |
| **retort**          | `~/repos/retort`          | Node.js, YAML     | AgentKit Forge — spec-driven agent config generation for 15+ AI tools  |
| **codeflow-engine** | `~/repos/codeflow-engine` | Python            | AutoPR engine — automated code review, PR generation, CI orchestration |
| **cognitive-mesh**  | `~/repos/cognitive-mesh`  | TypeScript (.sln) | Enterprise AI transformation framework                                 |

These three are built by the same owner (JustAGhosT / phoenixvc) and likely have natural integration points — but those points have never been formally mapped.

---

## Why This Matters

The VS Code plugin strategy session (see `2026-03-26-session-vscode-plugin-strategy.md`) needs to understand whether a plugin surfaces retort alone or the full ecosystem. The marketing site session needs to know whether to position retort as standalone or as part of a suite. And the engine architecture session may uncover patterns that should be shared across all three.

This map is the prerequisite for all three.

---

## What to Read

Start with the README and CLAUDE.md for each repo. Then go deeper on the integration surface:

### codeflow-engine (`~/repos/codeflow-engine`)

```bash
cat README.md
cat CLAUDE.md 2>/dev/null
cat MIGRATION_GUIDE.md | head -40   # recently migrated from monorepo
ls codeflow_engine/                  # Python source root
grep -r "agentkit\|retort\|claude\|agent.*spec" codeflow_engine/ --include="*.py" -l
```

Key questions:

- Does codeflow-engine generate or consume any files that retort also generates? (`.github/workflows/`, `CLAUDE.md`, agent configs?)
- Does it have its own concept of "agents" or "teams" that could map to retort's spec model?
- Does it call Claude/Cursor/Copilot APIs directly, or does it rely on retort-generated personas?
- What is its CI pipeline model — does it compete with or complement retort's quality gates?

### cognitive-mesh (`~/repos/cognitive-mesh`)

```bash
cat README.md
cat CLAUDE.md 2>/dev/null
cat CognitiveMesh.sln | head -20     # solution structure
ls                                    # top-level layout
grep -r "agentkit\|retort\|agent.*spec\|team.*spec" . --include="*.ts" --include="*.cs" -l 2>/dev/null | head -10
```

Key questions:

- What is cognitive-mesh's agent model — how does it define and route agents?
- Does it have a concept of "tool configuration" that retort could generate for it?
- Is it a runtime (executes agents) or a framework (defines agent behaviour)?
- Does it have VS Code integration already?

### retort side of the equation

```bash
# What retort currently generates that might touch the other repos
ls .agentkit/templates/              # all platform output templates
cat .agentkit/spec/project.yaml | grep -E "integration|external|ecosystem"
cat docs/integrations/ 2>/dev/null
```

---

## Output: The Integration Map

Produce `docs/architecture/decisions/XX-ecosystem-integration-map.md` with these sections:

### 1. Overlap matrix

For each potential integration point, classify it:

| Touchpoint                 | retort    | codeflow-engine | cognitive-mesh | Conflict / Complement / Gap |
| -------------------------- | --------- | --------------- | -------------- | --------------------------- |
| Claude agent persona files | Generates | Consumes?       | Consumes?      |                             |
| GitHub Actions workflows   | Generates | Generates       | —              | Potential conflict          |
| CLAUDE.md                  | Generates | —               | —              |                             |
| Agent team definition      | YAML spec | Python?         | TypeScript?    |                             |
| CI quality gates           | Template  | Enforces        | —              |                             |
| VS Code integration        | Planned   | Planned         | Unknown        |                             |
| ...                        |           |                 |                |                             |

### 2. Integration opportunities

For each complement relationship, describe a concrete integration:

- Could codeflow-engine read retort's `REGISTRY.json` to know which agents are available?
- Could retort generate codeflow-engine config files (if it has config that follows a known schema)?
- Could cognitive-mesh register its agents via retort's spec model rather than maintaining its own?

### 3. Conflict risks

For each conflict, describe the resolution options:

- Who owns the file?
- Should retort detect the other tool and skip that output?
- Should there be a shared schema owned by a fourth "meta" package?

### 4. Recommended next steps

Order the integration opportunities by:

- **Effort** — how much work to implement?
- **Value** — how much does it improve the user's workflow?
- **Dependency** — does one need to happen before another?

---

## Specific Hypotheses to Validate

Based on the backlog and what's known about the three repos:

1. **codeflow-engine generates GitHub workflow files.** If true, it conflicts with retort's workflow templates. Resolution may be: retort templates detect `codeflow-engine` in the repo and skip workflow generation, or codeflow-engine reads retort's template output.

2. **cognitive-mesh has its own agent concept.** If it defines agents in TypeScript/C#, those definitions could be cross-compiled to retort YAML spec, making retort the single source of truth for agent personas across all three tools.

3. **Neither codeflow-engine nor cognitive-mesh currently uses retort.** If confirmed, the immediate opportunity is onboarding both repos via `agentkit init` — giving them generated CLAUDE.md, agent personas, and quality gates for free.

4. **The VS Code extension is the natural unification layer.** If a single extension can surface retort's agent registry, codeflow-engine's PR queue, and cognitive-mesh's agent state, that's a stronger product than three separate tools.

---

## Constraints

- Research only — no code changes, no new files outside `docs/`
- Do not run `agentkit init` on the other repos without user confirmation
- If you find that codeflow-engine or cognitive-mesh already has retort onboarding files, note which version and whether they are current
- PR target: `dev` · Commit: `docs(architecture): add ecosystem integration map ADR`
