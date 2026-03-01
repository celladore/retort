# Nimbalyst

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | AI Session Manager & WYSIWYG Editor (Claude Code companion) |
| **Categories** | AI-Native IDE |
| **Access** | Desktop app — download from [nimbalyst.com](https://nimbalyst.com/) (macOS, Windows, Linux) |
| **Documentation** | [nimbalyst.com/docs](https://nimbalyst.com/docs) |
| **Performance Rating** | ⭐⭐⭐ — **58/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ai-native-ides)) |

---

## Platform Overview

Nimbalyst is a local-first WYSIWYG markdown editor and session manager
designed specifically as a Claude Code companion. It enables developers and
product managers to run, organize, and coordinate multiple Claude Code
sessions, with visual diffing, mockup tools, and project tracking.

### Key Capabilities

- **Multi-Session Claude Code Management** — run parallel Claude Code sessions
- **WYSIWYG Markdown Editor** — rich editing with Mermaid diagrams, tables, images
- **Visual Code Diffing** — red/green diff review for AI-proposed changes
- **Integrated Mockup & Diagram Tools** — HTML/CSS prototyping with AI collaboration
- **Project Tracking** — to-dos, bugs, decisions tracked in markdown
- **Git Integration** — AI-assisted commits, branch management, worktrees
- **MCP Integration** — Model Context Protocol support
- **Local-First** — all data stored locally unless synced to GitHub

### What AgentKit Forge Generates

| Output | Path | Purpose |
|--------|------|---------|
| AGENTS.md | `AGENTS.md` | Universal instructions (read via Claude Code sessions) |
| CLAUDE.md | `CLAUDE.md` | Claude Code-specific instructions |

### Gap Analysis

| Capability | Native Support | AgentKit Forge Coverage | Gap |
|-----------|---------------|------------------------|-----|
| Claude Code integration | ✅ Primary purpose | ✅ CLAUDE.md generated | ✔ Covered |
| Session management | ✅ Built-in | ❌ Not applicable | ✔ N/A |
| Project tracking | ✅ Built-in | ❌ Not generated | 🟡 Minor |

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 58/100 ⭐⭐⭐ | Performance depends entirely on Claude Code underneath |
| Developer Experience | 72/100 ⭐⭐⭐½ | Excellent multi-session UX; local-first is appealing |
| Cost & Value | 75/100 ⭐⭐⭐½ | Free tool; requires Claude Pro/Max subscription |
| Customization | 40/100 ⭐⭐ | Limited beyond Claude Code's own customization |
| Privacy & Security | 78/100 ⭐⭐⭐⭐ | Local-first data storage; strong privacy posture |
| Team & Enterprise | 30/100 ⭐½ | Individual-focused; no team/enterprise features |
| **Weighted Total** | **61/100 ⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Claude Code power users** wanting multi-session orchestration
- **Product managers** collaborating with developers via shared docs
- **Privacy-conscious developers** — local-first data storage
- **Documentation-heavy projects** — WYSIWYG markdown with AI

### Not Ideal For

- **Non-Claude users** — tightly coupled to Claude Code
- **Enterprise teams** — no team management, SSO, or governance
- **Standalone coding** — a companion tool, not a replacement IDE

---

## References

- [Nimbalyst on Product Hunt](https://www.producthunt.com/products/nimbalyst)
- [Nimbalyst overview — AIToolNet](https://www.aitoolnet.com/nimbalyst)
- [Nimbalyst — EveryDev.ai](https://www.everydev.ai/tools/nimbalyst)
