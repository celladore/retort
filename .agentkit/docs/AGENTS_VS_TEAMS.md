# Agents vs Teams

How agents and teams relate in AgentKit Forge, and how the orchestrator uses them.

---

## What Are Agents?

Agents are specialized AI configurations defined in `.agentkit/spec/agents.yaml`. Each agent represents a distinct professional role with:

- **Role** -- a description of the agent's expertise and responsibilities.
- **Focus** -- file glob patterns indicating which parts of the codebase the agent operates on.
- **Responsibilities** -- concrete tasks the agent is expected to perform.
- **Preferred tools** -- the set of tools (Read, Write, Edit, Grep, Bash, etc.) the agent uses.

Agents do not run independently. They provide context and constraints that shape how AI assistants behave when working within a particular domain. Think of an agent as a persona and skill profile that the AI adopts.

## What Are Teams?

Teams are functional groups defined in `.agentkit/spec/teams.yaml`. Each team organizes work around a domain and is invoked via a slash command (`/team-<id>`). A team definition includes:

- **ID** -- the identifier used in commands and orchestrator state (e.g., `backend`).
- **Name** -- display name (e.g., `BACKEND`).
- **Focus** -- a short description of the team's domain.
- **Scope** -- file glob patterns that define which files the team owns.

Teams are the unit of delegation in the orchestrator. When `/orchestrate` decides work needs to happen, it assigns that work to a team, not to an individual agent.

## How They Relate

Agents and teams are complementary but serve different purposes:

- **Agents** define _who_ does the work -- the expertise and behavioral constraints.
- **Teams** define _what domain_ the work falls into -- the organizational unit for delegation.

Agents are grouped into seven categories (engineering, design, marketing, operations, product, testing, project-management). Teams cut across these categories to form action-oriented groups. A single team may draw on multiple agents. For example, the Testing team maps to three agents (test-lead, coverage-tracker, integration-tester), while the Backend team maps primarily to the backend engineer agent.

The orchestrator tracks progress per team (not per agent) using statuses: `idle`, `in_progress`, `blocked`, and `done`.

---

## The 10 Teams

| ID         | Name          | Focus                                 | Slash Command    |
| ---------- | ------------- | ------------------------------------- | ---------------- |
| `backend`  | BACKEND       | API, services, core logic             | `/team-backend`  |
| `frontend` | FRONTEND      | UI, components, PWA                   | `/team-frontend` |
| `data`     | DATA          | Database, models, migrations          | `/team-data`     |
| `infra`    | INFRA         | IaC, cloud, Terraform/Bicep           | `/team-infra`    |
| `devops`   | DEVOPS        | CI/CD, pipelines, automation          | `/team-devops`   |
| `testing`  | TESTING       | Unit, E2E, integration tests          | `/team-testing`  |
| `security` | SECURITY      | Auth, compliance, audit               | `/team-security` |
| `docs`     | DOCUMENTATION | Docs, ADRs, guides                    | `/team-docs`     |
| `product`  | PRODUCT       | Features, PRDs, roadmap               | `/team-product`  |
| `quality`  | QUALITY       | Code review, refactoring, reliability | `/team-quality`  |

## The 19 Agents by Category

### Engineering (5 agents)

| Agent ID   | Name                    | Primary Responsibility                             |
| ---------- | ----------------------- | -------------------------------------------------- |
| `backend`  | Backend Engineer        | API design, service architecture, business logic   |
| `frontend` | Frontend Engineer       | UI components, state management, accessibility     |
| `data`     | Data Engineer           | Database schemas, migrations, query optimization   |
| `devops`   | DevOps Engineer         | CI/CD pipelines, containers, deployment automation |
| `infra`    | Infrastructure Engineer | IaC modules, cloud resources, platform reliability |

### Design (2 agents)

| Agent ID         | Name           | Primary Responsibility                                   |
| ---------------- | -------------- | -------------------------------------------------------- |
| `brand-guardian` | Brand Guardian | Brand consistency, design tokens, style guidelines       |
| `ui-designer`    | UI Designer    | Interaction patterns, component design, visual hierarchy |

### Marketing (2 agents)

| Agent ID             | Name               | Primary Responsibility                                     |
| -------------------- | ------------------ | ---------------------------------------------------------- |
| `content-strategist` | Content Strategist | Messaging, copy, documentation voice, content architecture |
| `growth-analyst`     | Growth Analyst     | User acquisition metrics, KPIs, A/B testing strategies     |

