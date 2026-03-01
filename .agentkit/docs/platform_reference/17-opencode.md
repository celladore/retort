# OpenCode

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | AI Coding Assistant (CLI, open-source) |
| **Categories** | CLI Agent |
| **Access** | CLI tool — `go install github.com/opencode-ai/opencode@latest` or build from source |
| **Documentation** | [github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode) |
| **Performance Rating** | ⭐⭐⭐ — **56/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents)) |

---

## Platform Overview

OpenCode is an open-source terminal-based AI coding assistant that natively
supports `AGENTS.md` for project instructions. It provides an interactive
terminal UI for code generation, editing, and project navigation.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |
| Config | `~/.config/opencode/config.json` | JSON |

### Key Capabilities

- **AGENTS.md native**: Reads for project context and coding conventions.
- **Terminal UI**: Rich interactive terminal interface for coding tasks.
- **Multi-model support**: Works with multiple LLM providers.
- **File operations**: Read, write, and navigate project files.
- **Shell integration**: Execute commands and analyze output.
- **Open source**: Community-driven development and extensibility.

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Agent instructions | `AGENTS.md` | Always generated from `project.yaml` |

OpenCode reads the universal `AGENTS.md`. No platform-specific files needed.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Native support | ✅ Always generated | None |
| Config file | ✅ JSON config | ❌ Not generated | Could generate project config |
| Platform-specific features | ⚠️ Limited config surface | N/A | Monitor for future expansion |

**Summary:** OpenCode is fully served by the universal `AGENTS.md`. Its
configuration surface is minimal beyond AGENTS.md. Monitor for future
platform-specific configuration options.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 56/100 ⭐⭐⭐ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents) |
| Developer Experience | 61/100 ⭐⭐⭐ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--cli-agents) |
| Cost & Value | 79/100 ⭐⭐⭐⭐ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--cli-agents) |
| Customization | 51/100 ⭐⭐½ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--cli-agents) |
| Privacy & Security | 61/100 ⭐⭐⭐ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--cli-agents) |
| Team & Enterprise | 22/100 ⭐ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--cli-agents) |
| **Weighted Total** | **58/100 ⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Go developers** — Go-native tooling with familiar ecosystem
- **Minimal setup needs** — lightweight terminal AI with quick start
- **Budget-zero projects** — fully open-source, $0 tool cost
- **Local model users** — supports local LLM backends

### Not Ideal For

- **Complex coding tasks** — less mature than Claude Code or Aider
- **Enterprise or team use** — no governance, admin, or collaboration features
- **Non-Go developers** — Go-based install is less accessible than npm/pip

---

## References

- [OpenCode — GitHub](https://github.com/opencode-ai/opencode)
- [AGENTS.md open standard](https://agents.md/)
