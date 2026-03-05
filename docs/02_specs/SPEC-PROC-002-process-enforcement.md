# SPEC-PROC-002: Process Enforcement

**Status**: Draft
**Phase**: 2 — Next Sprint (process logic changes)
**Scope**: WIP Limits, Swarming, Velocity Metrics, Scrum Master Role, Product Owner Authority
**Depends On**: SPEC-PROC-001 (Process Foundations)

---

## Design Principle: Code Over Context

Phase 2 builds on Phase 1's foundation. All enforcement continues to live in scripts and orchestrator logic — not in agent instructions. Phase 2 introduces **active enforcement** (scripts that block actions) versus Phase 1's **passive validation** (scripts that report status).

---

## F-007: WIP Limits

### Functional Requirements

**FR-007.1**: Each team SHALL have a maximum number of concurrent in-progress tasks (WIP limit).

**FR-007.2**: The orchestrator SHALL NOT assign new work to a team that has reached its WIP limit.

**FR-007.3**: When a team hits its WIP limit, the orchestrator SHALL offer three options:

1. Complete or hand off a current item
2. Swarm on a blocked item (see F-008)
3. Assist another team (cross-training, Phase 3)

**FR-007.4**: WIP limits SHALL be configurable per team in `teams.yaml`.

**FR-007.5**: WIP violations (exceeding the limit) SHALL be logged and tracked in retrospectives.

### Technical Requirements

**TR-007.1 — teams.yaml Schema**:

```yaml
teams:
  - id: backend
    name: BACKEND
    max-wip: 2
    # ...
  - id: data
    name: DATA
    max-wip: 1
    # ...
```

Default WIP limits:
| Team | max-wip | Rationale |
|------|---------|-----------|
| backend | 2 | Deep work, multiple modules |
| frontend | 2 | UI work is context-heavy |
| data | 1 | Schema changes are high-risk — serialize |
| infra | 2 | IaC changes need focus |
| devops | 2 | Pipeline work is often sequential |
| testing | 3 | Testing can parallelize |
| security | 1 | Security reviews need full attention |
| docs | 3 | Lower-risk, higher-volume |
| product | 2 | Planning work |
| quality | 2 | Review work |

**TR-007.2 — Enforcement Script**: `scripts/wip-check.mjs`

```
Input:  team ID
Action:
  1. Parse AGENT_BACKLOG.md Active Sprint
  2. Count items with status "In Progress" for the given team
  3. Read max-wip from teams.yaml for that team
  4. Compare
Output:
  { team, current_wip, max_wip, at_limit: boolean, items: [...] }
Exit code: 0 if below limit, 1 if at/above limit
```

**TR-007.3 — Orchestrator Integration**:

- Before assigning work: `wip-check.mjs --team <id>`. If exit code 1, block assignment.
- `/orchestrate` displays WIP status in assessment: "Backend: 2/2 (FULL) | Data: 0/1 (Available)"
- `/tasks` view includes WIP status per team

**TR-007.4 — Events Log**:

```json
{"type": "wip-blocked", "team": "backend", "current": 2, "max": 2, "attempted_task": "..."}
{"type": "wip-violation", "team": "backend", "current": 3, "max": 2, "reason": "manual override"}
```

### Context Bloat Mitigation

Agents never see WIP limits in their instructions. The orchestrator checks WIP before delegating. If an agent tries to pick up extra work, the orchestrator blocks it with: "Backend is at WIP limit (2/2). Complete P1-T1-001 or P1-T1-003 first." One sentence, not a policy document.

---

## F-008: Swarming on Blockers

### Functional Requirements

**FR-008.1**: When a task is blocked for longer than a defined threshold, agents from the team's `handoff-chain` SHALL be recruited to help unblock it.

**FR-008.2**: The swarm threshold SHALL be configurable (default: 2 sync cycles / sessions).

**FR-008.3**: Swarm recruitment SHALL only target teams that are below their WIP limit.

**FR-008.4**: Swarmed tasks SHALL receive a temporary P0 priority override until the blocker is resolved.

**FR-008.5**: Swarm events SHALL be logged and tracked in sprint metrics.

**FR-008.6**: Swarming SHALL be automatic (triggered by orchestrator) but can also be manually invoked.

### Technical Requirements

**TR-008.1 — teams.yaml Config**:

