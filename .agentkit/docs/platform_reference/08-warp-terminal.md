# Warp Terminal

**Render target:** `warp`

| | |
|---|---|
| **Type** | AI-Native Terminal / Agentic Development Environment |
| **Categories** | AI-Native IDE |
| **Access** | Desktop app — download from [warp.dev](https://www.warp.dev/) (macOS, Linux; Windows via WSL) |
| **Documentation** | [docs.warp.dev](https://docs.warp.dev/) |
| **Performance Rating** | ⭐⭐⭐ — **63/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ai-native-ides)) |

---

## Platform Overview

Warp is an AI-native terminal and Agentic Development Environment (ADE) that
reads `WARP.md` or `AGENTS.md` for project rules and supports multi-agent
workflows, natural language commands, and integrated code review.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project rules | `AGENTS.md` (preferred) or `WARP.md` | Plain Markdown |
| Subdirectory rules | `<subdir>/AGENTS.md` | Plain Markdown |
| Global rules | Warp settings UI | Warp config |

### Key Capabilities

- **Hierarchical rules**: Subdirectory rules override root, which override
  global. Most-specific context always wins.
- **Multi-agent support**: Run several AI agents concurrently, each for
  distinct roles (coding, review, DevOps, data analysis).
- **Natural language to command**: Describe a goal and the AI generates the
  command.
- **Contextual awareness**: Uses project rules, repo context, terminal history,
  and external systems via MCP protocol.
- **Agent autonomy levels**: Configure whether agents propose or execute
  automatically. Telemetry/logging controls available.
- **Warp Drive**: Syncs commands, environments, and shared agent prompts
  for team productivity.
- **Block-based output**: Every command/response is a selectable block,
  making sharing and collaboration easy.
- **Integrated editor & code review**: Tabbed file editor, code review diffs,
  multi-model AI support (OpenAI, Anthropic, Google).
- **Workflows & templates**: Save and reuse multi-step command workflows.
- **Migration**: `WARP.md` is still recognized but `AGENTS.md` is recommended.
  File name must be uppercase for Warp to recognize.

### Directory Structure Example

```
project/
  AGENTS.md                # Project-wide rules (preferred)
  WARP.md                  # Legacy format (still recognized)
  api/AGENTS.md            # API-specific rules
  ui/AGENTS.md             # UI-specific rules
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Root instructions | `WARP.md` | `templates/warp/WARP.md` + `project.yaml` |

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md (preferred) | ✅ Primary format | ✅ Always generated | None |
| WARP.md (legacy) | ✅ Backward compatible | ✅ Generated | Consider deprecating in favor of AGENTS.md |
| Subdirectory rules | ✅ Per-directory overrides | ❌ Not generated | Generate per-package rules in monorepos |
| Global rules | ✅ Via Warp settings UI | ❌ Not applicable | Platform-managed, not file-based |
| Multi-agent profiles | ✅ Concurrent agent roles | ❌ Not generated | Could generate agent role configs |
| Agent autonomy levels | ✅ Propose vs auto-execute | ❌ Not configured | Could document recommended settings |
| Warp Drive sync | ✅ Team command sharing | ❌ Not generated | Platform feature, not file-based |
| Workflow templates | ✅ Reusable multi-step | ❌ Not generated | Could generate common workflows |
| MCP integration | ✅ External tool connections | ❌ Not generated | Add MCP server config |

**Summary:** Warp is primarily served via `AGENTS.md` (always generated) and
the legacy `WARP.md`. Key gaps are subdirectory rules for monorepos and
generating multi-agent workflow templates.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 63/100 ⭐⭐⭐ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ai-native-ides) |
| Developer Experience | 77/100 ⭐⭐⭐⭐ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--ai-native-ides) |
| Cost & Value | 69/100 ⭐⭐⭐½ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--ai-native-ides) |
| Customization | 62/100 ⭐⭐⭐ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--ai-native-ides) |
| Privacy & Security | 51/100 ⭐⭐½ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--ai-native-ides) |
| Team & Enterprise | 54/100 ⭐⭐⭐ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--ai-native-ides) |
| **Weighted Total** | **65/100 ⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Terminal-first developers** who live in the command line
- **DevOps / infrastructure teams** — natural language to shell commands
- **Team collaboration** — Warp Drive shares commands, environments, and prompts
- **Multi-agent terminal workflows** — run concurrent AI agents for different roles

### Not Ideal For

- **Complex multi-file coding** — terminal is less natural for IDE-level edits
- **Enterprise compliance** — fewer certifications than Copilot or Amazon Q
- **Windows users** — requires WSL on Windows

---

## References

- [Warp — Rules documentation](https://docs.warp.dev/agent-platform/capabilities/rules)
- [Warp Code in Practice — Prompt to Production](https://www.vibesparking.com/en/blog/ai/warp/2025-09-04-warp-code-prompt-to-production-playbook/)
- [Warp Terminal Guide — DeployHQ](https://www.deployhq.com/guides/warp)
- [Complete WARP Terminal AI Rules System — GitHub](https://github.com/Janzen-KMC/WarpAI-Rules-System)
- [Complete Guide to Warp — AI-Based Development Environment](https://www.bluudit.com/blogs/complete-guide-to-warp-tool-ai-based-development-environment-for-2025)
- [Warp 2.0 — AI Agents and Team Collaboration](https://itsfoss.com/news/warp-terminal-2-0/)
- [Code, Collaborate, Command: Warp 2.0](https://engineering.01cloud.com/2025/06/26/code-collaborate-command-warp-2-0-transforms-how-developers-build/)
