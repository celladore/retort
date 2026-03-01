# AGENTS.md (Universal Standard)

**Always generated** — not gated by `renderTargets`.

| | |
|---|---|
| **Type** | Universal Instruction Standard |
| **Categories** | Universal Standard |
| **Access** | File-based — any tool that reads `AGENTS.md` from the repository |
| **Documentation** | [agents.md](https://agents.md/) |
| **Performance Rating** | N/A — AGENTS.md is a standard, not a coding platform |

---

## What Is It?

`AGENTS.md` is the open industry standard for AI agent instruction files,
stewarded by the Agentic AI Foundation under the Linux Foundation. It provides
a single, tool-agnostic way to communicate project context, conventions, and
workflows to any AI coding agent.

---

## Native Support

| Tool | How It Reads AGENTS.md |
|------|----------------------|
| OpenAI Codex | Reads `AGENTS.md` + `AGENTS.override.md` at every directory level |
| Google Jules | Reads from repo root before every task |
| GitHub Copilot | Auto-detects and applies to all chat requests |
| Roo Code | Loads after mode-specific rules, before generic rules |
| Cline | Loads alongside `.clinerules/` |
| Cursor | Recognized as part of the AGENTS.md initiative |
| Warp | Reads `AGENTS.md` (preferred) or `WARP.md` from repo root |
| Amp, Factory, OpenCode | Native support |
| Amazon Q Developer | Native support |
| Sourcegraph Cody | Reads AGENTS.md |
| Aider | Reads AGENTS.md + conventions file |

---

## What AgentKit Forge Generates

| Output | Path |
|--------|------|
| Agent instructions | `AGENTS.md` |

Content is generated from `project.yaml` (tech stack, architecture, conventions,
testing, integrations, documentation pointers) and the core spec files.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| Root `AGENTS.md` | ✅ All platforms | ✅ Generated | None |
| `AGENTS.override.md` | ✅ Codex, some others | ❌ Not generated | Generate override file for local/env-specific instructions |
| Subdirectory `AGENTS.md` | ✅ Codex, Warp | ❌ Not generated | Generate per-package AGENTS.md in monorepos |
| Global `~/.codex/AGENTS.md` | ✅ Codex | ❌ Not applicable | User-level, not project-scoped |

---

## Recommended Content for AGENTS.md

Per the [AGENTS.md specification](https://agents.md/), the file should include:

1. **Project overview** — what the project does, its purpose
2. **Tech stack** — languages, frameworks, versions, dependencies
3. **Architecture** — directory structure, key patterns, module boundaries
4. **Coding conventions** — naming, formatting, error handling
5. **Build/test/lint commands** — how to set up, build, test, and lint
6. **Workflow instructions** — PR requirements, branch strategy, deploy triggers
7. **Security requirements** — authentication, secrets handling, compliance
8. **Documentation pointers** — where to find ADRs, runbooks, API docs

---

## References

- [AGENTS.md open standard](https://agents.md/)
- [AGENTS.md specification — GitHub](https://github.com/agentic-ai-foundation/agents.md)
- [Instruction Files for AI Coding Assistants: An Overview](https://aruniyer.github.io/blog/agents-md-instruction-files.html)
- [The AGENTS.md Standard — Linux Foundation](https://www.linuxfoundation.org/research/agents-md)