```yaml
process:
  swarm-threshold: 2 # Sessions/syncs before swarm triggers
  swarm-max-recruits: 2 # Max additional teams to recruit
```

**TR-008.2 — Swarm Detection Script**: `scripts/swarm-check.mjs`

```
Input:  none (scans all blocked items)
Action:
  1. Parse AGENT_BACKLOG.md for items with status "Blocked"
  2. Check events.log for how long each item has been blocked (count sync cycles since blocked)
  3. For items exceeding swarm-threshold:
     a. Read handoff-chain from teams.yaml for the owning team
     b. Run wip-check.mjs for each chain member
     c. Identify available teams (below WIP limit)
     d. Recommend swarm assignments
Output:
  {
    swarm_candidates: [
      {
        blocked_task: "...",
        owning_team: "backend",
        blocked_since: "2 sessions",
        available_helpers: ["testing", "devops"],
        recommended_action: "Assign testing and devops to help unblock"
      }
    ]
  }
```

**TR-008.3 — Orchestrator Integration**:

- `/orchestrate` runs `swarm-check.mjs` during assessment
- If swarm candidates exist, orchestrator presents: "SWARM ALERT: P1-T1-001 blocked for 2 sessions. Testing (1/3 WIP) and DevOps (1/2 WIP) available to help. Assign swarm?"
- On approval, orchestrator creates swarm tasks via `/delegate` with `priority: P0` and `type: swarm`
- When blocker resolves, swarm tasks auto-close

**TR-008.4 — Swarm Task Lifecycle**:

```
Blocked item detected → Threshold exceeded → Available helpers identified →
Swarm tasks created (P0) → Helpers join → Blocker resolved →
Swarm tasks auto-complete → Normal WIP resumes
```

**TR-008.5 — Events Log**:

```json
{"type": "swarm-triggered", "task": "P1-T1-001", "team": "backend", "helpers": ["testing", "devops"]}
{"type": "swarm-resolved", "task": "P1-T1-001", "resolution_time": "1 session"}
```

### Context Bloat Mitigation

Swarming logic lives entirely in the orchestrator and scripts. Agents receive a standard task assignment: "Help unblock: [description]. Context: [blocker details]." The agent doesn't know it's part of a swarm — it just does the work. The swarm coordination is orchestrator-level, invisible to participating agents.

---

## F-009: Velocity & Sprint Metrics

### Functional Requirements

**FR-009.1**: After each sprint, a metrics report SHALL be generated.

**FR-009.2**: Metrics SHALL include:

- Velocity: story points completed vs planned
- Completion rate: items completed / items committed
- Estimation accuracy: average delta between estimate and actual
- Carried over items: count and reasons
- Flow metrics: items added mid-sprint, items blocked, swarm events
- Quality metrics: DOD violations caught, rework incidents

**FR-009.3**: A 3-sprint rolling average SHALL be used for capacity planning.

**FR-009.4**: Metrics SHALL be stored in a `metrics/` directory as versioned files.

**FR-009.5**: Sprint planning SHALL reference velocity data: "Last 3 sprints averaged 18 pts. Committing 20 pts this sprint."

### Technical Requirements

**TR-009.1 — Metrics Script**: `scripts/sprint-metrics.mjs`

```
Input:  sprint number (or "current")
Action:
  1. Parse AGENT_BACKLOG.md Completed section for the sprint
  2. Parse events.log for the sprint's date range
  3. Calculate all metrics
  4. Write report to metrics/sprint-N.md
Output: metrics/sprint-N.md
```

**TR-009.2 — Report Format**: `metrics/sprint-N.md`

```markdown
# Sprint N Metrics — [Date Range]

## Velocity

- Planned: 21 pts | Completed: 18 pts | Completion rate: 86%
- Rolling 3-sprint average: 17 pts

## Estimation Accuracy

- Mean absolute error: 1.2 pts
- Systematic bias: +0.5 (slight underestimation)
- Worst miss: "Auth middleware" — estimated 3, actual 8

## Flow

- Carried over: 2 items (5 pts) — reasons: [blocked by external dep, scope creep]
- Added mid-sprint: 1 item (P0 hotfix)
- Blocked items: 3 (avg resolution: 1.5 sessions)
- Swarm events: 1

## Quality

- DOD violations caught: 2 (missing tests, missing changelog)
- Rework incidents: 1
- Retro action items generated: 3
- Previous retro actions completed: 2/3

## Per-Team Breakdown

| Team    | Planned | Completed | Accuracy | WIP Violations |
| ------- | ------- | --------- | -------- | -------------- |
| backend | 8       | 6         | +1.5     | 0              |
| data    | 3       | 3         | 0        | 0              |
| ...     | ...     | ...       | ...      | ...            |
```

