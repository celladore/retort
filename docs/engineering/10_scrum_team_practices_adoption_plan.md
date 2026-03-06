# Scrum Team Practices Adoption Plan

**Created**: 2026-03-05
**Status**: Planning
**Author**: Human + AI collaborative session

---

## Purpose

Real scrum teams bring battle-tested practices that improve delivery, quality, and predictability. This document catalogs every meaningful scrum practice, maps it against our current AI agent team capabilities, identifies gaps, and provides a concrete adoption plan across three phases.

---

## Part 1: Complete Inventory of Scrum Team Advantages

### A. Ceremonies & Rituals

| #   | Practice             | Value Delivered                                                                            |
| --- | -------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Sprint Planning      | Shared scope understanding, capacity-based commitment, team alignment                      |
| 2   | Daily Standup        | Early blocker detection, coordination across agents, visibility into what others are doing |
| 3   | Sprint Review / Demo | Stakeholder feedback loop, course correction, celebration of done work                     |
| 4   | Sprint Retrospective | Continuous process improvement, team learning, systemic fixes                              |
| 5   | Backlog Refinement   | Requirements clarity before work starts, shared understanding, right-sizing                |

### B. Roles & Accountability

| #   | Practice                  | Value Delivered                                                  |
| --- | ------------------------- | ---------------------------------------------------------------- |
| 6   | Product Owner             | Single source of priority, stakeholder proxy, value maximization |
| 7   | Scrum Master              | Process facilitation, impediment removal, shield from noise      |
| 8   | Cross-functional team     | End-to-end delivery without external dependencies                |
| 9   | Collective code ownership | No knowledge silos, anyone can contribute anywhere               |
| 10  | Stable team composition   | Trust, velocity predictability, deep domain knowledge            |

### C. Planning & Estimation

| #   | Practice                           | Value Delivered                                                                  |
| --- | ---------------------------------- | -------------------------------------------------------------------------------- |
| 11  | Story points / relative estimation | Calibrated effort awareness — agents don't know upfront how complex something is |
| 12  | Definition of Ready (DoR)          | Work doesn't start until it's clear and actionable                               |
| 13  | Definition of Done (DoD)           | Consistent quality bar, no "almost done" drift                                   |
| 14  | Sprint Goal                        | Focus and alignment — a north star for the iteration                             |
| 15  | Velocity tracking                  | Predictability, evidence-based planning                                          |

### D. Quality & Engineering

| #   | Practice                  | Value Delivered                                           |
| --- | ------------------------- | --------------------------------------------------------- |
| 16  | Peer code review          | Defect reduction, knowledge sharing, standard enforcement |
| 17  | Pair/mob programming      | Real-time collaboration, fewer defects, mentoring         |
| 18  | Test-driven development   | Design pressure, regression safety, living documentation  |
| 19  | CI/CD with quality gates  | Fast feedback, never ship broken code                     |
| 20  | Technical debt management | Explicit allocation prevents codebase rot                 |

### E. Communication & Knowledge

| #   | Practice              | Value Delivered                                                                                                        |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 21  | Daily Standup (sync)  | An agent can be off working on something for a long time with no other agent aware of what it's doing or what it found |
| 22  | Information radiators | Transparent status without querying anyone                                                                             |
| 23  | Handoff documentation | Continuity when agents rotate or sessions end                                                                          |
| 24  | Cross-training        | Resilience, bus-factor reduction across agent specializations                                                          |
| 25  | Swarming on blockers  | Multiple agents attack the hardest problem to unblock flow                                                             |

### F. Continuous Improvement

| #   | Practice                      | Value Delivered                                        |
| --- | ----------------------------- | ------------------------------------------------------ |
| 26  | Inspect and adapt             | Evidence-based process tuning every sprint             |
| 27  | Root cause analysis           | Fix the system, not just the symptom                   |
| 28  | Experiment-driven improvement | Try small changes, measure, keep or discard            |
| 29  | WIP limits                    | Focus, finish what you start, reduce context switching |
| 30  | Burndown/burnup visibility    | Early warning when a sprint is going off-track         |

