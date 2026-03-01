# Platform Customization & Extensibility

Weighted evaluation of how deeply each AI coding platform can be customized,
extended, and configured to fit project-specific workflows, team standards,
and organizational policies.

> **Last updated:** 2025-02  
> **Methodology:** Scores are 1–10 (10 = most customizable). The weighted total
> produces a normalized rating out of 100.

---

## Table of Contents

1. [Customization Metrics](#customization-metrics)
2. [Category Matrix — AI-Native IDEs](#category-matrix--ai-native-ides)
3. [Category Matrix — IDE Extensions](#category-matrix--ide-extensions)
4. [Category Matrix — CLI Agents](#category-matrix--cli-agents)
5. [Category Matrix — Cloud / Autonomous Agents](#category-matrix--cloud--autonomous-agents)
6. [Overall Customization Rankings](#overall-customization-rankings)
7. [References](#references)

---

## Customization Metrics

| # | Metric | Weight | What It Measures |
|---|--------|--------|-----------------|
| 1 | **Instruction File Depth** | 25% | Richness of project-level instruction system — rules, commands, skills, prompts |
| 2 | **AGENTS.md Support** | 15% | Quality of universal AGENTS.md integration — how well it reads and follows the standard |
| 3 | **Activation Controls** | 15% | File-glob targeting, always-apply toggles, manual invocation, AI-decided activation |
| 4 | **MCP / Tool Integration** | 15% | Model Context Protocol support, external tool connections, plugin ecosystem |
| 5 | **Model Flexibility** | 15% | Choice of LLM backends — multiple providers, local models, model routing |
| 6 | **Team / Org Customization** | 15% | Team-specific rules, org-wide policies, role-based configurations |

### Why These Weights?

- **Instruction File Depth (25%)** is highest because this is the core mechanism
  AgentKit Forge uses to configure platforms — the richer the system, the more
  value AgentKit Forge can deliver.
- **AGENTS.md Support (15%)** is the universal baseline — every platform should
  read it, but depth of compliance varies.
- **Activation Controls, MCP, Model Flexibility, Team Customization** (15% each)
  represent equally important facets of real-world customization needs.

---

## Category Matrix — AI-Native IDEs

| Metric (Weight) | Cursor | Windsurf | Warp |
|-----------------|--------|----------|------|
| Instruction File Depth (25%) | 8 | 7 | 4 |
| AGENTS.md Support (15%) | 7 | 4 | 9 |
| Activation Controls (15%) | 9 | 6 | 4 |
| MCP / Tool Integration (15%) | 8 | 7 | 7 |
| Model Flexibility (15%) | 8 | 6 | 8 |
| Team / Org Customization (15%) | 7 | 6 | 6 |
| **Weighted Score** | **79** | **62** | **62** |
| **Customization Rating** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

### Justification — AI-Native IDEs

**Cursor (79/100)**
- Instruction Depth: 8 — `.mdc` rules with YAML frontmatter + commands [E1]
- Activation: 9 — Globs, alwaysApply, AI-decided, manual `@rule-name` [E1]
- MCP: 8 — Strong MCP support for external tools [E1]
- Model: 8 — Multiple providers; user can switch models per-task [E1]

**Windsurf (62/100)**
- Instruction Depth: 7 — Rules + commands + workflows [E2]
- AGENTS.md: 4 — Not documented as supporting AGENTS.md natively [E2]
- Activation: 6 — Modes (always, manual, glob, model) but less granular [E2]

**Warp (62/100)**
- AGENTS.md: 9 — AGENTS.md is the primary instruction file [E3]
- Instruction Depth: 4 — AGENTS.md only; no rules directory or skills [E3]
- Activation: 4 — No file-targeted activation; applies globally [E3]

---

## Category Matrix — IDE Extensions

| Metric (Weight) | Copilot | Cline | Roo Code | Continue | Cody | Amazon Q |
|-----------------|---------|-------|----------|----------|------|----------|
| Instruction File Depth (25%) | 9 | 6 | 7 | 7 | 5 | 5 |
| AGENTS.md Support (15%) | 8 | 8 | 8 | 4 | 7 | 7 |
| Activation Controls (15%) | 8 | 5 | 7 | 7 | 4 | 4 |
| MCP / Tool Integration (15%) | 5 | 8 | 8 | 8 | 5 | 5 |
| Model Flexibility (15%) | 6 | 9 | 9 | 10 | 7 | 5 |
| Team / Org Customization (15%) | 8 | 5 | 6 | 6 | 7 | 7 |
| **Weighted Score** | **76** | **68** | **75** | **72** | **58** | **56** |
| **Customization Rating** | ⭐⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐ | ⭐⭐⭐ |

### Justification — IDE Extensions

**GitHub Copilot (76/100)**
- Instruction Depth: 9 — Instructions, prompts, agents, chat modes — richest IDE extension [E4]
- AGENTS.md: 8 — Auto-detected and applied to all chat requests [E4]
- Team: 8 — Org-wide policies, chat modes per team [E4]
- Model: 6 — Limited to GitHub-provided models [E4]
- MCP: 5 — No MCP support yet [E4]

**Roo Code (75/100)**
- Instruction Depth: 7 — Rules + mode-specific rules + custom modes [E6]
- Activation: 7 — Mode-specific activation is powerful [E6]
- Model: 9 — BYOK; supports 20+ providers including local models [E6]

**Continue (72/100)**
- Model: 10 — Best model flexibility; any provider, local or remote [E9]
- MCP: 8 — Strong tool integration ecosystem [E9]
- AGENTS.md: 4 — Uses own rules system, indirect AGENTS.md support [E9]

**Cline (68/100)**
- MCP: 8 — Strong MCP integration [E5]
- Model: 9 — BYOK; any provider [E5]
- Activation: 5 — Rules are always-on; less granular than Cursor/Copilot [E5]

**Sourcegraph Cody (58/100)**
- Instruction Depth: 5 — AGENTS.md + config.json; no rules directory [E7]
- Team: 7 — Enterprise org-wide policies via Sourcegraph [E7]

**Amazon Q Developer (56/100)**
- Instruction Depth: 5 — AGENTS.md + `.amazonq/` config [E8]
- Model: 5 — Locked to Amazon's model offerings [E8]
- Team: 7 — AWS org policies and guardrails [E8]

---

## Category Matrix — CLI Agents

| Metric (Weight) | Claude Code | Codex | Gemini CLI | Aider | Amp | OpenCode |
|-----------------|-------------|-------|------------|-------|-----|----------|
| Instruction File Depth (25%) | 10 | 8 | 7 | 6 | 4 | 4 |
| AGENTS.md Support (15%) | 7 | 10 | 4 | 8 | 8 | 8 |
| Activation Controls (15%) | 9 | 6 | 5 | 4 | 4 | 3 |
| MCP / Tool Integration (15%) | 9 | 4 | 8 | 4 | 4 | 4 |
| Model Flexibility (15%) | 5 | 5 | 5 | 10 | 7 | 8 |
| Team / Org Customization (15%) | 8 | 5 | 5 | 4 | 4 | 3 |
| **Weighted Score** | **84** | **67** | **59** | **62** | **52** | **51** |
| **Customization Rating** | ⭐⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐½ | ⭐⭐½ |

### Justification — CLI Agents

**Claude Code (84/100)**
- Instruction Depth: 10 — CLAUDE.md + rules + commands + skills + agents + hooks + settings — richest system of any platform [E10]
- Activation: 9 — Glob-targeted rules, lifecycle hooks, skill triggers [E10]
- MCP: 9 — Full MCP support with tool permissions [E10]
- Model: 5 — Locked to Claude models [E10]

**Codex (67/100)**
- AGENTS.md: 10 — AGENTS.md is the primary file; hierarchical discovery, override support [E11]
- Instruction Depth: 8 — AGENTS.md + Skills system with scripts/templates [E11]

**Aider (62/100)**
- Model: 10 — Supports 60+ models from any provider [E12]
- AGENTS.md: 8 — Reads AGENTS.md + conventions file [E12]
- Instruction Depth: 6 — AGENTS.md + conventions; less structured than Claude/Codex [E12]

**Gemini CLI (59/100)**
- Instruction Depth: 7 — GEMINI.md + styleguide + settings + config [E13]
- MCP: 8 — Good MCP tool integration [E13]
- Model: 5 — Locked to Gemini models [E13]

---

## Category Matrix — Cloud / Autonomous Agents

| Metric (Weight) | Jules | Factory | Codex Cloud | Copilot Agent |
|-----------------|-------|---------|-------------|---------------|
| Instruction File Depth (25%) | 3 | 3 | 8 | 9 |
| AGENTS.md Support (15%) | 8 | 8 | 10 | 8 |
| Activation Controls (15%) | 3 | 3 | 6 | 8 |
| MCP / Tool Integration (15%) | 3 | 4 | 4 | 5 |
| Model Flexibility (15%) | 4 | 4 | 5 | 6 |
| Team / Org Customization (15%) | 4 | 7 | 5 | 8 |
| **Weighted Score** | **41** | **47** | **66** | **76** |
| **Customization Rating** | ⭐⭐ | ⭐⭐½ | ⭐⭐⭐½ | ⭐⭐⭐⭐ |

---

## Overall Customization Rankings

| Rank | Platform | Score | Rating |
|------|----------|-------|--------|
| 1 | Claude Code | 84 | ⭐⭐⭐⭐ |
| 2 | Cursor IDE | 79 | ⭐⭐⭐⭐ |
| 3 | GitHub Copilot | 76 | ⭐⭐⭐⭐ |
| 4 | Copilot Agent | 76 | ⭐⭐⭐⭐ |
| 5 | Roo Code | 75 | ⭐⭐⭐½ |
| 6 | Continue | 72 | ⭐⭐⭐½ |
| 7 | Cline | 68 | ⭐⭐⭐½ |
| 8 | Codex CLI | 67 | ⭐⭐⭐½ |
| 9 | Codex Cloud | 66 | ⭐⭐⭐½ |
| 10 | Windsurf | 62 | ⭐⭐⭐ |
| 11 | Aider | 62 | ⭐⭐⭐ |
| 12 | Warp | 62 | ⭐⭐⭐ |
| 13 | Gemini CLI | 59 | ⭐⭐⭐ |
| 14 | Cody | 58 | ⭐⭐⭐ |
| 15 | Amazon Q | 56 | ⭐⭐⭐ |
| 16 | Amp | 52 | ⭐⭐½ |
| 17 | OpenCode | 51 | ⭐⭐½ |
| 18 | Factory | 47 | ⭐⭐½ |
| 19 | Jules | 41 | ⭐⭐ |

---

## References

| ID | Source | URL |
|----|--------|-----|
| E1 | Cursor Rules docs | https://docs.cursor.com/ |
| E2 | Windsurf Cascade docs | https://docs.windsurf.com/ |
| E3 | Warp Rules docs | https://docs.warp.dev/agent-platform/capabilities/rules |
| E4 | GitHub Copilot customization | https://docs.github.com/en/copilot/customizing-copilot |
| E5 | Cline rules & MCP | https://docs.cline.bot/ |
| E6 | Roo Code modes & rules | https://docs.roocode.com/features/ |
| E7 | Sourcegraph Cody config | https://sourcegraph.com/docs/cody |
| E8 | Amazon Q customizations | https://docs.aws.amazon.com/amazonq/ |
| E9 | Continue rules & config | https://docs.continue.dev/customize/rules |
| E10 | Claude Code extensibility | https://docs.anthropic.com/en/docs/claude-code |
| E11 | Codex AGENTS.md & skills | https://developers.openai.com/codex/guides/agents-md |
| E12 | Aider model support | https://aider.chat/docs/leaderboards/ |
| E13 | Gemini CLI configuration | https://google-gemini.github.io/gemini-cli/ |

---

## See Also

- [PLATFORM_CODING_PERFORMANCE.md](./PLATFORM_CODING_PERFORMANCE.md) — Coding ability evaluation
- [PLATFORM_COST_ANALYSIS.md](./PLATFORM_COST_ANALYSIS.md) — Cost and pricing evaluation
- [PLATFORM_CONSOLIDATED_RATING.md](./PLATFORM_CONSOLIDATED_RATING.md) — Combined final rankings
