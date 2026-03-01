# Trae IDE

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | AI-Native Code Editor (VS Code fork) |
| **Categories** | AI-Native IDE |
| **Access** | Desktop app — download from [trae.ai](https://www.trae.ai/) (macOS, Windows; Linux pending) |
| **Documentation** | [trae.ai/docs](https://www.trae.ai/docs) |
| **Performance Rating** | ⭐⭐⭐½ — **72/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ai-native-ides)) |

---

## Platform Overview

Trae is ByteDance's AI-native code editor, built on a VS Code foundation with
deep AI integration. It provides free unlimited access to GPT-4o and Claude
3.5/3.7 Sonnet models, making it one of the most generous AI IDEs on the market.

### Key Capabilities

- **SOLO Agent Mode** — autonomous agent that plans, executes, and deploys
  end-to-end features with minimal input
- **Custom Agent Ecosystem** — create and share custom agents for specific
  workflows, roles, or languages
- **Multi-Model Support** — free GPT-4o + Claude 3.5/3.7 Sonnet access
- **Builder Mode** — auto-generates project scaffolding from natural language
- **Chat Mode** — contextual conversational agent for debugging and suggestions
- **Multimodal Input** — accepts prompts, file uploads, screenshots, and Figma designs
- **VS Code Compatibility** — imports VS Code settings and supports extensions
- **Bilingual** — full Chinese and English interface support

### What AgentKit Forge Generates

| Output | Path | Purpose |
|--------|------|---------|
| AGENTS.md | `AGENTS.md` | Universal instructions (Trae reads standard AGENTS.md) |

### Gap Analysis

| Capability | Native Support | AgentKit Forge Coverage | Gap |
|-----------|---------------|------------------------|-----|
| Project-level instructions | ✅ AGENTS.md | ✅ Generated | ✔ Covered |
| Rules directory | ❌ Not documented | ❌ Not generated | 🟡 Minor — AGENTS.md covers basics |
| Custom agents | ✅ Built-in | ❌ Not generated | 🔴 Gap — could generate agent configs |
| MCP integration | ⚠️ Emerging | ❌ Not generated | 🟡 Monitor |

### AGENTS.md Integration

Trae reads standard `AGENTS.md` files from the repository root. No special
configuration format is required beyond the universal AGENTS.md standard.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 72/100 ⭐⭐⭐½ | Strong models (GPT-4o + Claude 3.7) but newer, less benchmarked |
| Developer Experience | 79/100 ⭐⭐⭐⭐ | VS Code familiarity, polished UI, fast onboarding |
| Cost & Value | 92/100 ⭐⭐⭐⭐½ | Free unlimited GPT-4o + Claude access — best value in market |
| Customization | 55/100 ⭐⭐⭐ | Custom agents but limited rules/activation system |
| Privacy & Security | 45/100 ⭐⭐ | Local file storage but cloud model processing; [privacy policy](https://www.trae.ai/privacy) should be reviewed for data handling specifics |
| Team & Enterprise | 40/100 ⭐⭐ | Limited team/enterprise features |
| **Weighted Total** | **71/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Budget-zero developers** — completely free with premium model access
- **Rapid prototyping** — Builder mode generates project scaffolding from prompts
- **VS Code users** wanting AI-native experience without subscription cost
- **Bilingual teams** working across English and Chinese

### Not Ideal For

- **Privacy-sensitive projects** — code is processed via cloud models; review [Trae's privacy policy](https://www.trae.ai/privacy) before use with proprietary code
- **Enterprise compliance** — limited governance and audit features
- **Linux users** — full Linux support still pending
- **Deep customization** — fewer rule/activation controls than Cursor

---

## References

- [Trae IDE official site](https://www.trae.ai/)
- [Trae AI IDE Review — Skywork](https://skywork.ai/blog/trae-ai-ide-review-2025-cursor-alternative/)
- [ByteDance Trae overview — DigitalOcean](https://www.digitalocean.com/community/tutorials/trae-free-ai-code-editor)
