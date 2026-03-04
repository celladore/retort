# AgentKit Forge -- Workflow Examples

> Worked examples of complete AI-assisted development sessions. Each scenario
> walks through a real task from start to finish, showing what commands to run,
> what the AI does at each step, and what to expect.

---

## Table of Contents

1. [Scenario 1: New Feature Development](#scenario-1-new-feature-development)
2. [Scenario 2: Bug Fix](#scenario-2-bug-fix)
3. [Scenario 3: Full Project Assessment](#scenario-3-full-project-assessment)
4. [Scenario 4: Multi-Session Continuity](#scenario-4-multi-session-continuity)

---

## Scenario 1: New Feature Development

### Goal

Add user authentication to a Node.js application. This includes JWT-based login and registration endpoints on the backend, a login UI on the frontend, and full test coverage.

### When to Use This Flow

Use this flow for medium-to-large features that touch multiple parts of the codebase and involve more than one team. The full lifecycle ensures nothing is missed.

### Prerequisites

- Repository already initialized with AgentKit Forge (`sync` has been run)
- Claude Code open in the project directory
- A working build (run `/healthcheck` first if you are not sure)

### Step-by-Step

#### Step 1: Discover the Codebase

```
/discover
```

**What the AI does:**

- Scans the entire repository for languages, frameworks, build tools, and folder structure
- Detects Node.js and Express (or whatever framework is present)
- Identifies existing test frameworks (Vitest, Jest, etc.)
- Creates or updates `AGENT_TEAMS.md` with team assignments based on your actual code

**Expected output:**

```
## Repository Profile
- Primary stack: TypeScript + Express + Node.js
- Build system: pnpm
- Test framework: Vitest
- CI: GitHub Actions

## Team Assignments
### team-backend
- Focus: API routes, database, server-side logic
- Scope: src/api/**, src/server/**, src/services/**

### team-frontend
- Focus: UI components, pages, client-side state
- Scope: src/client/**, src/components/**
...

## Detected Issues
- Missing test coverage for src/api/users.ts
- TODO comment in src/server/middleware.ts:42
```

**Tip:** If this is your first time running `/discover` on this project, take a minute to review the team assignments. They are auto-generated based on your folder structure and can be adjusted in `AGENT_TEAMS.md`.

---

#### Step 2: Plan the Implementation

```
/plan Add JWT-based user authentication with login and registration endpoints, password hashing with bcrypt, and a React login form
```

**What the AI does:**

- Reads the codebase to understand existing patterns (routing style, middleware conventions, database layer)
- Produces a structured plan with: goal, assumptions, ordered implementation steps, file touch list, validation commands, rollback plan, and risks
- Does NOT write any code -- planning only

**Expected output:**

```
## 1. Goal
Add JWT-based authentication with login (POST /api/auth/login) and registration
(POST /api/auth/register) endpoints, bcrypt password hashing, and a React login form.

## 2. Assumptions
- The application uses Express.js with TypeScript
- PostgreSQL is the database with Prisma ORM
- The frontend uses React with React Router
- No existing auth system is in place

## 3. Steps
1. Add dependencies: bcrypt, jsonwebtoken, @types/bcrypt, @types/jsonwebtoken
   - Detail: Add to package.json, run pnpm install
   - Reason: Required for password hashing and token generation

2. Create User model in Prisma schema
   - Detail: Add User table with id, email, passwordHash, createdAt fields
   - Reason: Need persistent storage for user credentials

3. Create auth service in src/services/auth.service.ts
   - Detail: Implement hashPassword, verifyPassword, generateToken, verifyToken
   - Reason: Centralize auth logic for reuse and testing
...

## 4. File Touch List
| File | Action | Description |
|------|--------|-------------|
| prisma/schema.prisma | MODIFY | Add User model |
| src/services/auth.service.ts | CREATE | Auth business logic |
| src/api/auth.ts | CREATE | Login and register endpoints |
| src/middleware/auth.middleware.ts | CREATE | JWT verification middleware |
| src/client/pages/Login.tsx | CREATE | Login form component |
| src/client/pages/Register.tsx | CREATE | Registration form component |
| tests/services/auth.service.test.ts | CREATE | Auth service tests |
| tests/api/auth.test.ts | CREATE | Auth endpoint tests |

## 5. Validation Plan
1. pnpm build -- Project compiles
2. npx prisma migrate dev -- Migration runs
3. npx vitest run tests/services/auth.service.test.ts -- Auth service tests pass
4. npx vitest run tests/api/auth.test.ts -- Auth endpoint tests pass
5. npx vitest run -- Full test suite passes

## 6. Risks
- JWT secret must be stored in environment variable, not hardcoded
- Password hashing is CPU-intensive; consider bcrypt rounds carefully
- No rate limiting on auth endpoints yet (should add in follow-up)
```

**Tip:** Review the plan before proceeding. If something looks wrong -- a missing file, a wrong assumption, a better approach -- tell the AI now. Fixing a plan costs seconds; fixing an implementation costs minutes.

---

#### Step 3: Implement the Backend

```
/team-backend Implement auth service, login and registration endpoints, and JWT middleware per the plan above
```

**What the AI does:**

- Reads the plan and the relevant source files
- Creates the auth service with password hashing and token generation
- Creates the API endpoints for login and registration
- Creates the JWT verification middleware
- Adds unit and integration tests for all new code
- Runs the quality gate (format, lint, typecheck, test) on changed files
- Stays within the backend scope -- does not touch frontend files

**Expected output:**

```
## Backend Report

**Items Completed:** 3

### Changes Made
- **Auth service**
  - src/services/auth.service.ts: Created with hashPassword, verifyPassword,
    generateToken, verifyToken functions
- **Auth endpoints**
  - src/api/auth.ts: Created POST /api/auth/login and POST /api/auth/register
  - src/middleware/auth.middleware.ts: Created JWT verification middleware
- **Database**
  - prisma/schema.prisma: Added User model with email, passwordHash fields

### Tests Added
- tests/services/auth.service.test.ts: 8 tests covering hash, verify, token lifecycle
- tests/api/auth.test.ts: 6 tests covering login, register, validation, errors

### Quality Gate Results
- Format: PASS
- Lint: PASS
- Typecheck: PASS
- Tests: 14 passed, 0 failed
- Build: PASS
```

---

#### Step 4: Implement the Frontend

```
/team-frontend Implement login and registration forms that connect to the auth API endpoints
```

**What the AI does:**

- Reads the API endpoints created by the backend team
- Creates React components for Login and Registration pages
- Adds authentication state management (context or store)
- Updates routing to include the new pages
- Adds tests for the new components
- Runs the quality gate on frontend files

**Expected output:**

```
## Frontend Report

**Items Completed:** 2

### Changes Made
- **Login page**
  - src/client/pages/Login.tsx: Form with email/password, error display, redirect on success
  - src/client/hooks/useAuth.ts: Authentication hook with login, register, logout functions
- **Registration page**
  - src/client/pages/Register.tsx: Form with email/password/confirm, validation

### Tests Added
- tests/client/pages/Login.test.tsx: 5 tests covering render, submit, validation, error
- tests/client/pages/Register.test.tsx: 4 tests covering render, submit, password match

### Quality Gate Results
- Format: PASS
- Lint: PASS
- Typecheck: PASS
- Tests: 9 passed, 0 failed
- Build: PASS
```

---

#### Step 5: Run Quality Gates

```
/check
```

**What the AI does:**

- Runs the full quality gate across the entire project (not just the files changed by one team)
- Executes in order: format check, lint, typecheck, unit tests, build
- Reports any issues, including cross-team integration problems that individual team checks might miss

**Expected output:**

```
## Quality Gate Results

| Step      | Status | Duration | Details              |
|-----------|--------|----------|----------------------|
| Format    | PASS   | 1.2s     | All files formatted  |
| Lint      | PASS   | 3.1s     | 0 errors, 0 warnings |
| Typecheck | PASS   | 4.8s     | 0 errors             |
| Tests     | PASS   | 11.2s    | 165 passed, 0 failed |
| Build     | PASS   | 8.7s     | Clean build          |

### Overall: PASS
```

**Tip:** If `/check` fails, read the error details carefully. Most failures at this stage are integration issues -- a type mismatch between backend and frontend, or a test that depends on an import that changed.

---

#### Step 6: Code Review

```
/review
```

**What the AI does:**

- Diffs all changes since the orchestration began
- Reviews every changed file against six criteria: correctness, security, performance, tests and coverage, documentation and readability, compatibility and standards
- Classifies findings by severity: CRITICAL, HIGH, MEDIUM, LOW
- Produces a verdict: APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION

**Expected output:**

```
## Code Review

**Reviewed:** 12 files changed
**Verdict:** APPROVE

### Summary
User authentication implementation follows project conventions. JWT handling is
correct, passwords are properly hashed with bcrypt, and test coverage is thorough.

### Findings

#### Suggestions (recommended but not blocking)
- [SECURITY] src/api/auth.ts:34 -- Consider adding rate limiting to the login
  endpoint to prevent brute-force attacks. Not blocking for initial merge, but
  should be addressed in a follow-up.
- [PERFORMANCE] src/services/auth.service.ts:12 -- bcrypt rounds set to 12;
  consider 10 for development environments to speed up tests.

#### Positive Notes
- Password hashing uses bcrypt with configurable rounds
- JWT secret loaded from environment variable, not hardcoded
- Error responses do not leak internal details
- Tests cover both happy path and error cases
```

---

#### Step 7: Document and Hand Off

```
/handoff
```

**What the AI does:**

- Collects the current state: git branch, last commit, orchestrator state, events log
- Writes a structured handoff document with: what was done, current blockers, next 3 actions, validation commands, and open risks
- Saves the handoff to `docs/ai_handoffs/` (if the directory exists)
- Logs the handoff event to `.claude/state/events.log`

**Expected output:**

```
# Session Handoff

**Date:** 2026-02-23T14:30:00Z
**Branch:** feature/user-auth
**Last Commit:** a1b2c3d -- feat: add user authentication with JWT
**Overall Status:** HEALTHY

## What Was Done
- Added JWT-based authentication (login + registration endpoints)
- Created bcrypt password hashing in auth service
- Built React login and registration forms
- Added 23 new tests (all passing)
- Full quality gate passed

## Current Blockers
- None

## Next 3 Actions
1. Add rate limiting to POST /api/auth/login (suggested in code review)
2. Add password reset flow (email verification)
3. Add session management (refresh tokens)

## How to Validate
  pnpm build && npx vitest run && npx tsc --noEmit
```

**Tip:** Always end your session with `/handoff`. It takes 30 seconds and saves the next session (whether that is you tomorrow or a teammate) from re-discovering context.

---

### Summary of Commands Used

```
/discover            Understand the codebase
/plan                Design the implementation
/team-backend        Implement server-side auth
/team-frontend       Implement client-side login UI
/check               Verify quality across the whole project
/review              Code review for correctness and security
/handoff             Document the session for continuity
```

Total time: 10-20 minutes depending on codebase size and complexity.

---

## Scenario 2: Bug Fix

### Goal

Fix a database connection timeout issue that causes intermittent 500 errors in production. The error message is: `Error: Connection terminated unexpectedly`.

### When to Use This Flow

Use this flow for focused bug fixes where you already know the symptom. The emphasis is on speed: identify the problem, fix it, validate, and move on.

### Step-by-Step

#### Step 1: Discover the Stack (If Needed)

```
/discover
```

**What the AI does:**

- Scans the repository for database-related files, connection configuration, and ORM setup
- Identifies the database stack (PostgreSQL + Prisma, MySQL + Knex, etc.)
- Maps out connection handling code

**When to skip:** If you have already run `/discover` recently and the `AGENT_TEAMS.md` file is current, you can skip this step. The AI will still read existing discovery results.

**Tip:** For bug fixes, `/discover` is about context, not completeness. You just need enough information to know where to look.

---

#### Step 2: Investigate the Issue

Tell the AI what you know about the bug:

```
The application throws "Error: Connection terminated unexpectedly" under load.
This happens intermittently on the POST /api/orders endpoint. The database is
PostgreSQL and we use Prisma. Please investigate the connection handling,
pool configuration, and any timeout settings.
```

**What the AI does:**

- Reads the database configuration files (Prisma schema, environment variables, connection string format)
- Examines the connection pool settings
- Checks for missing connection cleanup, unclosed transactions, or pool exhaustion patterns
- Reviews error handling in the affected endpoint
- Reports findings with specific file and line references

**Expected findings:**

```
Investigation Results:

1. Connection pool is using default Prisma settings (connection_limit not set).
   Under load, this can exhaust the pool.
   File: prisma/schema.prisma, line 8

2. The POST /api/orders handler opens a transaction but does not handle the
   error path -- if validation fails after the transaction starts, the connection
   is never released back to the pool.
   File: src/api/orders.ts, lines 45-72

3. No connection timeout is configured in the DATABASE_URL. Default PostgreSQL
   timeout of 0 (no timeout) means stale connections hang indefinitely.
   File: .env.example, line 3
```

---

#### Step 3: Make the Fix

Based on the investigation, implement the fix directly. You can use a team command or just describe what to do:

```
Fix the database connection timeout issue:
1. Add connection_limit=10 and pool_timeout=10 to the Prisma datasource URL
2. Wrap the transaction in POST /api/orders with proper try/catch/finally
   to ensure connections are always released
3. Add a connect_timeout=5 parameter to the DATABASE_URL
```

**What the AI does:**

- Makes minimal, targeted changes to fix the specific issue
- Updates the Prisma configuration with pool settings
- Refactors the error-prone transaction handling with proper cleanup
- Does not refactor unrelated code or change behavior beyond what is needed

---

#### Step 4: Quick Validation

```
/check --fast
```

**What the AI does:**

- Runs format, lint, and typecheck only (skips the full build to save time)
- The `--fast` flag is designed for quick iterations during bug fixes
- Confirms the fix compiles and passes static analysis

**Expected output:**

```
## Quality Gate Results

| Step      | Status  | Duration | Details             |
|-----------|---------|----------|---------------------|
| Format    | PASS    | 0.8s     | All files formatted |
| Lint      | PASS    | 2.4s     | 0 errors            |
| Typecheck | PASS    | 4.1s     | 0 errors            |
| Tests     | PASS    | 9.6s     | 142 passed, 0 failed|
| Build     | SKIPPED | --       | --fast mode         |

### Overall: PASS
```

Then run the full check to make sure nothing else broke:

```
/check
```

---

#### Step 5: Review for Regressions

```
/review
```

**What the AI does:**

- Diffs the changes you just made
- Checks specifically for regressions: did the fix break any existing behavior?
- Verifies the fix actually addresses the root cause (not just the symptom)
- Checks for security implications of the changes

**Expected output:**

```
## Code Review

**Reviewed:** 3 files changed
**Verdict:** APPROVE

### Summary
Targeted fix for database connection pool exhaustion. Changes are minimal and
backwards-compatible. Transaction error handling now properly releases connections.

### Findings

#### Positive Notes
- Connection pool limit prevents exhaustion under load
- try/catch/finally ensures connections are always returned to pool
- Pool timeout prevents indefinite hangs
- No behavioral changes outside the fix scope
```

---

### Summary of Commands Used

```
/discover            Understand the database stack (optional if recent)
(investigate)        Manual investigation with AI assistance
(fix)                Implement the targeted fix
/check --fast        Quick validation (format + lint + typecheck)
/check               Full validation including tests and build
/review              Verify no regressions
```

Total time: 5-10 minutes for a focused bug fix.

**Tips for fast bug fixes:**

- Skip `/discover` if you already have a recent `AGENT_TEAMS.md`
- Use `/check --fast` for quick iterations while developing the fix
- Run the full `/check` once before considering the fix complete
- Always run `/review` to catch regressions -- bug fixes are where regressions hide

---

## Scenario 3: Full Project Assessment

### Goal

Perform a comprehensive project audit. This is the workflow for a new team member joining an unfamiliar codebase, for a periodic health assessment, or for a stakeholder who wants to understand the current state of the project.

### When to Use This Flow

Use this flow when you need a thorough understanding of a project's health, quality, and risks. This is not a quick scan -- it is a deep dive.

### Step-by-Step

#### Step 1: Run the Project Review

```
/project-review
```

**What the AI does:**
The `/project-review` command runs a comprehensive multi-phase analysis of the entire project. It combines several checks into a single, structured assessment:

**Phase A -- Discovery and Inventory:**

- Full codebase scan (same as `/discover`)
- Technology stack identification
- Dependency inventory with version currency
- Folder structure mapping

**Phase B -- Health Validation:**

- Build status (same as `/healthcheck`)
- Test suite status and coverage
- Lint and typecheck status
- Dependency vulnerability scan

**Phase C -- Code Quality Assessment:**

- Architecture pattern analysis
- Code duplication detection
- Complexity hotspots
- Test quality evaluation
- Documentation coverage

**Phase D -- Security Review:**

- OWASP top 10 check (same as `/security`)
- Hardcoded secrets scan
- Dependency vulnerability audit
- Authentication flow review

**Expected output -- Findings Table:**

```
## Project Review: my-project

### Executive Summary
The project is in DEGRADED health. The build passes and tests are at 78% coverage,
but there are 3 high-severity security findings and significant lint debt.

### Findings

| ID   | Severity | Category     | Finding                                  | Location              |
|------|----------|------------- |------------------------------------------|-----------------------|
| PR-1 | HIGH     | Security     | SQL injection in user search endpoint    | src/api/users.ts:67   |
| PR-2 | HIGH     | Security     | JWT secret hardcoded in config           | src/config/auth.ts:4  |
| PR-3 | HIGH     | Testing      | No tests for payment processing module   | src/services/payment/ |
| PR-4 | MEDIUM   | Performance  | N+1 query in order listing endpoint      | src/api/orders.ts:23  |
| PR-5 | MEDIUM   | Architecture | Circular dependency between user/order   | src/services/         |
| PR-6 | MEDIUM   | Quality      | 47 ESLint errors across 12 files         | Various               |
| PR-7 | LOW      | Docs         | API endpoints missing JSDoc comments     | src/api/              |
| PR-8 | LOW      | DevEx        | No .editorconfig for consistent style    | (root)                |

### Health Dashboard

| Metric           | Value     | Status    |
|------------------|-----------|-----------|
| Build            | Passing   | HEALTHY   |
| Tests            | 78% cov.  | DEGRADED  |
| Lint             | 47 errors | DEGRADED  |
| Typecheck        | Passing   | HEALTHY   |
| Dependencies     | 2 vulns   | DEGRADED  |
| Security         | 3 high    | AT RISK   |

### Recommended Priority
1. Fix SQL injection (PR-1) -- CRITICAL, security
2. Move JWT secret to environment variable (PR-2) -- CRITICAL, security
3. Add payment processing tests (PR-3) -- HIGH, reliability
4. Fix N+1 query (PR-4) -- MEDIUM, performance
5. Resolve circular dependency (PR-5) -- MEDIUM, maintainability
```

---

#### Step 2: Prioritize the Findings

Review the findings table and decide which items to address first. The project review already suggests a priority order, but you may want to adjust based on business context:

```
Let's focus on the top 3 items: the SQL injection, the hardcoded JWT secret,
and the missing payment tests. Deprioritize the lint debt for now.
```

**What the AI does:**

- Acknowledges the priority adjustment
- Focuses subsequent planning on the selected items
- Notes the deferred items for future sessions

---

#### Step 3: Plan the Fixes

```
/plan Fix the top 3 findings from the project review: SQL injection in user search, hardcoded JWT secret, and missing payment processing tests
```

**What the AI does:**

- Creates a structured implementation plan for each finding
- Orders the steps by dependency (security fixes first, then tests)
- Identifies the specific files and lines to change
- Provides validation commands for each fix

**Expected output:**

```
## 1. Goal
Fix 3 high-priority findings from the project review: SQL injection, hardcoded
secret, and missing test coverage for payment processing.

## 3. Steps
1. Replace string concatenation with parameterized query in src/api/users.ts:67
   - Detail: Use Prisma's built-in parameterized queries instead of raw SQL
   - Reason: Eliminates SQL injection vulnerability (PR-1)

2. Move JWT secret from src/config/auth.ts to environment variable
   - Detail: Read from process.env.JWT_SECRET with validation on startup
   - Reason: Removes hardcoded secret from source control (PR-2)

3. Add .env.example with JWT_SECRET placeholder
   - Detail: Document the required environment variable
   - Reason: Other developers need to know this variable exists

4. Write unit tests for src/services/payment/
   - Detail: Cover charge, refund, webhook processing, and error paths
   - Reason: Payment processing has zero test coverage (PR-3)
...
```

---

#### Step 4: Start Fixing

From here, you can either delegate to teams or fix manually:

```
/orchestrate Fix the SQL injection, hardcoded JWT secret, and add payment tests per the plan
```

**What the AI does:**

- Enters the 5-phase lifecycle starting from Implementation (since discovery and planning are done)
- Delegates the security fixes to the relevant team
- Delegates the test writing to the testing team
- Runs validation after each change
- Produces a summary when complete

**Tip:** For a project assessment, you do not need to fix everything in one session. Fix the critical items, then use `/handoff` to document the remaining findings for future sessions.

---

### Summary of Commands Used

```
/project-review      Comprehensive multi-phase audit
(prioritize)         Review findings and set priorities
/plan                Create implementation plan for top items
/orchestrate         Execute the plan with team coordination
/handoff             Document remaining items for next session
```

Total time: 20-40 minutes for the full assessment, plus implementation time for fixes.

**Tips for project assessments:**

- Run `/project-review` with a fresh eye -- do not assume you know what it will find
- Share the findings table with your team. It is a useful conversation starter about technical debt
- Do not try to fix everything at once. Fix the critical security issues, then schedule the rest
- Save the assessment output. It serves as a baseline for measuring improvement over time

---

## Scenario 4: Multi-Session Continuity

### Goal

Resume work from a previous session. You were adding a notification system to the application, and the previous session completed the backend but ran out of time before finishing the frontend.

### When to Use This Flow

Use this flow whenever you are starting a new Claude Code session and there is prior work to continue. This is the normal way of working on anything that spans more than one session.

### Prerequisites

- A previous session used `/handoff` to save its state
- The `docs/ai_handoffs/` directory contains handoff documents
- The `.claude/state/orchestrator.json` file contains the orchestrator state from the last session

### Step-by-Step

#### Step 1: Read the Previous Handoff

When you start a new session, the first thing to do is find and read the most recent handoff document:

```
Read the most recent handoff document from docs/ai_handoffs/ and
summarize where we left off.
```

**What the AI does:**

- Lists files in the `docs/ai_handoffs/` directory
- Reads the most recent handoff (sorted by date)
- Summarizes the key information: what was done, what is blocked, and what the next actions are

**Expected handoff content:**

```
# Session Handoff

**Date:** 2026-02-22T17:45:00Z
**Branch:** feature/notifications
**Last Commit:** f4e5d6c -- feat: add notification service and API endpoints
**Overall Status:** HEALTHY

## What Was Done
- Created notification service in src/services/notification.service.ts
- Added POST /api/notifications/send and GET /api/notifications endpoints
- Added WebSocket support for real-time notification delivery
- Created database migration for notifications table
- Added 12 tests for notification service (all passing)

## Current Blockers
- None

## Next 3 Actions
1. Create NotificationBell component in src/client/components/ (shows unread count)
2. Create NotificationList component with mark-as-read functionality
3. Add WebSocket client hook for real-time updates

## How to Validate
  pnpm build && npx vitest run && npx tsc --noEmit

## State Files
- Orchestrator: .claude/state/orchestrator.json -- Phase 3 (Implementation)
- Events: .claude/state/events.log -- 34 entries
- Backlog: AGENT_BACKLOG.md -- 8 items (2 P0)
- Teams: AGENT_TEAMS.md -- 6 teams defined
```

**Tip:** If no handoff document exists, check the orchestrator state directly (see Step 2). If neither exists, start fresh with `/discover`.

---

#### Step 2: Check Orchestrator State

```
/orchestrate --status
```

**What the AI does:**

- Reads `.claude/state/orchestrator.json`
- Reads the recent entries from `.claude/state/events.log`
- Reports the current phase, active teams, completed work, and pending items
- Does NOT make any changes -- this is read-only

**Expected output:**

```
## Orchestrator Status

**Current Phase:** 3 (Implementation)
**Lock:** None (no active session)
**Last Updated:** 2026-02-22T17:45:00Z

### Team Status
| Team | Status | Last Action |
|------|--------|-------------|
| T1 (Backend) | complete | Notification service + endpoints |
| T2 (Frontend) | pending | NotificationBell, NotificationList |
| T3 (Data) | complete | Notifications table migration |

### Completed Phases
- Phase 1: Discovery (2026-02-22T14:00:00Z)
- Phase 2: Planning (2026-02-22T14:15:00Z)

### Metrics
- Total changes: 8 files
- Tests added: 12
- Issues found: 0
- Issues resolved: 0

### Pending Work
- Frontend components (T2): NotificationBell, NotificationList, WebSocket hook
- Validation phase (Phase 4): Not yet started
```

This confirms what the handoff told you: backend is done, frontend needs to be built, and we are in Phase 3 (Implementation).

---

#### Step 3: Review What Phase We Are In

Based on the handoff and orchestrator state, you know:

- **Phase 1 (Discovery):** Complete. The codebase was scanned.
- **Phase 2 (Planning):** Complete. The implementation plan was created.
- **Phase 3 (Implementation):** In progress. Backend is done, frontend is pending.
- **Phase 4 (Validation):** Not started. Will run after implementation.
- **Phase 5 (Ship):** Not started. Will run after validation.

You can now pick up exactly where the previous session left off.

---

#### Step 4: Continue the Work

```
/team-frontend Build the NotificationBell and NotificationList components, and the WebSocket client hook for real-time notification updates. The backend API is already complete -- see src/api/notifications.ts for the endpoints.
```

**What the AI does:**

- Reads the handoff and orchestrator state for full context
- Reads the backend API endpoints to understand the contract
- Creates the frontend components following existing patterns in the codebase
- Adds the WebSocket client hook
- Writes tests for all new components
- Runs the quality gate on changed files

**Expected output:**

```
## Frontend Report

**Items Completed:** 3

### Changes Made
- **NotificationBell**
  - src/client/components/NotificationBell.tsx: Bell icon with unread count badge,
    fetches count from GET /api/notifications?unread=true
- **NotificationList**
  - src/client/components/NotificationList.tsx: Scrollable list with mark-as-read,
    pagination, and empty state
- **WebSocket hook**
  - src/client/hooks/useNotifications.ts: Real-time updates via WebSocket,
    automatic reconnection, optimistic UI updates

### Tests Added
- tests/client/components/NotificationBell.test.tsx: 4 tests
- tests/client/components/NotificationList.test.tsx: 6 tests
- tests/client/hooks/useNotifications.test.ts: 5 tests

### Quality Gate Results
- Format: PASS
- Lint: PASS
- Typecheck: PASS
- Tests: 15 passed, 0 failed
- Build: PASS
```

---

#### Step 5: Continue Through Remaining Phases

Now that implementation is complete, move through validation and ship:

```
/check
```

Run the full quality gate across the entire project.

```
/review
```

Review all changes made across both sessions (backend + frontend).

```
/handoff --save
```

**What the AI does with `--save`:**

- Writes the handoff document to console AND to `docs/ai_handoffs/`
- Updates the orchestrator state to Phase 5 (Ship)
- Logs the session completion to events.log

**Expected handoff:**

```
# Session Handoff

**Date:** 2026-02-23T10:30:00Z
**Branch:** feature/notifications
**Last Commit:** b7c8d9e -- feat: add notification UI components and real-time updates
**Overall Status:** HEALTHY

## What Was Done
- Created NotificationBell component with unread count
- Created NotificationList with mark-as-read and pagination
- Added WebSocket client hook with auto-reconnect
- Added 15 frontend tests (all passing)
- Full quality gate passed
- Code review approved

## Current Blockers
- None

## Next 3 Actions
1. Create pull request for feature/notifications branch
2. Add E2E test for the full notification flow (send -> receive -> read)
3. Update API documentation in docs/04_api/ with notification endpoints
```

---

### How State Persistence Works

AgentKit Forge uses three mechanisms to maintain continuity between sessions:

**1. Orchestrator State (`.claude/state/orchestrator.json`)**

This JSON file tracks:

- Which lifecycle phase the project is in (1-5)
- Which teams have completed their work
- Metrics (files changed, tests added, issues found/resolved)
- A lock to prevent concurrent sessions from conflicting

The orchestrator reads this file at the start of every session and updates it after every significant action.

**2. Events Log (`.claude/state/events.log`)**

A chronological log of every significant action:

```
[2026-02-22T14:00:00Z] [DISCOVERY] [ORCHESTRATOR] Discovery complete. Stacks: TypeScript, React. Build: pnpm. Tests: Vitest. Issues: 0.
[2026-02-22T14:15:00Z] [PLAN] [PLANNER] Plan created for: "Add notification system". Steps: 8. Files: 12.
[2026-02-22T17:45:00Z] [TEAM] [T1] Completed 3 items. Changes: 5 files. Tests: 12 added. Gate: PASS.
[2026-02-22T17:45:30Z] [HANDOFF] [ORCHESTRATOR] Session complete. Done: 3 items. Blockers: 0. Next: "Build frontend components".
[2026-02-23T10:00:00Z] [TEAM] [T2] Completed 3 items. Changes: 6 files. Tests: 15 added. Gate: PASS.
[2026-02-23T10:30:00Z] [HANDOFF] [ORCHESTRATOR] Session complete. Done: 3 items. Blockers: 0. Next: "Create PR".
```

**3. Handoff Documents (`docs/ai_handoffs/`)**

Human-readable markdown files with structured summaries. These serve as the "cold start" document: anyone (human or AI) should be able to read a handoff and start working within 2 minutes.

---

### Summary of Commands Used

```
(read handoff)           Read the previous session's handoff document
/orchestrate --status    Check where the orchestrator left off
/team-frontend           Continue implementation from where it stopped
/check                   Full quality gate validation
/review                  Code review across all changes
/handoff --save          Save session state for the next session
```

Total time: 10-15 minutes for the continuation session.

**Tips for multi-session work:**

- Always run `/handoff` at the end of every session. Even if you plan to continue immediately, the handoff is your safety net
- Read the handoff BEFORE checking orchestrator state. The handoff is written for humans and gives you context faster
- Use `/orchestrate --status` to verify the technical state matches what the handoff describes
- If the orchestrator lock is stale (left over from a crashed session), use `/orchestrate --force-unlock` to clear it
- Handoff documents accumulate in `docs/ai_handoffs/`. Periodically review and archive old ones
- The events log is append-only and grows over time. It is a useful audit trail but does not need to be read end-to-end -- the last 10-20 entries are usually sufficient
