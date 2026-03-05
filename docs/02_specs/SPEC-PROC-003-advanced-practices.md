# SPEC-PROC-003: Advanced Practices

**Status**: Draft
**Phase**: 3 — Future Sprints (architecture & design work)
**Scope**: Time-boxed Sprints, Sprint Review, Cross-training, Pair Programming, Burndown, Backlog Refinement, Tech Debt Management, Information Radiators, Root Cause Analysis, Collective Code Ownership
**Depends On**: SPEC-PROC-001 (Process Foundations), SPEC-PROC-002 (Process Enforcement)

---

## Design Principle: Code Over Context

Phase 3 introduces the most complex behaviors. The temptation is to describe these in agent instructions. Resist that. Every practice here is implemented as either:

1. **Config** in `teams.yaml` (read once by orchestrator)
2. **Scripts** that run at defined checkpoints
3. **Generated artifacts** that agents read only when relevant

---

## F-012: Time-boxed Sprints

### Functional Requirements

**FR-012.1**: A sprint SHALL be a fixed-duration work period with explicit start and end boundaries.

**FR-012.2**: Sprint duration SHALL be configurable. Default: 5 sessions or 1 calendar week, whichever comes first.

**FR-012.3**: Sprint lifecycle: Planning → Execution (with syncs) → Review → Retrospective.

**FR-012.4**: No new work SHALL enter mid-sprint without Product Owner scope-change approval.

**FR-012.5**: Sprint boundaries SHALL be tracked in orchestrator state for metrics and enforcement.

### Technical Requirements

**TR-012.1 — teams.yaml Config**:

```yaml
process:
  sprint:
    duration-sessions: 5
    duration-calendar-days: 7 # Whichever hits first
    ceremonies:
      planning: sprint-start
      sync: session-start
      review: sprint-end
      retro: sprint-end
    scope-change-approval: product # PO must approve mid-sprint additions
```

**TR-012.2 — Sprint State**: `.claude/state/orchestrator.json` tracks:

```json
{
  "sprint": {
    "number": 2,
    "started": "2026-03-05",
    "session_count": 3,
    "max_sessions": 5,
    "status": "active",
    "goal": "...",
    "committed_points": 18,
    "completed_points": 8
  }
}
```

**TR-012.3 — Sprint Boundary Script**: `scripts/sprint-lifecycle.mjs`

```
Commands:
  sprint start --goal <goal> --capacity <pts>
  sprint status
  sprint end                    # Triggers review + retro + metrics
  sprint scope-change --add <item> --approved-by <role>
```

**TR-012.4 — Orchestrator Integration**:

- `/orchestrate` checks `sprint.session_count` against `sprint.max_sessions`
- At boundary: "Sprint 2 has used 5/5 sessions. Trigger sprint end? (review → retro → planning)"
- Mid-sprint: scope change detection logs `po-decision` event

### Context Bloat Mitigation

Sprint state lives in `orchestrator.json`. Agents don't track sprint boundaries — the orchestrator does. Agents just receive tasks. The sprint lifecycle is invisible to them.

---

## F-013: Sprint Review Auto-generation

### Functional Requirements

**FR-013.1**: At sprint end, a review summary SHALL be auto-generated.

**FR-013.2**: The review SHALL include:

- Sprint Goal and achievement status
- Completed items with PR links and changed files
- Carried-over items with reasons
- Key decisions made during the sprint
- Placeholder for stakeholder notes

**FR-013.3**: The Product Owner SHALL review and annotate the generated review.

### Technical Requirements

**TR-013.1 — Generation Script**: `scripts/generate-review.mjs`

```
Input:  sprint number
Action:
  1. Read AGENT_BACKLOG.md Completed section for sprint N
  2. Read events.log for sprint N date range
  3. Run `git log` for commits in sprint date range
  4. Cross-reference completed tasks with PRs/commits
  5. Identify carried-over items (in Active Sprint at sprint end, not Done)
  6. Extract key decisions from events.log (type: "po-decision", "adr-created")
Output: docs/history/sprint-reviews/sprint-N-review.md
```

**TR-013.2 — Review Template**:

```markdown
# Sprint N Review — [Date]

## Sprint Goal

[Goal statement] — **[Achieved / Partially Achieved / Not Achieved]**

## Completed Items

| Task | Team | Points | PR  | Key Files |
| ---- | ---- | ------ | --- | --------- |

## Carried Over

| Task | Team | Points | Reason |
| ---- | ---- | ------ | ------ |

## Key Decisions

- [Decision from events.log]

## Stakeholder Notes

_[To be added by Product Owner]_

## Metrics Summary

_[Auto-linked from metrics/sprint-N.md]_
```

