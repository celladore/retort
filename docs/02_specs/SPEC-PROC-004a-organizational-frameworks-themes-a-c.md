# SPEC-PROC-004a: Organizational Framework Practices — Themes A-C

**Status**: Draft
**Phase**: Cross-phase — items span Tiers 1-3 from the organizational frameworks plan
**Scope**: Themes A (Flow), B (Quality), C (Decision-Making) — F-022 through F-038
**Depends On**: SPEC-PROC-001, SPEC-PROC-002, SPEC-PROC-003
**Companion**: SPEC-PROC-004b (Themes D-G, F-039 through F-058)
**Source**: `11_organizational_frameworks_adoption_plan.md`

---

## Design Principle: Code Over Context

This spec covers 3 themes with 17 features sourced from Kanban, XP, Lean, Shape Up, TPS, TOC, ICS, Mission Command, Cynefin, DORA, and Six Sigma. The same rule applies: **if you can enforce it in code, don't describe it in agent instructions**.

Many items here overlap with or extend SPEC-PROC-001/002/003 features. Where overlap exists, this spec adds the **incremental delta** only — it does not re-specify what's already covered.

---

## Theme A: Flow & Bottleneck Management

### F-022: Kanban Board Visualization

**Already covered by**: AGENT_BACKLOG.md (partially), F-019 STATUS.md

**Incremental requirement**: Restructure `AGENT_BACKLOG.md` Active Sprint from a flat table to a **flow-oriented layout** with explicit state columns.

#### Functional Requirements

**FR-022.1**: Active Sprint items SHALL be organized by flow state: `Ready → In Progress → In Review → Done`.

**FR-022.2**: Items SHALL move through states strictly in order. No skipping states.

**FR-022.3**: Each state transition SHALL be logged in events.log.

#### Technical Requirements

**TR-022.1 — Backlog Restructure**:
```markdown
## Active Sprint

**Sprint Goal**: ...
**Sprint**: 2 | **Capacity**: 18 pts | **Buffer**: 3 pts

### Ready
| Priority | Team | Task | Type | Estimate | Notes |
|----------|------|------|------|----------|-------|
| P1 | T3-Data | Design database schema | feature | 3 | Waiting on API contract |

### In Progress
| Priority | Team | Task | Type | Estimate | Started | Notes |
|----------|------|------|------|----------|---------|-------|
| P1 | T1-Backend | API route structure | feature | 5 | Session 1 | |

### In Review
| Priority | Team | Task | Type | Estimate | Reviewer | Notes |
|----------|------|------|------|----------|----------|-------|
| P1 | T8-DevEx | Lint config | tech-debt | 2 | T10-Quality | |

### Done
| Priority | Team | Task | Type | Estimate | Actual | Completed | Notes |
|----------|------|------|------|----------|--------|-----------|-------|
| P0 | T4-Infra | CI pipeline | feature | 5 | 5 | Session 2 | |
```

**TR-022.2 — State Transition Script**: `scripts/backlog-transition.mjs`
```
Commands:
  transition <item-id> --to <ready|in-progress|in-review|done>

Validation:
  - ready → in-progress: WIP check must pass
  - in-progress → in-review: DOD pre-check (build, tests, lint)
  - in-review → done: DOD full check + reviewer assigned
  - No backward transitions without explicit reason logged

Events:
  {"type": "state-transition", "item": "...", "from": "in-progress", "to": "in-review", "timestamp": "..."}
```

### Context Bloat Mitigation

Agents work on tasks regardless of which section they're in. The transition script manages flow. Agents only need to know: "Your task. Do it." They don't need to understand the Kanban board structure.

---

### F-023: Cycle Time Tracking

#### Functional Requirements

**FR-023.1**: Cycle time SHALL be measured for every work item: time from "Ready" to "Done".

**FR-023.2**: Lead time SHALL also be tracked: time from item creation (Backlog entry) to "Done".

