# SPEC-PROC-004b: Organizational Framework Practices — Themes D-G

**Status**: Draft
**Phase**: Cross-phase — items span Tiers 1-3 from the organizational frameworks plan
**Scope**: Themes D (Team Structure), E (Planning), F (Learning), G (Sustainability) — F-039 through F-058
**Depends On**: SPEC-PROC-001, SPEC-PROC-002, SPEC-PROC-003, SPEC-PROC-004a
**Companion**: SPEC-PROC-004a (Themes A-C, F-022 through F-038) — contains consolidated script manifest, teams.yaml process section, and agent impact summary
**Source**: `11_organizational_frameworks_adoption_plan.md`

---

## Design Principle: Code Over Context

See SPEC-PROC-004a for the full design principle statement. Same rule: **enforce in code, not in agent instructions**.

---

## Theme D: Team Structure & Interaction

### F-039: Team Interaction Modes

#### Functional Requirements

**FR-039.1**: Each team-to-team relationship SHALL be classified as one of:
- **Collaboration**: Work together closely, shared context (temporary)
- **X-as-a-Service**: One team provides a capability, other teams consume it (stable)
- **Facilitating**: One team helps another adopt a new practice (temporary)

**FR-039.2**: Interaction modes SHALL inform how the orchestrator delegates cross-team work.

#### Technical Requirements

**TR-039.1 — teams.yaml Config**:
```yaml
team-interactions:
  - from: backend
    to: frontend
    mode: collaboration
    notes: "Shared API contract design"

  - from: testing
    to: all
    mode: x-as-a-service
    notes: "Testing provides test scaffolding and review"

  - from: quality
    to: all
    mode: facilitating
    notes: "Quality helps teams adopt new practices"

  - from: security
    to: all
    mode: x-as-a-service
    notes: "Security reviews on request"

  - from: data
    to: backend
    mode: collaboration
    notes: "Schema design requires joint work"
```

**TR-039.2 — Orchestrator Behavior**:
- **Collaboration**: When assigning cross-team work, create joint tasks visible to both teams. Use pair mode (F-015) when appropriate.
- **X-as-a-Service**: Create a request task for the service team. Consuming team waits (or works on other items).
- **Facilitating**: Don't delegate the work TO the facilitating team. Delegate the work to the target team with facilitating team as a resource.

---

### F-040: Team API

#### Functional Requirements

**FR-040.1**: Each team SHALL have a published "API" defining: what it accepts, what it produces, how to request work, expected response time.

#### Technical Requirements

**TR-040.1 — teams.yaml Extension**:
```yaml
teams:
  - id: backend
    name: BACKEND
    api:
      accepts: [implement, review, plan]
      produces: [api-endpoints, service-modules, api-docs]
      request-via: /delegate --to backend
      sle:
        P0: same-session
        P1: within-2-sessions
        P2: within-sprint
    # ...
```

**TR-040.2 — SLE Monitoring**: `scripts/sprint-metrics.mjs` tracks SLE compliance:
```
For each completed item:
  Check if completion time met the SLE for its priority
  SLE compliance rate = items_within_sle / total_items
```

---

### F-041: Cognitive Load Budgeting

#### Functional Requirements

**FR-041.1**: Tasks assigned to an agent SHALL consider context window limits.

**FR-041.2**: Tasks that require reading more files/context than a single session can handle SHALL be flagged for decomposition.

#### Technical Requirements

**TR-041.1 — Heuristic**: Extend `scripts/validate-dor.mjs`:
```
For each item with scope-identified files:
  estimated_context = count(files) * avg_file_size
  if estimated_context > threshold (e.g., 50 files or 10k lines):
    warn: "Cognitive load risk: {count} files, ~{lines} lines. Consider decomposing."
```

**TR-041.2 — teams.yaml Config**:
```yaml
process:
  cognitive-load:
    max-files-per-task: 50
    max-lines-per-task: 10000
    action: warn   # warn or block
```

---

### F-042: Chapters for Shared Skills

#### Functional Requirements

**FR-042.1**: Cross-team groups with shared skills SHALL be defined as "chapters" with shared standards.

**FR-042.2**: Chapter members follow chapter standards in addition to team standards.

#### Technical Requirements

**TR-042.1 — teams.yaml Config**:
```yaml
chapters:
  - id: code-review
    members: [backend, frontend, quality, security]
    standards: docs/06_engineering/standards/code-review-standards.md

  - id: testing
    members: [testing, backend, frontend]
    standards: docs/06_engineering/standards/testing-standards.md

  - id: documentation
    members: [docs, product, quality]
    standards: docs/06_engineering/standards/documentation-standards.md
```

**TR-042.2 — Standards Enforcement**: Chapter standards are enforced via linter rules and CI checks — NOT via agent instructions. The standards files define the rules; tooling enforces them.