**TR-009.3 — Capacity Planning Integration**:

- `scripts/sprint-metrics.mjs capacity` outputs:
  ```json
  { "rolling_avg": 17, "recommended_commit": 18, "buffer": 3, "total_capacity": 21 }
  ```
- `/orchestrate` reads this during sprint planning to suggest sprint capacity

**TR-009.4 — Events Log Dependencies**:
Metrics calculation depends on structured events in `events.log`:

- `task-completed` with points
- `task-blocked` with timestamp
- `dod-check` results
- `swarm-triggered` / `swarm-resolved`
- `sprint-start` / `sprint-end` boundaries

These events are already produced by Phase 1 scripts. No new agent instructions needed.

### Context Bloat Mitigation

Agents never see metrics. The orchestrator reads metrics for capacity planning and presents: "Capacity: 18 pts (based on 3-sprint avg). Buffer: 3 pts." Agents see task assignments within that capacity — they don't need to know the math behind it.

---

## F-010: Scrum Master Agent Role

### Functional Requirements

**FR-010.1**: A Scrum Master role SHALL be formalized with explicit authority over process enforcement.

**FR-010.2**: The Scrum Master SHALL be responsible for:

- Enforcing DOR before work enters sprint
- Enforcing DOD before work is marked complete
- Monitoring WIP limits and flagging violations
- Triggering swarming when blockers exceed threshold
- Facilitating retrospectives
- Generating sprint metrics
- Tracking retro action item completion