**FR-023.3**: Cycle time per team SHALL be reported in sprint metrics.

#### Technical Requirements

**TR-023.1 — Timestamp Tracking**: State transitions (F-022) already log timestamps in events.log. Cycle time = `done_timestamp - in_progress_timestamp`. Lead time = `done_timestamp - created_timestamp`.

**TR-023.2 — Metrics Extension**: Extend `scripts/sprint-metrics.mjs`:
```
## Cycle Time
- Average cycle time: 1.8 sessions
- P50: 1.5 sessions | P90: 3.0 sessions
- Slowest item: "Auth middleware" — 4 sessions (blocked 2)

## Per-Team Cycle Time
| Team | Avg | P90 | Items |
|------|-----|-----|-------|
| Backend | 2.1 | 3.5 | 4 |
| Testing | 1.2 | 2.0 | 6 |
```

No new scripts needed — extends existing metrics script using existing event data.

---

### F-024: Bottleneck Identification (Theory of Constraints)

#### Functional Requirements

**FR-024.1**: Every sprint, the orchestrator SHALL identify which team is the current bottleneck (the constraint limiting overall throughput).

**FR-024.2**: Non-bottleneck teams SHALL prioritize work that feeds the bottleneck team.

**FR-024.3**: Bottleneck identification SHALL be data-driven, not subjective.

#### Technical Requirements

**TR-024.1 — Bottleneck Detection**: Extend `scripts/sprint-metrics.mjs`:
```
Bottleneck heuristic:
  For each team:
    throughput = points_completed / sessions_active
    queue_depth = items_in_ready_state_for_this_team
    blocked_time = total_sessions_blocked

  Bottleneck = team with highest (queue_depth / throughput) ratio
  OR team with most items waiting in "Ready" state (work piling up)
```

**TR-024.2 — Orchestrator Action**:
```
If bottleneck detected:
  1. Log: {"type": "bottleneck-identified", "team": "backend", "queue_depth": 4, "throughput": 1.5}
  2. Display: "BOTTLENECK: Backend (4 items queued, throughput 1.5 pts/session). Consider: swarming, cross-training, or deprioritizing non-backend work."
  3. Subordination: When assigning new work, prioritize items that the bottleneck team needs as inputs (e.g., data team delivers schema so backend can unblock).
```

### Context Bloat Mitigation

Bottleneck detection is a metric calculation. Agents don't know about TOC. The orchestrator adjusts priority ordering based on the analysis — agents just receive tasks in the adjusted priority order.

---

### F-025: Classes of Service / Swim Lanes

#### Functional Requirements

**FR-025.1**: Work items SHALL be classified into service classes with different handling policies:
- **Expedite**: P0 — drops everything, WIP limit override allowed, single item only
- **Standard**: P1-P2 — normal flow, WIP limits enforced
- **Tech Debt**: Reserved capacity (20%), lower urgency
- **Spike**: Time-boxed investigation, no deliverable expected

**FR-025.2**: At most ONE Expedite item SHALL be active at any time across all teams.

#### Technical Requirements

**TR-025.1 — Backlog Schema**: The `Type` column (from F-018) combined with `Priority` determines the class of service. No new column needed — derive from existing fields:
```
class_of_service = function(priority, type):
  if priority == "P0": return "expedite"
  if type == "tech-debt": return "tech-debt"
  if type == "spike": return "spike"
  return "standard"
```

**TR-025.2 — Policy Enforcement**: `scripts/wip-check.mjs` extended:
```
If class == "expedite":
  - WIP limit override: team can exceed max-wip by 1 for this item
  - Only 1 expedite item across all teams
  - If another expedite exists, reject: "Only one expedite item at a time"

If class == "spike":
  - Max duration: 1 session
  - Must produce: findings document, not code
  - Auto-expires: if not completed in 1 session, moves to "needs decision"
```

### Context Bloat Mitigation

Classes of service are derived from existing fields. No new agent instructions. WIP script handles the policy. Agents just see their task with its priority.

