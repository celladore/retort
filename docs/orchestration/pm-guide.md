# Product Manager Guide to AgentKit Forge

A practical guide for using AgentKit Forge's orchestration system to manage
features from idea through to shipped code.

## Quick Start

```bash
# 1. Assess current state
/orchestrate --assess-only

# 2. Plan the implementation
/plan

# 3. Delegate to teams
/team-product    # for PRDs, feature specs
/team-backend    # for API and services
/team-frontend   # for UI components

# 4. Check project health
/project-status

# 5. Validate before shipping
/check
/review
```

## The Three PM Agents

AgentKit Forge includes three PM-oriented agent personas that are loaded into
relevant team commands:

### Product Manager

- **Focus**: Feature prioritization, PRD creation, stakeholder alignment
- **Loaded by**: `/team-product`
- **Key responsibilities**: Define product requirements, manage feature backlog,
  create acceptance criteria, align cross-team priorities

### Project Shipper

- **Focus**: Issue templates, PR workflows, state management, backlog maintenance
- **Loaded by**: Team commands via project-management category
- **Key responsibilities**: Track delivery progress, maintain risk register,
  manage handoffs between teams, ensure tasks complete their lifecycle

### Release Manager

- **Focus**: Release coordination, changelog management, deployment readiness
- **Loaded by**: Team commands via project-management category
- **Key responsibilities**: Coordinate release cadence, verify quality gates,
  manage release notes, ensure deployment safety

## Feature Lifecycle

```
Idea → PRD → Backlog Item → Team Delegation → Implementation → Review → Ship
```

### 1. Capture the Feature Idea

Add to `AGENT_BACKLOG.md` with priority (P0 = critical, P1 = high, P2+ = normal):

```markdown
## P1 — Add user authentication

- **Owner**: product
- **Status**: proposed
- **Description**: OAuth2 login flow with JWT tokens
```

### 2. Create a PRD

Use `/team-product` to create a Product Requirements Document:

- Problem statement and user stories
- Acceptance criteria
- Technical constraints
- Success metrics

PRDs go in `docs/prd/`.

### 3. Plan the Implementation

Use `/plan` to create an implementation plan:

- Identify affected files and teams
- Estimate complexity
- Define task breakdown
- Create ADRs for architectural decisions

### 4. Delegate to Teams

Use `/orchestrate` to automatically delegate, or manually:

- `/team-backend` — API endpoints, services, data models
- `/team-frontend` — UI components, forms, state management
- `/team-testing` — Test coverage, integration tests
- `/team-security` — Auth flows, vulnerability review

### 5. Monitor Progress

Use `/project-status` for a unified dashboard:

- Phase progress and team health
- Active risks and blockers
- Delivery metrics
- Recommended actions

### 6. Ship

```bash
/check           # Run quality gates
/review          # Code review
/deploy          # Deploy (if configured)
/document-history feature "Add user authentication"
```

## Risk Register

The project-shipper agent maintains risks in `orchestrator.json`:

```json
{
  "risks": [
    {
      "id": "RISK-001",
      "severity": "high",
      "category": "technical",
      "description": "Third-party API rate limits may throttle peak usage",
      "mitigation": "Implement request queuing with exponential backoff",
      "owner": "backend",
      "status": "open",
      "raisedDate": "2026-03-05"
    }
  ]
}
```

Use `/project-status` to see all active risks in the dashboard.

## Using /project-status

The dashboard aggregates data from multiple sources:

| Source                       | What it provides                          |
| ---------------------------- | ----------------------------------------- |
| `orchestrator.json`          | Phase, team status, risks, cached metrics |
| `AGENT_BACKLOG.md`           | Backlog items by priority                 |
| `.claude/state/tasks/*.json` | Task status and lifecycle data            |
| `.claude/state/events.log`   | Recent activity stream                    |
| `git log`                    | Commit frequency, merge history           |

### Flags

- `--format json` — Machine-readable JSON output
- `--team backend` — Filter to a specific team

### Health Scoring

- **HEALTHY**: All teams active, no P0 blockers, WIP under limit
- **AT_RISK**: Team stale >24h, P0 items unassigned, or WIP exceeds 2x team count
- **BLOCKED**: Team explicitly blocked, stale lock, or critical risk unmitigated

## FAQ

**How do I reprioritize work?**
Edit `AGENT_BACKLOG.md` directly or use `/sync-backlog` to reconcile with external
trackers. Change priority labels (P0/P1/P2) and reassign owners.

**A team is blocked — what do I do?**

1. Run `/project-status --team <name>` to see blockers
2. Check task files in `.claude/state/tasks/` for `"status": "blocked"`
3. Resolve the dependency or reassign the task
4. Update the risk register if it's a recurring issue

**How do I pause and resume work?**
Use `/handoff` at the end of a session to capture context. The next session
can read the handoff document from `docs/ai_handoffs/` to resume.

**How do I add a new team?**
Teams are defined in `.agentkit/spec/teams.yaml`. Add a new entry with id,
name, scope globs, and accepted types. Run sync to generate the team command.
