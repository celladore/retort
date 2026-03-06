# AgentKit Forge

[![CI](https://github.com/JustAGhosT/agentkit-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/JustAGhosT/agentkit-forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D22-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-orange.svg)](https://pnpm.io/)

A universal AI-orchestration template repository. Generates tool-specific configs from a single YAML spec for **15+ AI coding tools** — Claude Code, Cursor, Windsurf, Copilot, Codex, Gemini, Warp, Cline, Roo Code, Continue, Jules, Amp, Factory, and more. Cross-platform (Windows, macOS, Linux) with polyglot support and MCP/A2A protocol integration.

---

## Why

Every AI coding tool has its own config format — `CLAUDE.md`, `.cursor/rules/`, `.windsurf/rules/`, `.github/copilot-instructions.md`, `AGENTS.md`, and more. Maintaining them by hand across a team means duplicated effort, inconsistent context, and drift between tools. When your stack changes, you update one file and forget the other ten.

## What

AgentKit Forge is a **single source of truth** for all your AI tool configurations. You define your project once in YAML (`project.yaml` + spec files), and `sync` generates consistent, project-aware configs for every tool your team uses. It also provides an orchestration layer — slash commands, team routing, quality gates, and session state — that works identically across Claude Code, Cursor, Copilot, and the rest.

## How

```text
.agentkit/spec/project.yaml   ← You describe your project once
.agentkit/spec/*.yaml          ← Teams, commands, rules, settings
.agentkit/templates/           ← Templates per tool
        ↓  agentkit sync
AGENTS.md, CLAUDE.md, .claude/, .cursor/, .windsurf/,
.github/prompts/, GEMINI.md, WARP.md, .clinerules/, ...    ← Generated
```

1. **`agentkit init`** — Scans your repo, asks a few questions, writes `project.yaml`.
2. **`agentkit sync`** — Renders templates → generates tool configs.
3. **`agentkit add/remove`** — Incrementally enable or disable tools.

Every developer runs `sync` after cloning. The generated files are gitignored — `.agentkit/` is the committed source of truth.

---

## Quick Start

**Prerequisites:** Node.js 22.x LTS (>=22.0.0) and pnpm 9+.

```bash
# Install runtime
pnpm -C .agentkit install

# Initialize (scans your repo, generates project.yaml, runs sync)
pnpm -C .agentkit agentkit:init -- --repoName MyProject

# That's it — init already runs sync. To re-sync later:
pnpm -C .agentkit agentkit:sync
```

For a non-interactive setup (CI or scripting), use `--non-interactive` or `--preset`:

```bash
pnpm -C .agentkit agentkit:init -- --repoName MyProject --preset team --non-interactive
```

> **Windows users:** Shell scripts are also available at `.agentkit/bin/*.ps1` and `.agentkit/bin/*.cmd`.

### After merging

After merging `main` into a feature branch, run sync to regenerate files and avoid CI drift:

```bash
pnpm -C .agentkit agentkit:sync --overwrite
git add -A && git status   # review, then commit
```

---

## Adoption Guide: New Repos

Use this path when starting a project from scratch.

### Step 1 — Create your repo from the template

Click **"Use this template"** on GitHub (or clone directly):

```bash
gh repo create my-org/my-project --template my-org/agentkit-forge --private --clone
cd my-project
```

### Step 2 — Install and initialize

```bash
pnpm -C .agentkit install
pnpm -C .agentkit agentkit:init -- --repoName my-project
```

This copies the template overlay, writes `settings.yaml`, and runs `sync` to generate all AI tool configs.

### Step 3 — Customize your overlay

Edit `.agentkit/overlays/my-project/settings.yaml`:

```yaml
repoName: my-project
defaultBranch: main
primaryStack: node # node | dotnet | rust | python | auto
windowsFirst: true
renderTargets:
  - claude
  - cursor
  - windsurf
  - copilot
  - gemini
  - codex
  - warp
  - cline
  - roo
  - ai
  - mcp
```

Remove render targets you don't need. For example, a team using only Claude Code and Cursor:

```yaml
renderTargets:
  - claude
  - cursor
```

### Step 4 — Add repo-specific rules or commands

Override or extend any spec definition in your overlay files:

- `.agentkit/overlays/my-project/commands.yaml` — add project-specific slash commands
- `.agentkit/overlays/my-project/rules.yaml` — add project-specific coding rules

### Step 5 — Manage tools incrementally

```bash
pnpm -C .agentkit agentkit:add -- cursor windsurf
pnpm -C .agentkit agentkit:remove -- mcp --clean
pnpm -C .agentkit agentkit:list
```

### Step 6 — Start working

```bash
/discover       # Scan the codebase
/healthcheck    # Pre-flight check
/orchestrate    # Start orchestrated development
```

### Step 7 — Commit the right files

Commit `.agentkit/` (source of truth). AI tool configs (`.claude/`, `.cursor/`, etc.) are gitignored — each developer regenerates them via `sync`. Scaffold-once files (`docs/`, `CONTRIBUTING.md`) are committed after the first sync.

```bash
git add .agentkit/ .gitignore .gitattributes README.md LICENSE
git commit -m "feat: initialize agentkit-forge scaffold"
```

---

## Adoption Guide: Existing Repos

Use this path to add AgentKit Forge to a project that already has code.

### Step 1 — Add the .agentkit directory

Copy or merge the `.agentkit/` directory into your repo root. If using git:

```bash
# Add agentkit-forge as a remote
git remote add agentkit-forge https://github.com/my-org/agentkit-forge.git
git fetch agentkit-forge

# Bring in just the .agentkit/ directory (and root config files)
git checkout agentkit-forge/main -- .agentkit/ .gitattributes
```

Or simply copy the folder manually.

### Step 2 — Merge the .gitignore

Append the AgentKit Forge ignore rules to your existing `.gitignore`. The key entries:

```gitignore
# AgentKit Forge — always-regenerate outputs (regenerate with: pnpm -C .agentkit agentkit:sync)
/.claude/
/.cursor/
/.windsurf/
/.ai/
/.gemini/
/.agents/
/.clinerules/
/.roo/
/mcp/
/.github/workflows/ai-framework-ci.yml
/.github/prompts/
/.github/agents/
/.github/chatmodes/
/AGENTS.md
/CLAUDE.md
/GEMINI.md
/WARP.md
/UNIFIED_AGENT_TEAMS.md
/AGENT_TEAMS.md
/QUALITY_GATES.md
/RUNBOOK_AI.md
```

> **Important:** Use leading `/` on each pattern so they only match at the repo root — not inside `.agentkit/templates/`.

### Step 3 — Install and initialize

```bash
pnpm -C .agentkit install
pnpm -C .agentkit agentkit:init -- --repoName my-existing-project
```

### Step 4 — Tune the overlay for your stack

Edit `.agentkit/overlays/my-existing-project/settings.yaml`:

```yaml
repoName: my-existing-project
defaultBranch: main # or develop, trunk, etc.
primaryStack: auto # auto-detects from Cargo.toml, package.json, etc.
windowsFirst: false # set to true for Windows-primary teams
renderTargets:
  - claude # only enable tools your team uses
  - cursor
```

### Step 5 — Handle conflicts with existing configs

| Existing file                      | Resolution                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `.claude/` directory               | Back up, then let `sync` regenerate. Merge any custom commands into your overlay's `commands.yaml`           |
| `.cursor/rules/`                   | Back up custom rules. Add them to `.agentkit/overlays/<repo>/rules.yaml` to have them rendered automatically |
| `.github/PULL_REQUEST_TEMPLATE.md` | Keep yours — sync uses `once` mode and won't overwrite existing files                                        |
| `.editorconfig`                    | Keep yours — sync uses `once` mode and won't overwrite existing files                                        |
| `CLAUDE.md`                        | Move custom instructions into your overlay or into `.agentkit/spec/`                                         |

### Step 6 — Run sync, validate, and commit

```bash
pnpm -C .agentkit agentkit:sync
pnpm -C .agentkit agentkit:validate
git add .agentkit/ .gitignore .gitattributes
git commit -m "feat: adopt agentkit-forge for AI orchestration"
```

---

## Documentation

Comprehensive guides for using AgentKit Forge:

| Guide                                                                  | Description                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **[Quick Start](.agentkit/docs/QUICK_START.md)**                       | Your first 15 minutes — setup, first session, command overview      |
| **[Command Reference](.agentkit/docs/COMMAND_REFERENCE.md)**           | All 23 commands with examples, flags, and expected outputs          |
| **[Workflows](.agentkit/docs/WORKFLOWS.md)**                           | Worked examples: feature dev, bug fix, project audit, multi-session |
| **[Team Guide](.agentkit/docs/TEAM_GUIDE.md)**                         | When to use which team, decision matrix, handoff patterns           |
| **[State & Sessions](.agentkit/docs/STATE_AND_SESSIONS.md)**           | Orchestrator state, events log, session continuity, lock files      |
| **[Customization](.agentkit/docs/CUSTOMIZATION.md)**                   | Overlays, settings reference, adding commands/rules/teams           |
| **[Troubleshooting](.agentkit/docs/TROUBLESHOOTING.md)**               | Common errors, recovery procedures, FAQ                             |
| **[Onboarding](.agentkit/docs/ONBOARDING.md)**                         | Full adoption guide with CI integration                             |
| **[Cost Tracking](.agentkit/docs/COST_TRACKING.md)**                   | Session tracking, usage reports, optimization tips                  |
| **[AGENTS.md Guide](.agentkit/docs/AGENTS_MD_GUIDE.md)**               | What AGENTS.md is, which tools read it, best practices              |
| **[project.yaml Reference](.agentkit/docs/PROJECT_YAML_REFERENCE.md)** | Full schema with examples for every field                           |
| **[Migration Guide](.agentkit/docs/MIGRATION_GUIDE.md)**               | Upgrading from older versions of AgentKit Forge                     |
| **[Architecture](.agentkit/docs/ARCHITECTURE.md)**                     | Sync engine, template rendering, CLI, orchestrator internals        |
| **[Tools](.agentkit/docs/TOOLS.md)**                                   | All 11 render targets + AGENTS.md-only tools                        |
| **[Security Model](.agentkit/docs/SECURITY_MODEL.md)**                 | Permission model, secret scanning, path traversal protection        |
| **[MCP/A2A Guide](.agentkit/docs/MCP_A2A_GUIDE.md)**                   | Model Context Protocol and Agent-to-Agent integration               |
| **[CLI Installation](.agentkit/docs/CLI_INSTALLATION.md)**             | Installing and configuring the CLI                                  |
| **[Agents vs Teams](.agentkit/docs/AGENTS_VS_TEAMS.md)**               | When to use agents vs teams, comparison guide                       |
| **[Agents Reference](.agentkit/docs/AGENTS_REFERENCE.md)**             | All 19 agent personas — roles, scopes, conventions, dependencies    |
| **[Roadmap](.agentkit/docs/ROADMAP.md)**                               | Planned features and development roadmap                            |
| **[PRD Library](docs/prd/README.md)**                                  | Product requirement docs and LLM-mapping PRD examples               |
| **[Documentation Audit](.agentkit/docs/DOCUMENTATION_AUDIT.md)**       | Gap analysis and documentation completeness report                  |

---

## What Gets Generated

After running `sync`, these are created in your project root:

**Always-regenerate** (gitignored — regenerated every sync):

| Output                   | Tool(s)     | Purpose                                                                                                                |
| ------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`              | Universal   | Agent instruction file (Linux Foundation standard) — read by Codex, Jules, Copilot, Cline, Roo, Amp, Factory, and more |
| `CLAUDE.md`              | Claude Code | Root Claude Code instructions with project context                                                                     |
| `GEMINI.md`              | Gemini      | Gemini Code Assist / CLI context file                                                                                  |
| `WARP.md`                | Warp        | Warp terminal/IDE context file                                                                                         |
| `.claude/`               | Claude Code | Commands, skills, hooks, agents, rules, state, settings                                                                |
| `.cursor/`               | Cursor      | Rules (.mdc), team rules, slash commands                                                                               |
| `.windsurf/`             | Windsurf    | Rules + workflows                                                                                                      |
| `.github/prompts/`       | Copilot     | Reusable prompt files (slash commands)                                                                                 |
| `.github/agents/`        | Copilot     | Custom agent definitions                                                                                               |
| `.github/chatmodes/`     | Copilot     | Team-scoped chat modes                                                                                                 |
| `.gemini/`               | Gemini      | Styleguide + code review config                                                                                        |
| `.agents/skills/`        | Codex       | Open Agent Skills (SKILL.md format)                                                                                    |
| `.clinerules/`           | Cline       | Project rules per domain                                                                                               |
| `.roo/rules/`            | Roo Code    | Project rules per domain                                                                                               |
| `.ai/`                   | Continue    | Portable multi-IDE rules                                                                                               |
| `mcp/`                   | MCP/A2A     | Server + protocol configurations                                                                                       |
| `UNIFIED_AGENT_TEAMS.md` | All         | Team definitions and routing                                                                                           |
| `QUALITY_GATES.md`       | All         | Quality gate checks per stack                                                                                          |

**Scaffold-once** (committed — generated once, then you own them):

| Directory                          | Purpose                                    |
| ---------------------------------- | ------------------------------------------ |
| `docs/`                            | Full 8-category documentation structure    |
| `AGENT_BACKLOG.md`                 | Backlog tracking for agent work            |
| `CONTRIBUTING.md`                  | Contributing guide                         |
| `SECURITY.md`                      | Security policy                            |
| `.github/ISSUE_TEMPLATE/`          | Issue templates                            |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR template                                |
| `.vscode/`                         | Editor settings and recommended extensions |
| `.editorconfig`, `.prettierrc`     | Formatting configs                         |

## Core Commands

| Command         | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| `/orchestrate`  | Master coordinator with state persistence                 |
| `/discover`     | Codebase scanner                                          |
| `/plan`         | Structured plan before writing code                       |
| `/check`        | Universal quality gate (format → lint → typecheck → test) |
| `/review`       | Structured code review                                    |
| `/handoff`      | Session handoff summary                                   |
| `/sync-backlog` | Update AGENT_BACKLOG.md                                   |

**Tool management (CLI):**

| Command                            | Purpose                                         |
| ---------------------------------- | ----------------------------------------------- |
| `agentkit add <tool...>`           | Enable AI tool(s) and sync                      |
| `agentkit remove <tool> [--clean]` | Disable tool; `--clean` deletes generated files |
| `agentkit list`                    | Show enabled, available, and always-on tools    |

## Teams

See the **[Team Guide](.agentkit/docs/TEAM_GUIDE.md)** for decision matrices, handoff patterns, and when to use which team.

| ID  | Team          | Focus                          |
| --- | ------------- | ------------------------------ |
| T1  | BACKEND       | API, services, core logic      |
| T2  | FRONTEND      | UI, components, PWA            |
| T3  | DATA          | Database, models, migrations   |
| T4  | INFRA         | IaC, cloud, Terraform/Bicep    |
| T5  | DEVOPS        | CI/CD, pipelines, automation   |
| T6  | TESTING       | Unit, E2E, integration tests   |
| T7  | SECURITY      | Auth, compliance, audit        |
| T8  | DOCUMENTATION | Docs, ADRs, guides             |
| T9  | PRODUCT       | Features, PRDs, roadmap        |
| T10 | QUALITY       | Code review, refactoring, bugs |

## Supported Tools

**First-class** (dedicated templates + sync): Claude Code, Codex, Copilot, Cursor, Windsurf, Gemini, Warp, Cline, Roo Code, Continue.
**Via AGENTS.md** (universal standard): Jules, Amp, Factory, OpenCode, Amazon Q, Cody, Aider.

See **[Tools](.agentkit/docs/TOOLS.md)** for per-tool output details and configuration.

## Architecture

```text
.agentkit/              ← Committed source of truth
├── spec/               ← Teams, commands, rules, project.yaml (YAML)
├── templates/          ← Output templates per tool (15+ tools)
├── overlays/           ← Per-repo customizations
├── engines/node/       ← Sync engine (Node.js)
└── bin/                ← Cross-platform command surface (.sh, .ps1, .cmd)

Generated (gitignored):   AGENTS.md, CLAUDE.md, .claude/, .cursor/, .windsurf/, ...
Scaffold-once (committed): docs/, CONTRIBUTING.md, .github/ISSUE_TEMPLATE/, ...
```

Each repo gets its own **overlay** under `.agentkit/overlays/<repo-name>/` to override commands, rules, and settings. Overlay values take precedence over `.agentkit/spec/` defaults.

The `.agentkit/` directory stays committed permanently — like `.github/` or `.vscode/`. Developers run `sync` after cloning to regenerate their local AI tool configs. Upgrades come from merging upstream changes.

See **[Architecture](.agentkit/docs/ARCHITECTURE.md)** and **[Customization](.agentkit/docs/CUSTOMIZATION.md)** for details.

---

## Upgrading

```bash
git remote add agentkit-forge https://github.com/my-org/agentkit-forge.git  # one-time
git fetch agentkit-forge
git merge agentkit-forge/main --allow-unrelated-histories
pnpm -C .agentkit install
pnpm -C .agentkit agentkit:sync
pnpm -C .agentkit agentkit:validate
git add .agentkit/ .gitignore .gitattributes
git commit -m "chore: upgrade agentkit-forge to latest"
```

> **Note:** If the upgrade adds new files with `once` scaffold mode (docs, editor configs), they appear as untracked after your first `sync`. This is expected — review them and `git add` the ones you want to keep. Files with `managed` mode are regenerated if pristine or merged with your edits. Files with `always` mode are always overwritten. Use `--overwrite` to force-regenerate everything. See [Scaffold Management Guide](docs/06_engineering/08_scaffold_management.md) for details.

Your overlay (`overlays/<your-repo>/`) is never touched by upstream merges. See the **[Migration Guide](.agentkit/docs/MIGRATION_GUIDE.md)** for detailed upgrade paths and conflict resolution.

### What merges cleanly vs. what needs attention

| Component                          | Merge behaviour                                                |
| ---------------------------------- | -------------------------------------------------------------- |
| `.agentkit/engines/`               | Auto-merges unless you modified engine source                  |
| `.agentkit/spec/`                  | Auto-merges; new teams/commands appear automatically           |
| `.agentkit/templates/`             | Auto-merges; new template files appear, existing ones update   |
| `.agentkit/overlays/__TEMPLATE__/` | Auto-merges; your repo-specific overlay is untouched           |
| `.agentkit/overlays/<your-repo>/`  | **Never touched by upstream** — this is your customization     |
| `.agentkit/package.json`           | May conflict if both sides changed versions — resolve manually |

### Version pinning

The current agentkit version is defined in `.agentkit/package.json` → `version`. After upgrading, check the version to confirm the merge landed:

```bash
node -e "console.log(require('./.agentkit/package.json').version)"
```

## License

MIT