---

### F-026: Workload Leveling (Heijunka)

#### Functional Requirements

**FR-026.1**: The orchestrator SHALL balance work across teams, flagging imbalances where one team is overloaded while another is idle.

**FR-026.2**: Imbalance threshold: flag when any team's committed points exceed 2x the average.

#### Technical Requirements

**TR-026.1 — Leveling Check**: Extend `scripts/sprint-metrics.mjs`:
```
For each team:
  committed_ratio = team_committed_pts / avg_committed_pts
  If committed_ratio > 2.0: flag "IMBALANCE: {team} has {pts} pts committed (avg: {avg})"
  If committed_ratio < 0.3 and team has capacity: flag "IDLE: {team} available for cross-training or swarming"
```

**TR-026.2 — Orchestrator Action**: Display imbalance warnings during sprint planning. Suggest rebalancing: move items to teams with capacity, use cross-training (F-014).

---

## Theme B: Quality & Defect Prevention

### F-027: Stop-the-Line (Jidoka)

#### Functional Requirements

**FR-027.1**: When a critical defect is discovered (broken build, security vulnerability, data corruption), ALL new work assignment SHALL pause until the defect is resolved.

**FR-027.2**: Stop-the-line can be triggered by any agent or the CI system.

**FR-027.3**: Active in-progress items that are NOT related to the defect may continue but no NEW assignments occur.

#### Technical Requirements

**TR-027.1 — Stop-the-Line State**: `.claude/state/orchestrator.json`:
```json
{
  "stop_the_line": {
    "active": true,
    "triggered_by": "ci-failure",
    "trigger_time": "2026-03-05T10:00:00Z",
    "description": "CI build broken — test suite failing on main",
    "assigned_to": "devops"
  }
}
```

**TR-027.2 — Trigger Mechanisms**:
- CI failure on main → auto-set `stop_the_line.active = true`
- Agent discovers security issue → `scripts/andon.mjs trigger --severity critical --description "..."`
- `/healthcheck` failure → prompt orchestrator to trigger

**TR-027.3 — Enforcement**: `/orchestrate` and `/delegate` check `stop_the_line.active` before any new assignment. If active: "STOP THE LINE: [description]. No new work until resolved. Assigned to: [team]."

**TR-027.4 — Resolution**: `scripts/andon.mjs resolve` clears the state and logs:
```json
{"type": "stop-the-line-resolved", "duration": "2 hours", "fix": "...", "rca_required": true}
```

### Context Bloat Mitigation

Stop-the-line is a boolean in orchestrator state. No agent carries stop-the-line instructions. The orchestrator blocks assignments. The fix team gets a normal P0 task.

---

### F-028: Andon Alert System

#### Functional Requirements

**FR-028.1**: Any agent SHALL be able to raise an alert that gets orchestrator attention.

**FR-028.2**: Alert severities: `critical` (triggers stop-the-line), `warning` (logged, reviewed at next sync), `info` (logged only).

#### Technical Requirements

**TR-028.1 — Alert Script**: `scripts/andon.mjs`
```
Commands:
  andon trigger --severity <critical|warning|info> --team <id> --description <text>
  andon list [--severity <filter>]
  andon resolve --id <alert-id>
```

**TR-028.2 — Alert State**: `.claude/state/alerts.json`:
```json
{
  "alerts": [
    {
      "id": "ANDON-001",
      "severity": "warning",
      "team": "backend",
      "description": "Express middleware ordering is fragile — new routes may break auth",
      "raised": "2026-03-05T10:00:00Z",
      "status": "open"
    }
  ]
}
```

**TR-028.3 — Orchestrator Integration**:
- `/orchestrate` reads alerts.json at session start
- Critical alerts block new work (stop-the-line)
- Warning alerts display: "WARNINGS: [count] open alerts. Review with `andon list`."
- Warnings older than 2 sprints auto-escalate to critical

### Context Bloat Mitigation

