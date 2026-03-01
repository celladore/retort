# Platform Reference Guide

Comprehensive reference for every AI coding platform supported by AgentKit Forge.
Each platform has its own detailed document covering native configuration,
what AgentKit Forge generates, gap analysis, and integration recommendations.

> **Tip:** Use `agentkit add <tool>` / `agentkit remove <tool>` to manage which
> platforms are active. See [TOOLS.md](../TOOLS.md) for the quick-reference table.

---

## Platform Categories

| Category | Description | Platforms |
|----------|-------------|-----------|
| **AI-Native IDE** | Full editor or terminal with built-in AI | Cursor, Windsurf, Warp, Trae, Qoder, Nimbalyst, Zed, PearAI, Void |
| **IDE Extension** | AI extension for existing IDEs (VS Code, JetBrains) | Copilot, Cline, Roo Code, Continue, Cody, Amazon Q, Junie, Tabnine, Augment Code, Supermaven, Codeium |
| **CLI Agent** | Terminal-based AI coding agent | Claude Code, Codex, Gemini CLI, Aider, Amp, OpenCode, Jules Tools |
| **Cloud / Autonomous Agent** | Fully autonomous cloud-hosted coding agent | Jules, Factory, Codex (Cloud), Copilot (Coding Agent), Devin |
| **Vibe Coding / App Builder** | Prompt-to-app platforms for rapid prototyping | Bolt.new, Lovable, Replit Agent, Vercel v0, Same.new |
| **Universal Standard** | Cross-platform instruction specification | AGENTS.md |

> Platforms may appear in multiple categories. See each platform doc for details.

---

## Supported Platforms

| # | Platform | Categories | Rating | Render Target | Document |
|---|----------|------------|--------|---------------|----------|
| 1 | [AGENTS.md](./01-agents-md.md) | Universal Standard | N/A | _(always generated)_ | Universal agent instruction file |
| 2 | [Claude Code](./02-claude-code.md) | CLI Agent | ⭐⭐⭐⭐½ 89 | `claude` | Anthropic's AI coding agent |
| 3 | [Cursor IDE](./03-cursor-ide.md) | AI-Native IDE | ⭐⭐⭐⭐ 77 | `cursor` | AI-native code editor |
| 4 | [Windsurf IDE](./04-windsurf-ide.md) | AI-Native IDE | ⭐⭐⭐½ 69 | `windsurf` | Cascade AI editor |
| 5 | [GitHub Copilot](./05-github-copilot.md) | IDE Extension, Cloud Agent | ⭐⭐⭐⭐ 78 | `copilot` | Microsoft/GitHub AI assistant |
| 6 | [Google Gemini CLI](./06-google-gemini-cli.md) | CLI Agent | ⭐⭐⭐½ 73 | `gemini` | Google's AI coding CLI |
| 7 | [OpenAI Codex](./07-openai-codex.md) | CLI Agent, Cloud Agent | ⭐⭐⭐⭐ 79 | `codex` | OpenAI's coding agent |
| 8 | [Warp Terminal](./08-warp-terminal.md) | AI-Native IDE | ⭐⭐⭐ 63 | `warp` | AI-native terminal |
| 9 | [Cline](./09-cline.md) | IDE Extension | ⭐⭐⭐½ 73 | `cline` | Open-source AI assistant |
| 10 | [Roo Code](./10-roo-code.md) | IDE Extension | ⭐⭐⭐½ 73 | `roo` | Open-source AI assistant (Cline fork) |
| 11 | [Continue](./11-continue.md) | IDE Extension | ⭐⭐⭐ 61 | `ai` | Open-source AI assistant |
| 12 | [Google Jules](./12-google-jules.md) | Cloud Agent, CLI Agent | ⭐⭐⭐½ 71 | _(via AGENTS.md)_ | Google's autonomous coding agent + CLI |
| 13 | [Amazon Q Developer](./13-amazon-q-developer.md) | IDE Extension | ⭐⭐⭐½ 70 | _(via AGENTS.md)_ | AWS AI coding assistant |
| 14 | [Sourcegraph Cody](./14-sourcegraph-cody.md) | IDE Extension | ⭐⭐⭐½ 68 | _(via AGENTS.md)_ | Code intelligence AI assistant |
| 15 | [Aider](./15-aider.md) | CLI Agent | ⭐⭐⭐⭐ 76 | _(via AGENTS.md)_ | Open-source AI pair programming |
| 16 | [Amp](./16-amp.md) | CLI Agent | ⭐⭐⭐½ 72 | _(via AGENTS.md)_ | Sourcegraph's coding agent |
| 17 | [OpenCode](./17-opencode.md) | CLI Agent | ⭐⭐⭐ 56 | _(via AGENTS.md)_ | Open-source terminal AI |
| 18 | [Factory](./18-factory.md) | Cloud Agent | ⭐⭐⭐½ 72 | _(via AGENTS.md)_ | Autonomous coding platform |
| 19 | [Trae IDE](./19-trae-ide.md) | AI-Native IDE | ⭐⭐⭐½ 72 | _(via AGENTS.md)_ | ByteDance's free AI code editor |
| 20 | [Qoder IDE](./20-qoder-ide.md) | AI-Native IDE | ⭐⭐⭐½ 70 | _(via AGENTS.md)_ | Alibaba's agentic coding platform |
| 21 | [Nimbalyst](./21-nimbalyst.md) | AI-Native IDE | ⭐⭐⭐ 58 | _(via AGENTS.md)_ | Claude Code session manager |
| 22 | [JetBrains Junie](./22-jetbrains-junie.md) | IDE Extension | ⭐⭐⭐⭐ 76 | _(via AGENTS.md)_ | JetBrains AI coding agent |
| 23 | [Tabnine](./23-tabnine.md) | IDE Extension | ⭐⭐⭐½ 68 | _(via AGENTS.md)_ | Privacy-first AI assistant |
| 24 | [Augment Code](./24-augment-code.md) | IDE Extension | ⭐⭐⭐⭐ 75 | _(via AGENTS.md)_ | Enterprise context engine |
| 25 | [Devin](./25-devin.md) | Cloud Agent | ⭐⭐⭐½ 70 | _(via AGENTS.md)_ | Autonomous AI software engineer |
| 26 | [Bolt.new](./26-bolt-new.md) | Vibe Coding | ⭐⭐⭐½ 68 | _(via AGENTS.md)_ | Prompt-to-app builder |
| 27 | [Lovable](./27-lovable.md) | Vibe Coding | ⭐⭐⭐½ 66 | _(via AGENTS.md)_ | Natural language to full-stack app |
| 28 | [Replit Agent](./28-replit-agent.md) | AI-Native IDE, Vibe Coding | ⭐⭐⭐½ 67 | _(via AGENTS.md)_ | Cloud IDE + autonomous agent |
| 29 | [Vercel v0](./29-vercel-v0.md) | Vibe Coding | ⭐⭐⭐ 62 | _(via AGENTS.md)_ | AI UI component generator |
| 30 | [Zed Editor](./30-zed-editor.md) | AI-Native IDE | ⭐⭐⭐½ 71 | _(via AGENTS.md)_ | Rust-based AI editor |
| 31 | [PearAI](./31-pearai.md) | AI-Native IDE | ⭐⭐⭐½ 68 | _(via AGENTS.md)_ | Open-source bundled AI editor |
| 32 | [Void Editor](./32-void-editor.md) | AI-Native IDE | ⭐⭐⭐ 60 | _(via AGENTS.md)_ | Privacy-first open-source AI editor |
| 33 | [Supermaven](./33-supermaven.md) | IDE Extension | ⭐⭐⭐½ 70 | _(via AGENTS.md)_ | 1M-token context completions |
| 34 | [Codeium](./34-codeium.md) | IDE Extension | ⭐⭐⭐½ 67 | _(via AGENTS.md)_ | Free AI completions engine |
| 35 | [Same.new](./35-same-new.md) | Vibe Coding | ⭐⭐⭐½ 66 | _(via AGENTS.md)_ | Prompt-to-app + URL cloning |