### Context Bloat Mitigation

Pure script output. No agent involvement in generation. PO annotates the file directly — not via an agent instruction.

---

## F-014: Cross-training / Secondary Scopes

### Functional Requirements

**FR-014.1**: Teams SHALL have optional secondary scopes — file areas they can work in when their primary expertise is needed elsewhere.

**FR-014.2**: Secondary scope work SHALL only be assigned when:

1. The primary-scope team is at WIP limit, OR
2. Swarming is triggered, OR
3. The orchestrator explicitly assigns cross-team work

**FR-014.3**: All secondary-scope contributions SHALL require quality review by the primary-scope team.

### Technical Requirements

**TR-014.1 — teams.yaml Schema**:

```yaml
teams:
  - id: backend
    name: BACKEND
    scope: ['apps/api/**', 'services/**', 'src/server/**', 'controllers/**']
    secondary-scope: ['**/*.test.*'] # Can write tests
    secondary-requires-review-from: testing # Testing must review

  - id: testing
    name: TESTING
    scope: ['**/*.test.*', 'tests/**', 'e2e/**']
    secondary-scope: ['apps/api/**'] # Can read/understand API code for test writing
    secondary-requires-review-from: backend

  - id: frontend
    name: FRONTEND
    scope: ['apps/web/**', 'components/**']
    secondary-scope: ['docs/01_product/**'] # Can contribute to product docs
    secondary-requires-review-from: docs
```

**TR-014.2 — Orchestrator Logic**:
When assigning work and primary team is at WIP limit:

1. Check `secondary-scope` of available teams
2. If a match exists and that team is below WIP limit, assign with flag `cross-team: true`
3. Auto-create a review task for the `secondary-requires-review-from` team

**TR-014.3 — Events Log**:

```json
{
  "type": "cross-team-assignment",
  "task": "...",
  "primary_team": "testing",
  "assigned_to": "backend",
  "scope_type": "secondary",
  "review_by": "testing"
}
```

### Context Bloat Mitigation

Secondary scope is config only. Agents don't carry instructions about when to use secondary scope. The orchestrator decides. When an agent gets a cross-team task, it just looks like a normal task with a note: "Review required by [team] before merge."

---

## F-015: Pair Programming Mode

### Functional Requirements

**FR-015.1**: Two agents SHALL be able to collaborate on the same task using a rapid sequential review model (see TR-015.3). The driver implements a small chunk; the navigator reviews it immediately before the next chunk begins.

**FR-015.2**: Roles: Driver (writes code) and Navigator (reviews in real-time, catches issues).

**FR-015.3**: Pair programming SHALL be reserved for:

- P0/P1 items with complexity >= 5 points
- Security-sensitive code
- Cross-team integration points

**FR-015.4**: Pair sessions SHALL be tracked for cost and effectiveness evaluation.

### Technical Requirements

**TR-015.1 — teams.yaml Config**:

```yaml
process:
  pair-programming:
    enabled: true
    triggers:
      - priority: [P0, P1]
        min-complexity: 5
      - scope: ['auth/**', 'security/**']
      - type: cross-team-integration
    cost-multiplier: 2.0 # Token budget impact
```

**TR-015.2 — Invocation**: `/delegate --pair <team-a> <team-b> --task <id>`

**TR-015.3 — Implementation Approach**:
Rather than two simultaneous agents (which is expensive and complex), implement as **rapid sequential review**:

1. Driver agent implements a small chunk (one function, one module)
2. Navigator agent immediately reviews that chunk
3. Driver incorporates feedback
4. Repeat

This achieves 80% of pair programming's value at ~1.3x cost instead of 2x.

**TR-015.4 — Task Protocol**:

```json
{
  "type": "pair",
  "driver": "backend",
  "navigator": "security",
  "task": "P0-T5-001",
  "chunks": [
    { "file": "auth/oauth.ts", "driver_done": true, "navigator_reviewed": true, "issues": 0 },
    { "file": "auth/tokens.ts", "driver_done": true, "navigator_reviewed": false }
  ]
}
```

### Context Bloat Mitigation

Pair mode is orchestrator-managed. The driver gets a normal task. The navigator gets a review task scoped to specific files. Neither agent carries pair-programming process instructions.

---

## F-016: Burndown Visibility

### Functional Requirements

**FR-016.1**: Sprint progress SHALL be tracked as a running burndown of remaining story points.

**FR-016.2**: Burndown SHALL update after each task completion.

**FR-016.3**: If the burndown trend shows the sprint goal is at risk, the orchestrator SHALL flag it.

### Technical Requirements

