# Google Gemini CLI

**Render target:** `gemini`

| | |
|---|---|
| **Type** | AI Coding Agent (CLI) |
| **Categories** | CLI Agent |
| **Access** | CLI tool — `npm install -g @google/gemini-cli` or see [installation guide](https://google-gemini.github.io/gemini-cli/docs/get-started/) |
| **Documentation** | [google-gemini.github.io/gemini-cli](https://google-gemini.github.io/gemini-cli/) |
| **Performance Rating** | ⭐⭐⭐½ — **73/100** ([details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents)) |

---

## Platform Overview

Google Gemini CLI and Gemini Code Assist use `GEMINI.md` for project context
and the `.gemini/` directory for configuration, style guides, and code review
settings. The CLI supports a hierarchical configuration system with project,
global, and environment-level settings.

---

## Native Configuration

| Feature | Location | Format |
|---------|----------|--------|
| Project context | `GEMINI.md` (repo root) | Plain Markdown |
| Style guide | `.gemini/styleguide.md` | Plain Markdown |
| Settings | `.gemini/settings.json` | JSON |
| Config | `.gemini/config.yaml` | YAML |
| Ignore patterns | `.gemini/.geminiignore` | Gitignore-style patterns |
| Global context | `~/.gemini/GEMINI.md` | Plain Markdown |
| Global settings | `~/.gemini/settings.json` | JSON |
| Sandbox config | `.gemini/sandbox.dockerfile` | Dockerfile |

### Key Capabilities

- **GEMINI.md** files supply persistent, reusable context. Can be placed
  globally (`~/.gemini/GEMINI.md`), at workspace level, or per-directory.
- **Hierarchical context**: CLI concatenates all relevant `GEMINI.md` files
  and supplies them automatically with each prompt.
- **Settings hierarchy**: Global → Project → Environment variables → CLI args.
- **Supported settings**: theme, vimMode, autoAccept, sandbox mode,
  includeDirectories, checkpointing, model, temperature, maxTokens.
- **MCP integration**: Custom tool integrations via Model Context Protocol
  (remote or local servers).
- **Slash commands**: `/stats`, `/tools`, `/memory` for workflow automation.
- **Sandboxing**: Docker-based execution sandboxing for safe code execution.
- **Telemetry controls**: Opt-in usage statistics with strict privacy controls.

### Configuration Hierarchy

```
Priority (highest to lowest):
1. Command-line arguments
2. Environment variables ($GEMINI_API_KEY, etc.)
3. Project: .gemini/settings.json
4. Global: ~/.gemini/settings.json
5. System: /etc/gemini-cli/settings.json
```

### Example settings.json

```json
{
  "theme": "GitHub",
  "vimMode": true,
  "autoAccept": false,
  "sandbox": "docker",
  "includeDirectories": ["../shared-lib"],
  "checkpointing": { "enabled": true },
  "fileFiltering": { "respectGitIgnore": true },
  "model": "gemini-2.5-flash"
}
```

---

## What AgentKit Forge Generates

| Output | Path | Source |
|--------|------|--------|
| Root instructions | `GEMINI.md` | `templates/gemini/GEMINI.md` + `project.yaml` |
| Style guide | `.gemini/styleguide.md` | `templates/gemini/styleguide.md` + `project.yaml` |
| Config | `.gemini/config.yaml` | Code review settings |

---

## Gap Analysis

| Feature | Platform Supports | AgentKit Forge Status | Gap |
|---------|------------------|----------------------|-----|
| GEMINI.md | ✅ Hierarchical context | ✅ Generated (root) | None |
| Style guide | ✅ `.gemini/styleguide.md` | ✅ Generated | None |
| settings.json | ✅ Rich configuration | ❌ Not generated | Generate project-level settings.json |
| config.yaml | ✅ Additional config | ✅ Generated | None |
| .geminiignore | ✅ File filtering | ❌ Not generated | Generate ignore patterns |
| Per-directory GEMINI.md | ✅ Hierarchical | ❌ Not generated | Generate per-package in monorepos |
| Sandbox config | ✅ Docker sandbox | ❌ Not generated | Could generate sandbox.dockerfile |
| MCP integration | ✅ Tool connections | ❌ Not generated | Add MCP server config |
| Slash commands | ✅ Built-in | N/A | Platform feature, no config needed |
| AGENTS.md support | ⚠️ Not documented | ✅ Always generated | Gemini reads GEMINI.md, not AGENTS.md |

**Summary:** Core generation is solid. Key gaps are `settings.json` generation,
`.geminiignore` patterns, and MCP configuration.

---

## Consolidated Rating

| Dimension | Score | Details |
|-----------|-------|---------|
| Coding Performance | 73/100 ⭐⭐⭐½ | [details](./PLATFORM_CODING_PERFORMANCE.md#category-matrix--cli-agents) |
| Developer Experience | 73/100 ⭐⭐⭐½ | [details](./PLATFORM_DEVELOPER_EXPERIENCE.md#category-matrix--cli-agents) |
| Cost & Value | 83/100 ⭐⭐⭐⭐ | [details](./PLATFORM_COST_ANALYSIS.md#category-matrix--cli-agents) |
| Customization | 59/100 ⭐⭐⭐ | [details](./PLATFORM_CUSTOMIZATION.md#category-matrix--cli-agents) |
| Privacy & Security | 59/100 ⭐⭐⭐ | [details](./PLATFORM_PRIVACY_SECURITY.md#category-matrix--cli-agents) |
| Team & Enterprise | 50/100 ⭐⭐½ | [details](./PLATFORM_TEAM_ENTERPRISE.md#category-matrix--cli-agents) |
| **Weighted Total** | **71/100 ⭐⭐⭐½** | [methodology](./PLATFORM_CONSOLIDATED_RATING.md#decision-dimensions--weights) |

### Best For

- **Budget-conscious developers** — most generous free tier of any CLI agent
- **Google ecosystem users** already in the Gemini/Google Cloud world
- **Fast inference needs** — Google infrastructure provides low latency
- **Pairing with paid agents** — use Gemini CLI for routine tasks, save Claude Code for complex work

### Not Ideal For

- **Teams needing model flexibility** — Gemini models only
- **Deep customization** — fewer activation controls than Claude Code or Codex
- **Enterprise governance** — limited admin and team features

---

## References

- [Gemini CLI official configuration docs](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html)
- [GEMINI.md usage — GitHub](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md)
- [Gemini CLI configuration reference](https://geminicli.com/docs/reference/configuration/)
- [Google Gemini CLI Cheatsheet](https://www.philschmid.de/gemini-cli-cheatsheet)
- [settings.json configuration breakdown — DeepWiki](https://deepwiki.com/addyosmani/gemini-cli-tips/5.2-settings.json-configuration)
- [Google Cloud Gemini CLI reference](https://docs.cloud.google.com/gemini/docs/codeassist/gemini-cli)
- [The Complete Google Gemini CLI Cheat Sheet and Guide](https://www.howtouselinux.com/post/the-complete-google-gemini-cli-cheat-sheet-and-guide)
