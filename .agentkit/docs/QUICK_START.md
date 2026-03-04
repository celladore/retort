# AgentKit Forge -- Quick Start Guide

> Your first 15 minutes with AgentKit Forge. From zero to an AI-assisted
> development workflow.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup in 3 Steps](#setup-in-3-steps)
3. [What Just Happened?](#what-just-happened)
4. [Your First Session with Claude Code](#your-first-session-with-claude-code)
5. [Command Quick Reference](#command-quick-reference)
6. [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, make sure you have the following installed:

| Requirement | Minimum Version     | Check Command    |
| ----------- | ------------------- | ---------------- |
| **Node.js** | 22.x LTS (>=22.0.0) | `node --version` |
| **Git**     | 2.30+               | `git --version`  |
| **AI Tool** | Latest              | See below        |

> **Azure:** Azure Functions 4.x and Static Web Apps support Node 22. See [Azure Functions versions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions).

You need at least one of these AI coding assistants:

- **Claude Code** -- Anthropic's CLI-based AI assistant (recommended for full feature support)
- **Cursor** -- AI-powered code editor
- **Windsurf** -- AI-powered development environment
- **GitHub Copilot** -- AI pair programmer in VS Code / JetBrains

AgentKit Forge generates configuration files for whichever tools your team uses. You do not need all of them -- pick the ones you work with.

---

## Setup in 3 Steps

### Step 1: Add AgentKit Forge as a Git Submodule

From the root of your project repository:

> **Note:** Replace `your-org` with your GitHub organization or the actual repository URL.

```bash
git submodule add https://github.com/your-org/agentkit-forge.git .agentkit
git submodule update --init --recursive
```

Then install the runtime dependencies:

```bash
pnpm -C .agentkit install
```

> **Note:** If you do not use pnpm, you can also run `npm install` inside the
> `.agentkit/` directory, but pnpm is recommended.

### Step 2: Initialize for Your Repository

Run the `init` command with your repository name:

```bash
node .agentkit/engines/node/src/cli.mjs init --repoName my-project
```

This command does three things:

1. Creates an overlay directory at `.agentkit/overlays/my-project/` with your project-specific settings
2. Sets your repository name, default branch, and primary tech stack in `settings.yaml`
3. Prepares the configuration for your chosen AI tools

After initialization, review and customize `.agentkit/overlays/my-project/settings.yaml`:

```yaml
repoName: my-project
defaultBranch: main
primaryStack: auto # auto | node | dotnet | rust | python
windowsFirst: false
renderTargets:
  - claude # Remove any tools your team does not use
  - cursor
  - windsurf
  - copilot
  - ai
```

### Step 3: Generate Configs

Run the `sync` command to generate all AI tool configuration files:

```bash
node .agentkit/engines/node/src/cli.mjs sync
```

This reads your overlay settings and the core spec, then renders configuration files for every tool listed in `renderTargets`.

Commit the .agentkit directory (the generated outputs are gitignored):

```bash
git add .agentkit/ .gitignore .gitattributes
git commit -m "feat: add AgentKit Forge configuration"
```

That is it. You are ready to go.

**Optional:** Configure branch protection rules for your default branch:

```bash
.github/scripts/setup-branch-protection.sh --dry-run  # Preview
.github/scripts/setup-branch-protection.sh             # Apply
```

See [.github/scripts/README.md](../../.github/scripts/README.md) for details.

---

## What Just Happened?

The `sync` command generated several directories and files in your repository root. Here is what each one does:

### Generated Directories

| Path         | Purpose                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.claude/`   | **Claude Code configs** -- Slash commands, lifecycle hooks, specialized agents, coding rules, and orchestrator state. This is where commands like `/discover` and `/orchestrate` live.          |
| `.cursor/`   | **Cursor AI rules** -- Rules files in `.mdc` format that Cursor uses for context-aware code generation.                                                                                                |
| `.windsurf/` | **Windsurf AI rules and workflows** -- Rules and workflow definitions for Windsurf's AI assistant.                                                                                                     |
| `.ai/`       | **Portable rules** -- A tool-agnostic rules format compatible with Continue and other AI tools that support the `.ai/` convention.                                                                     |
| `docs/`      | **8-category documentation structure** -- A complete project documentation scaffold organized into product, specs, architecture, API, operations, engineering, integrations, and reference categories. |

### Generated Root Files

| File                     | Purpose                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`              | **Main AI instructions entry point** -- The first file Claude Code reads when it opens your project. Contains the project overview, command reference, workflow guide, safety rules, and links to all other configuration.                                  |
| `UNIFIED_AGENT_TEAMS.md` | **Team specifications** -- Defines the 10 agent teams (Backend, Frontend, Data, Infrastructure, Auth, Integration, Documentation, DevEx, Platform, Quality), their responsibilities, scope patterns, and the 5-phase lifecycle model that governs all work. |
| `AGENT_BACKLOG.md`       | **Work tracking** -- A prioritized backlog of tasks for AI agents to pick up, organized by team and priority.                                                                                                                                               |
| `QUALITY_GATES.md`       | **Definition of done** -- Quality gates for each of the 5 lifecycle phases, ensuring work meets standards before advancing.                                                                                                                                 |
| `.gitignore`             | **Excludes build artifacts** — Lists common ignore patterns such as `node_modules/`, `.tmp/`, `*.log`, `.env`, `dist/` and other sensitive or temporary build artifacts.                                                                                    |
| `.gitattributes`         | **EOL and diff** -- Configures EOL (e.g., `* text=auto`) and diff/merge handling for repo files. Typical rules: `*.md text`, `*.sh text eol=lf`, `*.bat text eol=crlf`.                                                                                     |

### Documentation Structure

The `docs/` directory follows a standardized 8-category layout:

```
docs/
  01_product/        Product requirements, user stories, roadmap, personas
  02_specs/          Functional spec, technical spec, API spec, data models
  03_architecture/   System overview, architecture decision records (ADRs)
  04_api/            API overview, endpoints, authentication, examples
  05_operations/     Deployment, monitoring, incident response, troubleshooting
  06_engineering/    Dev setup, coding standards, testing, git workflow, security
  07_integrations/   External APIs, webhooks, SDK documentation
  08_reference/      Glossary, FAQ, changelog, contributing guide, AI handoffs
```

This structure gives AI assistants a consistent place to read and write documentation, regardless of your project's domain.

---

## Your First Session with Claude Code

Open Claude Code in your project directory and walk through this sequence. Each step takes 1-3 minutes.

### 1. Discover Your Codebase

```
/discover
```

**What it does:** The Discovery Agent scans your entire repository and produces a codebase inventory. It detects programming languages, frameworks, build tools, package managers, CI/CD pipelines, test frameworks, code quality tools, and any broken or suspicious items.

**What you get:** An `AGENT_TEAMS.md` file in your repository root with a repository profile, team assignments tailored to your actual codebase, a folder map, and a list of detected issues.

**Example output:**

```
## Repository Profile
- Primary stack: TypeScript + React + Node.js
- Build system: pnpm + Turborepo
- Test framework: Vitest
- CI: GitHub Actions

## Team Assignments
### team-backend
- Focus: API routes, database, server-side logic
- Scope: src/api/**, src/server/**

### team-frontend
- Focus: UI components, pages, client-side state
- Scope: src/components/**, src/pages/**
...
```

### 2. Run a Health Check

```
/healthcheck
```

**What it does:** The Healthcheck Agent validates that your repository is in a buildable, testable state. It runs five checks in sequence: dependency installation, build, lint and typecheck, unit tests, and coverage reporting.

**What you get:** A structured report showing pass/fail status for each check, with an overall health verdict of HEALTHY, DEGRADED, or BROKEN.

**Example output:**

```
## Healthcheck Report

| Check        | Status | Duration | Details              |
| ------------ | ------ | -------- | -------------------- |
| Dependencies | PASS   | 4.2s     | pnpm install clean   |
| Build        | PASS   | 12.1s    | No errors            |
| Lint         | FAIL   | 3.8s     | 7 errors, 2 warnings |
| Typecheck    | PASS   | 5.4s     | No errors            |
| Tests        | PASS   | 8.3s     | 142 passed, 0 failed |

### Overall Status: DEGRADED
### Recommended Next Step: Run /check --fix to auto-fix lint issues
```

### 3. Plan Your Work

```
/plan Add user authentication with JWT tokens
```

**What it does:** The Planning Agent produces a detailed implementation plan without writing any code. It generates a goal statement, assumptions, numbered implementation steps, a file touch list, validation commands, a rollback plan, and identified risks.

**What you get:** A structured plan you can review and approve before any code is written. This prevents wasted effort on wrong approaches.

### 4. See Recommended Actions

```
/orchestrate --assess-only
```

**What it does:** The Orchestrator runs discovery and healthcheck, then reports the current project state and recommended actions without making any changes. Think of it as a project dashboard.

**What you get:** A summary of the current phase, active teams, backlog items, and suggested next steps.

### 5. Start Working

```
/orchestrate Add user authentication
```

**What it does:** The Orchestrator takes over as the master coordinator. It follows the 5-phase lifecycle: Discovery (understand the codebase) then Planning (design the solution) then Implementation (delegate to teams) then Validation (run quality gates) then Ship (document and hand off). State is persisted in `.claude/state/orchestrator.json` so you can resume later.

**What you get:** End-to-end implementation with quality checks at every step, a full audit trail in the events log, and a handoff document for the next session.

---

## Command Quick Reference

AgentKit Forge provides 29 slash commands, organized into five categories. The tables below list 27 commands; the remaining 2 (`/scaffold` and `/preflight`) are slash-command-only and documented in [COMMAND_REFERENCE.md](./COMMAND_REFERENCE.md). See that reference for full details, flags, and examples.

### Workflow Commands

These commands drive the development lifecycle.

| Command           | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `/orchestrate`    | Master coordinator -- assess, plan, delegate, validate, ship |
| `/discover`       | Scan codebase, detect tech stacks, produce inventory         |
| `/healthcheck`    | Pre-flight validation of build, lint, typecheck, and tests   |
| `/plan`           | Structured implementation plan before writing code           |
| `/review`         | Structured code review with severity classification          |
| `/handoff`        | Session handoff summary for continuity between sessions      |
| `/sync-backlog`   | Update AGENT_BACKLOG.md from multiple sources                |
| `/project-review` | Comprehensive multi-phase project audit                      |

### Quality Commands

These commands validate and improve code quality.

| Command     | Purpose                                                        |
| ----------- | -------------------------------------------------------------- |
| `/check`    | Universal quality gate -- format, lint, typecheck, test, build |
| `/build`    | Build the project (auto-detects stack)                         |
| `/test`     | Run tests (auto-detects framework, accepts scope/filter)       |
| `/format`   | Run code formatters (auto-detects tools)                       |
| `/security` | Security audit -- OWASP top 10, dependencies, secrets scan     |
| `/deploy`   | Deployment automation with safety checks and rollback          |

### Team Commands

These commands activate specialized agent teams for focused work.

| Command          | Team                | Focus Area                                         |
| ---------------- | ------------------- | -------------------------------------------------- |
| `/team-backend`  | Backend (T1)        | API routes, services, core server logic            |
| `/team-frontend` | Frontend (T2)       | UI components, client state, accessibility         |
| `/team-data`     | Data (T3)           | Database, models, migrations, queries              |
| `/team-infra`    | Infrastructure (T4) | Terraform, Docker, cloud configuration             |
| `/team-devops`   | DevOps (T5)         | CI/CD pipelines, containers, deployment automation |
| `/team-testing`  | Testing (T6)        | Test strategy, coverage, E2E tests, benchmarks     |
| `/team-security` | Security (T7)       | Authentication, authorization, compliance          |
| `/team-docs`     | Documentation (T8)  | Docs, ADRs, runbooks, guides                       |
| `/team-product`  | Product (T9)        | PRDs, feature specs, user stories, roadmap         |
| `/team-quality`  | Quality (T10)       | Code review, refactoring, quality gate definitions |

### Task Management & Diagnostics

| Command     | Purpose                                           |
| ----------- | ------------------------------------------------- |
| `/tasks`    | List, filter, and inspect delegated tasks         |
| `/delegate` | Create a delegated task and assign it to a team   |
| `/doctor`   | Run diagnostics on your AgentKit Forge setup      |

### Coming Soon (In-Flight Branches)

The following commands are in active development. See [COMMAND_REFERENCE.md — Incoming Commands](./COMMAND_REFERENCE.md#incoming-commands-in-flight-branches) for full details.

| Command              | Purpose                                                         | Branch                          |
| -------------------- | --------------------------------------------------------------- | ------------------------------- |
| `/infra-eval`        | Infrastructure fitness evaluation (8 dimensions, hard gates)    | `agentforge-template-integration` |
| `/brand`             | Brand identity management and editor theme generation           | `repo-specific-editor-theme`    |
| `/feature-configure` | Interactive feature preset and toggle management                | `feature-management-strategy`   |
| `/feature-flow`      | End-to-end feature tracing from spec to output                  | `feature-management-strategy`   |
| `/feature-review`    | Feature configuration audit and recommendations                 | `feature-management-strategy`   |
| `/review --focus=retrospective` | Session retrospective for issue/lesson capture       | `elegant-knuth`                 |

---

## Next Steps

Now that you have AgentKit Forge running, here is where to go next:

- **[COMMAND_REFERENCE.md](./COMMAND_REFERENCE.md)** -- Detailed documentation for every command, including all flags, arguments, and output formats.
- **[WORKFLOWS.md](./WORKFLOWS.md)** -- Worked examples of complete sessions: new feature development, bug fixes, project audits, and multi-session continuity.
- **[CUSTOMIZATION.md](./CUSTOMIZATION.md)** -- How to customize commands, rules, team definitions, and overlay settings for your project.
- **[ONBOARDING.md](./ONBOARDING.md)** -- The full onboarding guide with CI integration, pre-commit hooks, and troubleshooting.
- **[COST_TRACKING.md](./COST_TRACKING.md)** -- Token usage logging, session tracking, and monthly cost reports (roadmap).

### Tips for Getting the Most Out of AgentKit Forge

1. **Always start with `/discover`** when opening a project for the first time. It gives the AI a complete map of your codebase.
2. **Run `/healthcheck` before making changes.** If the build is already broken, you want to know before you start.
3. **Use `/plan` for anything non-trivial.** A 2-minute plan saves 20 minutes of wrong-direction implementation.
4. **End every session with `/handoff`.** The handoff document is what makes multi-session work possible.
5. **Let `/orchestrate` drive complex work.** It coordinates teams, manages state, and ensures quality gates are run at every step.
6. **Keep your overlay up to date.** As your project evolves, update `settings.yaml`, `commands.yaml`, and `rules.yaml` to reflect your current standards.
7. **Re-run `sync` after updating overlays.** Changes to overlay files only take effect after regenerating configs with `node .agentkit/engines/node/src/cli.mjs sync`.