---

## Platform Comparison Matrix

| Capability | Claude | Cursor | Windsurf | Copilot | Gemini | Codex | Warp | Cline | Roo | Continue |
|------------|--------|--------|----------|---------|--------|-------|------|-------|-----|----------|
| Root instructions file | CLAUDE.md | — | — | copilot-instructions.md | GEMINI.md | AGENTS.md | WARP.md | — | — | — |
| Rules directory | .claude/rules/ | .cursor/rules/ | .windsurf/rules/ | .github/instructions/ | .gemini/ | — | — | .clinerules/ | .roo/rules/ | .continue/rules/ |
| Commands/prompts | .claude/commands/ | .cursor/commands/ | .windsurf/commands/ | .github/prompts/ | — | — | — | — | — | — |
| Skills | .claude/skills/ | — | — | — | — | .agents/skills/ | — | — | — | — |
| Agents/personas | .claude/agents/ | — | — | .github/agents/ | — | — | — | — | — | — |
| Team modes | team commands | team rules (.mdc) | team rules (.md) | .github/chatmodes/ | — | — | — | — | mode-specific rules | — |
| Hooks/automation | .claude/hooks/ | — | .windsurf/workflows/ | — | — | — | — | — | — | — |
| Settings/config | settings.json | frontmatter | — | — | settings.json + config.yaml | config.toml | Warp UI | Cline UI | profiles | config.json |
| AGENTS.md support | ✓ | ✓ | — | ✓ | — | ✓ (primary) | ✓ (primary) | ✓ | ✓ | — |
| YAML frontmatter | commands, skills | rules (.mdc) | — | prompts, agents, chatmodes | — | skills | — | — | — | rules |
| Glob-based activation | rules | rules | — | instructions | — | — | — | — | mode rules | rules |
| MCP integration | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | ✓ |

### AGENTS.md Adoption Matrix