---

## Part 2: Current State Assessment

### What We Already Have

| Practice                | Current Implementation                                  | Gap                                                   |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Cross-functional teams  | 10 specialized teams in `teams.yaml`                    | Teams are siloed specialists, not cross-functional    |
| Sprint Goal / Planning  | `/orchestrate` and `/plan` commands                     | Ad-hoc, not time-boxed, no explicit goal statement    |
| Code review             | `accepts: [review]` on most agents, required PRs        | Present and working                                   |
| Quality gates / CI      | Quality team, CI checks (CodeQL, Semgrep), 80% coverage | Present and working                                   |
| Handoff documentation   | `/handoff` command, `handoff-chain` in `teams.yaml`     | Present and working                                   |
| Backlog                 | `AGENT_BACKLOG.md` with sprint structure                | Present — good foundation to build on                 |
| Retrospective templates | `docs/history/lessons-learned/TEMPLATE-lesson.md`       | Template exists but no ceremony trigger               |
| Roles (PO/SM)           | `product` team as owner, `quality` team as operations   | Implicit — not formalized with authority              |
| Estimation / Velocity   | Not present                                             | Full gap                                              |
| WIP Limits              | Not present                                             | Full gap                                              |
| Daily Standup / Sync    | Not present                                             | Full gap — agents work in isolation with no broadcast |
| Sprint Review / Demo    | Not present                                             | Full gap                                              |
| Definition of Ready     | Not present                                             | Full gap                                              |
| Definition of Done      | Implicit in quality gates                               | Needs formalization                                   |
| Story Points            | Not present                                             | Full gap — agents can't gauge complexity upfront      |
| Swarming                | Not present                                             | handoff-chain exists but only sequential              |
| Burndown visibility     | Not present                                             | Full gap                                              |

---

## Part 3: Adoption Plan — All Items

### Phase 1: Foundations (Config & Document Changes)

#### 1.1 Definition of Done — `DOD.md`

**What**: Standalone `DOD.md` at repo root. Generated from spec, referenced by all agents and quality gates.

**Content structure**:

```markdown
# Definition of Done

A work item is "Done" when ALL of the following are true:

## Code Quality

- [ ] Code compiles/builds without errors
- [ ] All existing tests pass
- [ ] New/changed code has tests (coverage >= 80%)
- [ ] Linter passes with zero warnings
- [ ] No new security vulnerabilities introduced

## Review

- [ ] Code review completed by at least one other agent/team
- [ ] Review comments addressed or explicitly deferred with justification

## Documentation

- [ ] Public API changes documented
- [ ] ADR written for architectural decisions
- [ ] CHANGELOG.md updated for user-facing changes

## Integration

- [ ] CI pipeline passes all checks
- [ ] No regressions in existing functionality
- [ ] Handoff notes written if work continues in another session

## Verification

- [ ] Acceptance criteria from the task/story are met
- [ ] Quality team sign-off (for P0/P1 items)
```

**Implementation**:

- Create `DOD.md` at repo root
- Add `definition-of-done: DOD.md` reference in `teams.yaml` under a new `process:` section
- Quality team agent checks DoD before marking items as "Done" in `AGENT_BACKLOG.md`
- `/handoff` command validates DoD checklist completion

#### 1.2 Definition of Ready — `DOR.md`

**What**: Standalone `DOR.md` at repo root. Gate before any work item enters active sprint.

**Content structure**:

```markdown
# Definition of Ready

A work item is "Ready" for sprint inclusion when ALL of the following are true:

## Clarity

- [ ] Task has a clear, one-sentence description of what "done" looks like
- [ ] Acceptance criteria are defined (testable, observable outcomes)
- [ ] Scope is bounded — no open questions that block starting

## Dependencies

- [ ] All upstream dependencies identified
- [ ] Blocking dependencies resolved OR explicit plan to unblock
- [ ] Required team(s) identified and available

## Sizing

- [ ] Story points estimated (relative complexity)
- [ ] Task fits within a single sprint (if not, decompose further)
- [ ] Required files/modules identified in scope

## Context

- [ ] Related PRDs, specs, or ADRs linked
- [ ] If this continues prior work, handoff notes from previous session reviewed
```

**Implementation**:

- Create `DOR.md` at repo root
- Add `definition-of-ready: DOR.md` reference in `teams.yaml` under `process:` section
- `/orchestrate` validates DOR before promoting items from Backlog to Active Sprint
- Items failing DOR stay in Backlog with status note: `Not Ready: [missing criteria]`

#### 1.3 Sprint Goal

**What**: Every sprint (or orchestrated session) declares a single, explicit goal.

**Implementation**:

- Add `sprint-goal:` field to `AGENT_BACKLOG.md` Active Sprint section header
- Format: `**Sprint Goal**: [One sentence describing the most important outcome]`
- `/orchestrate` must set or confirm a sprint goal before assigning work
- All prioritization decisions during the sprint reference the goal
- Sprint review evaluates: "Did we achieve the sprint goal? Yes/No/Partial"

**Example**:

```markdown
## Active Sprint

**Sprint Goal**: Establish a working CI pipeline that runs tests on every PR to main.
```

#### 1.4 Structured Retrospective Ceremony

**What**: Formalized retrospective triggered at session/sprint end.

**Implementation**:

- `/handoff` auto-generates a retrospective entry using `TEMPLATE-lesson.md`
- Add a `## Retrospective` section to session handoff output
- Minimum required fields:
  - What went well (at least 1 item)
  - What didn't work (at least 1 item)
  - Action items (concrete, assigned to a team)
- Action items flow back into `AGENT_BACKLOG.md` as P2/P3 process improvement tasks
- Quality team reviews retro entries and tracks action item completion

#### 1.5 Story Points / Relative Estimation

**What**: Agents estimate relative complexity before starting work, because they genuinely don't know how hard something will be until they dig in.

**Implementation**:

- Add `estimate:` column to `AGENT_BACKLOG.md` task tables
- Scale: 1 (trivial), 2 (small), 3 (medium), 5 (large), 8 (very large), 13 (epic — must decompose)
- Estimation happens at sprint planning / backlog refinement
- Any item estimated at 13+ must be broken down before entering active sprint
- Track actual complexity post-completion to calibrate future estimates
- Add `actual:` column populated at completion for calibration data

**Why this matters for agents**: An agent might estimate "add health check endpoint" at 2, but discover it requires auth middleware, CORS config, and database connectivity checks — actual complexity 5. Without estimation, there's no signal that the sprint is overloaded.

#### 1.6 Daily Standup / Agent Sync

**What**: Periodic sync mechanism so agents know what other agents are doing, found, or are blocked by.

**Implementation**:

- Add `STANDUP.md` or a `## Daily Sync` section in `AGENT_BACKLOG.md`
- At the start of each session or at regular intervals during long sessions, each active agent reports:
  - **Working on**: Current task and status
  - **Found/Discovered**: Anything that affects other teams (breaking changes, new dependencies, blockers discovered)
  - **Blocked by**: What's preventing progress
  - **Need from**: Which team they need something from
- `/orchestrate` reads the standup log to detect:
  - Two agents unknowingly working on conflicting changes
  - An agent blocked while another agent could unblock them
  - Information one agent discovered that another agent needs

**Why this matters for agents**: Agent A might spend an entire session refactoring the auth module while Agent B is building a feature that depends on the old auth interface. Without a sync point, this collision is discovered only at merge time.

**Format**:

```markdown
## Agent Sync — [Date/Session]

### T1-Backend

- **Working on**: API route structure (P1)
- **Found**: Express router needs middleware refactor for nested routes
- **Blocked by**: Nothing
- **Need from**: T3-Data — schema for user model

### T3-Data

- **Working on**: Database schema design (P1)
- **Found**: Prisma doesn't support the composite key pattern we planned
- **Blocked by**: Nothing
- **Need from**: T1-Backend — confirm if we can use surrogate keys instead
```

---

### Phase 2: Process Logic Changes

#### 2.1 WIP Limits

**What**: Maximum concurrent tasks per team, enforced by orchestrator.

**Implementation**:

- Add `max-wip: N` to each team in `teams.yaml`:
  ```yaml
  - id: backend
    name: BACKEND
    max-wip: 2
    # ...
  ```
- Default: 2 per team (force focus and completion over starting)
- `/orchestrate` refuses to assign new work to a team at WIP limit
- When a team hits WIP limit, options:
  1. Complete or hand off a current item
  2. Swarm on a blocked item (see 2.2)
  3. Help another team (cross-training, see 3.3)
- Track WIP violations in retro data

**Suggested limits**:
| Team | Max WIP | Rationale |
|---|---|---|
| backend | 2 | Core team, deep work |
| frontend | 2 | UI work is parallel-friendly but context-heavy |
| data | 1 | Schema changes are high-risk, serialize them |
| infra | 2 | IaC changes need focus |
| devops | 2 | Pipeline work is sequential by nature |
| testing | 3 | Testing can be parallelized more |
| security | 1 | Security reviews need full attention |
| docs | 3 | Documentation is lower-risk, higher-volume |
| product | 2 | Planning work |
| quality | 2 | Review work |

#### 2.2 Swarming on Blockers

**What**: When a task is blocked beyond a threshold, agents from the `handoff-chain` proactively join to help unblock.

**Implementation**:

- Add `swarm-threshold: N` to `teams.yaml` process config (e.g., `swarm-threshold: 2` = blocked for 2 sync cycles)
- When threshold hit:
  1. Orchestrator identifies agents in `handoff-chain` with capacity (below WIP limit)
  2. Those agents are assigned to the blocker as a secondary task
  3. Swarm task gets P0 priority override
- Swarm mode ends when the blocker is resolved
- Track swarming events in retro data (how often, which teams, resolution time)

**Example flow**:

```
T1-Backend blocked on "auth middleware interface" (needs T5-Auth)
→ 2 sync cycles pass, still blocked
→ Orchestrator triggers swarm
→ T5-Auth (primary) + T4-Infra (from handoff-chain, has capacity) both work the blocker
→ Resolved → normal flow resumes
```

#### 2.3 Velocity & Session Metrics

**What**: Track what gets done per sprint/session to enable evidence-based planning.

**Implementation**:

- Create `metrics/` directory at repo root
- After each sprint, generate `metrics/sprint-N.md`:

  ```markdown
  # Sprint N Metrics — [Date Range]

  ## Velocity

  - Stories completed: N
  - Story points completed: N
  - Story points planned: N
  - Completion rate: N%

  ## Estimation Accuracy

  - Average estimate vs actual: +/- N points
  - Items that exceeded estimate: N (list)
  - Items that were easier than estimated: N (list)

  ## Flow

  - Items carried over from previous sprint: N
  - Items added mid-sprint: N
  - Items blocked during sprint: N
  - Swarm events triggered: N

  ## Quality

  - DoD violations caught: N
  - Items sent back for rework: N
  - Retro action items generated: N
  - Retro action items completed from previous: N/N
  ```

- Quality team generates this at sprint close
- Use 3-sprint rolling average for planning capacity

#### 2.4 Formalized Scrum Master Agent Role

**What**: Explicit process enforcement agent with authority to block non-compliant work.

**Implementation**:

- Add to `agents.yaml`:
  ```yaml
  - id: scrum-master
    category: process
    name: Scrum Master
    role: >
      Process facilitator responsible for enforcing DoR, DoD, WIP limits,
      and sprint ceremonies. Removes impediments and escalates blockers.
      Has authority to reject work that doesn't meet process gates.
    accepts:
      - enforce
      - facilitate
      - escalate
    focus:
      - 'AGENT_BACKLOG.md'
      - 'DOD.md'
      - 'DOR.md'
      - 'STANDUP.md'
      - 'metrics/**'
    responsibilities:
      - Enforce Definition of Ready before work enters sprint
      - Enforce Definition of Done before work is marked complete
      - Monitor WIP limits and flag violations
      - Trigger swarming when blockers exceed threshold
      - Facilitate retrospectives and track action items
      - Generate sprint metrics
  ```
- Quality team retains code quality focus; Scrum Master owns process quality
- Product team retains priority authority; Scrum Master owns process authority

#### 2.5 Formalized Product Owner Agent Role

**What**: Strengthen the product team's explicit authority over priority and value decisions.

**Implementation**:

- Update `product` agent in `agents.yaml` to explicitly include:
  ```yaml
  authority:
    - Final say on sprint goal
    - Priority arbitration when teams disagree
    - Accept/reject completed stories against acceptance criteria
    - Approve scope changes mid-sprint
  ```
- Product Owner approves sprint goal before work begins
- Product Owner accepts or rejects work at sprint review

---

### Phase 3: Design & Architecture Work

#### 3.1 Time-boxed Sprints

**What**: Define "sprint" as a fixed window with start/end ceremonies.

**Implementation**:

- Sprint = N sessions or a calendar window (recommend: 1 week or 5 sessions, whichever comes first)
- Sprint lifecycle:
  ```
  Sprint Planning → Daily Syncs → Sprint Review → Retrospective
  ```
- Add to `teams.yaml`:
  ```yaml
  process:
    sprint-duration: 5 sessions
    ceremonies:
      planning: start-of-sprint
      sync: start-of-session
      review: end-of-sprint
      retro: end-of-sprint
  ```
- Orchestrator tracks session count against sprint boundary
- No new work enters mid-sprint without Product Owner approval (scope change)

#### 3.2 Sprint Review / Demo Auto-generation

**What**: At sprint end, auto-generate a summary of everything completed.

**Implementation**:

- Generate `docs/history/sprint-reviews/sprint-N-review.md`:

  ```markdown
  # Sprint N Review — [Date]

  ## Sprint Goal

  [Goal statement] — **Achieved / Partially Achieved / Not Achieved**

  ## Completed Items

  | Task | Team | Points | PR(s) | Key Files Changed |
  | ---- | ---- | ------ | ----- | ----------------- |
  | ...  | ...  | ...    | ...   | ...               |

  ## Carried Over

  | Task | Team | Points | Reason |
  | ---- | ---- | ------ | ------ |
  | ...  | ...  | ...    | ...    |

  ## Key Decisions Made

  - [Decision and rationale]

  ## Stakeholder Notes

  - [Feedback or observations for human review]
  ```

- Pull data from `AGENT_BACKLOG.md` completed section + git log
- Product Owner reviews and adds stakeholder notes

#### 3.3 Cross-training / Secondary Scopes

**What**: Allow agents to contribute outside their primary scope to reduce bottlenecks.

**Implementation**:

- Add `secondary-scope` to `teams.yaml`:

  ```yaml
  - id: backend
    name: BACKEND
    scope: ['apps/api/**', 'services/**']
    secondary-scope: ['**/*.test.*'] # Can write tests
    # ...

  - id: testing
    name: TESTING
    scope: ['**/*.test.*', 'tests/**']
    secondary-scope: ['apps/api/**'] # Can read/understand API code
    # ...
  ```

- Agents only use secondary scope when:
  1. Primary-scope team is at WIP limit
  2. Swarming is triggered
  3. Orchestrator explicitly assigns cross-team work
- Quality review required for all secondary-scope contributions