Agents raise alerts via script call (one command). They don't carry alert system knowledge. The orchestrator reads the alert file. Alerts are short strings, not documents.

---

### F-029: Poka-yoke Expansion (Mistake-Proofing)

#### Functional Requirements

**FR-029.1**: For each recurring defect type, a prevention mechanism SHALL be added.

**FR-029.2**: Prevention mechanisms SHALL be automated (linter rules, pre-commit hooks, CI checks) — not agent instructions.

**FR-029.3**: A poka-yoke registry SHALL track which defect types have prevention mechanisms.

#### Technical Requirements

**TR-029.1 — Registry**: `docs/06_engineering/poka-yoke-registry.md`:
```markdown
# Poka-yoke Registry

| ID | Defect Type | Prevention Mechanism | Added | Status |
|----|-------------|---------------------|-------|--------|
| PY-001 | Missing tests for new code | Coverage threshold in CI (80%) | Sprint 0 | Active |
| PY-002 | Secrets in commits | .gitignore + secret scanning in CI | Sprint 0 | Active |
| PY-003 | Broken conventional commits | commitlint pre-commit hook | Sprint 1 | Active |
| PY-004 | Missing changelog entry | DOD validation script check | Sprint 2 | Planned |
```

**TR-029.2 — Defect Pattern Analysis**: Extend `scripts/sprint-metrics.mjs` to track DOD failure reasons. If the same reason appears 3+ times across sprints, auto-suggest a poka-yoke: "Recurring defect: 'missing tests' (4 times in 3 sprints). Recommend: add pre-merge test coverage check."

**TR-029.3 — Action Flow**:
```
Defect recurs 3+ times → Metrics script flags it → Retro action item created →
Team implements prevention (linter rule, CI check, hook) → Registry updated → Agent instructions unchanged
```

### Context Bloat Mitigation

This is the essence of code-over-context. Every poka-yoke is a tool (linter, hook, CI check), not an instruction. The registry is documentation for humans. Agents benefit from the prevention mechanisms without knowing they exist.

---

### F-030: Test-First Development

**Extends**: DOD (F-001)

#### Functional Requirements

**FR-030.1**: For items with type `feature` or `bugfix`, at least one test SHALL exist before or concurrently with the implementation code.

**FR-030.2**: This is enforced via DOD, not via agent instructions.

#### Technical Requirements

**TR-030.1 — DOD Addition**: Add to `DOD.md` under `## code-quality`:
```markdown
- [ ] `test-first`: For features/bugfixes, test file exists with at least one test case for the changed behavior
```

**TR-030.2 — Validation**: Extend `scripts/validate-dod.mjs`:
```
For items with type in [feature, bugfix]:
  Check git diff for test files (*.test.*, *.spec.*)
  If no test files in diff: fail "test-first"
  If test file exists but has no assertions: fail "test-first: test file has no assertions"
```

### Context Bloat Mitigation

Test-first is a DOD criterion, checked by the DOD script. Agents don't carry "remember to write tests first" — the gate catches it. One line in DOD.md.

---

### F-031: Build Time Budget

#### Functional Requirements

**FR-031.1**: The complete build + test + lint cycle SHALL complete within a defined time budget.

**FR-031.2**: Default budget: 10 minutes (600 seconds).

**FR-031.3**: Exceeding the budget SHALL be treated as a P1 tech debt item.

#### Technical Requirements

**TR-031.1 — teams.yaml Config**:
```yaml
process:
  build-time-budget-seconds: 600
```

**TR-031.2 — Monitoring**: Extend `/healthcheck` to time the full cycle:
```
start = now()
run build, test, lint
elapsed = now() - start
if elapsed > budget:
  log: {"type": "build-budget-exceeded", "elapsed": elapsed, "budget": 600}
  create tech debt item: "Build time {elapsed}s exceeds budget {budget}s"
```

### Context Bloat Mitigation

A timer around existing CI commands. No agent involvement.

---