| Platform | AGENTS.md Support | How It Reads |
|----------|------------------|--------------|
| OpenAI Codex | ✅ Primary | Reads `AGENTS.md` + `AGENTS.override.md` at every directory level |
| Google Jules | ✅ Native | Reads from repo root before every task |
| GitHub Copilot | ✅ Native | Auto-detects and applies to all chat requests |
| Roo Code | ✅ Native | Loads after mode-specific rules, before generic rules |
| Cline | ✅ Native | Loads alongside `.clinerules/` |
| Cursor | ✅ Recognized | Recognized as part of the AGENTS.md initiative |
| Warp | ✅ Primary | Reads `AGENTS.md` (preferred) or `WARP.md` from repo root |
| Amp | ✅ Native | Native support |
| Factory | ✅ Native | Native support |
| OpenCode | ✅ Native | Native support |
| Amazon Q Developer | ✅ Native | Native support |
| Sourcegraph Cody | ✅ Native | Reads AGENTS.md |
| Aider | ✅ Native | Reads AGENTS.md + conventions file |
| Claude Code | ✅ Reads | Also reads CLAUDE.md as primary |
| Continue | ⚠️ Indirect | Uses own rules system, no direct AGENTS.md support |

---

## Coding Performance

For weighted scoring of each platform's coding ability across key metrics,
see [PLATFORM_CODING_PERFORMANCE.md](./PLATFORM_CODING_PERFORMANCE.md).

---

## Platform Evaluations

Each platform is evaluated across six key decision dimensions. See the
consolidated view at [PLATFORM_CONSOLIDATED_RATING.md](./PLATFORM_CONSOLIDATED_RATING.md)
or drill into individual dimensions:

| Dimension | Weight | Document |
|-----------|--------|----------|
| Coding Performance | 30% | [PLATFORM_CODING_PERFORMANCE.md](./PLATFORM_CODING_PERFORMANCE.md) |
| Developer Experience | 20% | [PLATFORM_DEVELOPER_EXPERIENCE.md](./PLATFORM_DEVELOPER_EXPERIENCE.md) |
| Cost & Value | 20% | [PLATFORM_COST_ANALYSIS.md](./PLATFORM_COST_ANALYSIS.md) |
| Customization & Extensibility | 10% | [PLATFORM_CUSTOMIZATION.md](./PLATFORM_CUSTOMIZATION.md) |
| Privacy & Security | 10% | [PLATFORM_PRIVACY_SECURITY.md](./PLATFORM_PRIVACY_SECURITY.md) |
| Team & Enterprise | 10% | [PLATFORM_TEAM_ENTERPRISE.md](./PLATFORM_TEAM_ENTERPRISE.md) |
| **Consolidated Rating** | — | [**PLATFORM_CONSOLIDATED_RATING.md**](./PLATFORM_CONSOLIDATED_RATING.md) |

---

## Integration Plan

For the phased integration plan to address gaps across all platforms, see
[INTEGRATION_PLAN.md](./INTEGRATION_PLAN.md).

---

## See Also

- [SPENDING_GUIDES.md](./SPENDING_GUIDES.md) — Budget-optimized tool stacks ($0, $10–25, $50–200+)
- [SPENDING_FREE_TIER.md](./SPENDING_FREE_TIER.md) — Free tier rotation strategy
- [SPENDING_MINIMUM_SUB.md](./SPENDING_MINIMUM_SUB.md) — $10–25/month subscription guide
- [SPENDING_PREMIUM.md](./SPENDING_PREMIUM.md) — $50–200+/month premium guide
- [PLATFORM_CONSOLIDATED_RATING.md](./PLATFORM_CONSOLIDATED_RATING.md) — Combined final rankings and recommendations
- [PLATFORM_CODING_PERFORMANCE.md](./PLATFORM_CODING_PERFORMANCE.md) — Coding ability evaluation
- [PLATFORM_COST_ANALYSIS.md](./PLATFORM_COST_ANALYSIS.md) — Cost and pricing evaluation
- [PLATFORM_DEVELOPER_EXPERIENCE.md](./PLATFORM_DEVELOPER_EXPERIENCE.md) — UX and workflow evaluation
- [PLATFORM_CUSTOMIZATION.md](./PLATFORM_CUSTOMIZATION.md) — Extensibility evaluation
- [PLATFORM_PRIVACY_SECURITY.md](./PLATFORM_PRIVACY_SECURITY.md) — Privacy and security evaluation
- [PLATFORM_TEAM_ENTERPRISE.md](./PLATFORM_TEAM_ENTERPRISE.md) — Team and enterprise evaluation
- [INTEGRATION_PLAN.md](./INTEGRATION_PLAN.md) — Phased plan to address platform gaps
- [TOOLS.md](../TOOLS.md) — Quick-reference table of what AgentKit Forge generates
- [CUSTOMIZATION.md](../CUSTOMIZATION.md) — How to customize overlays and settings
- [PROJECT_YAML_REFERENCE.md](../PROJECT_YAML_REFERENCE.md) — Project configuration schema
