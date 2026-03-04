# AgentKit Forge Command Reference

A unified reference for every slash command available in AgentKit Forge, with usage guidance, flags, and examples.

---

## Table of Contents

1. [Decision Tree](#decision-tree)
2. [Workflow Commands](#workflow-commands)
3. [Team Commands](#team-commands)
4. [Utility Commands](#utility-commands)

---

## Decision Tree

Use this flowchart to determine which command to run next.

```
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

**When to use:**

- You have a complex task that spans multiple teams or multiple files.
- You want an end-to-end automated workflow from assessment through shipping.
- You need to resume a previously started orchestration session.

**When NOT to use:**

- The task is small and fits within a single team's scope. Use `/team-<name>` instead.
- You only need to check quality. Use `/check` instead.
- You only need to understand the codebase. Use `/discover` instead.

**Flags:**

| Flag             | Description                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `--status`       | Print the current orchestrator state and recent events, then exit.                         |
| `--phase N`      | Jump to a specific phase: 1=Discovery, 2=Planning, 3=Implementation, 4=Validation, 5=Ship. |
| `--team <name>`  | Delegate work only to the named team.                                                      |
| `--assess-only`  | Run discovery and healthcheck but do not delegate work. Report state and exit.             |
| `--dry-run`      | Show what would be done without making changes.                                            |
| `--force-unlock` | Clear a stale lock from a previous crashed session.                                        |

**Example invocation:**

```
/orchestrate --assess-only
/orchestrate --phase 3 --team backend
/orchestrate "Add rate limiting to auth endpoints"
```

**Expected output sample:**

```
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

**When to use:**

- First time working in a repository.
- The codebase has changed significantly and you need an updated map.
- The orchestrator needs a fresh `AGENT_TEAMS.md` before planning.

**When NOT to use:**

- You already know the stack and just need to run checks. Use `/check`.
- You want to fix something. Discovery is read-only.

**Flags:**

| Flag                            | Description                                                           |
| ------------------------------- | --------------------------------------------------------------------- |
| `--output yaml\|json\|markdown` | Control the output format of the discovery report. Default: markdown. |

**Example invocation:**

```
/discover
/discover --output json
```

**Expected output sample:**

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

## Detected Issues
- pnpm-lock.yaml is 3 commits behind package.json
- 42 TODO comments found across 18 files
- Empty test file: src/utils/__tests__/helpers.test.ts
```

---

### 3. `/healthcheck`

**One-line:** Pre-flight validation that verifies dependencies, build, lint, typecheck, and tests are all passing.

**When to use:**

- Starting a new session and you want to confirm the project is in a working state.
- Before running `/orchestrate` or `/plan` to establish a baseline.
- After pulling changes to verify nothing is broken.

**When NOT to use:**

- You want to fix issues. Healthcheck only reports; it does not fix.
- You need auto-fix capabilities. Use `/check --fix` instead.

**Flags:**

| Flag             | Description                                     |
| ---------------- | ----------------------------------------------- |
| `--stack <name>` | Limit checks to a specific tech stack.          |
| `--fix`          | Attempt to auto-fix issues found during checks. |
| `--verbose`      | Show detailed output for each check step.       |

**Example invocation:**

```
/healthcheck
```

**Expected output sample:**

```
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

**When to use:**

- A backlog item involves more than 2 files.
- The change touches shared infrastructure, APIs, or database schemas.
- The orchestrator requests a plan before delegating to teams.
- You want to think through an approach before committing to code.

**When NOT to use:**

- The change is trivial (single config tweak, typo fix).
- You are ready to implement and the path is obvious. Go directly to `/team-<name>`.

**Flags:** None. Pass the task description or backlog item reference as arguments.

**Example invocation:**

```
/plan "Add rate limiting to POST /api/auth/login"
/plan P1: Fix auth middleware token validation
```

**Expected output sample:**

```
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

**When to use:**

- After making changes, before committing or creating a PR.
- As a final validation step before shipping.
- To get a full quality report on the current state of the codebase.

**When NOT to use:**

- You only need to run tests. Use `/test` for a faster, focused test run.
- You only need to format. Use `/format` for formatting only.

**Flags:**

| Flag              | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `--fix`           | Enable auto-fix mode (format writes, lint auto-fix).                            |
| `--fast`          | Skip the build step; only run format + lint + typecheck.                        |
| `--stack <scope>` | Limit checks to a subdirectory or workspace (e.g., `frontend`, `packages/api`). |
| `--bail`          | Stop at the first failing step instead of running all steps.                    |

**Example invocation:**

```
/check
/check --fix
/check --fast --stack frontend
/check --fix --bail
```

**Expected output sample:**

```
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

**When to use:**

- Before creating or merging a pull request.
- After a team completes implementation and you want an automated review pass.
- To catch security issues, missing tests, or logic errors.

**When NOT to use:**

- You want to run linters and formatters. Use `/check`.
- You have not made any changes yet. Review operates on diffs.

**Flags:**

| Flag                 | Description                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| `--pr <number>`      | GitHub PR number to review.                                                   |
| `--range <ref>`      | Specify a commit range to review (e.g., `main..HEAD`, `abc123..def456`).      |
| `--file <path>`      | Review a specific file instead of the full diff.                              |
| `--focus <area>`     | Focus area: security, performance, correctness, style, or all. Default: all.  |
| `--severity <level>` | Minimum severity to report: info, warning, error, critical. Default: warning. |

**Example invocation:**

```
/review
/review --range main..HEAD
/review --file src/auth/middleware.ts
```

**Expected output sample:**

```
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

**When to use:**

- You are ending a work session and want to preserve context.
- You need to pass work to another developer or agent.
- The orchestrator has completed a run and needs to record what happened.

**When NOT to use:**

- You are in the middle of active work. Finish or reach a stopping point first.
- You have not done anything yet this session. There is nothing to hand off.

**Flags:**

| Flag             | Description                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `--save`         | Write the handoff to the archive directory (`docs/ai_handoffs/`) in addition to console output. |
| `--format <fmt>` | Output format: markdown or yaml. Default: markdown.                                             |
| `--include-diff` | Include a summary of all file changes in the handoff.                                           |
| `--tag <tag>`    | Tag for categorizing the handoff (e.g., feature, bugfix, spike).                                |

**Example invocation:**

```
/handoff
/handoff --save
```

**Expected output sample:**

````
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

**Example invocations:**

```
/team-backend          -- picks up highest-priority backend backlog items
/team-frontend         -- works on frontend backlog items
/team-testing          -- writes tests for recently changed code
/team-security         -- audits and hardens auth flows
```

---

## Utility Commands

These commands perform focused, single-purpose operations. They are often invoked by the workflow commands internally but can also be used standalone.

---

### `/build`

Build the project with auto-detected stack. Supports scoped builds for monorepos.

**Flags:** `--verbose`, `--clean`

```
/build
/build packages/api
/build --clean
```

---

### `/test`

Run the test suite with auto-detected framework. Supports scoped runs, filters, watch mode, and coverage.

**Flags:** `--watch`, `--coverage`, `--verbose`, `--update-snapshots`, `--bail`

```
/test
/test src/auth/
/test --coverage
/test "should validate token" --bail
```

---

### `/format`

Run code formatters across the project. Defaults to write mode (applies fixes). Supports scoped formatting and staged-files-only mode.

**Flags:** `--check`, `--staged`, `--changed`

```
/format
/format --check
/format --staged
/format src/api/
```

---

### `/deploy`

Deployment automation with safety checks, explicit confirmation gates, and rollback support. Requires user confirmation before executing any deployment.

**Flags:** `--dry-run`, `--skip-healthcheck`, `--rollback`, `--tag <version>`

```
/deploy staging
/deploy production --dry-run
/deploy --rollback
```

---

### `/security`

Full security audit covering OWASP Top 10, dependency vulnerabilities, auth flow review, and hardcoded secrets scan. Reports only; does not fix.

**Flags:** Pass a scope as an argument to focus the audit on a specific area.

```
/security
/security src/auth/
```

---

### `/sync-backlog`

Updates `AGENT_BACKLOG.md` by gathering work items from discovery findings, healthcheck results, orchestrator state, code TODOs, and review findings. Prioritizes and assigns items to teams.

**Flags:** None.

```
/sync-backlog
```

---

### `/project-review`

Runs a comprehensive project-wide audit combining discovery, healthcheck, security scan, and quality gate checks into a single consolidated report. Use this for periodic full-project health assessments.

**Flags:** None.

```
/project-review
```

---

### `/cost`

Displays AI token usage summaries, session costs, and budget status. See [COST_TRACKING.md](./COST_TRACKING.md) for full details on cost tracking configuration.

**Flags:**

| Flag                | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `--summary`         | Show recent session overview with durations and file counts. |
| `--sessions`        | List recent sessions.                                        |
| `--report`          | Generate an aggregate monthly usage report.                  |
| `--month <YYYY-MM>` | Month for the report (default: current month).               |
| `--format <fmt>`    | Export format: json, csv (default: table).                   |
| `--last <period>`   | Time period for session listing (e.g., 7d, 30d).             |

```
/cost --summary
/cost --sessions --last 7d
/cost --report --month 2026-02 --format json
```
