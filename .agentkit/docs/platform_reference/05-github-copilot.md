# GitHub Copilot

**Render target:** `copilot`

| | |
|---|---|
| **Type** | AI Coding Assistant (IDE extension + cloud agent) |
| **Categories** | IDE Extension, Cloud / Autonomous Agent |
| **Access** | VS Code / Visual Studio / JetBrains extension + GitHub.com — requires GitHub Copilot subscription |
| **Documentation** | [docs.github.com/en/copilot](https://docs.github.com/en/copilot) |
| **Performance Rating** | ⭐⭐⭐⭐ — **78/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions)) |

---

## Platform Overview

GitHub Copilot supports a layered customization system: repository-wide
instructions, path-specific instructions, reusable prompt files, custom agents,
and team-scoped chat modes. It is deeply integrated into VS Code, Visual Studio,
JetBrains, and GitHub.com.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Repo-wide instructions | `.github/copilot-instructions.md` | Plain Markdown |
| Path-specific instructions | `.github/instructions/*.instructions.md` | Markdown with YAML frontmatter |
| Prompt files (slash commands) | `.github/prompts/*.prompt.md` | YAML frontmatter + Markdown |
| Custom agents | `.github/agents/*.agent.md` | YAML frontmatter + Markdown |
| Chat modes | `.github/chatmodes/*.chatmode.md` | YAML frontmatter + Markdown |
| Agent instructions | `AGENTS.md` | Plain Markdown |
| Personal instructions | `$HOME/.copilot/copilot-instructions.md` | Plain Markdown |

### Key Capabilities

- **Repository-wide instructions** in `.github/copilot-instructions.md` are
  automatically used by all Copilot sessions in the repo.
- **Path-specific instructions** apply to files/folders matching patterns —
  great for language- or layer-specific standards (e.g., rules for `/api/`
  or `/tests/`).
- **Prompt files** define reusable slash commands (e.g., `/spell-check`,
  `/deploy`). They automate repetitive guidance.
- **Custom agents** define specialist personas with tools and scope for
  multi-step workflows.
- **Chat modes** tailor Copilot's interaction style — toggle between
  strict code review, creative brainstorming, or documentation mode.
- **Supported in**: Copilot Chat (VS Code, Visual Studio, GitHub.com),
  Copilot Coding Agent, Copilot Code Review, inline completions.
- **AGENTS.md** is natively read and applied to all chat requests.

### Directory Structure Example

```
.github/
  copilot-instructions.md
  instructions/
    api.instructions.md
    tests.instructions.md
  prompts/
    build.prompt.md
    deploy.prompt.md
  agents/
    reviewer.agent.md
    architect.agent.md
  chatmodes/
    strict-review.chatmode.md
    brainstorm.chatmode.md
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Main instructions | `.github/copilot-instructions.md` | `templates/copilot/copilot-instructions.md` |
| Path instructions (4) | `.github/instructions/*.md` | `templates/copilot/instructions/` |
| Prompt files (19) | `.github/prompts/*.prompt.md` | `commands.yaml` (non-team commands) |
| Custom agents (19) | `.github/agents/*.agent.md` | `agents.yaml` |
| Chat modes (10) | `.github/chatmodes/*.chatmode.md` | `teams.yaml` |

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| Repo-wide instructions | ✅ Auto-applied to all sessions | ✅ Generated | None |
| Path-specific instructions | ✅ Glob-targeted | ✅ 4 generated | Could add more per language/framework |
| Prompt files | ✅ Slash commands with YAML frontmatter | ✅ 19 generated | None |
| Custom agents | ✅ Specialist personas with tools | ✅ 19 generated | None |
| Chat modes | ✅ Interaction style customization | ✅ 10 generated | None |
| AGENTS.md support | ✅ Auto-detected | ✅ Always generated | None |
| Personal instructions | ✅ `$HOME/.copilot/` | ❌ Not generated | User-level, not project-scoped |
| Organization-wide instructions | ✅ Org-level emerging | ❌ Not generated | Requires GitHub org admin setup |
| Copilot Coding Agent config | ✅ Autonomous multi-file edits | ⚠️ Via AGENTS.md only | Could add coding agent-specific prompts |
| Code Review integration | ✅ Custom review instructions | ⚠️ Not explicitly targeted | Could add review-specific prompt files |

**Summary:** GitHub Copilot is comprehensively supported. Minor gaps in
organization-wide instructions and specialized coding agent / code review prompts.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 78/100 ⭐⭐⭐⭐ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions) |
| Developer Experience | 86/100 ⭐⭐⭐⭐½ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--ide-extensions) |
| Cost & Value | 72/100 ⭐⭐⭐½ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--ide-extensions) |
| Customization | 76/100 ⭐⭐⭐⭐ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--ide-extensions) |
| Privacy & Security | 74/100 ⭐⭐⭐½ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--ide-extensions) |
| Team & Enterprise | 88/100 ⭐⭐⭐⭐½ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--ide-extensions) |
| **Weighted Total** | **79/100 ⭐⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Enterprise teams (50+ devs)** — best admin, SSO, audit, and policy controls
- **GitHub-centric workflows** — native issues → PRs → CI → deploy integration
- **Lowest-friction adoption** — "it just works" with one-click install
- **Teams wanting IDE + Coding Agent + Code Review** in a single subscription
- **Organizations needing compliance** — SOC 2, ISO 27001, GDPR

### Not Ideal For

- **Teams wanting model flexibility** — locked to GitHub-provided models
- **MCP/tool integration** — no MCP support yet
- **Budget-zero teams** — no meaningful free tier

---

## References

- [Use custom instructions in VS Code](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
- [Adding repository custom instructions for GitHub Copilot](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot)
- [Copilot coding agent supports AGENTS.md](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/)
- [GitHub Copilot Customization: Instructions, Prompts, Agents and Skills](https://blog.cloud-eng.nl/2025/12/22/copilot-customization/)
- [Copilot DevOps Excellence: Prompt Files vs Instructions vs Chat Modes](https://azurewithaj.com/github-copilot-prompt-instructions-chatmodes/)
- [All About GitHub Copilot Custom Instructions](https://www.nathannellans.com/post/all-about-github-copilot-custom-instructions)
- [GitHub Copilot Instructions Guide — design.dev](https://design.dev/guides/copilot-instructions/)
- [Awesome GitHub Copilot Customizations repo](https://developer.microsoft.com/blog/introducing-awesome-github-copilot-customizations-repo)