### Operations (3 agents)

| Agent ID              | Name                | Primary Responsibility                                 |
| --------------------- | ------------------- | ------------------------------------------------------ |
| `dependency-watcher`  | Dependency Watcher  | Dependency updates, security audits, supply chain risk |
| `environment-manager` | Environment Manager | Environment configs, secrets rotation, setup scripts   |
| `security-auditor`    | Security Auditor    | Security audits, vulnerability assessment, compliance  |

### Product (2 agents)

| Agent ID          | Name            | Primary Responsibility                                  |
| ----------------- | --------------- | ------------------------------------------------------- |
| `product-manager` | Product Manager | PRDs, acceptance criteria, backlog prioritization       |
| `roadmap-tracker` | Roadmap Tracker | Milestone tracking, progress reports, release timelines |

### Testing (3 agents)

| Agent ID             | Name               | Primary Responsibility                                      |
| -------------------- | ------------------ | ----------------------------------------------------------- |
| `test-lead`          | Test Lead          | Test strategy, quality gate definitions, test architecture  |
| `coverage-tracker`   | Coverage Tracker   | Coverage metrics, threshold enforcement, gap analysis       |
| `integration-tester` | Integration Tester | E2E tests, cross-service testing, API contract verification |

### Project Management (2 agents)

| Agent ID          | Name            | Primary Responsibility                                       |
| ----------------- | --------------- | ------------------------------------------------------------ |
| `project-shipper` | Project Shipper | Task scoping, delivery tracking, handoff documentation       |
| `release-manager` | Release Manager | Release coordination, versioning, changelogs, deployment     |

---

## How the Orchestrator Delegates to Teams

The orchestrator (`.agentkit/engines/node/src/orchestrator.mjs`) manages a 5-phase lifecycle:

1. **Discovery** -- scan the codebase, identify tech stacks.
2. **Planning** -- design the implementation, create plans.
3. **Implementation** -- delegate to teams for execution.
4. **Validation** -- run quality gates (`/check`, `/review`).
5. **Ship** -- deploy and hand off.

During Phase 3 (Implementation), the orchestrator delegates work to teams. It does this by:

1. Loading team IDs from `teams.yaml` via `loadTeamIdsFromSpec()`.
2. Initializing a `team_progress` map in `orchestrator.json` with each team set to `idle`.
3. Updating team status as work proceeds (`idle` -> `in_progress` -> `done` or `blocked`).
4. Logging delegation events to `events.log` for audit and continuity.
5. Acquiring an exclusive session lock to prevent concurrent orchestration conflicts.

The orchestrator does not call agents directly. It delegates to teams, and the team command activates the appropriate agent persona(s) for the domain.

## How to Invoke Team Commands

Invoke a team directly using its slash command:

```
/team-backend       Build or fix API endpoints and services
/team-frontend      Build or fix UI components and client state
/team-data          Create or modify schemas, migrations, queries
/team-infra         Manage IaC, cloud resources, Dockerfiles
/team-devops        Fix or create CI/CD pipelines and workflows
/team-testing       Write tests, improve coverage, fix flaky tests
/team-security      Implement auth, fix vulnerabilities, harden endpoints
/team-docs          Write or update documentation, ADRs, guides
/team-product       Draft PRDs, user stories, acceptance criteria
/team-quality       Review code, refactor, enforce standards
```

## When to Use Which Team

| You need to...                                      | Team             |
| --------------------------------------------------- | ---------------- |
| Add or modify an API endpoint                       | `/team-backend`  |
| Build a UI component or fix a layout                | `/team-frontend` |
| Write a database migration or optimize a query      | `/team-data`     |
| Modify Terraform, Docker, or cloud configs          | `/team-infra`    |
| Fix a CI/CD pipeline or create a GitHub Action      | `/team-devops`   |
| Write tests or improve coverage                     | `/team-testing`  |
| Implement authentication or fix a vulnerability     | `/team-security` |
| Write docs, ADRs, or runbooks                       | `/team-docs`     |
| Draft product requirements or user stories          | `/team-product`  |
| Review code quality or refactor for maintainability | `/team-quality`  |

When a task spans multiple teams, use `/orchestrate` to let the orchestrator manage the delegation sequence and inter-team handoffs. For single-team tasks where you already know the right team, invoke the team command directly.

---

See also: [TEAM_GUIDE.md](./TEAM_GUIDE.md) for decision matrices, inter-team handoff patterns, and orchestrate-vs-manual guidance.