#### 3.4 Pair Programming Mode

**What**: Two agents collaborate on the same task simultaneously.

**Implementation**:

- Invocation: `/pair <agent-1> <agent-2> <task>`
- Roles:
  - **Driver**: Writes the code
  - **Navigator**: Reviews in real-time, catches issues, suggests improvements
- Swap roles at natural breakpoints (e.g., after each function/module)
- Use cases:
  - Complex algorithm implementation
  - Security-sensitive code
  - Cross-team integration points
- Cost consideration: 2x token usage — reserve for P0/P1 items or high-complexity work
- Track pair sessions in metrics for effectiveness evaluation

#### 3.5 Burndown Visibility

**What**: Running burndown chart updated after each task completion.

**Implementation**:

- Add `## Burndown` section to `AGENT_BACKLOG.md`:

  ```markdown
  ## Burndown — Sprint N

  Total points: 21 | Completed: 8 | Remaining: 13

  | Session | Points Remaining | Notes                                       |
  | ------- | ---------------- | ------------------------------------------- |
  | 1       | 21               | Sprint start                                |
  | 2       | 18               | 3 pts completed                             |
  | 3       | 13               | 5 pts completed, 2 pts added (scope change) |
  ```

- Updated by orchestrator after each session
- If remaining points trend shows sprint goal at risk, trigger:
  1. Scope negotiation with Product Owner
  2. Swarming on largest remaining items
  3. Carry-over planning

#### 3.6 Backlog Refinement Ceremony

**What**: Dedicated refinement pass before sprint planning.

**Implementation**:

- Run refinement 1 session before sprint planning
- Activities:
  1. Review all Backlog items for clarity (DOR check)
  2. Estimate story points for unestimated items
  3. Decompose items > 8 points
  4. Update dependencies in Cross-Team Dependencies table
  5. Identify items that are ready for next sprint
- Output: Backlog items tagged `refined: true` are eligible for sprint planning
- Items not refined cannot enter the sprint

#### 3.7 Technical Debt Management

**What**: Explicit allocation of sprint capacity for tech debt reduction.

**Implementation**:

- Reserve 20% of sprint capacity for tech debt items
- Add `type:` column to `AGENT_BACKLOG.md`: `feature | bugfix | tech-debt | process`
- Track tech debt ratio in sprint metrics
- If tech debt items exceed 30% of backlog, trigger a dedicated tech debt sprint
- Quality team maintains a tech debt register with severity ratings

#### 3.8 Information Radiators

**What**: Auto-generated dashboard summarizing team status at a glance.

**Implementation**:

- Generate `STATUS.md` at repo root, updated by orchestrator:

  ```markdown
  # Project Status — Auto-generated

  **Sprint**: N | **Goal**: [goal] | **Health**: On Track / At Risk / Off Track
  **Velocity** (3-sprint avg): N pts | **This sprint**: N/N pts

  ## Team Status

  | Team    | WIP | Capacity  | Current Task | Status   |
  | ------- | --- | --------- | ------------ | -------- |
  | Backend | 2/2 | Full      | API routes   | On track |
  | Data    | 0/1 | Available | —            | Idle     |
  | ...     | ... | ...       | ...          | ...      |

  ## Blockers

  - [Blocker description] — Owner: [team] — Age: [N sessions]

  ## Recent Completions

  - [Task] by [team] — [date]
  ```

#### 3.9 Root Cause Analysis Practice

**What**: When things go wrong, investigate systemically rather than patching symptoms.

**Implementation**:

- For any P0 bug or sprint goal miss, require a "5 Whys" entry in lessons learned
- Template addition to `TEMPLATE-lesson.md`:

  ```markdown
  ## Root Cause Analysis (5 Whys)

  1. Why did [problem] happen? → [answer]
  2. Why did [answer 1] happen? → [answer]
  3. Why did [answer 2] happen? → [answer]
  4. Why did [answer 3] happen? → [answer]
  5. Why did [answer 4] happen? → [root cause]

  **Systemic fix**: [What process/config/tool change prevents recurrence]
  ```

