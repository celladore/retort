# Void Editor

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | Open-Source AI Code Editor (VS Code fork) |
| **Categories** | AI-Native IDE |
| **Access** | Desktop app — [voideditor.com](https://voideditor.com/) (macOS, Windows, Linux) |
| **Documentation** | [github.com/voideditor/void](https://github.com/voideditor/void) |
| **Performance Rating** | ⭐⭐⭐ — **60/100** |

---

## Platform Overview

Void is an open-source (Apache 2.0), privacy-first AI code editor forked from
VS Code. It supports connecting to any LLM (local or cloud) with no
intermediary backend — every interaction goes directly from your machine to the
model provider. Y Combinator-backed with 28K+ GitHub stars.

### Key Capabilities

- **Connect to Any LLM** — OpenAI, Anthropic, Gemini, DeepSeek, Ollama, LM Studio
- **Agent Mode** — AI can search, create, modify files, and access terminal
- **Gather Mode** — secure read-only AI operations
- **Quick Edit** — inline AI refactoring and transformation
- **No Intermediary Backend** — direct machine-to-LLM connection
- **FIM Model Support** — Fill-in-the-Middle for advanced completions
- **Checkpoints & Diffs** — track LLM-driven code changes
- **VS Code Compatibility** — extensions, themes, keybindings

### What AgentKit Forge Generates

| Output | Path | Purpose |
|--------|------|---------|
| AGENTS.md | `AGENTS.md` | Universal instructions |

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 60/100 ⭐⭐⭐ | Depends entirely on chosen LLM; no proprietary magic |
| Developer Experience | 70/100 ⭐⭐⭐½ | VS Code familiarity; agent/gather modes are clean |
| Cost & Value | 95/100 ⭐⭐⭐⭐½ | Completely free; BYOK only |
| Customization | 55/100 ⭐⭐⭐ | Multi-model + prompt customization; limited rules |
| Privacy & Security | 90/100 ⭐⭐⭐⭐½ | Best-in-class: no telemetry, no intermediary, local option |
| Team & Enterprise | 20/100 ⭐ | No team features; individual-focused |
| **Weighted Total** | **67/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Maximum privacy** — no telemetry, no intermediary, direct LLM connection
- **Air-gapped environments** — local models via Ollama/LM Studio
- **Zero-cost AI coding** — completely free with BYOK
- **Open-source transparency** — full source code visibility

### Not Ideal For

- **Team collaboration** — no multiplayer or team features
- **Enterprise needs** — no SSO, governance, audit, or policies
- **Polished experience** — core team [paused development in mid-2025](https://github.com/voideditor/void) to explore new ideas; community maintains it
- **Maximum coding performance** — quality depends entirely on chosen model

---

## References

- [Void Editor official](https://voideditor.com/)
- [Void GitHub](https://github.com/voideditor/void)
- [Void IDE beta review — InfoQ](https://www.infoq.com/news/2025/06/void-ide-beta-release/)
