# Amp

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | AI Coding Agent (CLI + IDE) |
| **Categories** | CLI Agent |
| **Access** | CLI tool or VS Code extension — see [ampcode.com](https://ampcode.com/) |
| **Documentation** | [ampcode.com/docs](https://ampcode.com/docs) |
| **Performance Rating** | ⭐⭐⭐½ — **72/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents)) |

---

## Platform Overview

Amp (by Sourcegraph) is an AI coding agent that runs in the terminal and
IDE, focused on autonomous multi-step coding tasks. It natively supports
`AGENTS.md` for project context and instructions.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |

### Key Capabilities

- **AGENTS.md native**: Reads for project context and coding conventions.
- **Autonomous execution**: Plans and executes multi-step coding tasks.
- **Code understanding**: Deep analysis of project structure and patterns.
- **Terminal + IDE**: Works in terminal and as IDE extension.
- **Git integration**: Creates branches, commits, and pull requests.
- **Multi-model**: Supports various LLM backends.
- **Tool use**: Can invoke build, test, and lint tools.

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Agent instructions | `AGENTS.md` | Always generated from `project.yaml` |

Amp reads the universal `AGENTS.md`. No platform-specific files needed.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Native support | ✅ Always generated | None |
| Platform-specific config | ❌ No known config system beyond AGENTS.md | N/A | No gap |

**Summary:** Amp is fully served by the universal `AGENTS.md`. As a relatively
new tool, its configuration surface is currently limited to `AGENTS.md`.
Monitor for future platform-specific configuration options.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 72/100 ⭐⭐⭐½ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents) |
| Developer Experience | 70/100 ⭐⭐⭐½ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--cli-agents) |
| Cost & Value | 79/100 ⭐⭐⭐⭐ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--cli-agents) |
| Customization | 52/100 ⭐⭐½ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--cli-agents) |
| Privacy & Security | 48/100 ⭐⭐½ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--cli-agents) |
| Team & Enterprise | 42/100 ⭐⭐ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--cli-agents) |
| **Weighted Total** | **65/100 ⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Sourcegraph users** already in the Sourcegraph ecosystem
- **Autonomous multi-step CLI tasks** — plans and executes independently
- **Free-tier users** — generous free access for individual developers
- **AGENTS.md-first projects** — native AGENTS.md support

### Not Ideal For

- **Enterprise governance** — limited admin and team features
- **Deep customization** — minimal configuration beyond AGENTS.md
- **Privacy-sensitive projects** — cloud-processed via Sourcegraph

---

## References

- [Amp by Sourcegraph](https://sourcegraph.com/amp)
- [Amp documentation](https://ampcode.com/docs)
- [AGENTS.md open standard](https://agents.md/)
