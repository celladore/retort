# Devin

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | Autonomous AI Software Engineer |
| **Categories** | Cloud / Autonomous Agent |
| **Access** | Web interface — [devin.ai](https://devin.ai/) — requires account and repo access |
| **Documentation** | [docs.devin.ai](https://docs.devin.ai/) |
| **Performance Rating** | ⭐⭐⭐½ — **70/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cloud--autonomous-agents)) |

---

## Platform Overview

Devin (by Cognition) is positioned as "the first AI software engineer" —
a fully autonomous coding agent that operates in a sandboxed cloud environment
with its own shell, editor, and browser. It handles entire tasks from
planning through implementation, testing, and PR submission.

### Key Capabilities

- **End-to-End Autonomy** — plans, codes, debugs, iterates independently
- **Agent-Native IDE** — cloud-hosted workspace with shell, editor, browser
- **Interactive Planning** — researches codebase, generates plans for approval
- **Devin Search** — deep codebase exploration with cited code references
- **Devin Wiki** — auto-generated documentation and architecture diagrams
- **Parallel Agents** — launch multiple Devins for concurrent subtasks
- **Sandboxed Execution** — isolated environment for safe code execution
- **API Access** — Team and Enterprise plans for automation

### What AgentKit Forge Generates

| Output | Path | Purpose |
|--------|------|---------|
| AGENTS.md | `AGENTS.md` | Universal instructions (Devin reads from repo) |

### Gap Analysis

| Capability | Native Support | AgentKit Forge Coverage | Gap |
|-----------|---------------|------------------------|-----|
| AGENTS.md | ✅ Reads from repo | ✅ Generated | ✔ Covered |
| Task instructions | ✅ Via chat/API | ❌ Not applicable | ✔ N/A |
| Wiki generation | ✅ Built-in | ❌ Not applicable | ✔ N/A |

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 70/100 ⭐⭐⭐½ | SWE-bench 13.86% (pioneering but still limited) |
| Developer Experience | 65/100 ⭐⭐⭐ | Cloud-only; async; requires patience and oversight |
| Cost & Value | 45/100 ⭐⭐ | $20/mo base but ACU costs scale quickly |
| Customization | 40/100 ⭐⭐ | Minimal file-based config; primarily chat-driven |
| Privacy & Security | 55/100 ⭐⭐⭐ | Cloud-only execution; enterprise security features |
| Team & Enterprise | 60/100 ⭐⭐⭐ | Team plan with API; enterprise features growing |
| **Weighted Total** | **58/100 ⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Routine bounded tasks** — bug fixes, migrations, known-pattern implementation
- **Teams with overflow work** — delegate well-defined tasks to AI
- **Prototyping and MVPs** — rapid autonomous development
- **Non-technical founders** — describe what you want, get working code

### Not Ideal For

- **Complex open-ended development** — still needs significant oversight
- **Budget-sensitive projects** — ACU costs accumulate quickly
- **Real-time collaboration** — async cloud model isn't interactive
- **Privacy-sensitive code** — cloud-only execution

---

## References

- [Cognition Devin 2.0 announcement](https://cognition.ai/blog/devin-2)
- [Devin AI Complete Guide — Digital Applied](https://www.digitalapplied.com/blog/devin-ai-autonomous-coding-complete-guide)
- [Devin AI pricing — Eesel](https://www.eesel.ai/blog/cognition-ai-pricing)