### F-032: DORA Metrics (Change Failure Rate + MTTR)

#### Functional Requirements

**FR-032.1**: Change Failure Rate SHALL be tracked: % of merged PRs that cause test failures, reverts, or hotfixes.

**FR-032.2**: Mean Time to Recovery SHALL be tracked: time from defect detection to fix merged.

**FR-032.3**: Both metrics SHALL appear in sprint metrics report.

#### Technical Requirements

**TR-032.1 — Extend `scripts/sprint-metrics.mjs`**:
```
Change Failure Rate:
  reverts = count events where type == "revert" in sprint
  hotfixes = count events where type == "hotfix" in sprint
  total_merges = count events where type == "merge" in sprint
  cfr = (reverts + hotfixes) / total_merges

MTTR:
  For each defect event:
    detect_time = event where type == "defect-detected"
    fix_time = event where type == "defect-fixed" matching same item
    mttr = fix_time - detect_time
  avg_mttr = mean(all mttr values)
```

**TR-032.2 — Sprint Metrics Addition**:
```markdown
## DORA Metrics
- Change Failure Rate: 12% (target: < 15%)
- Mean Time to Recovery: 0.8 sessions (target: < 1 session for P0/P1)
- Deployment Frequency: 4 merges/sprint
```

### Context Bloat Mitigation

Pure metrics calculation from events.log. No agent awareness needed.

---

## Theme C: Decision-Making & Delegation

### F-033: Commander's Intent

#### Functional Requirements

**FR-033.1**: Task descriptions from the orchestrator SHALL state the intent and acceptance criteria, NOT the implementation steps.

**FR-033.2**: Format: "Achieve [outcome] so that [reason]. Acceptance: [criteria]."

**FR-033.3**: Implementation decisions (file names, function signatures, library choices) SHALL be left to the assigned agent.

#### Technical Requirements

**TR-033.1 — Task Template**: Modify `/delegate` to enforce intent-based format:
```json
{
  "title": "Users can reset their password",
  "intent": "Allow users who forgot their password to regain account access securely",
  "acceptance_criteria": [
    "User receives reset email within 30 seconds",
    "Reset token expires after 1 hour",
    "Password change requires token validation"
  ],
  "anti_pattern_examples": [
    "BAD: Create POST /api/auth/reset with fields email and token using bcrypt...",
    "BAD: In file auth/reset.ts, add function resetPassword that calls..."
  ]
}
```

**TR-033.2 — Orchestrator Validation**: When `/delegate` creates a task, check description against patterns:
- Contains specific file paths → warning: "Task description is prescriptive. Consider intent-based format."
- Contains function names → warning (same)
- These are warnings, not blocks — sometimes specificity is needed

**TR-033.3 — Prescriptive Pattern Detection**: The orchestrator checks task descriptions for these patterns:
- File path literals (e.g., `src/auth/reset.ts`, `controllers/user.js`)
- Function/method declarations (e.g., `function resetPassword`, `class AuthService`)
- Library-specific API calls (e.g., `bcrypt.hash()`, `jwt.sign()`)

If 2+ patterns detected, emit a `delegation-style-warning` event. If 0 patterns, emit `delegation-style: intent-based`.

**TR-033.4 — Events Log**:
```json
{"type": "delegation-style", "task": "...", "format": "intent-based"}
{"type": "delegation-style-warning", "task": "...", "issue": "prescriptive: contains file path"}
```

**TR-033.5 — Enforcement Type**: `advisory` — warnings only, not blocks. Prescriptive delegation is sometimes appropriate (e.g., "fix the bug in auth/tokens.ts line 42"). Track compliance rate in sprint metrics for trend analysis.

### Context Bloat Mitigation

This REDUCES context. Intent-based tasks are shorter than prescriptive ones. "Users can reset their password. Acceptance: [3 criteria]" is smaller than a detailed implementation plan. Agents also perform better with intent — they can use their training rather than following a rigid script.