**FR-010.3**: The Scrum Master SHALL NOT make priority decisions (that's the Product Owner).

**FR-010.4**: The Scrum Master SHALL NOT implement features (that's the engineering teams).

**FR-010.5**: The Scrum Master role SHALL be implemented primarily as orchestrator behavior and scripts, NOT as a separate agent consuming context.

### Technical Requirements

**TR-010.1 — NOT a New Agent**: The Scrum Master is **not** a new entry in `agents.yaml`. Adding another agent would mean another context window, another set of instructions, another source of bloat.

Instead, the Scrum Master is a **behavior mode of the orchestrator**, activated by scripts:

```yaml
# teams.yaml
process:
  scrum-master:
    authority:
      - enforce-dor # Block sprint entry without DOR pass
      - enforce-dod # Block completion without DOD pass
      - enforce-wip # Block assignment beyond WIP limit
      - trigger-swarm # Auto-recruit when blocker exceeds threshold
      - generate-retro # Create retrospective at sprint end
      - generate-metrics # Create sprint metrics
      - track-actions # Monitor retro action item completion
    cannot:
      - set-priority # Product Owner authority
      - implement-code # Engineering team authority
      - approve-scope # Product Owner authority
```

**TR-010.2 — Orchestrator Checkpoints**: The SM behavior is a set of script calls at phase boundaries:

| Orchestrator Phase    | SM Check                          | Script               |
| --------------------- | --------------------------------- | -------------------- |
| Sprint Planning       | DOR validation for all candidates | `validate-dor.mjs`   |
| Task Assignment       | WIP limit check                   | `wip-check.mjs`      |
| Every Sync            | Blocker age check → swarm trigger | `swarm-check.mjs`    |
| Task Completion       | DOD validation                    | `validate-dod.mjs`   |
| Sprint End            | Metrics generation                | `sprint-metrics.mjs` |
| Session End (handoff) | Retro generation                  | `generate-retro.mjs` |

**TR-010.3 — SM Event Log Entries**:

```json
{"type": "sm-enforcement", "action": "dor-blocked", "item": "P2-T3-005", "reason": "missing estimate"}
{"type": "sm-enforcement", "action": "dod-blocked", "item": "P1-T1-001", "reason": "tests failing"}
{"type": "sm-enforcement", "action": "wip-blocked", "team": "backend", "current": 2, "max": 2}
```

### Context Bloat Mitigation

This is the biggest context savings in Phase 2. By making the Scrum Master a set of scripts rather than an agent, we:

- Save an entire agent's context window
- Eliminate redundant instructions (the SM would need to know about DOD, DOR, WIP, swarming — all already in scripts)
- Get more reliable enforcement (scripts don't forget, agents do)
- Reduce orchestrator complexity (call scripts, not manage another agent)

---

## F-011: Product Owner Authority Formalization

### Functional Requirements

**FR-011.1**: The Product Owner (PO) role SHALL have explicit, documented authority over:

- Sprint Goal approval (the PO sets or approves the goal)
- Priority arbitration (the PO decides when teams disagree on priority)
- Scope change approval (mid-sprint changes require PO approval)
- Story acceptance (the PO accepts or rejects completed stories against acceptance criteria)

**FR-011.2**: The PO role SHALL be the human operator by default, with the `product` team agent as proxy when the human is unavailable.

**FR-011.3**: PO decisions SHALL be logged in events.log for auditability.

**FR-011.4**: The PO SHALL NOT override process gates (DOD, DOR, WIP) — that's the Scrum Master's domain.

### Technical Requirements

**TR-011.1 — teams.yaml Authority Block**:

```yaml
teams:
  - id: product
    name: PRODUCT
    focus: 'Features, PRDs, roadmap'
    scope: ['docs/01_product/**', 'docs/prd/**']
    accepts: [plan, review, decide]
    authority:
      - sprint-goal-approval
      - priority-arbitration
      - scope-change-approval
      - story-acceptance
    cannot:
      - override-dod # Cannot bypass Definition of Done
      - override-dor # Cannot bypass Definition of Ready
      - override-wip # Cannot bypass WIP limits
    handoff-chain: [backend, frontend]
```

**TR-011.2 — Decision Logging**:
PO decisions are logged as structured events:

```json
{"type": "po-decision", "action": "sprint-goal-approved", "goal": "...", "by": "human"}
{"type": "po-decision", "action": "priority-change", "item": "P2-T3-005", "from": "P2", "to": "P1", "reason": "..."}
{"type": "po-decision", "action": "scope-change", "added": "...", "removed": "...", "approved_by": "human"}
{"type": "po-decision", "action": "story-accepted", "item": "P1-T1-001", "result": "accepted"}
{"type": "po-decision", "action": "story-rejected", "item": "P1-T1-001", "result": "rejected", "reason": "..."}
```

**TR-011.3 — Orchestrator Integration**:

- Sprint planning: orchestrator prompts for sprint goal. If human is present, ask directly. If not, product team agent proposes, logged as `by: product-agent`.
- Mid-sprint scope changes: orchestrator detects new items added and flags: "Scope change detected. PO approval required." Blocks until approved.
- Story completion: after DOD passes (SM gate), PO acceptance is the final gate.

**TR-011.4 — Separation of Concerns Matrix**:

| Decision           |  Product Owner  | Scrum Master (Scripts) | Engineering Teams |
| ------------------ | :-------------: | :--------------------: | :---------------: |
| What to build      |     Decides     |           —            |      Advises      |
| Priority order     |     Decides     |           —            |      Advises      |
| Sprint goal        |     Decides     |           —            |         —         |
| How to build       |        —        |           —            |      Decides      |
| Process compliance |        —        |        Enforces        |      Follows      |
| Quality gates      |        —        |        Enforces        |      Follows      |
| Scope changes      |    Approves     |           —            |     Requests      |
| Story acceptance   | Accepts/Rejects |  Validates DOD first   |     Delivers      |

### Context Bloat Mitigation

PO authority is codified in `teams.yaml`, not in agent instructions. The orchestrator reads authority rules and enforces them. The product agent doesn't need expanded instructions — it already knows about features and roadmap. The authority block just gives the orchestrator permission logic.

---

## Cross-Cutting Technical Requirements

### TR-CC-5: New Scripts (Phase 2)

```
scripts/
  wip-check.mjs          # WIP limit enforcement
  swarm-check.mjs        # Blocked item detection + swarm recruitment
  sprint-metrics.mjs     # Velocity, accuracy, flow metrics (extends Phase 1)
```

### TR-CC-6: teams.yaml Process Section (Phase 2 Additions)

```yaml
process:
  # Phase 1 (from SPEC-PROC-001)
  definition-of-done: DOD.md
  definition-of-ready: DOR.md
  dod-validation: scripts/validate-dod.mjs
  dor-validation: scripts/validate-dor.mjs
  sprint-validation: scripts/validate-sprint.mjs
  retro-generation: scripts/generate-retro.mjs
  sprint-metrics: scripts/sprint-metrics.mjs
  sync-state: .claude/state/sync.json
  sync-script: scripts/agent-sync.mjs
  estimation-scale: [1, 2, 3, 5, 8]
  estimation-decompose-threshold: 13
  sprint-buffer-percent: 15

  # Phase 2 (new)
  wip-check: scripts/wip-check.mjs
  swarm-check: scripts/swarm-check.mjs
  swarm-threshold: 2
  swarm-max-recruits: 2
  scrum-master:
    authority:
      [
        enforce-dor,
        enforce-dod,
        enforce-wip,
        trigger-swarm,
        generate-retro,
        generate-metrics,
        track-actions,
      ]
    cannot: [set-priority, implement-code, approve-scope]
```

### TR-CC-7: Orchestrator Phase Checkpoint Map

Complete map of all script calls at each orchestrator phase:

```
SESSION START (/orchestrate)
  ├── sync read --all             # What is everyone doing?
  ├── swarm-check.mjs             # Any blockers to swarm?
  ├── sprint-metrics.mjs capacity # What's our capacity?
  └── Display: Sprint Goal, WIP status, sync summary

SPRINT PLANNING
  ├── validate-dor.mjs (each candidate item)
  ├── wip-check.mjs (each team)
  ├── PO approval for sprint goal
  └── Commit sprint with capacity <= rolling avg + buffer

TASK ASSIGNMENT
  ├── wip-check.mjs --team <id>
  ├── sync read --for <team>      # Relevant discoveries
  └── Assign with filtered context

TASK COMPLETION
  ├── validate-dod.mjs --task <id>
  ├── PO acceptance (for feature items)
  ├── sync update --team <id>
  └── wip-check.mjs (now has capacity for next item)

SESSION END (/handoff)
  ├── sync update --team <id> --status closing
  ├── generate-retro.mjs
  ├── sprint-metrics.mjs (if sprint boundary)
  └── Handoff summary with retro link
```

---

## File Manifest

Files to create:

```
scripts/wip-check.mjs           # WIP limit enforcement
scripts/swarm-check.mjs         # Swarm detection and recruitment
```

Files to extend:

```
scripts/sprint-metrics.mjs      # Add velocity, accuracy, flow metrics
.agentkit/spec/teams.yaml       # Add max-wip per team, swarm config, SM authority, PO authority
```

Files NOT modified:

```
.agentkit/spec/agents.yaml      # No new agents, no instruction changes
```

---

## Dependencies

```
F-007 (WIP) ────────► Depends on AGENT_BACKLOG.md tracking "In Progress" (already exists)
F-008 (Swarming) ──► Depends on F-007 (WIP check for available helpers)
                   ► Depends on F-006 (Sync data for blocker age)
F-009 (Metrics) ───► Depends on F-005 (Story points for velocity calc)
                   ► Depends on F-001 (DOD results for quality metrics)
F-010 (SM) ────────► Depends on all Phase 1 scripts + F-007/F-008
F-011 (PO) ────────► No hard dependencies — authority codification
```

Recommended implementation order: F-011 → F-007 → F-008 → F-009 → F-010

---

## Acceptance Criteria

| Item           | Acceptance Criteria                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| F-007 WIP      | `wip-check.mjs` correctly counts in-progress items per team. Orchestrator blocks assignment at limit                             |
| F-008 Swarming | `swarm-check.mjs` identifies items blocked > threshold. Recommends available helpers. Swarm tasks created and auto-closed        |
| F-009 Metrics  | Sprint metrics report generated with velocity, accuracy, flow data. Rolling average calculated. Capacity recommendation produced |
| F-010 SM       | All SM checkpoints fire at correct orchestrator phases. No new agent created. DOD/DOR/WIP enforcement verified                   |
| F-011 PO       | Authority documented in teams.yaml. Sprint goal requires PO approval. Scope changes flagged. Decisions logged                    |
