<!-- generated_by: agentkit-forge | last_model: sync-engine | last_updated: 2026-03-08 -->
<!-- Format: Plain Markdown project instructions. Claude reads CLAUDE.md from the repo root. -->
<!-- Docs: https://docs.anthropic.com/en/docs/claude-code/memory#claudemd -->

# agentkit-forge — Claude Code Instructions

## Project Overview

AgentKit Forge framework for multi-tool AI agent team orchestration, sync generation, and quality-gated workflows.

This repository uses **AgentKit Forge** to manage AI agent team workflows across multiple tools.

- **Repository**: agentkit-forge
- **Default Branch**: main
- **Framework Version**: 3.1.0

- **Phase**: active

## Tech Stack

- **Languages**: javascript, yaml, markdown
  - **Backend**: node.js
  - **ORM**: none
  - **Database**: none
  - **Messaging**: none
  - **Architecture**: monolith
  - **API Style**: mixed

## Quick Reference

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `/orchestrate`      | Master coordinator — assess, plan, delegate  |
| `/discover`         | Scan codebase, detect tech stacks            |
| `/review`           | Code review with quality gates               |
| `/check`            | Universal quality gate (lint + test + build) |
| `/plan`             | Structured planning before implementation    |
| `/build`            | Build project (auto-detects stack)           |
| `/test`             | Run tests (auto-detects stack)               |
| `/format`           | Format code (auto-detects stack)             |
| `/deploy`           | Deployment automation                        |
| `/security`         | Security audit                               |
| `/sync-backlog`     | Update AGENT_BACKLOG.md                      |
| `/document-history` | Create history doc for completed work        |

## Team Commands

| Command          | Team                | Focus                     |
| ---------------- | ------------------- | ------------------------- |
| `/team-backend`  | Backend (T1)        | API, services, core logic |
| `/team-frontend` | Frontend (T2)       | UI, components, PWA       |
| `/team-data`     | Data (T3)           | DB, models, migrations    |
| `/team-infra`    | Infrastructure (T4) | IaC, cloud resources      |
| `/team-devops`   | DevOps (T5)         | CI/CD, containers         |
| `/team-testing`  | Testing (T6)        | Quality, coverage         |
| `/team-security` | Security (T7)       | Auth, compliance          |
| `/team-docs`     | Documentation (T8)  | Docs, guides              |
| `/team-product`  | Product (T9)        | Features, PRDs            |
| `/team-quality`  | Quality (T10)       | Review, refactor          |

## Workflow

### 5-Phase Lifecycle

1. **Discovery** — Understand requirements, scan codebase (`/discover`)
2. **Planning** — Design solution, create ADRs (`/plan`)
3. **Implementation** — Write code, add tests (team commands)
4. **Validation** — Verify quality, run gates (`/check`, `/review`)
5. **Ship** — Deploy, document

### Standard Session Flow

```text
/orchestrate --assess-only → Understand current state
/plan                     → Design implementation
/team-<name>              → Execute with appropriate team
/check                    → Verify quality gates
/review                   → Code review
/document-history         → Record what was done and why
```

## Cross-Cutting Conventions

### Authentication

Provider: custom-jwt, strategy: jwt-bearer.
RBAC is enforced.

### API

- Versioning: url-segment
  - Pagination: cursor
  - Response format: envelope

## Testing

- **Unit**: vitest
- **Integration**: vitest

- **Coverage target**: 80%

Always run the full test suite before creating a PR.

## Architecture

- **Agents**: `.claude/agents/` — Specialized AI agents by category
- **Commands**: `.claude/commands/` — Slash command definitions
- **Rules**: `.claude/rules/` — Domain-specific coding rules
- **Hooks**: `.claude/hooks/` — Lifecycle hooks (session-start, protect-sensitive, etc.)
- **State**: `.claude/state/` — Orchestrator state and session tracking

## Documentation

- **PRDs**: `docs/prd/`
- **ADRs**: `docs/architecture/decisions/`
- **API Spec**: `docs/api/`

- **Brand Guide**: `.agentkit/spec/brand.yaml` — AgentKit Forge (primary: `#1976D2`)

### History Documentation (MANDATORY)

After completing significant work (bug fixes, features, implementations, or migrations), **always** create a history document:

```bash
./scripts/create-doc.sh <type> "<title>" [pr-number]
```

| Work Type             | Command                                          | Trigger                                                        |
| --------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Bug fix (non-trivial) | `./scripts/create-doc.sh bugfix "Title"`         | Any bug fix touching 2+ files or requiring root-cause analysis |
| New feature           | `./scripts/create-doc.sh feature "Title"`        | Any user-facing feature or new capability                      |
| Implementation        | `./scripts/create-doc.sh implementation "Title"` | Architecture changes, refactors, new subsystems                |
| Migration             | `./scripts/create-doc.sh migration "Title"`      | Library upgrades, data migrations, infrastructure changes      |

Templates are in `docs/history/` — fill in all sections after generation. The `/review --focus=retrospective` command captures issues and lessons learned separately. See `docs/engineering/06_pr_documentation.md` for the full strategy.

All project documentation follows a domain-driven structure in `docs/`:

| Category         | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| `product/`       | Product vision, strategy, personas, PRDs       |
| `architecture/`  | Specs, ADRs, diagrams, tech stack decisions    |
| `orchestration/` | Orchestration guide, PM guide, protocols       |
| `agents/`        | Agent catalog, roles, team mappings            |
| `api/`           | API reference, authentication, versioning      |
| `operations/`    | Deployment, monitoring, SLAs                   |
| `engineering/`   | Setup, coding standards, testing, contributing |
| `integrations/`  | External services, third-party connections     |
| `reference/`     | Glossary, acronyms, FAQ, tool config           |
| `handoffs/`      | AI session handoff documents                   |
| `history/`       | Bug fixes, features, implementations, lessons  |

## Infrastructure Conventions

- **Naming convention**: `{org}-{env}-{project}-{resourcetype}-{region}`
  - **Default region**: global
  - **Organisation prefix**: akf
  - **Preferred IaC toolchain**: terraform, terragrunt
  - **Mandatory tags** (required on every taggable resource): `environment, project, owner, cost_center`
  - **Optional tags** (recommended): `team, created_by, managed_by`

> **Tagging is enforced.** When creating or modifying IaC resources, always include
> the mandatory tags listed above. Use a shared `locals` block or Terragrunt `inputs`
> for consistency. See `.claude/rules/iac.md` for examples.

## Task Delegation Protocol

Work is delegated between agents using **task files** in `.claude/state/tasks/`.
Each task is a JSON file with a lifecycle: `submitted → accepted → working → completed/failed/rejected`.

**Key rules:**

- The **orchestrator** creates tasks and assigns them to teams.
- Teams **accept or reject** tasks based on scope and accepted types.
- On completion, teams add **artifacts** (files changed, test results) and optionally set `handoffTo` for downstream teams.
- The orchestrator processes handoffs and manages **dependency chains** (`dependsOn` / `blockedBy`).
- Tasks support **fan-out** (parallel delegation) and **chained handoff** (sequential delegation).

See `.claude/state/tasks/` for active task files. See `UNIFIED_AGENT_TEAMS.md` for team coordination protocol.

## Git & PR Conventions

### Commit Messages — Conventional Commits (MANDATORY)

All commit messages **and PR titles** MUST follow Conventional Commits format:

```
type(scope): description
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`, `revert`

**Examples:**

- `feat(auth): add OAuth2 login flow`
- `fix(api): handle null response from payment gateway`
- `docs(readme): update setup instructions`
- `chore(deps): update vitest to v2.1`
- `ci(workflows): add coverage enforcement`
- `refactor(sync): extract template rendering helpers`

**Common mistakes to avoid:**

- `Plan: Brand-Driven Editor Theme` — NOT valid, use `feat(editor): add brand-driven theme generation`
- `Update files` — NOT valid, use `chore: update generated files`
- `WIP` — NOT valid, use `chore(wip): partial implementation of X`

The CI `branch-protection` workflow **rejects PRs** with non-conforming titles. Fix the title before pushing.

### Generated File Sync (MANDATORY)

When you modify any file in `.agentkit/spec/`, you **MUST** run sync before committing:

```bash
pnpm -C .agentkit agentkit:sync
```

Then commit the regenerated output. The CI drift check **will fail** if generated files are out of sync. This is the #1 cause of CI failures across branches.

**Workflow:**

1. Edit spec files in `.agentkit/spec/`
2. Run `pnpm -C .agentkit agentkit:sync`
3. Commit spec changes and generated output together (or in two atomic commits)
4. Verify with `git diff --quiet` — if there's output, you missed something

### Branch Naming

Feature branches: `type/short-description` (e.g., `feat/add-user-auth`, `fix/token-refresh`)

## Safety Rules

1. **Never** commit secrets, API keys, or credentials
2. **Never** force-push to main
3. **Never** run destructive commands without confirmation
4. **Never** modify files in `.agentkit/templates/`, `.agentkit/engines/`, `.agentkit/overlays/`, or `.agentkit/bin/` — these are the upstream source-of-truth for AgentKit Forge and are protected by a PreToolUse hook. Note: `.agentkit/spec/` is the intended edit point for project configuration — modify spec YAML files there and run `agentkit sync` to regenerate output
5. **Never** directly edit files marked `<!-- GENERATED by AgentKit Forge — DO NOT EDIT -->` — modify the spec in `.agentkit/spec/` and run `agentkit sync` instead; if spec files changed, run `pnpm -C .agentkit agentkit:sync` and commit regenerated outputs before creating a PR
6. **Always** run `/check` before creating a PR
7. **Always** use Conventional Commits format for PR titles: `type(scope): description` — CI rejects non-conforming titles (valid types: feat, fix, docs, style, refactor, test, chore, ci, perf, build, revert)
8. **Always** document breaking changes — PRs with `!:` or `BREAKING` in the title must include a `## Breaking Changes` section, ADR reference, or migration guide in the PR body (CI enforces this)
9. **Always** write tests for new functionality

## References

- [COMMAND_GUIDE.md](./COMMAND_GUIDE.md) — When to use orchestrate vs plan vs project-review
- [AGENTS.md](./AGENTS.md) — Universal agent instruction file
- [UNIFIED_AGENT_TEAMS.md](./UNIFIED_AGENT_TEAMS.md) — Full team specification
- [AGENT_BACKLOG.md](./AGENT_BACKLOG.md) — Current backlog
- [QUALITY_GATES.md](./QUALITY_GATES.md) — Definition of done per phase
- [RUNBOOK_AI.md](./RUNBOOK_AI.md) — Recovery procedures