---

### F-043: Guilds for Cross-Cutting Concerns

#### Functional Requirements

**FR-043.1**: Optional interest groups SHALL be defined for cross-cutting concerns.

**FR-043.2**: Guilds propose standards and tools but don't have authority — they influence through quality team.

#### Technical Requirements

**TR-043.1 — teams.yaml Config**:
```yaml
guilds:
  - id: performance
    focus: "Runtime performance, bundle size, query optimization"
    champion: backend
    members: [backend, frontend, data, infra]

  - id: security-hardening
    focus: "Proactive security beyond compliance"
    champion: security
    members: [security, backend, devops, infra]

  - id: developer-experience
    focus: "Build speed, tooling, debugging, documentation quality"
    champion: quality
    members: [quality, devops, docs]
```

**TR-043.2 — Guild Outputs**: Guilds produce recommendations that flow through the product team's backlog refinement. No direct task creation authority.

---

### F-044: Span of Control / Team Clusters

#### Functional Requirements

**FR-044.1**: The 10 teams SHALL be grouped into 3-4 clusters for orchestrator management.

#### Technical Requirements

**TR-044.1 — teams.yaml Config**:
```yaml
clusters:
  - id: delivery
    teams: [backend, frontend, data]
    focus: "Feature delivery pipeline"

  - id: platform
    teams: [infra, devops, security]
    focus: "Platform, infrastructure, and security"

  - id: enablement
    teams: [testing, quality, docs, product]
    focus: "Quality, process, and stakeholder alignment"
```

**TR-044.2 — Orchestrator Behavior**: When assessing project state, report at cluster level first: "Delivery: 5/6 WIP, 2 blocked. Platform: 2/5 WIP, 0 blocked. Enablement: 3/7 WIP, 0 blocked." Drill into team-level only when needed.

---

### F-045: Temporary Task Forces

#### Functional Requirements

**FR-045.1**: For large cross-cutting features, a temporary squad SHALL be assemblable from members of multiple teams.

**FR-045.2**: Task forces dissolve when the feature ships.

#### Technical Requirements

**TR-045.1 — Task Force Protocol**:
```json
// .claude/state/task-forces.json
{
  "task_forces": [
    {
      "id": "TF-001",
      "name": "OAuth Integration",
      "teams": ["backend", "security", "testing"],
      "scope": ["auth/**"],
      "created": "2026-03-05",
      "status": "active",
      "dissolves_on": "feature shipped"
    }
  ]
}
```

**TR-045.2 — Orchestrator Integration**: During a task force's lifetime, the orchestrator routes all work within the task force's scope to the task force members, overriding normal team routing.

---

## Theme E: Planning & Strategy

### F-046: OKRs per Sprint

**Extends**: F-003 (Sprint Goal)

#### Functional Requirements

**FR-046.1**: Sprint Goal SHALL be structured as an Objective with 2-3 measurable Key Results.

**FR-046.2**: Key Results SHALL be scored 0.0-1.0 at sprint review.

#### Technical Requirements

**TR-046.1 — Backlog Format**:
```markdown
## Active Sprint

**Objective**: Establish reliable CI/CD that the team trusts
**Key Results**:
- KR1: CI runs on every PR with < 10 min cycle time [0.0-1.0]
- KR2: Zero manual deployment steps for staging [0.0-1.0]
- KR3: Test coverage reaches 80% on core modules [0.0-1.0]

**Sprint**: 2 | **Capacity**: 18 pts
```

**TR-046.2 — Scoring**: At sprint review, each KR gets a score. 0.7 is target. 1.0 means the target was too easy. Written to sprint review document.

---

### F-047: Hill Charts

#### Functional Requirements

**FR-047.1**: Each in-progress item SHALL be tracked on a conceptual "hill": uphill (figuring it out) or downhill (making it happen).

**FR-047.2**: Items stuck uphill for > 1 session SHALL be flagged for spike or swarm.

#### Technical Requirements

**TR-047.1 — Backlog Metadata**: Add `Hill` column or field:
```markdown
| Task | Hill | Notes |
|------|------|-------|
| API routes | Downhill (70%) | Implementation underway |
| Auth design | Uphill (30%) | Still investigating approach |
```

**TR-047.2 — Stuck Detection**: `scripts/sprint-metrics.mjs` checks: if an item has been "Uphill" for > 1 session, flag: "STUCK UPHILL: {item}. Consider spike or swarm."

### Context Bloat Mitigation

Hill status is a field on the backlog item (one word + percentage). Not carried in agent instructions.

---

### F-048: Value Stream Mapping

#### Functional Requirements

**FR-048.1**: The full delivery pipeline SHALL be mapped with time spent at each stage.

**FR-048.2**: The stage with the most waste (waiting time, rework) SHALL be identified each sprint.

#### Technical Requirements

