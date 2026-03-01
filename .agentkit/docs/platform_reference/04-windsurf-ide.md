# Windsurf IDE

**Render target:** `windsurf`

| | |
|---|---|
| **Type** | AI-Native Code Editor (Cascade AI) |
| **Categories** | AI-Native IDE |
| **Access** | Desktop app — download from [windsurf.com](https://windsurf.com/) (macOS, Windows, Linux) |
| **Documentation** | [docs.windsurf.com](https://docs.windsurf.com/) |
| **Performance Rating** | ⭐⭐⭐½ — **69/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ai-native-ides)) |

---

## Platform Overview

Windsurf IDE (Cascade AI) uses `.windsurf/rules/` for project rules,
`.windsurf/commands/` for custom commands, and `.windsurf/workflows/` for
multi-step automation sequences. It supports over 70 languages out of the box.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Rules | `.windsurf/rules/*.md` | Plain Markdown |
| Commands | `.windsurf/commands/*.md` | Plain Markdown |
| Workflows | `.windsurf/workflows/*.yml` | YAML |
| Legacy rules | `.windsurfrules` (deprecated) | Plain text |

### Key Capabilities

- **Global and workspace scoping**: Project-level `.windsurf/rules/` or
  `~/.config/windsurf/` for global rules.
- **Activation modes**: Always, manually, by file globs, or model decision.
- **Coding style enforcement**: Linter integration, line length, naming,
  formatting tools (Black, Prettier, Ruff, etc.).
- **AI behavior directives**: Explain decisions, check existing code,
  propose strategy before writing.
- **Workflows and Memories**: Predefined multi-step sequences (build, test,
  deploy) and context auto-learned from usage.
- **70+ language support** out of the box.
- **MCP integration** for external tool connections via JSON or YAML.
- **Version control friendly**: Rules are text-based and intended to be committed.

### Directory Structure Example

```
.windsurf/
  rules/
    project.md
    security.md
    typescript.md
    team-frontend.md
  commands/
    build.md
    deploy.md
  workflows/
    ci-check.yml
    release.yml
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Project context rule | `.windsurf/rules/project.md` | `templates/windsurf/rules/` |
| Security rule | `.windsurf/rules/security.md` | `templates/windsurf/rules/` |
| Orchestrate rule | `.windsurf/rules/orchestrate.md` | `templates/windsurf/rules/` |
| Team rules (10) | `.windsurf/rules/team-*.md` | `teams.yaml` |
| Commands (19) | `.windsurf/commands/*.md` | `commands.yaml` (non-team commands) |
| Workflows (2) | `.windsurf/workflows/*.yml` | `templates/windsurf/workflows/` |

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| Rules (.md) | ✅ Plain Markdown | ✅ 13 rules generated | None |
| Commands | ✅ Custom commands | ✅ 19 generated | None |
| Workflows (.yml) | ✅ Multi-step YAML sequences | ✅ 2 generated | Could expand workflow coverage |
| Activation modes | ✅ Always / manual / glob / model | ⚠️ Implicit in rules | Could add explicit activation metadata |
| Global rules | ✅ `~/.config/windsurf/` | ❌ Not generated | User-level, not project-scoped |
| Memories system | ✅ Auto-learned context | ❌ Not generated | Platform-managed, not file-based |
| AI behavior directives | ✅ Explain, check, propose | ⚠️ Partial in rules | Could add explicit AI behavior sections |
| MCP integration | ✅ JSON/YAML tool connections | ❌ Not generated | Add MCP config generation |
| AGENTS.md support | ⚠️ Not documented | ✅ Always generated | Windsurf may not read AGENTS.md natively |
| Legacy `.windsurfrules` | ⚠️ Deprecated | ❌ Not generated | Correct — deprecated format |

**Summary:** Windsurf is well-supported for rules and commands. Gaps exist in
workflow expansion, MCP configuration, and explicit AI behavior directives.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 69/100 ⭐⭐⭐½ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ai-native-ides) |
| Developer Experience | 77/100 ⭐⭐⭐⭐ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--ai-native-ides) |
| Cost & Value | 73/100 ⭐⭐⭐½ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--ai-native-ides) |
| Customization | 62/100 ⭐⭐⭐ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--ai-native-ides) |
| Privacy & Security | 55/100 ⭐⭐⭐ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--ai-native-ides) |
| Team & Enterprise | 51/100 ⭐⭐½ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--ai-native-ides) |
| **Weighted Total** | **68/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Cursor alternative at a lower price point** — $15/mo vs $20/mo
- **Teams that value Cascade's flow-based AI** and Memories system
- **Multi-language projects** with 70+ language support out of the box
- **Workflow automation** via `.windsurf/workflows/` YAML sequences

### Not Ideal For

- **Teams requiring AGENTS.md support** — not documented as supported natively
- **Enterprise buyers** — fewer governance and admin features
- **Advanced customization** — fewer activation controls than Cursor

---

## References

- [Windsurf Cascade documentation](https://docs.windsurf.com/windsurf/cascade)
- [Windsurf Rules Guide — design.dev](https://design.dev/guides/windsurf-rules/)
- [Windsurf Rules & Workflows best practices](https://www.paulmduvall.com/using-windsurf-rules-workflows-and-memories/)
- [AI Coding Assistant Rules for Windsurf and Cursor](https://deeplearning.fr/ai-coding-assistant-rules-for-windsurf-and-cursor/)
- [Windsurf AI Rules: A Guide to Prompting](https://uibakery.io/blog/windsurf-ai-rules)
- [Community-contributed rule sets](https://www.dotwindsurfrules.com/)
- [Real-world configuration examples](https://github.com/anthony-hopkins/windsurf_rules)
