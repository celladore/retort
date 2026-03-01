# Cursor IDE

**Render target:** `cursor`

| | |
|---|---|
| **Type** | AI-Native Code Editor (VS Code fork) |
| **Categories** | AI-Native IDE |
| **Access** | Desktop app — download from [cursor.com](https://cursor.com/) (macOS, Windows, Linux) |
| **Documentation** | [docs.cursor.com](https://docs.cursor.com/) |
| **Performance Rating** | ⭐⭐⭐⭐ — **77/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ai-native-ides)) |

---

## Platform Overview

Cursor IDE is an AI-native code editor that uses `.cursor/rules/` for persistent
project rules and `.cursor/commands/` for custom slash commands. Rules use the
`.mdc` format (Markdown with YAML frontmatter) and support context-aware activation.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Rules | `.cursor/rules/*.mdc` | MDC (YAML frontmatter + Markdown) |
| Commands | `.cursor/commands/*.md` | Plain Markdown |
| Legacy rules | `.cursorrules` (deprecated) | Plain text |

### Key Capabilities

- **Rich activation controls** in YAML frontmatter: `description`, `globs`,
  `alwaysApply`.
- **Auto context loading**: Rules are loaded into AI context for relevant
  files or scenarios based on glob patterns.
- **Manual and on-demand**: Reference rule names with `@rule-name` in chat.
- **Folder scoping**: `.cursor/rules/` can appear in subfolders for
  monorepo/microservice layouts.
- **Composability**: Split large policy sets into multiple modular rule files.
- **Commands (Cursor 1.6+)**: `.cursor/commands/*.md` for slash commands,
  analogous to Claude commands.

### Rule File Anatomy

Each rule file uses the `.mdc` extension with YAML frontmatter:

```yaml
---
description: "Core TypeScript standards"
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---
# Actual rule content, guidelines, examples, etc.
```

### How Rules Are Triggered

- **Always Apply**: Loaded for all AI sessions if set (`alwaysApply: true`).
- **Auto Attach by Glob**: Loaded when working on files that match `globs`.
- **Manual**: Invoked via commands or by referencing with `@rule-name` in chat.
- **AI Decision**: The agent can decide to apply rules based on description relevance.

### Directory Structure Example

```
.cursor/
  rules/
    typescript-standards.mdc
    react-patterns.mdc
    api-guidelines.mdc
    frontend/
      components.mdc
  commands/
    build.md
    test.md
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Project context rule | `.cursor/rules/project-context.mdc` | `templates/cursor/rules/` |
| Security rule | `.cursor/rules/security.mdc` | `templates/cursor/rules/` |
| Orchestrate rule | `.cursor/rules/orchestrate.mdc` | `templates/cursor/rules/` |
| Team rules (10) | `.cursor/rules/team-*.mdc` | `teams.yaml` |
| Commands (19) | `.cursor/commands/*.md` | `commands.yaml` (non-team commands) |

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| Rules (.mdc) | ✅ Rich YAML frontmatter + Markdown | ✅ 13 rules generated | None |
| Commands | ✅ Slash commands (Cursor 1.6+) | ✅ 19 generated | None |
| Glob-based activation | ✅ In rule frontmatter | ✅ Used in generated rules | None |
| `alwaysApply` flag | ✅ For global rules | ✅ Used where appropriate | None |
| Subfolder rules | ✅ Monorepo support | ❌ Not generated | Generate per-package rules in monorepos |
| `@rule-name` references | ✅ Manual invocation | ⚠️ Not documented in output | Add usage docs to generated rules |
| Dynamic rule activation | ✅ AI-decided based on description | ✅ Descriptions included | None |
| Project/user/team hierarchy | ✅ User → project → team | ⚠️ Project only | Could document user-level rules setup |
| AGENTS.md support | ✅ Recognized | ✅ Always generated | None |
| Legacy `.cursorrules` | ⚠️ Deprecated | ❌ Not generated | Correct — deprecated format should not be generated |

**Summary:** Cursor IDE is well-supported. Primary gap is subfolder rules for
monorepo layouts. The `.mdc` format with YAML frontmatter is fully utilized.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 77/100 ⭐⭐⭐⭐ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ai-native-ides) |
| Developer Experience | 84/100 ⭐⭐⭐⭐ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--ai-native-ides) |
| Cost & Value | 68/100 ⭐⭐⭐½ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--ai-native-ides) |
| Customization | 79/100 ⭐⭐⭐⭐ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--ai-native-ides) |
| Privacy & Security | 63/100 ⭐⭐⭐ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--ai-native-ides) |
| Team & Enterprise | 63/100 ⭐⭐⭐ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--ai-native-ides) |
| **Weighted Total** | **74/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Developers who want AI woven into every IDE interaction** — inline completions, Composer, chat
- **Teams with project-specific coding standards** — `.mdc` rules with glob activation are powerful
- **VS Code users** ready to switch to a dedicated AI-native editor
- **Fast prototyping and iteration** with Composer multi-file mode

### Not Ideal For

- **Teams that need to stay in VS Code** — Cursor is a fork, not an extension
- **Budget-constrained teams** at $40/seat/mo for Business tier
- **Enterprise governance** — fewer admin controls than Copilot

---

## References

- [Cursor official documentation — Rules](https://cursor.com/docs/context/rules)
- [Cursor Rules Guide — design.dev](https://design.dev/guides/cursor-rules/)
- [Setting Up Cursor Rules — DEV Community](https://dev.to/stamigos/setting-up-cursor-rules-the-complete-guide-to-ai-enhanced-development-24cg)
- [Cursor IDE Rules Deep Dive — Mervin Praison](https://mer.vin/2025/12/cursor-ide-rules-deep-dive/)
- [Using Cursor Rules Effectively — cursor.fan](https://cursor.fan/tutorial/HowTo/using-cursor-rules-effectively/)
- [AI Rules and Configuration — DeepWiki](https://deepwiki.com/getcursor/docs/4.3-ai-rules-and-configuration)
