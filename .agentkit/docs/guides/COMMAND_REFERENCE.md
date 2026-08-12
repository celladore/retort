# AgentKit Forge Command Reference

A unified reference for every slash command available in AgentKit Forge, with usage guidance, flags, and examples.

---

## Table of Contents

1. [Decision Tree](#decision-tree)
2. [Workflow Commands](#workflow-commands)
3. [Team Commands](#team-commands)
4. [Task Management Commands](#task-management-commands)
5. [Utility Commands](#utility-commands)
6. [Diagnostic Commands](#diagnostic-commands)
7. [Slash-Command-Only Commands](#slash-command-only-commands)
8. [Incoming Commands (In-Flight Branches)](#incoming-commands-in-flight-branches)

---

## Decision Tree

Use this flowchart to determine which command to run next.

```text
Which command should I use?
|
+-- Need to understand the codebase?
|   --> /discover
|
+-- Starting a new session?
|   --> /healthcheck  then  /plan
|
+-- Ready to build?
|   +-- Multi-team or complex task?
|   |   --> /orchestrate
|   +-- Single-team, focused task?
|       --> /team-<name>
|
+-- Need to verify quality?
|   --> /check
|
+-- Want a code review?
|   --> /review
|
+-- Done for the day?
|   --> /handoff --save
|
+-- Want a full project audit?
|   --> /project-review
|
+-- Need to sync the backlog?
    --> /sync-backlog
```

---

## Workflow Commands

These seven commands form the core orchestration and lifecycle workflow.

---

### 1. `/orchestrate`

**One-line:** Master coordinator that runs the 5-phase lifecycle (discover, plan, implement, validate, ship) across all teams.

#### When to use

- You have a complex task that spans multiple teams or multiple files.
- You want an end-to-end automated workflow from assessment through shipping.
- You need to resume a previously started orchestration session.

#### When NOT to use

- The task is small and fits within a single team's scope. Use `/team-<name>` instead.
- You only need to check quality. Use `/check` instead.
- You only need to understand the codebase. Use `/discover` instead.

#### Flags

| Flag             | Description                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `--status`       | Print the current orchestrator state and recent events, then exit.                         |
| `--phase N`      | Jump to a specific phase: 1=Discovery, 2=Planning, 3=Implementation, 4=Validation, 5=Ship. |
| `--team <name>`  | Delegate work only to the named team.                                                      |
| `--assess-only`  | Run discovery and healthcheck but do not delegate work. Report state and exit.             |
| `--scope <path>` | Limit orchestration to specific file paths or directories.                                 |
| `--dry-run`      | Show what would be done without making changes.                                            |
| `--force-unlock` | Clear a stale lock from a previous crashed session.                                        |

#### Example invocation

```text
/orchestrate --assess-only
/orchestrate --phase 3 --team backend
/orchestrate "Add rate limiting to auth endpoints"
```

#### Expected output sample

```text
## Orchestration Summary

### Actions Taken
- Ran discovery scan, detected TypeScript + React + Node.js stack
- Healthcheck: HEALTHY (build, lint, typecheck, tests all pass)
- Delegated 2 backlog items to team-backend
- Validation gate: PASS

### Files Changed
- src/middleware/rateLimit.ts (created)
- src/routes/auth.ts (modified)
- src/middleware/__tests__/rateLimit.test.ts (created)

### Updated State
- Phase: 4 (Validation)
- Teams active: backend
- Backlog items completed: 2
- Tests added: 4
```

---

### 2. `/discover`

**One-line:** Scans the repository and produces a full codebase inventory including tech stacks, infrastructure, CI/CD, test frameworks, and issues.

#### When to use

- First time working in a repository.
- The codebase has changed significantly and you need an updated map.
- The orchestrator needs a fresh `AGENT_TEAMS.md` before planning.

#### When NOT to use

- You already know the stack and just need to run checks. Use `/check`.
- You want to fix something. Discovery is read-only.

#### Flags

| Flag                            | Description                                                           |
| ------------------------------- | --------------------------------------------------------------------- |
| `--output yaml\|json\|markdown` | Control the output format of the discovery report. Default: markdown. |
| `--depth <n>`                   | Limit directory traversal depth during scanning.                      |
| `--include-deps`                | Include dependency analysis in the discovery report.                  |

#### Example invocation

```text
/discover
/discover --output json
```

#### Expected output sample

```text
## Repository Profile
- Primary stack: TypeScript + React + Node.js
- Build system: pnpm + Turborepo
- Test framework: Vitest
- CI: GitHub Actions

## Team Assignments
### team-backend
- Focus: API routes, database, server-side logic
- Scope: src/api/**, src/server/**

## Detected Issues
- pnpm-lock.yaml is 3 commits behind package.json
- 42 TODO comments found across 18 files
- Empty test file: src/utils/__tests__/helpers.test.ts
```

---

### 3. `/healthcheck`

**One-line:** Pre-flight validation that verifies dependencies, build, lint, typecheck, and tests are all passing.

#### When to use

- Starting a new session and you want to confirm the project is in a working state.
- Before running `/orchestrate` or `/plan` to establish a baseline.
- After pulling changes to verify nothing is broken.

#### When NOT to use

- You want to fix issues. Healthcheck only reports; it does not fix.
- You need auto-fix capabilities. Use `/check --fix` instead.

#### Flags

| Flag             | Description                                     |
| ---------------- | ----------------------------------------------- |
| `--stack <name>` | Limit checks to a specific tech stack.          |
| `--fix`          | Attempt to auto-fix issues found during checks. |
| `--verbose`      | Show detailed output for each check step.       |

#### Example invocation

```text
/healthcheck
```

#### Expected output sample

```text
## Healthcheck Report

**Branch:** main
**Commit:** a1b2c3d — feat: add user profile endpoint

### Results

| Check        | Status | Duration | Details              |
|-------------|--------|----------|----------------------|
| Dependencies | PASS   | 4.2s     | pnpm install clean   |
| Build        | PASS   | 12.1s    | No errors            |
| Lint         | PASS   | 3.8s     | 0 errors, 2 warnings |
| Typecheck    | PASS   | 5.4s     | 0 errors             |
| Tests        | PASS   | 8.7s     | 142 passed, 0 failed |
| Coverage     | 84%    | --       | Above 80% threshold  |

### Overall Status: HEALTHY
```

---

### 4. `/plan`

**One-line:** Produces a structured implementation plan with steps, file touch list, validation commands, and rollback strategy before any code is written.

#### When to use

- A backlog item involves more than 2 files.
- The change touches shared infrastructure, APIs, or database schemas.
- The orchestrator requests a plan before delegating to teams.
- You want to think through an approach before committing to code.

#### When NOT to use

- The change is trivial (single config tweak, typo fix).
- You are ready to implement and the path is obvious. Go directly to `/team-<name>`.

#### Flags

| Flag                            | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| `--issue <number>`              | GitHub issue number to plan for.               |
| `--output markdown\|yaml\|json` | Output format for the plan. Default: markdown. |
| `--depth high\|medium\|low`     | Level of detail in the plan. Default: medium.  |

#### Example invocation

```text
/plan "Add rate limiting to POST /api/auth/login"
/plan P1: Fix auth middleware token validation
```

#### Expected output sample

```text
## Implementation Plan

### 1. Goal
Add rate limiting to the /api/auth/login endpoint, returning HTTP 429
after 5 failed attempts within 15 minutes per IP address.

### 2. Assumptions
- The application uses Express.js middleware
- Redis is available for storing rate limit counters

### 3. Steps
1. Create rate limit middleware in src/middleware/rateLimit.ts
2. Add Redis client initialization in src/lib/redis.ts
3. Attach middleware to POST /api/auth/login in src/routes/auth.ts
4. Add tests in src/middleware/__tests__/rateLimit.test.ts

### 4. File Touch List
| File                                        | Action | Description              |
|---------------------------------------------|--------|--------------------------|
| src/middleware/rateLimit.ts                  | CREATE | Rate limiting middleware  |
| src/lib/redis.ts                            | MODIFY | Add Redis client export  |
| src/routes/auth.ts                          | MODIFY | Attach rate limit        |
| src/middleware/__tests__/rateLimit.test.ts   | CREATE | Rate limit tests         |

### 5. Validation Plan
1. pnpm build
2. npx tsc --noEmit
3. npx vitest run src/middleware/__tests__/rateLimit.test.ts

### 6. Rollback Plan
1. git revert <sha>

### 7. Risks
- Redis connection failure would block all login attempts
```

---

### 5. `/check`

**One-line:** Universal quality gate that runs format, lint, typecheck, test, and build checks in a single pass with auto-detection.

#### When to use

- After making changes, before committing or creating a PR.
- As a final validation step before shipping.
- To get a full quality report on the current state of the codebase.

#### When NOT to use

- You only need to run tests. Use `/test` for a faster, focused test run.
- You only need to format. Use `/format` for formatting only.

#### Flags

| Flag              | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `--fix`           | Enable auto-fix mode (format writes, lint auto-fix).                            |
| `--fast`          | Skip the build step; only run format + lint + typecheck.                        |
| `--stack <scope>` | Limit checks to a subdirectory or workspace (e.g., `frontend`, `packages/api`). |
| `--bail`          | Stop at the first failing step instead of running all steps.                    |

#### Example invocation

```text
/check
/check --fix
/check --fast --stack frontend
/check --fix --bail
```

#### Expected output sample

```text
## Quality Gate Results

**Scope:** all
**Mode:** check

| Step      | Status | Duration | Details              |
|-----------|--------|----------|----------------------|
| Format    | PASS   | 2.1s     | 0 files need changes |
| Lint      | FAIL   | 3.4s     | 3 errors, 1 warning  |
| Typecheck | PASS   | 5.2s     | 0 errors             |
| Tests     | PASS   | 9.8s     | 142 passed, 0 failed |
| Build     | PASS   | 11.3s    | Clean build          |

### Overall: FAIL

### Failures (Detail)
Lint errors:
  src/api/handlers.ts:42 — 'res' is defined but never used (@typescript-eslint/no-unused-vars)
  src/api/handlers.ts:67 — Unexpected any (@typescript-eslint/no-explicit-any)
  src/utils/parse.ts:15 — Missing return type (@typescript-eslint/explicit-function-return-type)
```

---

### 6. `/review`

**One-line:** Structured code review that evaluates changes for correctness, security, performance, test coverage, and documentation quality.

#### When to use

- Before creating or merging a pull request.
- After a team completes implementation and you want an automated review pass.
- To catch security issues, missing tests, or logic errors.

#### When NOT to use

- You want to run linters and formatters. Use `/check`.
- You have not made any changes yet. Review operates on diffs.

#### Flags

| Flag                 | Description                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| `--pr <number>`      | GitHub PR number to review.                                                   |
| `--range <ref>`      | Specify a commit range to review (e.g., `main..HEAD`, `abc123..def456`).      |
| `--file <path>`      | Review a specific file instead of the full diff.                              |
| `--focus <area>`     | Focus area: security, performance, correctness, style, or all. Default: all.  |
| `--severity <level>` | Minimum severity to report: info, warning, error, critical. Default: warning. |

#### Example invocation

```text
/review
/review --range main..HEAD
/review --file src/auth/middleware.ts
```

#### Expected output sample

```text
## Code Review

**Reviewed:** main..HEAD (4 files, 187 additions, 23 deletions)
**Verdict:** REQUEST_CHANGES

### Findings

#### Required Changes (must fix before merge)
- [ ] [SECURITY] src/api/users.ts:34 — User input passed directly to SQL query without parameterization
- [ ] [CORRECTNESS] src/auth/session.ts:89 — Token expiry check uses < instead of <=, off-by-one on boundary

#### Suggestions (recommended but not blocking)
- [PERFORMANCE] src/api/users.ts:52 — N+1 query pattern; consider batching with IN clause
- [READABILITY] src/utils/helpers.ts:12 — Magic number 86400 should be a named constant (SECONDS_PER_DAY)

#### Positive Notes
- Good test coverage for the new rate limiter
- Clean separation of concerns in the middleware layer
```

---

### 7. `/handoff`

**One-line:** Generates a session handoff document so the next session (human or AI) can pick up exactly where this one left off.

#### When to use

- You are ending a work session and want to preserve context.
- You need to pass work to another developer or agent.
- The orchestrator has completed a run and needs to record what happened.

#### When NOT to use

- You are in the middle of active work. Finish or reach a stopping point first.
- You have not done anything yet this session. There is nothing to hand off.

#### Flags

| Flag             | Description                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `--save`         | Write the handoff to the archive directory (`docs/ai_handoffs/`) in addition to console output. |
| `--format <fmt>` | Output format: markdown or yaml. Default: markdown.                                             |
| `--include-diff` | Include a summary of all file changes in the handoff.                                           |
| `--tag <tag>`    | Tag for categorizing the handoff (e.g., feature, bugfix, spike).                                |

#### Example invocation

```text
/handoff
/handoff --save
```

#### Expected output sample

````text
# Session Handoff

**Date:** 2026-02-23T17:30:00Z
**Branch:** feature/rate-limiting
**Last Commit:** a1b2c3d — feat: add rate limiter middleware
**Overall Status:** HEALTHY

## What Was Done
- Created rate limiting middleware in src/middleware/rateLimit.ts
- Integrated with auth login endpoint in src/routes/auth.ts
- Added 4 unit tests covering happy path and edge cases
- All quality gates pass (format, lint, typecheck, tests, build)

## Current Blockers
- None

## Next 3 Actions
1. Open PR for feature/rate-limiting targeting main
2. Add Redis connection retry logic (logged as P2 backlog item)
3. Run /security to audit the new middleware for edge cases

## How to Validate
```bash
pnpm build && npx vitest run && npx tsc --noEmit
```
````

---

## Team Commands

Team commands invoke a specialized agent scoped to a particular domain. Each team reads from `AGENT_BACKLOG.md`, completes 1-3 high-priority items within its scope, runs quality gates, and produces a structured report.

| Command          | Team                | Owns                                                           | When to Invoke                                                                        |
| ---------------- | ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/team-backend`  | Backend (T1)        | API endpoints, services, server-side logic, request validation | Building or fixing API routes, service-layer code, backend error handling             |
| `/team-frontend` | Frontend (T2)       | UI components, client state, routing, accessibility            | Building or fixing React components, pages, client-side state, responsive layout      |
| `/team-data`     | Data (T3)           | Database schemas, migrations, ORM config, query optimization   | Creating or modifying database migrations, schema changes, query performance          |
| `/team-infra`    | Infrastructure (T4) | Terraform, Docker, cloud config, environment provisioning      | Modifying Dockerfiles, Terraform modules, cloud resource configuration                |
| `/team-devops`   | DevOps (T5)         | CI/CD pipelines, containers, deployment automation             | Fixing or creating GitHub Actions workflows, pipeline configuration, build automation |
| `/team-testing`  | Testing (T6)        | Test strategy, coverage enforcement, E2E tests, benchmarks     | Writing or fixing tests, improving coverage, setting up test infrastructure           |
| `/team-security` | Security (T7)       | Authentication, authorization, security middleware, compliance | Implementing auth flows, fixing security vulnerabilities, hardening endpoints         |
| `/team-docs`     | Documentation (T8)  | Docs, ADRs, runbooks, onboarding guides                        | Writing or updating documentation, creating ADRs, maintaining operational runbooks    |
| `/team-product`  | Product (T9)        | PRDs, feature specs, user stories, roadmap                     | Drafting product requirements, writing user stories, defining acceptance criteria     |
| `/team-quality`  | Quality (T10)       | Code review, refactoring, quality gate definitions             | Refactoring code for maintainability, reviewing code quality, enforcing standards     |

### Flags (all team commands)

| Flag            | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `--task <text>` | Specify a specific task instead of pulling from the backlog. |

#### How team commands work

1. The team agent activates with its predefined role, scope, and conventions.
2. Without `--task`, it reads `AGENT_BACKLOG.md` and picks the highest-priority item within its scope.
3. It implements the work, runs quality gates (`/check`), and produces a structured report.
4. If the team's handoff chain is defined (in `teams.yaml`), it notes the next team to continue.

**What happens when no backlog items exist:** The team agent reports that no actionable items are in its scope and suggests running `/discover` or `/sync-backlog` to populate the backlog.

#### Example invocations

```text
/team-backend                              -- picks up highest-priority backend backlog items
/team-frontend                             -- works on frontend backlog items
/team-testing                              -- writes tests for recently changed code
/team-security                             -- audits and hardens auth flows
/team-backend --task "Add pagination to GET /api/users"  -- specific task
```

---

## Utility Commands

These commands perform focused, single-purpose operations. They are often invoked by the workflow commands internally but can also be used standalone.

---

### `/build`

Build the project with auto-detected stack. Supports scoped builds for monorepos.

#### Flags

| Flag               | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `--stack <name>`   | Limit build to a specific tech stack (node, dotnet, rust, python). |
| `--package <name>` | Build a specific package in a monorepo.                            |
| `--production`     | Run a production-optimized build.                                  |
| `--verbose`        | Show detailed build output.                                        |

```text
/build
/build packages/api
/build --stack node --production
```

---

### `/test`

Run the test suite with auto-detected framework. Supports scoped runs, filters, watch mode, and coverage.

#### Flags

| Flag                 | Description                                        |
| -------------------- | -------------------------------------------------- |
| `--stack <name>`     | Limit tests to a specific tech stack.              |
| `--filter <pattern>` | Run only tests matching the given name or pattern. |
| `--coverage`         | Generate coverage report after test run.           |
| `--watch`            | Run tests in watch mode (re-run on file changes).  |
| `--package <name>`   | Run tests for a specific monorepo package.         |
| `--bail`             | Stop on first test failure.                        |
| `--update-snapshots` | Update snapshot files.                             |
| `--verbose`          | Show detailed test output.                         |

```text
/test
/test src/auth/
/test --coverage
/test --filter "should validate token" --bail
```

---

### `/format`

Run code formatters across the project. Defaults to write mode (applies fixes). Supports scoped formatting and staged-files-only mode.

#### Flags

| Flag             | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `--stack <name>` | Limit formatting to a specific tech stack.                              |
| `--check`        | Check formatting without writing changes. Exit non-zero if unformatted. |
| `--path <path>`  | Format only files under the specified path.                             |
| `--staged`       | Format only git-staged files.                                           |
| `--changed`      | Format only files changed since the last commit.                        |

```text
/format
/format --check
/format --staged
/format --path src/api/
```

---

### `/deploy`

Deployment automation with safety checks, explicit confirmation gates, and rollback support. Requires user confirmation before executing any deployment.

#### Flags

| Flag                  | Description                                         |
| --------------------- | --------------------------------------------------- |
| `--environment <env>` | Target environment (e.g., staging, production).     |
| `--dry-run`           | Show what would be deployed without executing.      |
| `--skip-checks`       | Skip pre-deployment healthcheck (use with caution). |
| `--stack <name>`      | Deploy only a specific stack in a polyglot project. |
| `--rollback`          | Roll back the last deployment.                      |
| `--tag <version>`     | Deploy a specific version tag.                      |

```text
/deploy staging
/deploy production --dry-run
/deploy --rollback
```

---

### `/security`

Full security audit covering OWASP Top 10, dependency vulnerabilities, auth flow review, and hardcoded secrets scan.

#### Flags

| Flag                                        | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| `--scan-type deps\|secrets\|code\|all`      | Type of security scan to run. Default: all.             |
| `--severity info\|warning\|error\|critical` | Minimum severity to report. Default: warning.           |
| `--fix`                                     | Attempt to auto-fix issues (e.g., dependency upgrades). |
| `--output json\|markdown`                   | Output format. Default: markdown.                       |

```text
/security
/security src/auth/
/security --scan-type deps --fix
/security --severity critical --output json
```

---

### `/sync-backlog`

Updates `AGENT_BACKLOG.md` by gathering work items from discovery findings, healthcheck results, orchestrator state, code TODOs, and review findings. Prioritizes and assigns items to teams.

#### Flags

| Flag                           | Description                                                       |
| ------------------------------ | ----------------------------------------------------------------- |
| `--direction pull\|push\|both` | Sync direction: pull from GitHub Issues, push to Issues, or both. |
| `--labels <csv>`               | Filter GitHub Issues by labels (comma-separated).                 |
| `--team <name>`                | Only sync backlog items for a specific team.                      |

```text
/sync-backlog
/sync-backlog --direction pull --labels "bug,priority:high"
/sync-backlog --team backend
```

---

### `/project-review`

Runs a comprehensive project-wide audit combining discovery, healthcheck, security scan, and quality gate checks into a single consolidated report. Use this for periodic full-project health assessments.

#### Flags

| Flag             | Description                                                           |
| ---------------- | --------------------------------------------------------------------- |
| `--scope <path>` | Limit the review to a specific directory or set of files.             |
| `--focus <area>` | Focus area: security, performance, correctness, architecture, or all. |
| `--phase <n>`    | Run only a specific phase of the review.                              |

```text
/project-review
/project-review --scope src/api/ --focus security
```

---

### `/cost`

Displays AI token usage summaries, session costs, and budget status. See [COST_TRACKING.md](../architecture/COST_TRACKING.md) for full details on cost tracking configuration.

#### Flags

| Flag                | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `--summary`         | Show recent session overview with durations and file counts. |
| `--sessions`        | List recent sessions.                                        |
| `--report`          | Generate an aggregate monthly usage report.                  |
| `--month <YYYY-MM>` | Month for the report (default: current month).               |
| `--format <fmt>`    | Export format: json, csv (default: table).                   |
| `--last <period>`   | Time period for session listing (e.g., 7d, 30d).             |

```text
/cost --summary
/cost --sessions --last 7d
/cost --report --month 2026-02 --format json
```

---

## Task Management Commands

These commands manage the delegated task system used by the orchestrator and team agents.

---

### `/tasks`

**One-line:** List, filter, and inspect delegated tasks across all teams.

#### When to use

- You want to see what tasks are pending, in-progress, or completed.
- You need to check the status of a specific task by ID.
- You want to filter tasks by team, priority, or status before deciding what to work on next.

#### Flags

| Flag                 | Description                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--status <status>`  | Filter by task status (submitted, accepted, working, completed, failed, rejected, canceled). Maps to the task protocol lifecycle defined in `task-protocol.mjs`. |
| `--assignee <team>`  | Filter by assigned team (e.g., backend, frontend).                                                                                                               |
| `--id <task-id>`     | Show details for a specific task.                                                                                                                                |
| `--type <type>`      | Filter by task type (implement, review, plan, investigate, test, document).                                                                                      |
| `--priority <level>` | Filter by priority (P0, P1, P2, P3).                                                                                                                             |
| `--process-handoffs` | Process handoff chains before listing tasks.                                                                                                                     |

#### Example invocations

```text
/tasks                                  -- list all tasks
/tasks --status submitted --assignee backend
/tasks --id TASK-042
/tasks --priority P0 --status submitted   -- show urgent unstarted work
```

#### Expected output sample

```text
## Delegated Tasks

| ID       | Title                          | Team     | Priority | Status      | Type       |
|----------|-------------------------------|----------|----------|-------------|------------|
| TASK-001 | Add rate limiting middleware   | backend  | P1       | completed   | implement  |
| TASK-002 | Write rate limit tests        | testing  | P1       | in-progress | test       |
| TASK-003 | Update API docs for rate limit| docs     | P2       | pending     | document   |

Total: 3 tasks (1 completed, 1 in-progress, 1 pending)
```

---

### `/delegate`

**One-line:** Create a new delegated task and assign it to a team with optional dependencies and handoff chains.

#### When to use

- You want to break a large effort into team-scoped tasks.
- The orchestrator has identified work that should be routed to a specific team.
- You need to set up task dependencies (task B waits for task A).

#### Flags

| Flag                     | Description                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `--to <team>`            | **(Required)** The team to assign the task to.                                       |
| `--title <text>`         | **(Required)** Short title for the task.                                             |
| `--type <type>`          | Task type: implement, review, plan, investigate, test, document. Default: implement. |
| `--priority <level>`     | Priority level: P0, P1, P2, P3. Default: P2.                                         |
| `--depends-on <task-id>` | Task ID that must complete before this task can start.                               |
| `--handoff-to <team>`    | Team to automatically hand off to when this task completes.                          |
| `--scope <path>`         | File path or directory scope for the task.                                           |
| `--description <text>`   | Detailed description of what needs to be done.                                       |

#### Example invocations

```text
/delegate --to backend --title "Add pagination to GET /api/users" --priority P1
/delegate --to testing --title "Write E2E tests for auth flow" --depends-on TASK-001
/delegate --to docs --title "Update API reference" --handoff-to quality --type document
```

#### Expected output sample

```text
## Task Created

**ID:** TASK-004
**Title:** Add pagination to GET /api/users
**Assigned to:** team-backend
**Priority:** P1
**Type:** implement
**Status:** pending
**Dependencies:** none
**Handoff:** none

Task added to AGENT_BACKLOG.md. Run `/team-backend` to begin work.
```

---

## Diagnostic Commands

---

### `/doctor`

**One-line:** Runs AgentKit Forge diagnostics to verify your setup, configuration, and environment health.

#### When to use

- Something is not working and you need to identify the problem.
- After initial setup to verify everything is configured correctly.
- After upgrading AgentKit Forge to verify the migration succeeded.

#### When NOT to use

- You want to check code quality. Use `/check` instead.
- You want to validate generated outputs. Use `agentkit validate` (CLI) instead.

#### Flags

| Flag        | Description                      |
| ----------- | -------------------------------- |
| `--verbose` | Show detailed diagnostic output. |

#### Example invocations

```text
/doctor
/doctor --verbose
```

#### Expected output sample

```text
## AgentKit Forge Diagnostics

| Check                  | Status | Details                              |
|-----------------------|--------|--------------------------------------|
| Node.js version       | PASS   | v22.12.0 (>=22.0.0 required)        |
| pnpm version          | PASS   | 10.30.3 (>=9.0.0 required)          |
| Git version           | PASS   | 2.43.0 (>=2.30.0 required)          |
| .agentkit/ directory  | PASS   | Found at project root                |
| package.json          | PASS   | Valid, version 3.1.0                 |
| Spec files            | PASS   | 8/8 YAML files valid                 |
| Overlay               | PASS   | my-project overlay found             |
| Node modules          | PASS   | Dependencies installed               |
| Generated files       | WARN   | 3 files out of date (run sync)       |
| Lock file             | PASS   | No stale locks                       |

### Overall: PASS (1 warning)

Run `pnpm --dir .agentkit agentkit:sync` to regenerate outdated files.
```

---

## Slash-Command-Only Commands

These commands are available only as slash commands within AI coding tools. They cannot be invoked via the CLI.

---

### `/scaffold`

**One-line:** Generates convention-aligned code skeletons (files, modules, components) based on project patterns and stack.

#### When to use

- You need to create a new file that should follow project conventions (component, service, test, migration).
- You want boilerplate generated with correct imports, naming, and structure.

#### Flags

| Flag             | Description                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `--type <type>`  | Scaffold type (e.g., component, service, middleware, migration, test). |
| `--name <name>`  | Name for the generated entity.                                         |
| `--stack <name>` | Tech stack context (auto-detected if omitted).                         |
| `--path <path>`  | Target directory for the generated file(s).                            |

#### Example invocations

```text
/scaffold --type component --name UserProfile
/scaffold --type service --name billing --stack node
/scaffold --type migration --name add-user-preferences
```

---

### `/preflight`

**One-line:** Release-readiness checks that verify the project is ready to ship, including changelog, version, tests, and documentation.

#### When to use

- Before cutting a release to verify all release criteria are met.
- As part of a release checklist to catch missing items.

#### Flags

| Flag              | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `--stack <name>`  | Limit checks to a specific tech stack.                   |
| `--base <ref>`    | Base branch or commit to compare against. Default: main. |
| `--range <range>` | Git commit range to check (e.g., v1.0.0..HEAD).          |
| `--strict`        | Fail on warnings in addition to errors.                  |

#### Example invocations

```text
/preflight
/preflight --base main --strict
/preflight --range v1.0.0..HEAD
```

---

## Incoming Commands (In-Flight Branches)

> **Note:** The following commands are being developed on active branches and are not yet merged into `dev` or `main`. This section documents them preemptively so that documentation stays ahead of code delivery. Update this section and move entries to the main reference as each branch merges.

---

### `/infra-eval`

**Branch:** `claude/agentforge-template-integration-eCegs`

**One-line:** Risk-aware infrastructure and codebase fitness evaluation scoring 8 weighted dimensions with hard gate enforcement.

#### When to use

- Quarterly reassessment of infrastructure health.
- Pre-funding due diligence on technical maturity.
- Before architectural decisions that affect reliability or cost.

#### Flags

| Flag             | Description                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `--scope <path>` | Limit evaluation to specific paths or modules.                                                   |
| `--focus <area>` | Target dimension: all, reliability, cost, security, infra, scalability, architecture, code, ops. |
| `--output <fmt>` | Output format: markdown, json, yaml.                                                             |
| `--save`         | Save report to `docs/evaluations/`. Default: true.                                               |
| `--no-save`      | Do not save report.                                                                              |
| `--gates-only`   | Run hard gate checks only (skip dimensional scoring).                                            |

#### 8 evaluation dimensions (weighted)

1. Reliability & Resilience (18%)
2. Cost Efficiency (16%)
3. Security & Compliance (14%)
4. Infrastructure & Delivery Safety (12%)
5. Scalability Path (12%)
6. Architecture Quality (10%)
7. Code Quality (10%)
8. Operational Maturity (8%)

**Hard gates (non-negotiable):** Any gate failure = overall FAIL.

- G1: No tested backup restore for critical data
- G2: No cost attribution or billing explanation
- G3: No content moderation audit trail (if applicable)
- G4: No rollback strategy for production
- G5: Identity/role boundaries not technically enforced (if multi-role)

**Integration:** Wired into `/orchestrate` Phase 4 (Validate). New event type: `INFRA_EVAL_COMPLETED`. Requires `evaluation.infraEval: true` in `project.yaml` to enable.

---

### `/brand`

**Branch:** `claude/repo-specific-editor-theme-zMOG1`

**One-line:** Brand management and editor theme generation from a centralized `brand.yaml` specification.

#### When to use

- Scaffolding a new brand identity for your repository.
- Generating editor themes (VS Code, Cursor, Windsurf) from brand colors.
- Auditing accessibility compliance (WCAG) of your color palette.

#### Modes

| Flag         | Description                                              |
| ------------ | -------------------------------------------------------- |
| `--init`     | Scaffold `brand.yaml` and `editor-theme.yaml` templates. |
| `--validate` | Validate brand spec for completeness and accessibility.  |
| `--palette`  | Preview color palette with contrast ratios.              |
| `--theme`    | Regenerate editor theme files from brand spec.           |
| `--contrast` | Audit WCAG compliance of color combinations.             |
| `--all`      | Run all validations and generation.                      |

#### Key files

- `.agentkit/spec/brand.yaml` — Brand identity specification (colors, typography, spacing, motion, accessibility)
- `.agentkit/spec/editor-theme.yaml` — Maps brand colors to editor UI elements (light/dark mode)
- `.agentkit/engines/node/src/brand-resolver.mjs` — Color resolution and validation engine

---

### `/feature-configure`

**Branch:** `claude/feature-management-strategy-1jUSw`

**One-line:** Interactive workflow to configure which AgentKit Forge features are enabled for your repository.

#### When to use

- Initial setup to choose a feature preset (minimal, lean, standard, full).
- Enabling or disabling specific features with dependency checking.
- Previewing changes before applying with dry-run mode.

#### Presets

| Preset     | Features | Description                                          |
| ---------- | -------- | ---------------------------------------------------- |
| `minimal`  | 5        | Sync + basic quality gates, no team orchestration    |
| `lean`     | 8        | Quality + docs, no team overhead (solo developers)   |
| `standard` | 12       | **Default** — teams + quality + docs + security      |
| `full`     | 20       | Everything including cost tracking, MCP, healthcheck |

#### Key files

- `.agentkit/spec/features.yaml` — Canonical registry of all kit features with dependencies
- `.agentkit/engines/node/src/feature-manager.mjs` — Feature resolution engine

#### CLI equivalents

```bash
agentkit features                          # List features and status
agentkit features enable <id> [id2...]     # Enable specific features
agentkit features disable <id> [id2...]    # Disable specific features
agentkit features preset <name>            # Apply preset
```

---

### `/feature-flow`

**Branch:** `claude/feature-management-strategy-1jUSw`

**One-line:** End-to-end tracing of a feature from spec definition through template rendering to generated output.

#### When to use

- Debugging why a feature's generated output looks wrong.
- Understanding the full resolution chain for a specific feature.
- Verifying template variable injection is correct.

#### Flags

| Flag               | Description                                    |
| ------------------ | ---------------------------------------------- |
| `--show-output`    | Include generated output file contents.        |
| `--show-templates` | Include raw template content before rendering. |

---

### `/feature-review`

**Branch:** `claude/feature-management-strategy-1jUSw`

**One-line:** Audit feature configuration for consistency, recommend features based on codebase analysis, and detect stale configs.

#### Flags

| Flag          | Description                                                      |
| ------------- | ---------------------------------------------------------------- |
| `--recommend` | Scan codebase and recommend features based on detected patterns. |
| `--audit`     | Check if enabled features have corresponding generated files.    |

---

### `/review --focus=retrospective`

**Branch:** `claude/elegant-knuth-iSy89`

**One-line:** Session-aware retrospective mode that reviews conversation history to extract issues encountered and lessons learned.

#### When to use

- End of a sprint or development session to capture institutional knowledge.
- After resolving a difficult bug to document the debugging process.
- To build a library of lessons for future sessions.

#### New `/review` flags (this branch)

| Flag                    | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| `--focus=retrospective` | Activate retrospective mode instead of code review.                  |
| `--open-issues`         | Automatically file issues in external tracker for critical findings. |
| `--dry-run`             | Preview findings without writing files or creating issues.           |

#### Expanded review criteria (7-10, new)

| #   | Criterion                 | Description                                                 |
| --- | ------------------------- | ----------------------------------------------------------- |
| 7   | Completeness              | Ensures features are fully implemented, no stubs/TODOs left |
| 8   | Documentation Gaps        | Validates all public APIs/components/changes have docs      |
| 9   | Bug Detection             | Identifies latent bugs and race conditions                  |
| 10  | Enhancement Opportunities | Non-blocking improvement suggestions                        |

#### Output locations

- `docs/history/issues/` — Records of issues encountered during sessions
- `docs/history/lessons-learned/` — Lessons extracted from retrospectives

**New agent:** `retrospective-analyst` (operations category) — activates when `--focus=retrospective` is used.

---

### Merge Conflict Resolution (Not a Command)

**Branch:** `claude/resolve-merge-conflicts-WBEqO`

**What it adds:** Automated merge conflict resolution system for generated files. Not a slash command, but a supporting system.

#### Key components

- `scripts/resolve-merge.sh` / `.ps1` — Cross-platform resolution script
- `.github/workflows/merge-conflict-detection.yml` — CI workflow that detects conflicts on open PRs and posts resolution instructions
- `.gitattributes` updates — Custom `agentkit-generated` merge driver for auto-resolved files

**Auto-resolved files:** Generated skill packs, agent metadata, chat modes, prompt definitions, doc indexes, Copilot config, PR templates, lockfiles.

**Manual resolution required:** Engine source (`.agentkit/engines/**`), spec files (`.agentkit/spec/*.yaml`), source code.

---

### CI/CD Infrastructure Review (Not a Command)

**Branch:** `claude/review-cicd-infrastructure-vsSil`

**What it adds:** A 502-line audit document (`docs/reviews/cicd-infrastructure-review-2026-03-04.md`) analyzing 28 identified issues across CI/CD pipeline gaps, infrastructure generation, agent workforce alignment, and security/supply chain. Provides a 4-wave remediation roadmap.

---

### Issue Intake Ownership Flow (Not a Command)

**Branch:** `docs/issue-intake-ownership-flow`

**What it adds:** Specification for configurable issue intake from GitHub and Linear trackers, with ownership routing, team assignment, and escalation rules. Enhances the existing `/sync-backlog` command to be tracker-neutral.
