# Claude Code

**Render target:** `claude`

| | |
|---|---|
| **Type** | AI Coding Agent (CLI + IDE integration) |
| **Categories** | CLI Agent |
| **Access** | CLI tool — `npm install -g @anthropic-ai/claude-code` or `brew install claude-code` |
| **Documentation** | [docs.anthropic.com/en/docs/claude-code](https://docs.anthropic.com/en/docs/claude-code) |
| **Performance Rating** | ⭐⭐⭐⭐½ — **89/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents)) |

---

## Platform Overview

Claude Code (by Anthropic) is the most feature-rich AI coding agent integration.
It supports a full directory hierarchy under `.claude/` with commands, skills,
agents, rules, hooks, settings, and orchestrator state.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Root instructions | `CLAUDE.md` (repo root) | Plain Markdown |
| Commands | `.claude/commands/*.md` | YAML frontmatter + Markdown |
| Skills | `.claude/skills/*/SKILL.md` | YAML frontmatter + Markdown |
| Agents | `.claude/agents/*.md` | Plain Markdown with persona/scope |
| Rules | `.claude/rules/*.md` | Plain Markdown (optional YAML frontmatter for path targeting) |
| Hooks | `.claude/hooks/*.sh`, `*.ps1` | Shell/PowerShell scripts |
| Settings | `.claude/settings.json` | JSON (permissions, deny lists) |
| State | `.claude/state/` | JSON (orchestrator state, session tracking) |

### Key Capabilities

- **CLAUDE.md** is loaded automatically at session start. Supports hierarchical
  placement (`./CLAUDE.md`, `.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`).
- **Commands** are slash-invoked (`/build`, `/test`, etc.) with `allowed-tools`
  in YAML frontmatter for sandboxing.
- **Skills** are the modern replacement for commands — modular folders with
  `SKILL.md` containing instructions, plus optional scripts, templates,
  and references.
- **Rules** support path-filtered activation using globs in frontmatter.
- **Hooks** are deterministic script automations triggered by lifecycle events
  (UserPromptSubmit, PreToolUse, PostToolUse, Notification, Stop).
- **Settings** define tool permissions, deny lists, and project-level config.
- **Agents/subagents** run with isolated context for parallel, modular work.

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Root instructions | `CLAUDE.md` | `templates/claude/CLAUDE.md` + `project.yaml` |
| Commands (28) | `.claude/commands/*.md` | `commands.yaml` + team commands from `teams.yaml` |
| Skills (19) | `.claude/skills/*/SKILL.md` | `commands.yaml` (non-team commands) |
| Agents (19) | `.claude/agents/*.md` | `agents.yaml` |
| Rules (6) | `.claude/rules/*.md` | `templates/claude/rules/` |
| Hooks (10) | `.claude/hooks/*.sh`, `*.ps1` | `templates/claude/hooks/` |
| State schema | `.claude/state/` | Orchestrator state schema |
| Settings | `.claude/settings.json` | Permissions from `settings.yaml` |

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| CLAUDE.md | ✅ Hierarchical placement | ✅ Generated (root) | None |
| Commands | ✅ Slash-invoked with sandboxing | ✅ 28 generated | None |
| Skills | ✅ Modular folders with SKILL.md | ✅ 19 generated | Could add more domain-specific skills |
| Agents/subagents | ✅ Isolated context, parallel work | ✅ 19 generated | None |
| Rules | ✅ Path-filtered with globs | ✅ 6 generated | Could add more language/framework-specific rules |
| Hooks | ✅ 5 lifecycle events | ✅ 10 generated (sh + ps1) | None |
| Settings | ✅ Permissions, deny lists | ✅ Generated | None |
| State | ✅ Orchestrator state | ✅ Schema generated | None |
| Hierarchical CLAUDE.md | ✅ `~/.claude/`, `.claude/`, repo root | ⚠️ Root only | Could generate `.claude/CLAUDE.md` for workspace scope |
| Tool permissions | ✅ Fine-grained in settings.json | ✅ Generated | None |

**Summary:** Claude Code is the most comprehensively supported platform. Minor
gaps exist in hierarchical CLAUDE.md placement and domain-specific skill/rule expansion.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 89/100 ⭐⭐⭐⭐½ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents) |
| Developer Experience | 80/100 ⭐⭐⭐⭐ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--cli-agents) |
| Cost & Value | 64/100 ⭐⭐⭐ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--cli-agents) |
| Customization | 84/100 ⭐⭐⭐⭐ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--cli-agents) |
| Privacy & Security | 66/100 ⭐⭐⭐½ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--cli-agents) |
| Team & Enterprise | 68/100 ⭐⭐⭐½ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--cli-agents) |
| **Weighted Total** | **78/100 ⭐⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Power users** who need the strongest coding performance available
- **Complex multi-file refactoring** where subagent architecture excels
- **Teams investing in rich customization** — hooks, skills, commands, rules
- **Terminal-first workflows** that benefit from deep git integration

### Not Ideal For

- **Budget-sensitive individuals** — $20/mo minimum with usage caps
- **Teams needing model flexibility** — locked to Anthropic's Claude models
- **Regulated environments** requiring fully local/air-gapped execution

---

## References

- [Claude Code official documentation — Extending Claude](https://code.claude.com/docs/en/features-overview)
- [CLAUDE.md memory system](https://docs.anthropic.com/en/docs/claude-code/memory#claudemd)
- [Complete guide to CLAUDE.md structure](https://www.claudedirectory.org/blog/claude-md-guide)
- [Claude Code customization guide — skills, subagents](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [Rules directory — modular instructions](https://claudefa.st/blog/guide/mechanics/rules-directory)
- [Config file locations](https://inventivehq.com/knowledge-base/claude/where-configuration-files-are-stored)
- [Hooks and event automation](https://dev.to/holasoymalva/the-ultimate-claude-code-guide-every-hidden-trick-hack-and-power-feature-you-need-to-know-2l45)
- [Creating the perfect CLAUDE.md](https://dometrain.com/blog/creating-the-perfect-claudemd-for-claude-code/)
