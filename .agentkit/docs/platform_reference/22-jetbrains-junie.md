# JetBrains Junie

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | AI Coding Agent (JetBrains IDE plugin) |
| **Categories** | IDE Extension |
| **Access** | JetBrains IDE plugin — included with JetBrains AI Pro subscription; install via Marketplace |
| **Documentation** | [jetbrains.com/junie](https://www.jetbrains.com/junie/) |
| **Performance Rating** | ⭐⭐⭐⭐ — **76/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions)) |

---

## Platform Overview

Junie is JetBrains' agentic AI coding agent, deeply integrated into IntelliJ
IDEA, PyCharm, WebStorm, GoLand, PhpStorm, RubyMine and other JetBrains IDEs.
It goes beyond the JetBrains AI Assistant by offering autonomous multi-step
development with planning, execution, testing, and verification.

### Key Capabilities

- **Ask Mode** — explores and explains code without making changes
- **Code Mode** — proposes and applies changes with diff review
- **Brave Mode** — autonomous execution without per-step confirmation
- **PLAN.md Generation** — creates step-by-step implementation plans
- **IDE-Deep Integration** — leverages inspections, navigation, search, test frameworks
- **Test & Verify** — runs project tests after changes to ensure correctness
- **Multi-Language** — Java, Kotlin, Python, Rust, JavaScript, TypeScript, Go, PHP, Ruby
- **Local AI Option** — supports Ollama / LM Studio for privacy

### What AgentKit Forge Generates

| Output | Path | Purpose |
|--------|------|---------|
| AGENTS.md | `AGENTS.md` | Universal instructions |

### Gap Analysis

| Capability | Native Support | AgentKit Forge Coverage | Gap |
|-----------|---------------|------------------------|-----|
| AGENTS.md | ✅ Native | ✅ Generated | ✔ Covered |
| PLAN.md | ✅ Built-in | ❌ Not generated | 🟡 Junie-specific |
| IDE inspections | ✅ Built-in | ❌ Not applicable | ✔ N/A |
| Rules directory | ❌ Not documented | ❌ Not generated | 🟡 Minor |

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 76/100 ⭐⭐⭐⭐ | Strong multi-step agent; IDE inspections boost correctness |
| Developer Experience | 82/100 ⭐⭐⭐⭐ | Deeply integrated into JetBrains workflow; familiar UX |
| Cost & Value | 60/100 ⭐⭐⭐ | Requires JetBrains AI Pro ($16.67/mo); on top of IDE license |
| Customization | 55/100 ⭐⭐⭐ | AGENTS.md + PLAN.md; limited activation controls |
| Privacy & Security | 65/100 ⭐⭐⭐ | Local model option via Ollama; JetBrains privacy posture |
| Team & Enterprise | 70/100 ⭐⭐⭐½ | JetBrains org management; enterprise features |
| **Weighted Total** | **72/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **JetBrains users** who want agentic AI without switching editors
- **Java/Kotlin/Python teams** — strongest language support
- **Enterprise developers** leveraging existing JetBrains licenses
- **Safety-conscious teams** — planning → review → execute → verify workflow

### Not Ideal For

- **VS Code users** — JetBrains only
- **Budget-constrained developers** — requires JetBrains + AI Pro subscription
- **Deep customization** — limited rule/activation system vs Cursor/Claude Code

---

## References

- [JetBrains Junie official](https://www.jetbrains.com/junie/)
- [Junie Starter's Pack — DEV.to](https://dev.to/jetbrains/junie-starters-pack-ai-coding-agent-explained-2hjf)
- [JetBrains Junie deep dive — CHDR Tech](https://chdr.tech/en/2025/07/23/junie-by-jetbrains-a-breakthrough-in-code-automation-and-developer-tools/)