**TR-016.1 — Burndown in AGENT_BACKLOG.md**:

```markdown
## Burndown — Sprint 2

**Total**: 21 pts | **Completed**: 8 pts | **Remaining**: 13 pts

| Session | Remaining | Delta | Notes               |
| ------- | --------- | ----- | ------------------- |
| 1       | 21        | —     | Sprint start        |
| 2       | 18        | -3    |                     |
| 3       | 15        | -3    |                     |
| 4       | 13        | -2    | +2 pts scope change |
```

**TR-016.2 — Burndown Update Script**: `scripts/burndown-update.mjs`

```
Input:  none (reads AGENT_BACKLOG.md current state)
Action:
  1. Calculate remaining points from Active Sprint items not Done
  2. Append row to burndown table
  3. Calculate ideal burndown rate (total / max_sessions)
  4. Compare actual to ideal
  5. If actual > ideal * 1.3: emit warning "Sprint at risk"
Output: Updated AGENT_BACKLOG.md burndown section
```

**TR-016.3 — Risk Threshold**: If remaining points exceed ideal burndown by 30% or more, orchestrator receives: "BURNDOWN WARNING: Sprint at risk. 13 pts remaining with 1 session left (ideal: 4 pts). Consider scope negotiation."

### Context Bloat Mitigation

Burndown is a script that updates a markdown table. Agents don't calculate burndown. The orchestrator reads the warning if triggered. One line: "Sprint on track" or "Sprint at risk — [details]."

---

## F-017: Backlog Refinement Ceremony

### Functional Requirements

**FR-017.1**: A refinement pass SHALL occur before sprint planning.

**FR-017.2**: Refinement activities:

1. DOR check on all candidate items
2. Estimate unestimated items
3. Decompose items > 8 points
4. Update cross-team dependencies
5. Tag items as `refined: true`

**FR-017.3**: Only items tagged `refined: true` SHALL be eligible for sprint planning.

### Technical Requirements

**TR-017.1 — Refinement Script**: `scripts/backlog-refine.mjs`

```
Input:  none (reads AGENT_BACKLOG.md Backlog section)
Action:
  1. Run validate-dor.mjs on each backlog item
  2. Flag items missing estimates
  3. Flag items with estimate > 8
  4. Flag items with unresolved dependencies
  5. Output: refinement report with item-by-item status
Output:
  {
    "ready": ["P1-T1-002", "P2-T2-003"],
    "needs_estimate": ["P2-T5-001"],
    "needs_decomposition": ["P1-T1-005"],
    "needs_dependency_resolution": ["P1-T3-001"],
    "refined_count": 5,
    "total_candidates": 8
  }
```

**TR-017.2 — Refinement Tag**: Add `Refined` column to Backlog table, or append `[refined]` to Notes.

**TR-017.3 — Sprint Planning Gate**: `/orchestrate` sprint planning only considers items where `refined: true`.

### Context Bloat Mitigation

Refinement is a script run. Agents are asked to estimate specific items ("Estimate P2-T5-001") — they don't carry the refinement process. The script orchestrates which items need attention.

---

## F-018: Technical Debt Management

### Functional Requirements

**FR-018.1**: 20% of sprint capacity SHALL be reserved for technical debt items.

**FR-018.2**: Backlog items SHALL have a `type` field: `feature | bugfix | tech-debt | process`.

**FR-018.3**: If tech debt items exceed 30% of total backlog, a dedicated tech debt sprint SHALL be triggered.

**FR-018.4**: A tech debt register SHALL track severity and impact.

### Technical Requirements

**TR-018.1 — Backlog Schema**: Add `Type` column to `AGENT_BACKLOG.md`:

```markdown
| Priority | Team | Task | Type | Phase | Status | Estimate | Notes |
```

**TR-018.2 — Capacity Allocation Script**: `scripts/sprint-metrics.mjs` extended:

```
When calculating sprint capacity:
  total_capacity = rolling_avg + buffer
  tech_debt_budget = total_capacity * 0.20
  feature_budget = total_capacity - tech_debt_budget

Sprint planning must include at least tech_debt_budget points of type: tech-debt
```

**TR-018.3 — Tech Debt Threshold**: `scripts/backlog-health.mjs`

```
Input: AGENT_BACKLOG.md
Action:
  Count items by type
  If tech-debt / total > 0.30: emit "TECH DEBT WARNING: 35% of backlog is tech debt. Consider dedicated sprint."
```

**TR-018.4 — Tech Debt Register**: `docs/06_engineering/tech-debt-register.md`

