# Augment Code

**Render target:** _(via AGENTS.md — no dedicated render target)_

|                        |                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Type**               | AI Coding Agent & Assistant (IDE extension)                                                         |
| **Categories**         | IDE Extension                                                                                       |
| **Access**             | VS Code / JetBrains / Vim extension — [augmentcode.com](https://www.augmentcode.com/)               |
| **Documentation**      | [docs.augmentcode.com](https://docs.augmentcode.com/)                                               |
| **Performance Rating** | ⭐⭐⭐⭐ — **75/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions)) |

---

## Platform Overview

Augment Code is an enterprise-grade AI coding assistant with a deep Context
Engine that understands entire codebases — patterns, dependencies, and
architecture. It excels at large-codebase scenarios and integrates with
development workflow tools like Slack, Jira, Linear, and Notion.

### Key Capabilities

- **Context Engine** — maintains persistent understanding of entire codebase
- **AI Agent** — autonomous feature implementation, bug fixing, refactoring
- **Smart Completions** — multi-line, block, context-aware code suggestions
- **Code Review** — PR summaries, inline comments, guideline adherence
- **Workflow Integrations** — Slack, GitHub, Jira, Linear, Notion, Confluence
- **200K Token Context** — handles very large codebases
- **Enterprise Security** — SOC 2 Type II, ISO 42001, CMEK, SIEM, SSO

### What AgentKit Forge Generates

| Output    | Path        | Purpose                |
| --------- | ----------- | ---------------------- |
| AGENTS.md | `AGENTS.md` | Universal instructions |

### Gap Analysis

| Capability           | Native Support | AgentKit Forge Coverage | Gap                 |
| -------------------- | -------------- | ----------------------- | ------------------- |
| AGENTS.md            | ✅ Supported   | ✅ Generated            | ✔ Covered           |
| Code review rules    | ✅ Built-in    | ❌ Not generated        | 🟡 Augment-specific |
| Workflow automations | ✅ Built-in    | ❌ Not applicable       | ✔ N/A               |

---

## Consolidated Rating

| Dimension            | Score              | Details                                                                       |
| -------------------- | ------------------ | ----------------------------------------------------------------------------- |
| Coding Performance   | 75/100 ⭐⭐⭐⭐    | Strong context engine; good SWE-bench placement                               |
| Developer Experience | 76/100 ⭐⭐⭐⭐    | Clean IDE integration; workflow tool connections                              |
| Cost & Value         | 50/100 ⭐⭐½       | Expensive: $20–200/mo credit-based; costs can spike                           |
| Customization        | 55/100 ⭐⭐⭐      | AGENTS.md + review rules; limited activation controls                         |
| Privacy & Security   | 78/100 ⭐⭐⭐⭐    | SOC 2 Type II, ISO 42001, CMEK                                                |
| Team & Enterprise    | 80/100 ⭐⭐⭐⭐    | Strong: SSO, audit, multi-org GitHub, usage analytics                         |
| **Weighted Total**   | **69/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Large enterprise codebases** — 200K token context excels here
- **Workflow integration** — Jira, Linear, Slack, Notion all connected
- **Security-conscious enterprises** — SOC 2, ISO 42001, CMEK
- **Code review automation** — PR summaries and guideline enforcement

### Not Ideal For

- **Budget-constrained teams** — credit-based pricing can be expensive
- **Individual developers** — pricing model favors teams
- **Deep rule customization** — limited compared to Cursor/Claude Code

---

## References

- [Augment Code official](https://www.augmentcode.com/)
- [Augment Code pricing](https://www.augmentcode.com/pricing)
- [Augment Code review — VibeCodingTools](https://www.vibecodingtools.com/augment-code)