#### 3.10 Collective Code Ownership

**What**: Reduce knowledge silos by ensuring multiple teams can work on any area.

**Implementation**:

- Track "code familiarity" per team: which files/modules each team has touched
- Flag modules only one team has ever worked on (bus factor = 1)
- During cross-training opportunities, deliberately assign secondary teams to these modules
- Goal: Every critical module has at least 2 teams with familiarity

---

## Part 4: Implementation Roadmap

```
Phase 1 — Foundations (Immediate)
├── 1.1  DOD.md (standalone, generated, referenced)
├── 1.2  DOR.md (standalone, generated, referenced)
├── 1.3  Sprint Goal in AGENT_BACKLOG.md
├── 1.4  Structured Retrospective ceremony
├── 1.5  Story Points / Relative Estimation
└── 1.6  Daily Standup / Agent Sync

Phase 2 — Process Logic (Next Sprint)
├── 2.1  WIP Limits per team
├── 2.2  Swarming on blockers
├── 2.3  Velocity & Session Metrics
├── 2.4  Scrum Master agent role
└── 2.5  Product Owner authority formalization

Phase 3 — Architecture (Future Sprints)
├── 3.1  Time-boxed sprints
├── 3.2  Sprint Review auto-generation
├── 3.3  Cross-training / secondary scopes
├── 3.4  Pair programming mode
├── 3.5  Burndown visibility
├── 3.6  Backlog refinement ceremony
├── 3.7  Technical debt management
├── 3.8  Information radiators (STATUS.md)
├── 3.9  Root cause analysis practice
└── 3.10 Collective code ownership tracking
```

---

## Part 5: Dependencies Between Items

```
DOR.md (1.2) ──────────────► Sprint Planning requires DOR gate
DOD.md (1.1) ──────────────► Completion requires DOD gate
Story Points (1.5) ────────► Velocity tracking (2.3) needs points data
                   ────────► Burndown (3.5) needs points data
                   ────────► DOR (1.2) includes sizing check
Agent Sync (1.6) ──────────► Swarming (2.2) needs sync data to detect blockers
WIP Limits (2.1) ──────────► Cross-training (3.3) activated at WIP ceiling
                 ──────────► Swarming (2.2) checks capacity against WIP
Velocity (2.3) ────────────► Time-boxed sprints (3.1) needs historical velocity
               ────────────► Sprint Review (3.2) reports velocity
Retro (1.4) ───────────────► Root Cause Analysis (3.9) extends retro template
Scrum Master (2.4) ────────► Enforces 1.1, 1.2, 2.1, 3.6
Product Owner (2.5) ───────► Owns 1.3 (sprint goal), 3.2 (review), 3.1 (scope)
```

---

## Part 6: Success Criteria

How we know this is working:

| Metric                                             | Baseline (Current) | Target (After Phase 2) | Target (After Phase 3) |
| -------------------------------------------------- | ------------------ | ---------------------- | ---------------------- |
| Items marked "Done" that actually meet quality bar | Unknown            | 90%+ (DoD enforced)    | 95%+                   |
| Items entering sprint that are well-defined        | Unknown            | 80%+ (DoR enforced)    | 95%+                   |
| Sprint goal achievement rate                       | Not tracked        | 70%+                   | 85%+                   |
| Estimation accuracy (estimate vs actual)           | Not tracked        | Within +/- 3 points    | Within +/- 2 points    |
| Blockers detected early (via sync)                 | 0 (no sync exists) | 60%+ caught in sync    | 80%+                   |
| Retro action items completed                       | Not tracked        | 50%+ per sprint        | 75%+                   |
| Tech debt ratio                                    | Unknown            | Measured               | < 30% of backlog       |

---

_This is a planning document. No implementation changes have been made. Each phase requires explicit approval before execution._
