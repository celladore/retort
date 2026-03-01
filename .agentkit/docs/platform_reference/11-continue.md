# Continue

**Render target:** `ai`

| | |
|---|---|
| **Type** | AI Coding Assistant (IDE extension, open-source) |
| **Categories** | IDE Extension |
| **Access** | VS Code / JetBrains extension — install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Continue.continue) or [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/22707-continue) |
| **Documentation** | [docs.continue.dev](https://docs.continue.dev/) |
| **Performance Rating** | ⭐⭐⭐ — **61/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions)) |

---

## Platform Overview

Continue (continue.dev) is an open-source AI coding assistant for VS Code and
JetBrains. It uses `.continue/rules/` for project rules and supports a rich
ecosystem of shareable rule sets. Continue can render rules for multiple
target formats (Cursor, Claude, Copilot, Codex, Cody).

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project rules | `.continue/rules/*.md` | Markdown with optional YAML frontmatter |
| Hub/org rules | Continue Mission Control | Managed dashboard |
| Portable rules | `.continuerules` | Plain text |
| Cross-tool rules | `.cursorrules`, `.windsurfrules` | Auto-detected |

### Key Capabilities

- **Local rules** in `.continue/rules/` — version-controlled, project-specific.
- **Hub/organization rules** for cross-project enforcement via dashboard.
- **YAML frontmatter** for categorization: `title`, `objective`, `severity`,
  `applies` (glob patterns).
- **Severity levels**: `block` (hard enforcement) or `warn` (soft guidance).
- **Format conversion**: The rules CLI can render rules for Cursor, Claude,
  Copilot, Cody, Codex, and more.
- **Multi-model support**: Assign different rules to distinct models, tasks,
  or agents. Works with local and remote LLMs (Ollama, Azure, AWS).
- **UI + CLI**: Visual Studio Code extension GUI and `rules-cli` for
  downloading, rendering, and publishing rule sets.

### Directory Structure Example

```
.continue/
  rules/
    typescript-standards.md
    security-policy.md
    testing-requirements.md
  config.json
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Continue rules | `.ai/continuerules` | `templates/ai/continuerules` |
| Cursor rules | `.ai/cursorrules` | `templates/ai/cursorrules` |
| Windsurf rules | `.ai/windsurfrules` | `templates/ai/windsurfrules` |

These are portable rule files that work across multiple IDEs.

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| .continue/rules/ directory | ✅ Project-specific rules | ❌ Not generated | Generate rules in .continue/rules/ format |
| Portable rules files | ✅ Multi-format | ✅ 3 portable files generated | None |
| YAML frontmatter | ✅ title, objective, severity, applies | ❌ Not in portable files | Add frontmatter to generated rules |
| Severity levels | ✅ block / warn | ❌ Not used | Could classify rules by severity |
| Hub/org rules | ✅ Managed dashboard | ❌ Not applicable | Platform-managed feature |
| Format conversion | ✅ Multi-target rendering | N/A | Continue can render from any format |
| config.json | ✅ Model/provider config | ❌ Not generated | Could generate config.json |
| AGENTS.md support | ⚠️ Not directly | ✅ Always generated | Continue uses own rule system |

**Summary:** Continue is supported via portable rule files. Key gap is not
generating rules in the native `.continue/rules/` directory format with
YAML frontmatter. The portable format works but misses Continue-specific features.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 61/100 ⭐⭐⭐ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--ide-extensions) |
| Developer Experience | 68/100 ⭐⭐⭐½ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--ide-extensions) |
| Cost & Value | 76/100 ⭐⭐⭐⭐ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--ide-extensions) |
| Customization | 72/100 ⭐⭐⭐½ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--ide-extensions) |
| Privacy & Security | 64/100 ⭐⭐⭐ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--ide-extensions) |
| Team & Enterprise | 50/100 ⭐⭐½ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--ide-extensions) |
| **Weighted Total** | **66/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Model-agnostic teams** — best model flexibility; any provider, local or remote
- **JetBrains users** — one of few AI assistants with strong JetBrains support
- **Teams using multiple tools** — can render rules for Cursor, Claude, Copilot, Cody
- **Organizations wanting managed rules** — Mission Control Hub for cross-project enforcement

### Not Ideal For

- **Teams needing maximum coding performance** — quality depends heavily on model choice
- **Full agentic workflows** — primarily a copilot, not an autonomous agent
- **Teams needing AGENTS.md** — uses own rules system without direct AGENTS.md support

---

## References

- [Continue — Rules documentation](https://docs.continue.dev/customize/rules)
- [Awesome Rules — Curated rule collection](https://github.com/continuedev/awesome-rules)
- [Rules CLI Tool — GitHub](https://github.com/continuedev/rules)
- [Configuration Interface — DeepWiki](https://deepwiki.com/continuedev/continue/6.2-configuration-interface)
