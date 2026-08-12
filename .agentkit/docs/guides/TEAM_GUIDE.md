# AgentKit Forge Team Guide

When to use which team, how teams interact, and when to let `/orchestrate` handle delegation versus invoking teams manually.

---

## Table of Contents

1. [Quick Reference Table](#quick-reference-table)
2. [Decision Matrix](#decision-matrix)
3. [Inter-Team Handoff Patterns](#inter-team-handoff-patterns)
4. [Orchestrate vs Manual](#orchestrate-vs-manual)

---

## Quick Reference Table

| Team                | Command          | Owns                                                               | Use When                                                                                       |
| ------------------- | ---------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Backend (T1)        | `/team-backend`  | API endpoints, services, server-side logic, request validation     | You need to build, fix, or modify API routes, service-layer code, or backend error handling    |
| Frontend (T2)       | `/team-frontend` | UI components, pages, client state, routing, accessibility         | You need to build or fix React components, client-side state management, or layout issues      |
| Data (T3)           | `/team-data`     | Database schemas, migrations, ORM, seed data, query optimization   | You need to create or modify database schemas, write migrations, or optimize queries           |
| Infrastructure (T4) | `/team-infra`    | Terraform, Docker, cloud resources, environment provisioning       | You need to modify Dockerfiles, Terraform configs, or cloud resource definitions               |
| DevOps (T5)         | `/team-devops`   | CI/CD pipelines, GitHub Actions, containers, deployment automation | You need to fix or create CI/CD workflows, build pipelines, or container configurations        |
| Testing (T6)        | `/team-testing`  | Test strategy, coverage, E2E tests, performance benchmarks         | You need to write tests, improve coverage, set up test infrastructure, or fix flaky tests      |
| Security (T7)       | `/team-security` | Authentication, authorization, security middleware, compliance     | You need to implement auth flows, fix security vulnerabilities, or harden endpoints            |
| Documentation (T8)  | `/team-docs`     | Docs, ADRs, runbooks, onboarding guides, API documentation         | You need to write or update documentation, create ADRs, or maintain operational runbooks       |
| Product (T9)        | `/team-product`  | PRDs, feature specs, user stories, roadmap, personas               | You need to draft product requirements, write user stories, or define acceptance criteria      |
| Quality (T10)       | `/team-quality`  | Code review, refactoring, quality gates, standards enforcement     | You need code reviewed for quality, want to refactor for maintainability, or enforce standards |

---

## Decision Matrix

Use this lookup to find the right team for your task.

```text
I want to...                              --> Use this team
------------------------------------------    ----------------
Build an API endpoint                     --> /team-backend
Fix a server-side bug                     --> /team-backend
Add request validation                    --> /team-backend
Create a React component                  --> /team-frontend
Fix a UI layout issue                     --> /team-frontend
Implement client-side state management    --> /team-frontend
Create a database migration               --> /team-data
Optimize a slow database query            --> /team-data
Design a new data model                   --> /team-data
Write a Dockerfile                        --> /team-infra
Modify Terraform configuration            --> /team-infra
Set up a new cloud resource               --> /team-infra
Fix a CI/CD pipeline                      --> /team-devops
Create a GitHub Actions workflow          --> /team-devops
Configure automated deployments           --> /team-devops
Write unit or integration tests           --> /team-testing
Improve test coverage                     --> /team-testing
Set up E2E testing                        --> /team-testing
Implement login/signup flow               --> /team-security
Fix a security vulnerability              --> /team-security
Add role-based access control             --> /team-security
Write API documentation                   --> /team-docs
Create an Architecture Decision Record    --> /team-docs
Update the onboarding guide              --> /team-docs
Draft a product requirements document     --> /team-product
Write user stories for a feature          --> /team-product
Define acceptance criteria                --> /team-product
Refactor code for maintainability         --> /team-quality
Review code for best practices            --> /team-quality
Enforce coding standards across files     --> /team-quality
```

### Edge Cases: When Two Teams Could Apply

| Scenario                          | Primary Team     | Reason                                                                                                 |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| Auth-related API endpoint         | `/team-security` | Security owns auth routes even though they are technically API endpoints                               |
| Database-heavy API endpoint       | `/team-backend`  | Backend owns the endpoint; coordinate with `/team-data` for schema work                                |
| Test for a frontend component     | `/team-testing`  | Testing owns test strategy; frontend may write the test if it is tightly coupled to a component change |
| CI pipeline for security scanning | `/team-devops`   | DevOps owns pipelines; coordinate with `/team-security` for scan configuration                         |
| API documentation                 | `/team-docs`     | Docs owns documentation; backend provides the technical content                                        |

---

## Inter-Team Handoff Patterns

These are the three most common multi-team workflows. Each pattern shows the team sequence and what gets passed between them.

---

### Pattern 1: Backend Creates API, Frontend Consumes

This is the most common cross-team workflow for feature development.

```text
/team-backend                     /team-frontend
     |                                  |
     |  1. Implement API endpoint       |
     |  2. Define request/response      |
     |     contract (types, schemas)    |
     |  3. Write API tests              |
     |                                  |
     +-- handoff: API contract -------> |
                                        |  4. Build UI component that
                                        |     calls the new endpoint
                                        |  5. Add client-side validation
                                        |  6. Write component tests
```

**What gets handed off:** The API contract (endpoint URL, request shape, response shape, error codes). Ideally defined as shared TypeScript types or an OpenAPI schema.

**Coordination point:** Both teams should agree on the API contract during `/plan` before either starts implementation.

---

### Pattern 2: Product Writes PRD, Backend + Frontend Implement, Testing Verifies

This is the standard feature lifecycle from requirements to verification.

```text
/team-product                /team-backend + /team-frontend         /team-testing
     |                                  |                                |
     |  1. Write PRD with user          |                                |
     |     stories and acceptance       |                                |
     |     criteria                     |                                |
     |                                  |                                |
     +-- handoff: PRD + stories ------> |                                |
                                        |  2. Backend builds API         |
                                        |  3. Frontend builds UI         |
                                        |  4. Both write unit tests      |
                                        |                                |
                                        +-- handoff: feature branch ---> |
                                                                         |  5. Write integration tests
                                                                         |  6. Write E2E tests
                                                                         |  7. Verify acceptance criteria
                                                                         |  8. Report coverage gaps
```

#### What gets handed off

- Product to Backend/Frontend: PRD document with user stories, acceptance criteria, and priority.
- Backend/Frontend to Testing: Feature branch with implementation and unit tests. Testing uses the acceptance criteria from the PRD to write verification tests.

**Coordination point:** The `/plan` phase should produce a shared implementation plan that all three teams reference.

---

### Pattern 3: Security Audit, Backend Fixes, Quality Verifies

This pattern is used for security hardening and vulnerability remediation.

```text
/team-security               /team-backend                    /team-quality
     |                              |                               |
     |  1. Run security audit       |                               |
     |  2. Identify vulnerabilities |                               |
     |  3. Prioritize findings      |                               |
     |     (CRITICAL/HIGH/MED/LOW)  |                               |
     |                              |                               |
     +-- handoff: audit report ---> |                               |
                                    |  4. Fix CRITICAL and HIGH     |
                                    |     findings                  |
                                    |  5. Add tests for each fix    |
                                    |  6. Update security docs      |
                                    |                               |
                                    +-- handoff: fix branch ------> |
                                                                    |  7. Review fixes for
                                                                    |    correctness
                                                                    |  8. Verify no regressions
                                                                    |  9. Confirm all gates pass
                                                                    | 10. Approve for merge
```

#### What gets handed off

- Security to Backend: Audit report with severity-classified findings, exact file/line references, and remediation guidance.
- Backend to Quality: Branch with fixes, tests, and documentation updates. Quality verifies the fixes are correct and complete.

**Coordination point:** Security findings should be added to `AGENT_BACKLOG.md` via `/sync-backlog` so they are tracked and prioritized alongside other work.

---

## Orchestrate vs Manual

When should you let `/orchestrate` handle team delegation automatically, and when should you invoke teams manually?

### Use `/orchestrate` When

| Scenario                                      | Why Orchestrate                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Multi-team feature development                | Orchestrate manages the handoff sequence between teams and tracks state     |
| You do not know which teams are needed        | Orchestrate runs discovery first and identifies the right teams             |
| Full lifecycle needed (discover through ship) | Orchestrate moves through all 5 phases automatically                        |
| Resuming a previous session                   | Orchestrate reads its state file and picks up where it left off             |
| You want automated validation between steps   | Orchestrate runs `/check` and `/review` between implementation and shipping |

**How it works:** `/orchestrate` reads the backlog, assigns items to teams based on their scope patterns, delegates work, runs validation after each team completes, and produces a consolidated summary. It manages the `.claude/state/orchestrator.json` state file and `.claude/state/events.log` to maintain continuity across sessions.

### Use Manual Team Invocation When

| Scenario                                           | Why Manual                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Quick, single-team task                            | Overhead of full orchestration is unnecessary for a small fix            |
| You know exactly which team should do the work     | Skip the discovery and planning phases and go straight to implementation |
| You want fine-grained control over execution order | Invoke teams in the exact sequence you want                              |
| Debugging a specific team's output                 | Run just that team to reproduce and fix the issue                        |
| Parallel independent tasks                         | Invoke multiple teams in separate sessions for unrelated work            |

**Example:** If you need to fix a single failing test, run `/team-testing` directly instead of spinning up the full orchestration loop.

### Hybrid Approach

You can combine both strategies:

1. Start with `/orchestrate --assess-only` to get a full picture of the project state.
2. Review the assessment and decide which teams need to act.
3. Invoke specific teams manually for focused work.
4. Finish with `/check` and `/review` to validate everything.
5. Run `/handoff --save` to record the session.

This gives you the intelligence-gathering benefits of orchestration with the precision of manual team invocation.

### Decision Flowchart

```text
Is the task well-defined and limited to one team?
|
+-- YES --> Do you know which team?
|           |
|           +-- YES --> /team-<name>
|           +-- NO  --> /orchestrate --assess-only, then /team-<name>
|
+-- NO  --> Does it span multiple teams or phases?
            |
            +-- YES --> /orchestrate
            +-- NO  --> /plan first, then decide
```