**TR-048.1 — Pipeline Stages**: Derived from state transitions (F-022):
```
Backlog → Ready → In Progress → In Review → Done → Shipped
```

**TR-048.2 — Waste Analysis**: `scripts/sprint-metrics.mjs` calculates time in each stage:
```
For each completed item:
  backlog_time = ready_timestamp - created_timestamp
  wait_time = in_progress_timestamp - ready_timestamp
  work_time = in_review_timestamp - in_progress_timestamp
  review_time = done_timestamp - in_review_timestamp

Waste = stages where items spend time but no value is added (waiting)
```

**TR-048.3 — Sprint Metrics Addition**:
```markdown
## Value Stream
| Stage | Avg Time | % of Total | Waste? |
|-------|----------|-----------|--------|
| Waiting in Ready | 0.5 sessions | 15% | Yes — reduce by pre-assigning |
| In Progress | 1.5 sessions | 45% | No — value-add |
| In Review | 1.0 sessions | 30% | Partial — reduce review queue |
| Post-review wait | 0.3 sessions | 10% | Yes — auto-merge when approved |
```

---

### F-049: Cooldown Periods

#### Functional Requirements

**FR-049.1**: After every 3-4 sprints, 1 session SHALL be unstructured: tech debt, exploration, tooling, dependency updates.

**FR-049.2**: Cooldown is NOT wasted time — it's investment.

#### Technical Requirements

**TR-049.1 — teams.yaml Config**:
```yaml
process:
  cooldown:
    frequency: every-4-sprints
    duration: 1 session
    allowed-work: [tech-debt, spike, tooling, dependency-update]
```

**TR-049.2 — Orchestrator Integration**: `scripts/sprint-lifecycle.mjs` tracks sprint count. After every 4th sprint end: "Cooldown session recommended. Focus: tech debt, dependency updates, tooling improvements."

---

### F-050: Fat Marker Sketches (Loose Scoping)

