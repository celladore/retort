# Tabnine

**Render target:** _(via AGENTS.md — no dedicated render target)_

|                        |                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Type**               | AI Code Completion & Agent (IDE extension)                                                         |
| **Categories**         | IDE Extension                                                                                      |
| **Access**             | VS Code / JetBrains / Visual Studio extension — requires Tabnine account (free tier available)     |
| **Documentation**      | [docs.tabnine.com](https://docs.tabnine.com/)                                                      |
| **Performance Rating** | ⭐⭐⭐½ — **68/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions)) |

---

## Platform Overview

Tabnine is a veteran AI coding assistant (founded 2018) that has evolved from
pure code completion into an agentic platform with autonomous task execution.
Known for its privacy-first approach, Tabnine supports on-premises deployment,
air-gapped environments, and local model execution.

### Key Capabilities

- **Tabnine Agent** — autonomous multi-step tasks: refactoring, test generation, docs
- **Context-Aware Completions** — project-aware code suggestions
- **AI Chat** — codebase-aware Q&A and explanations
- **Natural Language to Code** — describe what you want in comments
- **Enterprise Controls** — on-premises, private VPC, air-gapped deployment
- **Multi-IDE** — VS Code, JetBrains, Visual Studio, Neovim
- **Policy & Compliance** — agent governance, coding standards enforcement

### What AgentKit Forge Generates

| Output    | Path        | Purpose                |
| --------- | ----------- | ---------------------- |
| AGENTS.md | `AGENTS.md` | Universal instructions |

### Gap Analysis

| Capability    | Native Support | AgentKit Forge Coverage | Gap                   |
| ------------- | -------------- | ----------------------- | --------------------- |
| AGENTS.md     | ✅ Supported   | ✅ Generated            | ✔ Covered             |
| Agent config  | ✅ Built-in    | ❌ Not generated        | 🟡 Tabnine-specific   |
| Code policies | ✅ Enterprise  | ❌ Not generated        | 🔴 Gap for enterprise |

---

## Consolidated Rating

| Dimension            | Score              | Details                                                                       |
| -------------------- | ------------------ | ----------------------------------------------------------------------------- |
| Coding Performance   | 68/100 ⭐⭐⭐½     | Solid completions; agent mode is newer and improving                          |
| Developer Experience | 75/100 ⭐⭐⭐½     | Mature product; smooth IDE integration                                        |
| Cost & Value         | 72/100 ⭐⭐⭐½     | Free tier; Pro at $12/mo; Enterprise custom                                   |
| Customization        | 50/100 ⭐⭐½       | AGENTS.md + policy config; less depth than Cursor                             |
| Privacy & Security   | 85/100 ⭐⭐⭐⭐    | Best-in-class: on-prem, air-gapped, local models                              |
| Team & Enterprise    | 82/100 ⭐⭐⭐⭐    | Strong enterprise: SSO, audit, governance, VPC deploy                         |
| **Weighted Total**   | **71/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Privacy-first enterprises** — on-prem, air-gapped, VPC deployment options
- **Regulated industries** — healthcare, finance, defense compliance
- **JetBrains + VS Code shops** — seamless multi-IDE support
- **Established teams** wanting mature, stable AI assistance

### Not Ideal For

- **Maximum coding performance** — completions lag behind Claude/GPT-4 tier
- **Deep customization** — limited rule/activation system
- **Autonomous agentic use** — Tabnine Agent is newer, less mature than Claude Code

---

## References

- [Tabnine official docs](https://docs.tabnine.com/)
- [Tabnine Agent docs](https://docs.tabnine.com/main/getting-started/tabnine-agent)
- [Tabnine overview — Eesel](https://www.eesel.ai/blog/tabnine-overview)