---

### F-034: Subsidiarity

#### Functional Requirements

**FR-034.1**: Agents SHALL make implementation decisions within their domain scope without orchestrator approval.

**FR-034.2**: Decisions requiring escalation: scope changes, new dependencies, breaking API changes.

**FR-034.3**: Decision authority boundaries SHALL be documented per team.

#### Technical Requirements

**TR-034.1 — teams.yaml Authority**:
```yaml
teams:
  - id: backend
    name: BACKEND
    decides-autonomously:
      - file-structure-within-scope
      - function-signatures
      - library-selection-within-approved-list
      - error-handling-patterns
      - internal-refactoring
    escalates:
      - new-external-dependency
      - breaking-api-change
      - scope-change
      - cross-team-interface-change
```

**TR-034.2 — Escalation Detection**: When an agent's task result includes indicators of escalation-level changes (e.g., `package.json` modified, API contract changed), the orchestrator flags: "Escalation check: new dependency added. PO/SM review required."

### Context Bloat Mitigation

Autonomy reduces context. If agents don't need permission for routine decisions, they don't need to carry permission-seeking instructions. The escalation check is a post-hoc script, not a pre-task instruction.

---

### F-035: Cynefin Domain Classification

#### Functional Requirements

**FR-035.1**: Every backlog item SHALL be tagged with a complexity domain: `clear`, `complicated`, `complex`, `chaotic`.

**FR-035.2**: The domain determines the approach:
- **Clear**: Execute directly. No spike needed. Low estimation uncertainty.
- **Complicated**: Analyze first, then execute. Expert agent assigned.
- **Complex**: Spike required before estimation. Probe-sense-respond.
- **Chaotic**: Act immediately to stabilize (P0 only). Analyze after.

**FR-035.3**: Items tagged `complex` SHALL require a completed spike (type: `spike`) before estimation and sprint entry.

#### Technical Requirements

**TR-035.1 — Backlog Schema**: Add `Complexity` column:
```markdown
| Priority | Team | Task | Type | Complexity | Estimate | Notes |
```

**TR-035.2 — DOR Extension**: `scripts/validate-dor.mjs` extended:
```
If complexity == "complex" and no linked spike task completed:
  fail "DOR: Complex item requires completed spike before sprint entry"
```

**TR-035.3 — Approach Mapping** (in `teams.yaml`, read by orchestrator):
```yaml
process:
  cynefin:
    clear:
      approach: execute
      spike-required: false
      estimation-confidence: high
    complicated:
      approach: analyze-then-execute
      spike-required: false
      estimation-confidence: medium
    complex:
      approach: probe-sense-respond
      spike-required: true
      estimation-confidence: low
    chaotic:
      approach: act-stabilize-then-analyze
      spike-required: false
      estimation-confidence: none
      priority-override: P0
```

### Context Bloat Mitigation

Cynefin classification is metadata on the backlog item. The orchestrator reads the approach mapping from config. Agents don't need to understand Cynefin — they receive either "implement this" (clear/complicated) or "investigate this for 1 session" (complex spike) or "fix this now" (chaotic).

---

### F-036: Spike-Before-Estimate

**Extends**: F-035 (Cynefin), F-002 (DOR)

#### Functional Requirements

**FR-036.1**: Spike tasks SHALL be time-boxed to 1 session maximum.

**FR-036.2**: Spike output SHALL be a findings document, not implementation code.

**FR-036.3**: After spike completion, the original item SHALL be re-scoped, estimated, and re-evaluated against DOR.

#### Technical Requirements

**TR-036.1 — Spike Task Template**:
```json
{
  "type": "spike",
  "title": "Spike: Investigate OAuth provider options",
  "time_box": "1 session",
  "deliverable": "findings document",
  "output_path": "docs/spikes/spike-NNNN-<title>.md",
  "parent_item": "P2-T5-001",
  "acceptance_criteria": [
    "At least 2 options evaluated",
    "Recommendation with rationale",
    "Revised estimate for parent item"
  ]
}
```

