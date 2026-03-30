# retort

![Version](https://img.shields.io/badge/version-3.1.0-blue) ![Status](https://img.shields.io/badge/status-active-green) ![License](https://img.shields.io/badge/license-MIT-green)

> One YAML spec. Consistent AI agent configs for every tool your team uses.

Every AI coding assistant has its own config format — `CLAUDE.md`, `.cursor/rules/`, `.windsurf/rules/`, `GEMINI.md`, `.junie/guidelines.md`, `AGENTS.md`, and more. Keeping them in sync by hand means duplicated effort and drift. **retort** solves this: define your project once in YAML, run `retort sync`, and get consistent, project-aware configs for all 16 supported tools.

---

## Supported targets

| Tool            | Output                                                             |
| --------------- | ------------------------------------------------------------------ |
| Claude Code     | `.claude/` (CLAUDE.md, agents, commands, rules, hooks, skills)     |
| Cursor          | `.cursor/rules/`, `.cursor/commands/`, team configs                |
| Windsurf        | `.windsurf/rules/`, `.windsurf/teams/`, workflows                  |
| GitHub Copilot  | `.github/copilot-instructions.md`, chat modes, prompts             |
| Gemini CLI      | `GEMINI.md`, `.gemini/`                                            |
| Codex / OpenAI  | `.agents/skills/`                                                  |
| JetBrains Junie | `.junie/guidelines.md`                                             |
| Cline           | `.clinerules/`                                                     |
| Roo Code        | `.roo/rules/`                                                      |
| Warp            | `WARP.md`                                                          |
| VS Code         | `.vscode/settings.json` (theme + editor config)                    |
| GitHub Actions  | `.github/workflows/` (CI, branch protection, drift check)          |
| MCP / A2A       | `.mcp/`, `a2a-config.json`                                         |
| Docs            | `AGENTS.md`, `AGENT_TEAMS.md`, `QUALITY_GATES.md`, `RUNBOOK_AI.md` |

---

## How it works

```
.agentkit/spec/project.yaml    ← describe your project once
.agentkit/spec/*.yaml          ← teams, commands, rules, settings
.agentkit/templates/           ← per-tool Handlebars templates
           ↓
       retort sync
           ↓
CLAUDE.md  .claude/  .cursor/  .windsurf/  GEMINI.md
.junie/  .agents/  .github/  WARP.md  AGENTS.md  ...
```

1. `retort init` — scans your repo, asks a few questions, writes `project.yaml`
2. `retort sync` — renders all templates, generates every tool config in one pass
3. Commit the generated output alongside your spec changes

---

## Quick start

```bash
# Use as a GitHub template, or clone and run:
npx retort init
npx retort sync
```

Or via pnpm (if already installed):

```bash
pnpm --dir .agentkit retort:sync
```

---

## Key features

### `/start` TUI

Interactive terminal UI for kicking off agent sessions. Shows:

- **ConversationFlow** — guided dialogue tree for new users
- **CommandPalette** — fuzzy search across all slash commands
- **TasksPanel** — live view of active tasks from `.claude/state/tasks/`
- **WorktreesPanel** — agent-owned git worktrees in flight
- **MCPPanel** — MCP server health at a glance

```bash
npx retort start    # or: ak-start
```

### Task delegation protocol

File-based A2A-lite — tasks live in `.claude/state/tasks/*.json` with a
full lifecycle: `submitted → accepted → working → input-required → completed/failed`.
The `retort run` command dispatches the next queued task to the right agent team.

### Quality gates

Every PR passes through configurable quality gates: lint, typecheck, tests,
coverage ≥ 80%, spec validation, and drift check (generated files must stay in
sync with the spec). Agents cannot merge without all gates green.

### Worktree isolation

Code-writing agents operate in isolated git worktrees (`feat/agent-<name>/<slug>`)
to prevent dirty-tree collisions and enable clean rollback. The `retort worktree create`
command creates the worktree and writes the `.agentkit-repo` marker automatically.

---

## Repository layout

```
retort/
├── .agentkit/
│   ├── spec/               # project.yaml, teams, commands, rules, settings
│   ├── templates/          # Handlebars templates for each target tool
│   ├── engines/node/src/   # sync engine (synchronize.mjs, platform-syncer.mjs, …)
│   └── overlays/           # per-repo customisations
├── src/
│   └── start/              # /start TUI (Ink/React)
│       ├── components/     # App, TasksPanel, WorktreesPanel, MCPPanel, …
│       └── lib/            # detect, commands, tasks, worktrees
├── scripts/                # create-doc.sh, setup-branch-protection, split-pr
├── docs/
│   ├── architecture/       # specs, ADRs, diagrams
│   ├── engineering/        # setup, standards, testing
│   ├── history/            # bug fixes, features, implementations
│   └── reference/          # glossary, tool config
├── .claude/                # Claude Code state, agents, commands, rules, hooks
└── package.json
```

---

## Ecosystem

retort is the agent engineering baseline for the phoenixvc platform:

| Repo                                                            | Role                                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`phoenix-flow`](https://github.com/phoenixvc/phoenix-flow)     | Task graph + MCP server — retort projects read tasks from phoenix-flow            |
| [`sluice`](https://github.com/phoenixvc/sluice)                 | AI gateway — retort-scaffolded projects use sluice as their model proxy           |
| [`docket`](https://github.com/phoenixvc/docket)                 | AI cost ops — tracks token spend across retort-scaffolded projects                |
| [`cognitive-mesh`](https://github.com/phoenixvc/cognitive-mesh) | Agent orchestration — complex multi-agent tasks route through cognitive-mesh      |
| [`org-meta`](https://github.com/phoenixvc/org-meta)             | Org registry — org-meta's own CLAUDE.md and project specs are generated by retort |

---

## Name

**retort** — a retort is a sharp, witty response, but also a sealed laboratory vessel used for distillation. Both apply: retort gives you a precise response to the chaos of AI tool fragmentation (the sharp comeback), and it's a vessel in which agent configurations are synthesised from raw ingredients (the chemistry). Sits alongside `deck` and `sluice` — playful but intentional.

Previously called `agentkit-forge` internally. The public name `retort` better reflects its standalone, template-first character.
