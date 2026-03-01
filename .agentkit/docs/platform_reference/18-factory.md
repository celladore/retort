# Factory

**Render target:** _(via AGENTS.md — no dedicated render target)_

| | |
|---|---|
| **Type** | Autonomous Cloud Coding Platform |
| **Categories** | Cloud / Autonomous Agent |
| **Access** | Web dashboard — [factory.ai](https://www.factory.ai/) — requires account and GitHub/GitLab repo access |
| **Documentation** | [docs.factory.ai](https://docs.factory.ai/) |
| **Performance Rating** | ⭐⭐⭐½ — **72/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cloud--autonomous-agents)) |

---

## Platform Overview

Factory is an autonomous AI coding platform that handles end-to-end software
development tasks including bug fixes, feature development, code reviews, and
migrations. It natively supports `AGENTS.md` for project context.

Factory operates as a cloud-based autonomous agent, reading project instructions
from `AGENTS.md` and working directly with your Git repositories.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project instructions | `AGENTS.md` (repo root) | Plain Markdown |
| Factory config | Factory dashboard | Web UI |

### Key Capabilities

- **AGENTS.md native**: Reads for project context, conventions, and workflows.
- **Autonomous development**: End-to-end bug fixes, feature implementation.
- **Code review**: Automated PR review with style and security checks.
- **Migration support**: Automated dependency upgrades and framework migrations.
- **CI/CD awareness**: Understands and respects existing CI/CD pipelines.
- **Git integration**: Creates branches, commits, and pull requests.
- **Enterprise**: Organization-wide policies and guardrails.

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Agent instructions | `AGENTS.md` | Always generated from `project.yaml` |

Factory reads the universal `AGENTS.md`. No platform-specific files needed.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| AGENTS.md | ✅ Native support | ✅ Always generated | None |
| Dashboard config | ✅ Web UI configuration | N/A | Platform-managed, not file-based |
| Organization policies | ✅ Enterprise guardrails | ❌ Not generated | Could document best practices |

**Summary:** Factory is fully served by the universal `AGENTS.md`. Its
configuration is primarily dashboard-based, with `AGENTS.md` providing
the project-level context. Ensure AGENTS.md is comprehensive with build,
test, and deployment information for best results.

---

## Recommendations

- Ensure `AGENTS.md` includes comprehensive build, test, and deployment commands.
- Document CI/CD pipeline configuration for Factory's awareness.
- Include migration context if using Factory for dependency upgrades.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 72/100 ⭐⭐⭐½ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cloud--autonomous-agents) |
| Developer Experience | 57/100 ⭐⭐⭐ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--cloud--autonomous-agents) |
| Cost & Value | 38/100 ⭐⭐ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--cloud--autonomous-agents) |
| Customization | 47/100 ⭐⭐½ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--cloud--autonomous-agents) |
| Privacy & Security | 52/100 ⭐⭐½ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--cloud--autonomous-agents) |
| Team & Enterprise | 71/100 ⭐⭐⭐½ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--cloud--autonomous-agents) |
| **Weighted Total** | **57/100 ⭐⭐⭐** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Enterprise-scale autonomous development** — end-to-end SDLC automation
- **Automated code reviews** — PR review with style and security checks
- **Code migration projects** — automated dependency upgrades, framework migrations
- **Organizations already invested in autonomous tooling** as part of their pipeline

### Not Ideal For

- **Individuals or small teams** — enterprise sales model, no free tier
- **Budget-conscious organizations** — custom pricing, likely premium
- **Teams wanting transparency** — dashboard-driven, limited file-based config
- **Interactive coding** — designed for autonomous, not collaborative, workflows

---

## References

- [Factory — Autonomous AI coding](https://www.factory.ai/)
- [Factory documentation](https://docs.factory.ai/)
- [AGENTS.md open standard](https://agents.md/)
