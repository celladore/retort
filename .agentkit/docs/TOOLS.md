# Supported AI Coding Tools

AgentKit Forge generates tool-specific configurations for 15+ AI coding tools from a single set of YAML specs. This document describes each supported tool, what files are generated, and how to enable/disable them.

## Render Targets

Each tool corresponds to a **render target** in your overlay's `settings.yaml`:

```yaml
renderTargets:
  - claude # Claude Code
  - cursor # Cursor IDE
  - windsurf # Windsurf IDE
  - copilot # GitHub Copilot
  - gemini # Gemini CLI / Code Assist
  - codex # OpenAI Codex
  - warp # Warp terminal/IDE
  - cline # Cline
  - roo # Roo Code
  - ai # Continue / portable rules
  - mcp # MCP/A2A protocol
```

`AGENTS.md` is **always generated** (not gated by renderTargets) — it's the universal standard.

Use `agentkit add <tool>` / `agentkit remove <tool>` to manage targets incrementally.

---

## Universal: AGENTS.md

**Always generated** — not gated by renderTargets.

| Output             | Path        |
| ------------------ | ----------- |
| Agent instructions | `AGENTS.md` |

The universal agent instruction file, stewarded by the Agentic AI Foundation under the Linux Foundation. Natively read by:

- **OpenAI Codex** — reads AGENTS.md + AGENTS.override.md at every directory level
- **Google Jules** — automatically looks for AGENTS.md before every task
- **GitHub Copilot** — VS Code auto-detects and applies instructions to all chat requests
- **Roo Code** — loads after mode-specific rules, before generic rules
- **Cline** — loads alongside .clinerules/
- **Cursor** — recognized as part of the AGENTS.md initiative
- **Amp, Factory, OpenCode, Amazon Q Developer, Sourcegraph Cody, Aider** — native support

Content is generated from `project.yaml` (tech stack, architecture, conventions, testing, integrations) and the core spec files.

---

## Claude Code

**Render target**: `claude`

| Output            | Path                          | Source                                            |
| ----------------- | ----------------------------- | ------------------------------------------------- |
| Root instructions | `CLAUDE.md`                   | `templates/claude/CLAUDE.md` + project.yaml       |
| Commands          | `.claude/commands/*.md`       | `commands.yaml` + team commands from `teams.yaml` |
| Skills            | `.claude/skills/*/SKILL.md`   | `commands.yaml` (non-team commands)               |
| Agents            | `.claude/agents/**/*.md`      | `agents.yaml`                                     |
| Rules             | `.claude/rules/*.md`          | `templates/claude/rules/`                         |
| Hooks             | `.claude/hooks/*.sh`, `*.ps1` | `templates/claude/hooks/`                         |
| State             | `.claude/state/`              | Orchestrator state schema                         |
| Settings          | `.claude/settings.json`       | Permissions from `settings.yaml`                  |

Claude Code is the most feature-rich integration. Skills (SKILL.md) are the modern replacement for legacy commands — both are generated.

---

## GitHub Copilot

**Render target**: `copilot`

| Output            | Path                              | Source                                      |
| ----------------- | --------------------------------- | ------------------------------------------- |
| Main instructions | `.github/copilot-instructions.md` | `templates/copilot/copilot-instructions.md` |
| Path instructions | `.github/instructions/*.md`       | `templates/copilot/instructions/`           |
| Prompt files      | `.github/prompts/*.prompt.md`     | `commands.yaml` (non-team commands)         |
| Custom agents     | `.github/agents/*.agent.md`       | `agents.yaml`                               |
| Chat modes        | `.github/chatmodes/*.chatmode.md` | `teams.yaml`                                |

**Prompt files** are reusable slash commands in VS Code. Each non-team command from `commands.yaml` gets its own `.prompt.md` with frontmatter (`mode`, `description`).

**Custom agents** map each agent from `agents.yaml` into Copilot's agent format with persona, tools, and scope.

**Chat modes** map each team from `teams.yaml` into a team-scoped chat persona.

---

## Cursor

**Render target**: `cursor`

| Output     | Path                       | Source                              |
| ---------- | -------------------------- | ----------------------------------- |
| Rules      | `.cursor/rules/*.mdc`      | `templates/cursor/rules/`           |
| Team rules | `.cursor/rules/team-*.mdc` | `teams.yaml`                        |
| Commands   | `.cursor/commands/*.md`    | `commands.yaml` (non-team commands) |

