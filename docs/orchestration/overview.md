# How Orchestration Works

This guide explains the AgentKit Forge orchestration pipeline — how work flows from
a user request through phases, team delegation, agent personas, and quality gates.

## The Pipeline

The orchestration system follows a 5-phase lifecycle:

```
/orchestrate → Discovery → Planning → Implementation → Validation → Ship
```

### Phase 1: Discovery (`/discover`)

Scan the codebase, detect tech stacks, identify team boundaries, and understand
the current state. Outputs a structured discovery report.

### Phase 2: Planning (`/plan`)

Design the implementation approach. Create ADRs for architectural decisions.
Break work into tasks and assign to teams.

### Phase 3: Implementation (team commands)

Delegate work to specialized teams via `/team-<name>` commands. Each team
operates within its defined scope (file globs, accepted task types).

### Phase 4: Validation (`/check`, `/review`)

Verify quality gates pass: lint, typecheck, tests, coverage, security scan.
Code review with structured criteria.

### Phase 5: Ship (`/deploy`, `/document-history`)

Deploy artifacts, create history documentation, update changelog.

## Team Delegation

Teams are defined in `.agentkit/spec/teams.yaml` with:

- **Scope**: file globs defining what files the team owns
- **Accepted types**: what kind of work the team handles
- **Agents**: specialist personas loaded into the team context

When `/orchestrate` delegates to a team, the corresponding team command
provides the team's scope, rules, and agent personas.

## Agent Personas

Agent personas are defined in `.agentkit/spec/agents.yaml` and represent
specialist perspectives (e.g., Product Manager, Backend Engineer). The sync
engine resolves which agents belong to each team using:

1. **Explicit mapping**: `agents: [agent-id-1, agent-id-2]` in teams.yaml
2. **Category fallback**: agents whose category matches the team ID

When a team command is generated, matching agent personas are injected as an
"Agent Personas" section, providing role descriptions, responsibilities, and
conventions for the agent to embody.

### Example

`/team-product` loads the Product team scope and injects:

- **Product Manager** — feature prioritization, PRD creation, stakeholder alignment
- **Roadmap Tracker** — timeline management, milestone tracking
- **Expansion Analyst** — gap identification, improvement opportunities

## Feature Gating

Not all teams need orchestration features. The feature system controls what
capabilities are available:

| Feature              | What it enables                          |
| -------------------- | ---------------------------------------- |
| `team-orchestration` | Team commands, shared state, delegation  |
| `agent-personas`     | Agent persona files in `.claude/agents/` |
| `task-delegation`    | Task protocol, JSON task files           |
| `project-status`     | `/project-status` dashboard command      |

Feature presets (`minimal`, `lean`, `standard`, `full`) bundle features together.
The active preset is set in `.agentkit/overlays/<repo>/settings.yaml`.

### How Gating Works

Template sections have `gate` fields referencing feature template variables.
When a feature is disabled, the corresponding section is rendered as empty,
keeping agent files lean for simpler setups.

## State Files

| File                              | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `.claude/state/orchestrator.json` | Phase, team status, metrics, risks            |
| `.claude/state/events.log`        | Append-only event stream                      |
| `.claude/state/tasks/*.json`      | Task delegation files (submitted → completed) |
| `AGENT_BACKLOG.md`                | Human-readable backlog                        |
| `AGENT_TEAMS.md`                  | Team boundaries and ownership                 |

## Monitoring with /project-status

The `/project-status` command aggregates all state files into a unified dashboard:

- Phase progress and team health
- Active risks with owners and mitigations
- Backlog summary by priority
- Delivery metrics (commit frequency, throughput, WIP, lead time, block rate, cycle time)
- Recent activity and recommended actions

Run with `--format json` for machine-readable output or `--team <name>` to filter.

## Concurrency

When multiple agents work concurrently, they coordinate via:

- `.lock` files for exclusive access to shared state
- Append-only writes to `events.log`
- Task protocol with status lifecycle

See [concurrency-protocol.md](./concurrency-protocol.md) for the full lock protocol.

## Troubleshooting

**Orchestration stuck?**
Check `.claude/state/orchestrator.json` for the current phase and any stale locks.
Remove stale `.lock` files if the owning process has exited.

**Team blocked?**
Check task files in `.claude/state/tasks/` for `"status": "blocked"`. Review the
`blockedBy` field to identify dependencies.

**State corrupted?**
Back up `.claude/state/`, then reset `orchestrator.json` to phase 1. Task files
can be individually deleted and re-created by the orchestrator.