**TR-036.2 — Auto-expiry**: If spike task not completed within 1 session, auto-transition to "needs decision" with note: "Spike expired. Rescope or extend?"

**TR-036.3 — Spike Output Location**: `docs/spikes/spike-NNNN-<title>.md`

---

### F-037: Appetite-Based Scoping

#### Functional Requirements

**FR-037.1**: For P2-P3 items, scoping SHALL be appetite-driven: "How much are we willing to spend?" not "How long will it take?"

**FR-037.2**: Each item SHALL have an optional `appetite` field (in sessions).

**FR-037.3**: If work exceeds its appetite, the circuit breaker (F-038) triggers.

#### Technical Requirements

**TR-037.1 — Backlog Schema**: Add optional `Appetite` to Notes or as a field:
```markdown
| Priority | Team | Task | Type | Complexity | Estimate | Appetite | Notes |
```

**TR-037.2 — Appetite is distinct from estimate**:
- **Estimate**: How complex do we think this is? (story points)
- **Appetite**: How much are we willing to invest? (sessions)
- A 5-point item with appetite of 1 session means: "We think it's medium complexity but we're only willing to spend 1 session. Scope accordingly."

---

### F-038: Circuit Breaker

#### Functional Requirements

**FR-038.1**: If a task exceeds its appetite (time budget), work SHALL stop automatically.

**FR-038.2**: Exceeding appetite triggers a decision point: re-scope, re-estimate, or kill the task.

**FR-038.3**: The Product Owner SHALL make the re-scope/kill decision.

#### Technical Requirements

**TR-038.1 — Enforcement**: Extend orchestrator session tracking:
```
For each in-progress item with appetite set:
  sessions_spent = count sessions where item was in-progress
  if sessions_spent >= appetite:
    transition item to "circuit-breaker"
    log: {"type": "circuit-breaker", "item": "...", "appetite": 2, "spent": 2}
    notify PO: "Circuit breaker: {item} reached appetite ({appetite} sessions). Re-scope, extend, or kill?"
```

**TR-038.2 — PO Resolution Options**:
1. **Re-scope**: Reduce scope, reset appetite, continue
2. **Extend**: Increase appetite (must justify — logged as scope change)
3. **Kill**: Move to backlog with note "Killed: exceeded appetite"

### Context Bloat Mitigation

Circuit breaker is a check in the orchestrator. Agents don't track their own time. The orchestrator counts sessions per item and triggers the break.

---

## Complete Script Manifest (All Phases)

_This section covers scripts for both SPEC-PROC-004a and SPEC-PROC-004b._

```
scripts/
  # Phase 1
  validate-dod.mjs              # F-001: DOD gate check
  validate-dor.mjs              # F-002, F-035, F-050, F-055: DOR gate check (extended)
  validate-sprint.mjs           # F-003, F-057: Sprint structure + buffer check
  generate-retro.mjs            # F-004: Retrospective generation
  sprint-metrics.mjs            # F-005, F-009, F-023, F-024, F-026, F-032, F-048, F-052: Metrics (extended heavily)
  agent-sync.mjs                # F-006: Sync state management

  # Phase 2
  wip-check.mjs                 # F-007, F-025: WIP + classes of service enforcement
  swarm-check.mjs               # F-008: Swarm detection and recruitment

  # Phase 3
  sprint-lifecycle.mjs           # F-012, F-049: Sprint boundaries + cooldown
  generate-review.mjs            # F-013: Sprint review auto-generation
  burndown-update.mjs            # F-016: Burndown tracking
  backlog-refine.mjs             # F-017: Refinement automation
  backlog-health.mjs             # F-018: Tech debt monitoring
  backlog-transition.mjs         # F-022: Kanban state transitions
  generate-status.mjs            # F-019: STATUS.md generation
  code-ownership.mjs             # F-021: Bus factor analysis
  andon.mjs                      # F-027, F-028: Stop-the-line + alert system
```

