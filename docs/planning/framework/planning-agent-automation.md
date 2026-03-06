# FW-004: Planning Agent & Automated Planning Workflow

## Metadata
- **ID**: FW-004
- **Priority**: P2
- **Status**: not-started
- **Created**: 2026-03-06

## Problem Statement

The `docs/planning/` folder currently requires manual maintenance — creating plan files, updating the planning index, tracking status changes, and managing dependencies. As the number of planning items grows, this manual process doesn't scale and creates drift between planning state and actual work state.

Additionally, future tasks (like FW-001 through FW-003) are created ad-hoc during sessions rather than through a structured intake process. A planning agent could automate the lifecycle from idea → plan → tracking → completion.

## Investigation Areas

### 1. Planning Agent Capabilities

A dedicated planning agent could:
- **Create plan files** from templates when a new work item is identified
- **Update the planning index** automatically when plan files are added/modified
- **Track status transitions** by scanning git history and task states
- **Validate dependencies** — flag blocked items when prerequisites complete
- **Generate reports** — weekly planning summaries, stale item alerts
- **Cross-reference** GitHub issues ↔ planning items ↔ AGENT_BACKLOG entries

### 2. Integration with Existing Systems

| System | Integration Point |
|--------|-------------------|
| Orchestrator | Route planning work to the planning agent |
| Task protocol | Planning agent accepts `plan`, `review`, `triage` work types |
| `/sync-backlog` | Two-way sync between planning folder and AGENT_BACKLOG.md |
| `/import-issues` | Auto-create planning items from imported GitHub issues |
| Dependency graph | Planning agent validates and updates the graph |

### 3. Relationship to Existing Agents

Currently there is no dedicated planning agent. The closest are:
- **Orchestrator** — coordinates work but doesn't manage planning artifacts
- **Product Manager** (product category) — PRD-focused, not general planning
- **Architect** (AT-005, proposed) — architecture decisions, not project planning

A planning agent would be a new agent in the `operations` or a new `planning` category.

### 4. Automated vs. Semi-Automated

| Approach | Pros | Cons |
|----------|------|------|
| **Fully automated** | No manual maintenance | Risk of noise, needs good heuristics |
| **Semi-automated** | Human reviews changes | Still requires manual approval step |
| **Agent-assisted** | Agent proposes, human decides | Best of both; lower risk |

Recommendation: Start with agent-assisted (agent proposes changes, human reviews).

## Deliverables

- [ ] Planning agent spec (for agents.yaml)
- [ ] `/plan-intake` command design (create planning items from issues/ideas)
- [ ] `/plan-status` command design (report on planning items)
- [ ] Integration design with orchestrator dependency resolution
- [ ] Prototype with 3-5 automated planning workflows

## Acceptance Criteria

- [ ] Planning agent can create properly formatted plan files from templates
- [ ] Planning index auto-updates when plan files change
- [ ] Dependency graph validation catches cycles and missing prerequisites
- [ ] Agent proposes status transitions based on git/task evidence