```markdown
# Tech Debt Register

| ID     | Description                                | Severity | Impact                             | Introduced | Team    | Status |
| ------ | ------------------------------------------ | -------- | ---------------------------------- | ---------- | ------- | ------ |
| TD-001 | Express router middleware ordering fragile | High     | New routes may break existing auth | Sprint 1   | backend | Open   |
```

### Context Bloat Mitigation

Type field is metadata in the backlog. Agents don't carry tech debt policies. The orchestrator allocates capacity using the script. Agents receive tech debt tasks like any other task.

---

## F-019: Information Radiators (STATUS.md)

### Functional Requirements

**FR-019.1**: A `STATUS.md` file at repo root SHALL provide at-a-glance project status.

**FR-019.2**: STATUS.md SHALL be auto-generated, never manually edited.

**FR-019.3**: Content: sprint info, team WIP status, active blockers, recent completions.

### Technical Requirements

**TR-019.1 — Generation Script**: `scripts/generate-status.mjs`

```
Input: AGENT_BACKLOG.md, orchestrator.json, sync.json, teams.yaml
Output: STATUS.md
```

**TR-019.2 — Format**:

```markdown
# Project Status — Auto-generated [timestamp]

**Sprint**: 2 | **Goal**: [goal] | **Health**: On Track
**Velocity** (3-sprint avg): 17 pts | **This sprint**: 8/18 pts (session 3/5)

## Team Status

| Team    | WIP | Current Task                | Status    |
| ------- | --- | --------------------------- | --------- |
| Backend | 2/2 | API routes, Auth middleware | On track  |
| Data    | 0/1 | —                           | Available |

## Active Blockers

- [P1-T1-001] Auth middleware — blocked 1 session — Owner: Backend

## Recent Completions (last 2 sessions)

- [P1-T8-001] Linting config — DevEx — Sprint 1
```

**TR-019.3 — Generation Trigger**: Runs at end of every `/orchestrate` call. Also available manually: `node scripts/generate-status.mjs`.

### Context Bloat Mitigation

STATUS.md is for human consumption and orchestrator quick-reference. Agents don't read it. The orchestrator reads `orchestrator.json` and `sync.json` directly (which STATUS.md is derived from).

---

## F-020: Root Cause Analysis (5 Whys)

### Functional Requirements

**FR-020.1**: For any P0 incident or sprint goal miss, a root cause analysis SHALL be required.

**FR-020.2**: RCA SHALL use the "5 Whys" technique.

**FR-020.3**: RCA SHALL identify a systemic fix (process/config/tool change), not just a code fix.

**FR-020.4**: Systemic fixes SHALL be added to `AGENT_BACKLOG.md` as process improvement items.

### Technical Requirements

**TR-020.1 — Template Extension**: Add to `TEMPLATE-lesson.md`:

```markdown
## Root Cause Analysis (5 Whys)

_Required for P0 incidents and sprint goal misses._

1. Why did [problem] happen?
   → [answer]
2. Why did [answer 1] happen?
   → [answer]
3. Why did [answer 2] happen?
   → [answer]
4. Why did [answer 3] happen?
   → [answer]
5. Why did [answer 4] happen?
   → [root cause]

**Systemic Fix**: [Process/config/tool change that prevents recurrence]
**Backlog Item**: [Link to AGENT_BACKLOG.md item for the systemic fix]
```

**TR-020.2 — Trigger**: Quality team generates RCA when:

- events.log contains `type: "incident"` with `severity: P0`
- Sprint review shows goal `Not Achieved`
- DOD violation count exceeds 3 in a sprint

**TR-020.3 — Events Log**:

```json
{
  "type": "rca-created",
  "trigger": "sprint-goal-missed",
  "sprint": 2,
  "systemic_fix": "...",
  "backlog_item": "P2-Q-001"
}
```

### Context Bloat Mitigation

RCA is a template that quality team fills out. The template lives in `docs/history/lessons-learned/`. No agent carries RCA instructions — the quality team reads the template when triggered. The trigger is an events.log entry, not an agent instruction.

---

## F-021: Collective Code Ownership Tracking

### Functional Requirements

**FR-021.1**: Code familiarity SHALL be tracked per team — which files/modules each team has worked on.

**FR-021.2**: Modules with only one team's familiarity (bus factor = 1) SHALL be flagged.

**FR-021.3**: During cross-training opportunities, bus-factor-1 modules SHALL be prioritized for secondary team assignment.

### Technical Requirements

**TR-021.1 — Ownership Tracking Script**: `scripts/code-ownership.mjs`