**Total: 17 scripts** replacing what would otherwise be hundreds of lines of agent instructions.

---

## Complete teams.yaml Process Section (All Phases)

_This section covers config for both SPEC-PROC-004a and SPEC-PROC-004b._

```yaml
process:
  # Definitions
  definition-of-done: DOD.md
  definition-of-ready: DOR.md

  # Validation scripts
  dod-validation: scripts/validate-dod.mjs
  dor-validation: scripts/validate-dor.mjs
  sprint-validation: scripts/validate-sprint.mjs

  # Generation scripts
  retro-generation: scripts/generate-retro.mjs
  review-generation: scripts/generate-review.mjs
  status-generation: scripts/generate-status.mjs
  metrics-generation: scripts/sprint-metrics.mjs

  # State management scripts
  sync-script: scripts/agent-sync.mjs
  wip-check: scripts/wip-check.mjs
  swarm-check: scripts/swarm-check.mjs
  sprint-lifecycle: scripts/sprint-lifecycle.mjs
  burndown: scripts/burndown-update.mjs
  backlog-transition: scripts/backlog-transition.mjs
  backlog-refine: scripts/backlog-refine.mjs
  backlog-health: scripts/backlog-health.mjs
  code-ownership: scripts/code-ownership.mjs
  andon: scripts/andon.mjs

  # Sync state
  sync-state: .claude/state/sync.json
  alerts-state: .claude/state/alerts.json
  task-forces-state: .claude/state/task-forces.json

  # Estimation
  estimation-scale: [1, 2, 3, 5, 8]
  estimation-decompose-threshold: 13

  # Sprint
  sprint:
    duration-sessions: 5
    duration-calendar-days: 7
    buffer-percent: 15
    ceremonies:
      planning: sprint-start
      sync: session-start
      review: sprint-end
      retro: sprint-end

  # WIP
  default-max-wip: 2

  # Swarming
  swarm-threshold: 2
  swarm-max-recruits: 2

  # Quality
  build-time-budget-seconds: 600
  test-first-required-types: [feature, bugfix]

  # Scoping
  cynefin:
    clear: { spike-required: false }
    complicated: { spike-required: false }
    complex: { spike-required: true }
    chaotic: { spike-required: false, priority-override: P0 }

  # Sustainability
  cooldown:
    frequency: every-4-sprints
    duration: 1 session
    allowed-work: [tech-debt, spike, tooling, dependency-update]

  session-budget:
    warning-threshold: 80%
    action-at-limit: handoff

  # Cognitive load
  cognitive-load:
    max-files-per-task: 50
    max-lines-per-task: 10000
    action: warn

  # Scrum Master (orchestrator behavior, not an agent)
  scrum-master:
    authority: [enforce-dor, enforce-dod, enforce-wip, trigger-swarm, generate-retro, generate-metrics, track-actions]
    cannot: [set-priority, implement-code, approve-scope]

  # Pair programming
  pair-programming:
    enabled: true
    triggers:
      - priority: [P0, P1]
        min-complexity: 5
      - scope: ['auth/**', 'security/**']
```

---

## Agent Instruction Impact Summary

_Combined impact for SPEC-PROC-004a and SPEC-PROC-004b._

| Change | Words added to agent context |
|--------|---------------------------|
| New rules in rules.yaml (`ac-verify-state`, `ac-just-in-time`) | ~55 words total, applied globally |
| Everything else | 0 — enforced via scripts and orchestrator |

**Total new agent context cost**: ~55 words across ALL 37 features.

Compare to the alternative: describing all 37 features in agent instructions would add ~5,000-10,000 words per agent across 10+ agents = 50,000-100,000 words of duplicated context.

---

_This is a planning document. No implementation changes have been made._
_See also: SPEC-PROC-001, SPEC-PROC-002, SPEC-PROC-003, SPEC-PROC-004b for companion specifications._