**Extends**: F-033 (Commander's Intent)

#### Functional Requirements

**FR-050.1**: Task descriptions SHALL be intentionally loose, defining the "shape" of the solution, not the exact implementation.

**FR-050.2**: Over-specified tasks SHALL be flagged during refinement.

#### Technical Requirements

**TR-050.1 — DOR Update**: Add to DOR.md:
```markdown
## scope-shape
- [ ] `not-over-specified`: Task does not prescribe file names, function signatures, or specific libraries unless there is a hard constraint
```

**TR-050.2 — Validation**: Extend `scripts/validate-dor.mjs` to detect over-specification patterns in task descriptions (file paths, function names, class names) and warn.

---

## Theme F: Learning & Improvement

### F-051: After-Action Review (AAR)

**Extends**: F-004 (Retrospective), F-020 (RCA)

#### Functional Requirements

**FR-051.1**: For every P0 incident, a structured AAR SHALL be completed within 1 session.

**FR-051.2**: AAR format: What was planned → What happened → Why → What we'll do differently.

#### Technical Requirements

**TR-051.1 — Template**: `docs/history/lessons-learned/TEMPLATE-aar.md`:
```markdown
# After-Action Review — [Incident Title]

**Date**: [YYYY-MM-DD]
**Severity**: P0
**Duration**: [time from detection to resolution]
**Teams involved**: [list]

## What Was Planned
[What we expected to happen]

## What Actually Happened
[What happened, timeline]

## Why (Root Cause — 5 Whys)
1. → 2. → 3. → 4. → 5. → [root cause]

## What We'll Do Differently
- [ ] [Systemic fix — backlog item link]
- [ ] [Process change]
- [ ] [Poka-yoke addition]
```

---

### F-052: Kaizen Counter

#### Functional Requirements

**FR-052.1**: The number of small process improvements per sprint SHALL be tracked as a health metric.

**FR-052.2**: Target: increasing or stable kaizen count over time. Declining = stagnation warning.

#### Technical Requirements

**TR-052.1 — Events Log**: Each improvement logged as:
```json
{"type": "kaizen", "description": "Added lint rule for unused imports", "team": "devops", "sprint": 2}
```

**TR-052.2 — Sprint Metrics Addition**:
```markdown
## Kaizen
- Improvements this sprint: 4
- Rolling trend: 2 → 3 → 4 (healthy: increasing)
```

---

### F-053: Genchi Genbutsu (Go and See)

#### Functional Requirements

**FR-053.1**: Agents SHALL verify current state directly before acting. No acting on assumptions or stale information.

**FR-053.2 — Enforcement Type**: `advisory` — this is a behavioral principle tracked via compliance metrics, not a hard gate. Compliance is measured by tracking `ac-verify-before-change` rule violations (e.g., agent edits a file it didn't read) in events.log and reporting the rate in sprint retros.

#### Technical Requirements

**TR-053.1 — Rule Addition**: Add to `.agentkit/spec/rules.yaml` (NOT to each agent individually):
```yaml
rules:
  - id: ac-verify-state
    scope: all-agents
    rule: "Before modifying any file, read its current contents. Before assuming a test passes, run it. Before assuming a dependency exists, check package.json. Never act on stale information or assumptions."
    type: advisory
    phase: implementation
```

This rule already partially exists as `ac-verify-before-change`. Strengthen it.

**TR-053.2 — Compliance Tracking**: `scripts/sprint-metrics.mjs` tracks:
```
verify_before_edit_rate = edits_with_prior_read / total_edits
Target: > 95%
```

### Context Bloat Mitigation

One rule in rules.yaml, applied to all agents. Not repeated per agent. The rule is ~30 words.

---

### F-054: Experiment-Driven Improvement

#### Functional Requirements

**FR-054.1**: Every process change SHALL be treated as an experiment with: hypothesis, duration, success criteria, evaluation.

**FR-054.2**: Experiments that fail SHALL be reverted.

#### Technical Requirements

**TR-054.1 — Experiment Log**: `docs/06_engineering/experiments.md`:
```markdown
# Process Experiments

| ID | Hypothesis | Duration | Success Criteria | Status | Result |
|----|-----------|----------|-----------------|--------|--------|
| EXP-001 | WIP limit of 2 reduces cycle time | 2 sprints | Cycle time decreases 20% | Active | — |
| EXP-002 | Pair programming reduces P0 defects | 3 sprints | P0 defect rate decreases 50% | Active | — |
```

**TR-054.2 — Review Cadence**: At every 2nd sprint retro, review active experiments. Score and decide: keep, modify, or revert.

---

### F-055: Voice of the Customer

#### Functional Requirements

**FR-055.1**: Every feature-type backlog item SHALL trace to a user story, PRD, or explicit user need.

**FR-055.2**: Items that cannot trace to a user need SHALL be challenged during refinement.

#### Technical Requirements

**TR-055.1 — DOR Extension**: Add to DOR.md:
```markdown
## traceability
- [ ] `user-need`: For features, links to a user story, PRD, or explicit user justification
```

**TR-055.2 — Validation**: `scripts/validate-dor.mjs` checks: if `type == feature` and Notes column has no PRD/story link, warn: "Feature has no user need traceability."

---

## Theme G: Sustainability

### F-056: Token/Cost Budgeting

#### Functional Requirements

**FR-056.1**: Each session SHALL have a token/cost budget.

**FR-056.2**: Work SHALL be scoped to fit within the budget.

**FR-056.3**: Sessions approaching budget limit SHALL receive a warning.

#### Technical Requirements

**TR-056.1 — teams.yaml Config**:
```yaml
process:
  session-budget:
    warning-threshold: 80%     # Warn at 80% of budget consumed
    action-at-limit: handoff   # Auto-trigger /handoff at budget
```

**TR-056.2 — Budget is external**: Token tracking is a platform concern, not something we implement in scripts. This spec defines the desired behavior for when the platform signals budget consumption. The orchestrator checks budget status and adjusts: "Budget at 80%. Prioritize completing in-progress items over starting new work."

---

### F-057: Buffer Capacity

#### Functional Requirements

**FR-057.1**: 15-20% of sprint capacity SHALL be left unallocated for emergent work, discoveries, and blockers.

#### Technical Requirements

**TR-057.1 — Already spec'd**: Sprint buffer is defined in SPEC-PROC-001 (TR-005.3):
```yaml
process:
  sprint-buffer-percent: 15
```

**TR-057.2 — Enforcement**: `scripts/validate-sprint.mjs` checks:
```
committed_points <= capacity * (1 - buffer_percent / 100)
If violated: warn "Sprint over-committed: {committed} pts > {max_commitment} pts (buffer: {buffer}%)"
```

---

### F-058: Just-in-Time Work

#### Functional Requirements

**FR-058.1**: Agents SHALL NOT pre-generate scaffolding, boilerplate, docs, or config for features not yet in the active sprint.

#### Technical Requirements

**TR-058.1 — Rule Addition**: Add to `.agentkit/spec/rules.yaml`:
```yaml
rules:
  - id: ac-just-in-time
    scope: all-agents
    rule: "Do not create scaffolding, boilerplate, templates, or documentation for work not yet in the active sprint. Produce only what the current task requires."
    type: agent-conduct
    phase: implementation
```

### Context Bloat Mitigation

One rule, ~25 words, applied globally. Prevents agents from creating unnecessary files that other agents then need to understand.

---

_This is a planning document. No implementation changes have been made._
_See SPEC-PROC-004a for the consolidated script manifest, teams.yaml process section, and agent impact summary._
_See also: SPEC-PROC-001, SPEC-PROC-002, SPEC-PROC-003 for companion specifications._
