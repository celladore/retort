# Bolt.new

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | AI App Builder (prompt-to-app) |
| **Categories** | Vibe Coding / App Builder |
| **Access** | Web app — [bolt.new](https://bolt.new/) — browser-based, no install required |
| **Documentation** | [docs.bolt.new](https://docs.bolt.new/) |
| **Performance Rating** | ⭐⭐⭐½ — **68/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--vibe-coding--app-builders)) |

---

## Platform Overview

Bolt.new is a browser-based AI development platform that generates full-stack
web applications from natural language prompts. It integrates with Claude and
GPT-4 for code generation and deploys directly to Vercel. Ideal for rapid
prototyping and MVP development.

### Key Capabilities

- **Prompt-to-App** — generate full front-end + back-end from description
- **Live Preview** — real-time application preview as code generates
- **Bolt Database** — built-in database for generated apps
- **Vercel Deploy** — one-click deployment to production
- **GitHub Sync** — export and sync generated code to repositories
- **Iterative Refinement** — chat-based iteration on generated apps
- **Multi-Framework** — Next.js, React, Vue, Svelte support

### What AgentKit Forge Generates

| Output | Path | Purpose |
|--------|------|---------|
| AGENTS.md | `AGENTS.md` | Universal instructions (if repo is connected) |

### Gap Analysis

Bolt.new operates primarily as a generative tool rather than reading project
configuration files. AGENTS.md may be useful when working with existing repos.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 68/100 ⭐⭐⭐½ | Good for greenfield; weaker on existing codebases |
| Developer Experience | 82/100 ⭐⭐⭐⭐ | Zero-setup browser experience; instant preview |
| Cost & Value | 65/100 ⭐⭐⭐ | Free limited; paid ~$25/mo token-based |
| Customization | 30/100 ⭐½ | Primarily prompt-driven; minimal file-based config |
| Privacy & Security | 45/100 ⭐⭐ | Cloud-only; code processed on Bolt servers |
| Team & Enterprise | 35/100 ⭐⭐ | Limited team features; collaborative but not enterprise |
| **Weighted Total** | **60/100 ⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Rapid MVPs and prototypes** — idea to deployed app in minutes
- **Technical founders/startups** — skip boilerplate, ship fast
- **Next.js/Vercel ecosystem** — native deployment pipeline
- **Non-coders with technical taste** — generate and iterate visually

### Not Ideal For

- **Existing large codebases** — greenfield-focused
- **Enterprise requirements** — limited governance and security
- **Complex backend logic** — better at UI than deep business logic
- **Code customization** — generated code may need significant refactoring

---

## References

- [Bolt.new official](https://bolt.new/)
- [Bolt vs Cursor vs Replit — Geeky Gadgets](https://www.geeky-gadgets.com/bolt-vs-cursor-vs-replit-vs-lovable-ai-coders-comparison-guide/)
- [Bolt vs Replit vs Lovable — Emergent](https://emergent.sh/learn/bolt-new-vs-replit-vs-lovable)