```
Input: git log (last N sprints), teams.yaml (team scopes)
Action:
  1. For each file changed in git log:
     - Determine which team scope it falls under
     - Record which teams have committed to that file area
  2. For each module (directory):
     - Count distinct teams that have touched it
     - Flag if count == 1 (bus factor = 1)
Output:
  {
    "modules": [
      { "path": "apps/api/auth/", "teams": ["backend"], "bus_factor": 1, "risk": "high" },
      { "path": "apps/api/routes/", "teams": ["backend", "testing"], "bus_factor": 2, "risk": "low" }
    ],
    "bus_factor_1_count": 5,
    "total_modules": 12
  }
```

**TR-021.2 — Risk Report**: `scripts/code-ownership.mjs report` generates:

```markdown
# Code Ownership Report — [Date]

## High Risk (Bus Factor = 1)

| Module         | Solo Team | Last Modified | Recommended Secondary |
| -------------- | --------- | ------------- | --------------------- |
| apps/api/auth/ | backend   | 2 sprints ago | security              |
| db/migrations/ | data      | 1 sprint ago  | backend               |

## Healthy (Bus Factor >= 2)

| Module           | Teams            | Last Modified  |
| ---------------- | ---------------- | -------------- |
| apps/api/routes/ | backend, testing | current sprint |
```

**TR-021.3 — Integration**: Run `code-ownership.mjs report` at sprint planning. Use results to inform cross-training assignments (F-014).

### Context Bloat Mitigation

Pure script + git log analysis. Zero agent context. The orchestrator reads the report and may assign cross-training work based on it. Agents just receive tasks.

---

## File Manifest

Files to create:

```
scripts/sprint-lifecycle.mjs     # Sprint boundary management
scripts/generate-review.mjs      # Sprint review auto-generation
scripts/burndown-update.mjs      # Burndown tracking
scripts/backlog-refine.mjs       # Refinement automation
scripts/backlog-health.mjs       # Tech debt threshold monitoring
scripts/generate-status.mjs      # STATUS.md generation
scripts/code-ownership.mjs       # Bus factor analysis
STATUS.md                        # Auto-generated project status (repo root)
docs/06_engineering/tech-debt-register.md  # Tech debt register
docs/history/sprint-reviews/     # Directory for sprint reviews
```

Files to modify:

```
.agentkit/spec/teams.yaml        # Add secondary-scope, pair-programming config, sprint config
AGENT_BACKLOG.md                 # Add Type column, Burndown section, refined tags
docs/history/lessons-learned/TEMPLATE-lesson.md  # Add 5 Whys section
```

---

## Dependencies

```
F-012 (Time-boxed) ──► Depends on F-003 (Sprint Goal), F-009 (Metrics for capacity)
F-013 (Review) ─────► Depends on F-012 (Sprint boundaries)
F-014 (Cross-train) ► Depends on F-007 (WIP limits trigger cross-team)
F-015 (Pair) ───────► Depends on F-007 (WIP), minimal external deps
F-016 (Burndown) ──► Depends on F-005 (Story points), F-012 (Sprint boundaries)
F-017 (Refinement) ► Depends on F-002 (DOR), F-005 (Estimation)
F-018 (Tech Debt) ─► Depends on F-009 (Metrics for capacity allocation)
F-019 (Status) ────► Depends on F-006 (Sync), F-007 (WIP), F-012 (Sprint)
F-020 (RCA) ───────► Depends on F-004 (Retro template)
F-021 (Ownership) ─► Depends on F-014 (Cross-training uses ownership data)
```

Recommended implementation order:
F-012 → F-016 → F-017 → F-013 → F-018 → F-019 → F-014 → F-021 → F-015 → F-020

---

## Acceptance Criteria

| Item              | Acceptance Criteria                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| F-012 Time-boxed  | Sprint start/end tracked. Session counter works. Scope change requires PO approval                        |
| F-013 Review      | Auto-generated review includes completed items, carried-over items, goal status                           |
| F-014 Cross-train | Secondary scope assignments work. Review auto-created for primary team                                    |
| F-015 Pair        | Pair tasks created with driver/navigator roles. Sequential review mode works                              |
| F-016 Burndown    | Burndown table updates per session. At-risk warning triggers at 30% deviation                             |
| F-017 Refinement  | Refinement script identifies unestimated, oversized, and unready items. Refined tag gates sprint planning |
| F-018 Tech Debt   | Type column exists. 20% reservation enforced. 30% threshold warning triggers                              |
| F-019 Status      | STATUS.md auto-generated with team WIP, blockers, recent completions                                      |
| F-020 RCA         | 5 Whys template works. Systemic fixes added to backlog. Triggers fire on P0/goal miss                     |
| F-021 Ownership   | Bus factor report generated from git log. Single-team modules flagged                                     |
