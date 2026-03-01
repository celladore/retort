# OpenAI Codex

**Render target:** `codex`

| | |
|---|---|
| **Type** | AI Coding Agent (CLI + Cloud) |
| **Categories** | CLI Agent, Cloud / Autonomous Agent |
| **Access** | CLI tool — `npm install -g @openai/codex` or cloud via [chatgpt.com/codex](https://chatgpt.com/codex) |
| **Documentation** | [developers.openai.com/codex](https://developers.openai.com/codex/) |
| **Performance Rating** | ⭐⭐⭐⭐ — **79/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents)) |

---

## Platform Overview

OpenAI Codex is a cloud-based coding agent that uses `AGENTS.md` as its primary
project instruction file and `.agents/skills/` (or `.codex/skills/`) for modular,
repeatable workflow definitions (Skills). It supports hierarchical instruction
discovery and a TOML-based configuration system.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |
| Directory instructions | `<subdir>/AGENTS.md` | Plain Markdown |
| Override instructions | `AGENTS.override.md` | Plain Markdown |
| Skills | `.agents/skills/*/SKILL.md` or `.codex/skills/*/SKILL.md` | YAML frontmatter + Markdown |
| Global instructions | `~/.codex/AGENTS.md` | Plain Markdown |
| Config | `~/.codex/config.toml` | TOML |

### Key Capabilities

- **Hierarchical AGENTS.md**: Global → root → subdirectory, most-specific wins.
  Codex chains instructions from the global config, then project root, then
  down each directory as you navigate.
- **AGENTS.override.md**: Provides temporary or local overrides without
  modifying the main `AGENTS.md`.
- **Skills** are modular folders with `SKILL.md` (required) plus optional
  `scripts/`, `templates/`, `references/` directories.
- **SKILL.md** contains YAML frontmatter (`name`, `description`, triggers)
  and step-by-step instructions.
- **Config.toml** controls model version, approval policy, sandbox mode,
  web search, reasoning effort, and agent privileges.
- **Skills are lazy-loaded**: Full instructions load only when context triggers
  the skill, reducing memory bloat.

### Skill Structure

```
.codex/skills/my-custom-skill/
├── SKILL.md         # Metadata + instructions (required)
├── scripts/         # Optional: agent-invokable scripts
├── templates/       # Optional: code/response templates
├── references/      # Optional: extra docs/specs
```

### Example SKILL.md

```yaml
---
name: deploy-staging
description: Deploy current branch to staging environment
---
## Steps
1. Run `npm run build`
2. Run `npm run test`
3. Execute `./scripts/deploy-staging.sh`
4. Verify deployment at staging URL
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Skills (19) | `.agents/skills/*/SKILL.md` | `commands.yaml` (non-team commands) |

Codex also reads `AGENTS.md` (always generated) for project-level context.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Primary instruction file | ✅ Always generated | None |
| AGENTS.override.md | ✅ Local/temp overrides | ❌ Not generated | Generate template override file |
| Subdirectory AGENTS.md | ✅ Per-package instructions | ❌ Not generated | Generate per-package in monorepos |
| Skills (.agents/skills/) | ✅ Modular workflow folders | ✅ 19 generated | None |
| Skills (.codex/skills/) | ✅ Alternate location | ❌ Uses `.agents/` only | Could support both paths |
| Global AGENTS.md | ✅ `~/.codex/AGENTS.md` | ❌ Not applicable | User-level, not project-scoped |
| Config.toml | ✅ Model, sandbox, approvals | ❌ Not generated | Could generate project-level config |
| Skill scripts | ✅ Agent-invokable scripts | ❌ Not generated | Could add scripts to skill folders |
| Skill templates | ✅ Code/response templates | ❌ Not generated | Could add templates to skill folders |
| Lazy loading | ✅ Context-triggered | ✅ Via SKILL.md triggers | None |

**Summary:** Skills generation is solid. Key gaps are `AGENTS.override.md`,
subdirectory AGENTS.md for monorepos, config.toml generation, and enriching
skills with scripts and templates.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 79/100 ⭐⭐⭐⭐ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents) |
| Developer Experience | 69/100 ⭐⭐⭐½ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--cli-agents) |
| Cost & Value | 59/100 ⭐⭐⭐ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--cli-agents) |
| Customization | 67/100 ⭐⭐⭐½ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--cli-agents) |
| Privacy & Security | 62/100 ⭐⭐⭐ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--cli-agents) |
| Team & Enterprise | 50/100 ⭐⭐½ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--cli-agents) |
| **Weighted Total** | **67/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **AGENTS.md-first projects** — Codex treats AGENTS.md as its primary instruction file
- **Cloud autonomous coding** — sandboxed execution without local resources
- **OpenAI ecosystem users** already on ChatGPT Plus/Pro
- **Skills-based workflows** — modular, reusable task definitions

### Not Ideal For

- **Budget-sensitive users** — Pro tier ($200/mo) needed for full autonomous use
- **Teams needing model choice** — OpenAI models only
- **Enterprise deployments** — limited admin and governance features

---

## References

- [OpenAI Codex — Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [How to Use AGENTS.md in OpenAI Codex](https://agentsmd.io/how-to-use-agents-md-in-codex)
- [How to Build Custom Agent Skills for Codex](https://skilllm.com/blog/custom-agent-skills-openai-codex)
- [Codex CLI Cheatsheet](https://shipyard.build/blog/codex-cli-cheat-sheet/)
- [Skills Catalog for Codex — GitHub](https://github.com/openai/skills)
- [Codex App Skills: Safe and Reusable Agent Workflows](https://www.verdent.ai/guides/codex-app-skills-guide)
- [OpenAI launches Skills in Codex](https://dataconomy.com/2025/12/24/openai-launches-skills-in-codex-to-supercharge-agentic-coding/)
- [AGENTS.md open standard](https://agents.md/)