Cursor 1.6+ supports `.cursor/commands/*.md` for slash commands — analogous to Claude commands.

---

## Windsurf

**Render target**: `windsurf`

| Output     | Path                        | Source                          |
| ---------- | --------------------------- | ------------------------------- |
| Rules      | `.windsurf/rules/*.md`      | `templates/windsurf/rules/`     |
| Team rules | `.windsurf/rules/team-*.md` | `teams.yaml`                    |
| Workflows  | `.windsurf/workflows/*.yml` | `templates/windsurf/workflows/` |

---

## Gemini CLI / Code Assist

**Render target**: `gemini`

| Output            | Path                    | Source                                          |
| ----------------- | ----------------------- | ----------------------------------------------- |
| Root instructions | `GEMINI.md`             | `templates/gemini/GEMINI.md` + project.yaml     |
| Style guide       | `.gemini/styleguide.md` | `templates/gemini/styleguide.md` + project.yaml |
| Config            | `.gemini/config.yaml`   | Code review settings                            |

Gemini Code Assist and Gemini CLI both read `GEMINI.md` from the repo root. The `.gemini/` directory provides additional configuration for GitHub-based code review.

---

## OpenAI Codex

**Render target**: `codex`

| Output | Path                        | Source                              |
| ------ | --------------------------- | ----------------------------------- |
| Skills | `.agents/skills/*/SKILL.md` | `commands.yaml` (non-team commands) |

Codex uses the open SKILL.md standard. Each non-team command from `commands.yaml` generates a skill folder with `SKILL.md` containing frontmatter (`name`, `description`) and instructions.

Codex also reads `AGENTS.md` (always generated) for project-level context.

---

## Warp

**Render target**: `warp`

| Output            | Path      | Source                                  |
| ----------------- | --------- | --------------------------------------- |
| Root instructions | `WARP.md` | `templates/warp/WARP.md` + project.yaml |

Warp reads `WARP.md` from the repo root for project context. The template includes tech stack, coding standards, cross-cutting conventions, testing, and infrastructure details from `project.yaml`.

---

## Cline

**Render target**: `cline`

| Output | Path               | Source                             |
| ------ | ------------------ | ---------------------------------- |
| Rules  | `.clinerules/*.md` | `rules.yaml` (one file per domain) |

Cline reads `.clinerules/` for project-specific rules. Each domain from `rules.yaml` (typescript, dotnet, python, rust, security, blockchain) generates a dedicated rule file with conventions and applies-to patterns.

Cline also reads `AGENTS.md` for universal project context.

---

## Roo Code

**Render target**: `roo`

| Output | Path              | Source                             |
| ------ | ----------------- | ---------------------------------- |
| Rules  | `.roo/rules/*.md` | `rules.yaml` (one file per domain) |

Roo Code (a Cline fork) reads `.roo/rules/` for project rules. Generated from the same `rules.yaml` source as Cline rules.

Roo Code also loads `AGENTS.md` after mode-specific rules.

---

## Continue / Portable AI

**Render target**: `ai`

| Output         | Path                | Source                       |
| -------------- | ------------------- | ---------------------------- |
| Continue rules | `.ai/continuerules` | `templates/ai/continuerules` |
| Cursor rules   | `.ai/cursorrules`   | `templates/ai/cursorrules`   |
| Windsurf rules | `.ai/windsurfrules` | `templates/ai/windsurfrules` |

Portable rule files that work across multiple IDEs.

---

## MCP/A2A Protocol

**Render target**: `mcp`

| Output      | Path                  | Source                          |
| ----------- | --------------------- | ------------------------------- |
| MCP servers | `mcp/servers.json`    | `templates/mcp/servers.json`    |
| A2A config  | `mcp/a2a-config.json` | `templates/mcp/a2a-config.json` |

Model Context Protocol and Agent-to-Agent protocol configurations.

---

## Tools Covered via AGENTS.md Only

These tools natively read `AGENTS.md` and require no dedicated template:

| Tool                   | How it reads AGENTS.md                               |
| ---------------------- | ---------------------------------------------------- |
| **Google Jules**       | Automatically reads from repo root before every task |
| **Amp**                | Native support                                       |
| **Factory**            | Native support                                       |
| **OpenCode**           | Native support                                       |
| **Amazon Q Developer** | Announced support                                    |
| **Sourcegraph Cody**   | Reads AGENTS.md                                      |
| **Aider**              | Reads AGENTS.md + conventions file                   |
