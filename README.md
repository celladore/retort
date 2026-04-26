# retort

[![CI](https://github.com/phoenixvc/retort/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/phoenixvc/retort/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)](https://github.com/phoenixvc/retort/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-3.1.0-blue)](https://github.com/phoenixvc/retort/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**One YAML spec. Consistent AI agent configs for every tool your team uses.**

Every AI coding assistant has its own config format — `CLAUDE.md`, `.cursor/rules/`, `.windsurf/rules/`, `GEMINI.md`, `.junie/guidelines.md`, `AGENTS.md`, and more. Keeping them in sync by hand means duplicated effort and drift. **retort** solves this: describe your project once, run `retort sync`, and get correct, project-aware configs for all 16 supported tools — automatically, on every sync.

---

## Supported targets

| Tool                | Output                                                             |
| ------------------- | ------------------------------------------------------------------ |
| **Claude Code**     | `.claude/` — CLAUDE.md, agents, commands, rules, hooks, skills     |
| **Cursor**          | `.cursor/rules/`, `.cursor/commands/`, team configs                |
| **Windsurf**        | `.windsurf/rules/`, `.windsurf/teams/`, workflows                  |
| **GitHub Copilot**  | `.github/copilot-instructions.md`, chat modes, prompts             |
| **Gemini CLI**      | `GEMINI.md`, `.gemini/`                                            |
| **Codex / OpenAI**  | `.agents/skills/`                                                  |
| **JetBrains Junie** | `.junie/guidelines.md` ✓ shipped                                   |
| **Cline**           | `.clinerules/`                                                     |
| **Roo Code**        | `.roo/rules/`                                                      |
| **Warp**            | `WARP.md`                                                          |
| **VS Code**         | `.vscode/settings.json` (brand-driven theme + editor config)       |
| **GitHub Actions**  | `.github/workflows/` — CI, branch protection, drift check          |
| **MCP / A2A**       | `.mcp/servers.json`, `a2a-config.json`                             |
| **Docs**            | `AGENTS.md`, `AGENT_TEAMS.md`, `QUALITY_GATES.md`, `RUNBOOK_AI.md` |

---

## How it works

```
.agentkit/spec/project.yaml    ← describe your project once
.agentkit/spec/teams.yaml      ← agent teams and their scopes
.agentkit/spec/commands.yaml   ← slash commands
.agentkit/spec/rules.yaml      ← coding rules by domain
           ↓
       retort sync
           ↓
CLAUDE.md  .claude/  .cursor/  .windsurf/  GEMINI.md
.junie/  .agents/  .github/  WARP.md  AGENTS.md  ...
```

The sync engine reads your specs, renders Handlebars templates for each target tool, and writes the output. Generated files include a `GENERATED — DO NOT EDIT` header so the engine can detect drift. Running sync again is safe and idempotent.

---

## Quick start

```bash
# Use as a GitHub template, then:
npx retort init       # scans your repo, writes project.yaml interactively
npx retort sync       # generates all tool configs

# Or via pnpm after installing locally:
pnpm --dir .agentkit retort:sync
```

After sync, commit the generated output alongside your spec changes. The CI drift check will fail if you forget.

```bash
# Check what would change without writing:
npx retort sync --diff

# Regenerate only specific targets:
npx retort sync --only claude,cursor

# Interactive apply — confirm each changed file:
npx retort sync --interactive
```

---

## Agent teams

retort generates configs for 13 built-in agent teams, each with a defined scope, accepted task types, and slash command:

| Team           | Command               | Scope                                  |
| -------------- | --------------------- | -------------------------------------- |
| Backend        | `/team-backend`       | `apps/api/**`, `services/**`           |
| Frontend       | `/team-frontend`      | `apps/web/**`, `apps/marketing/**`     |
| Data           | `/team-data`          | `db/**`, `migrations/**`, `prisma/**`  |
| Infrastructure | `/team-infra`         | `infra/**`, `terraform/**`             |
| DevOps         | `/team-devops`        | `.github/workflows/**`, `docker/**`    |
| Testing        | `/team-testing`       | `**/*.test.*`, `tests/**`, `e2e/**`    |
| Security       | `/team-security`      | `auth/**`, `security/**`               |
| Documentation  | `/team-docs`          | `docs/**`, `README.md`                 |
| Product        | `/team-product`       | `docs/product/**`, `docs/prd/**`       |
| Quality        | `/team-quality`       | Catch-all reviewer                     |
| TeamForge      | `/team-forge`         | `.agentkit/spec/**`                    |
| Strategic Ops  | `/team-strategic-ops` | `docs/planning/**`                     |
| Cost Ops       | `/team-cost-ops`      | `docs/cost-ops/**`, `config/models/**` |

Customize teams in `.agentkit/spec/teams.yaml`. Add, remove, or rename teams — sync regenerates all downstream configs automatically.

---

## Key features

### `/start` TUI

An interactive terminal UI for starting agent sessions. Built with Ink + React (TypeScript). Run it at the beginning of every session:

```bash
npx retort start    # or: ak-start
```

Panels:

- **ConversationFlow** — guided dialogue tree for new users (auto-detected on first run)
- **CommandPalette** — fuzzy-search across all slash commands (Tab to switch)
- **TasksPanel** — active tasks from `.claude/state/tasks/` with status, priority, and assignee
- **WorktreesPanel** — agent-owned git worktrees currently in flight
- **MCPPanel** — MCP server health and connection status

### Task delegation protocol

File-based A2A-lite: tasks are JSON files in `.claude/state/tasks/` with a full lifecycle:

```
submitted → accepted → working → input-required → completed / failed / rejected
```

The orchestrator creates tasks; teams pick them up, work them, and hand off to downstream teams via `handoffTo`. Use `retort run` to dispatch the next queued task:

```bash
npx retort run              # dispatch highest-priority submitted task
npx retort run --id task-x  # dispatch a specific task
npx retort run --dry-run    # preview without transitioning state
```

### Worktree isolation

Code-writing agents run in isolated git worktrees to prevent collisions:

```bash
retort worktree create .worktrees/my-feature feat/my-feature
```

This creates the worktree and writes the `.agentkit-repo` marker automatically. The `feat/agent-<name>/<slug>` branch naming convention is enforced so teams can identify agent branches at a glance.

### Quality gates

Every PR passes through configurable gates: lint, typecheck, unit tests, coverage ≥ 80%, spec validation, and drift check. Agents cannot mark tasks complete without all gates green. The `/check` command runs all gates locally in one step.

---

## Repository layout

```
retort/
├── .agentkit/
│   ├── spec/               # project.yaml, teams, commands, rules, settings
│   ├── templates/          # Handlebars templates (one dir per target tool)
│   ├── engines/node/src/   # sync engine: synchronize.mjs, platform-syncer.mjs, …
│   └── overlays/           # per-repo customisations (settings.yaml, feature flags)
├── src/
│   └── start/              # /start TUI (Ink + React, TypeScript)
│       ├── components/     # App.tsx, TasksPanel.tsx, WorktreesPanel.tsx, MCPPanel.tsx, …
│       └── lib/            # detect.ts, commands.ts, tasks.ts, worktrees.ts
├── scripts/                # create-doc.sh, setup-branch-protection, split-pr
├── docs/
│   ├── architecture/       # ADRs, specs, diagrams
│   ├── engineering/        # setup, coding standards, testing strategy
│   ├── history/            # bug fixes, features, implementations
│   └── reference/          # glossary, tool config
├── .claude/                # Claude Code: state, agents, commands, rules, hooks
└── package.json
```

---

## Configuration

The primary config file is `.agentkit/spec/project.yaml`. Key fields:

```yaml
name: my-project
stack:
  languages: [typescript, python]
  frameworks:
    frontend: [next.js, react]
    backend: [fastapi]
testing:
  e2e: [playwright] # drives MCP browser server selection
  coverage: 80
documentation:
  storybook: true # adds Storybook guidance to agent instructions
process:
  commitConvention: conventional
  branchStrategy: github-flow
```

Run `retort init` to auto-detect values from your repo, or edit `project.yaml` directly and run `retort sync` to regenerate.

---

## Ecosystem

| Repo                                                            | Role                                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`retort-plugins`](https://github.com/phoenixvc/retort-plugins) | IDE plugins — VS Code (`@retort` Copilot Chat), JetBrains (Junie), Zed                       |
| [`baton`](https://github.com/phoenixvc/baton)                   | Task graph + MCP server — retort projects read live tasks from baton (formerly phoenix-flow) |
| [`sluice`](https://github.com/phoenixvc/sluice)                 | AI gateway — retort-scaffolded projects route model calls through sluice                     |
| [`docket`](https://github.com/phoenixvc/docket)                 | AI cost ops — tracks token spend and model costs per project                                 |
| [`cognitive-mesh`](https://github.com/phoenixvc/cognitive-mesh) | Agent orchestration — complex multi-agent tasks route through cognitive-mesh                 |
| [`org-meta`](https://github.com/phoenixvc/org-meta)             | Org registry — org-meta's CLAUDE.md and project specs are generated by retort                |

---

## Name

**retort** — a retort is both a sharp, witty comeback and a sealed laboratory vessel used for distillation and chemical reactions. Both meanings apply: retort gives you a precise response to the chaos of AI tool fragmentation, and it's a vessel in which agent configurations are synthesised from raw ingredients.

Previously called `agentkit-forge` internally. The public name `retort` better reflects its standalone, template-first character. Sits comfortably alongside `deck`, `sluice`, and `docket` — functional names with a bit of personality.
