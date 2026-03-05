# SPEC-PROC-001: Process Foundations

**Status**: Draft
**Phase**: 1 — Immediate (config & document changes)
**Scope**: DOD.md, DOR.md, Sprint Goal, Structured Retrospective, Story Points, Agent Sync
**Companion Docs**: `10_scrum_team_practices_adoption_plan.md`, `11_organizational_frameworks_adoption_plan.md`

---

## Design Principle: Code Over Context

All items in this spec follow one rule: **push enforcement into tooling, not agent instructions**.

| Approach | Context Cost | Reliability | Preferred? |
|----------|-------------|-------------|------------|
| Tell every agent "check DOD before marking done" | High (repeated per agent, per session) | Low (agents forget) | No |
| Orchestrator script validates DOD checklist at phase transition | Zero agent context | High (code doesn't forget) | Yes |
| Add DOD rules to every agent's `domain-rules` | Multiplied across 10+ agents | Medium | No |
| Single `process:` section in `teams.yaml` + validation script | One source, agents inherit | High | Yes |

**Implementation strategy**: Define process rules in YAML config. Build lightweight validation scripts that run at phase boundaries. Agents only see the result ("DOD check: PASS" or "DOD check: FAIL — missing: tests, docs"). No agent needs to carry the full DOD checklist in context.

---

## F-001: Definition of Done (DOD.md)

### Functional Requirements

**FR-001.1**: A standalone `DOD.md` file SHALL exist at repository root defining the criteria that must be met before any work item is considered "Done".

**FR-001.2**: DOD criteria SHALL be organized into categories:
- Code Quality (build, tests, lint, coverage)
- Review (peer review completed, comments addressed)
- Documentation (API docs, ADRs, changelog)
- Integration (CI passes, no regressions)
- Verification (acceptance criteria met, quality sign-off for P0/P1)

**FR-001.3**: Each criterion SHALL be a checkable item (boolean: met or not met).

**FR-001.4**: DOD SHALL be referenced — not duplicated — by all processes that evaluate completion.

**FR-001.5**: DOD violations SHALL prevent items from moving to "Done" in `AGENT_BACKLOG.md`.

**FR-001.6**: DOD SHALL be version-controlled and changes SHALL require review.

### Technical Requirements

**TR-001.1 — File Structure**: `DOD.md` at repo root. Machine-parseable checklist format:
```markdown
# Definition of Done

## code-quality
- [ ] `build`: Project builds without errors
- [ ] `tests-pass`: All existing tests pass
- [ ] `coverage`: New/changed code has test coverage >= 80%
- [ ] `lint`: Linter passes with zero errors

## review
- [ ] `peer-review`: At least one review completed by another team
- [ ] `comments-resolved`: All review comments addressed or deferred with justification

## documentation
- [ ] `api-docs`: Public API changes documented
- [ ] `adr`: Architectural decisions recorded (if applicable)
- [ ] `changelog`: CHANGELOG.md updated for user-facing changes

## integration
- [ ] `ci-pass`: CI pipeline passes all required checks
- [ ] `no-regression`: No regressions in existing functionality

## verification
- [ ] `acceptance`: Acceptance criteria from task/story are met
- [ ] `quality-signoff`: Quality team sign-off (P0/P1 items only)
```

**TR-001.2 — Machine-Readable IDs**: Each criterion has a kebab-case ID (e.g., `tests-pass`, `peer-review`) used by validation scripts. The `## section` headers map to category names.

**TR-001.3 — Validation Script**: `scripts/validate-dod.mjs`
```
Input:  task ID or PR number
Action: For each DOD criterion, check programmatically where possible:
  - build:         Run `pnpm build`, check exit code
  - tests-pass:    Run `pnpm test`, check exit code
  - coverage:      Parse coverage report, compare threshold
  - lint:          Run `pnpm lint`, check exit code
  - ci-pass:       Query GitHub Actions status via `gh`
  - peer-review:   Query PR review status via `gh`
Output: JSON report { criterion: "pass"|"fail"|"skip", details: string }
```

**TR-001.4 — Integration Points**:
- `/handoff` reads validation output, includes DOD status in handoff summary
- `/orchestrate` phase transition (Implementation → Validation → Ship) gates on DOD
- `AGENT_BACKLOG.md` item status cannot be set to "Done" if DOD fails
- Agents do NOT carry DOD rules — they receive pass/fail results from the script

**TR-001.5 — teams.yaml Reference**:
```yaml
process:
  definition-of-done: DOD.md
  dod-validation: scripts/validate-dod.mjs
```

### Context Bloat Mitigation

| What agents see | What agents DON'T carry |
|----------------|------------------------|
| "DOD check: PASS" or "DOD check: FAIL — missing: tests-pass, peer-review" | The full 13-item checklist |
| A link to `DOD.md` if they need to look up details | The checklist contents repeated in their instructions |
| The specific failed items with actionable next steps | The complete DOD specification |

---

## F-002: Definition of Ready (DOR.md)

### Functional Requirements

**FR-002.1**: A standalone `DOR.md` file SHALL exist at repository root defining criteria that must be met before a work item enters the Active Sprint.

**FR-002.2**: DOR criteria SHALL cover:
- Clarity (description, acceptance criteria, bounded scope)
- Dependencies (identified, blocking ones resolved or planned)
- Sizing (story points estimated, fits in sprint, files/modules identified)
- Context (related docs linked, prior handoff notes reviewed)

**FR-002.3**: Items failing DOR SHALL remain in the Backlog section of `AGENT_BACKLOG.md` with a note: `Not Ready: [missing criteria]`.

**FR-002.4**: DOR validation SHALL occur during backlog refinement and sprint planning, NOT during implementation.

**FR-002.5**: Items tagged `complexity: complex` or `complexity: chaotic` SHALL require a completed spike before DOR can pass the Sizing criteria.

### Technical Requirements

**TR-002.1 — File Structure**: `DOR.md` at repo root. Same machine-parseable format as DOD:
```markdown
# Definition of Ready

## clarity
- [ ] `description`: Task has a clear, one-sentence description of what "done" looks like
- [ ] `acceptance-criteria`: Testable, observable acceptance criteria defined
- [ ] `bounded-scope`: No open questions that block starting work

## dependencies
- [ ] `deps-identified`: All upstream dependencies listed
- [ ] `deps-resolved`: Blocking dependencies resolved OR explicit unblock plan exists

## sizing
- [ ] `estimated`: Story points assigned (1, 2, 3, 5, 8; 13+ must decompose)
- [ ] `fits-sprint`: Task fits within a single sprint
- [ ] `scope-identified`: Required files/modules identified

## context
- [ ] `docs-linked`: Related PRDs, specs, or ADRs linked
- [ ] `handoff-reviewed`: If continuing prior work, previous handoff notes reviewed
```

**TR-002.2 — Validation Script**: `scripts/validate-dor.mjs`
```
Input:  backlog item (parsed from AGENT_BACKLOG.md)
Action: Check each DOR criterion against the item's metadata:
  - description:        Non-empty task description exists
  - acceptance-criteria: Item has "AC:" or "Acceptance:" section
  - estimated:          Estimate column is populated and in [1,2,3,5,8]
  - deps-identified:    Dependencies column is populated or "None"
  - docs-linked:        Notes column contains at least one doc reference (for P0/P1)
Output: JSON report { criterion: "pass"|"fail"|"skip", details: string }
```

**TR-002.3 — Enforcement Point**: `/orchestrate` sprint planning phase runs DOR validation before promoting items from Backlog to Active Sprint. Items that fail are logged with reasons and left in Backlog.

**TR-002.4 — teams.yaml Reference**:
```yaml
process:
  definition-of-ready: DOR.md
  dor-validation: scripts/validate-dor.mjs
```

### Context Bloat Mitigation

Agents never carry DOR criteria. The orchestrator runs the script at sprint planning time and reports: "Item X is Ready" or "Item X is Not Ready — missing: estimated, acceptance-criteria". Agents only see the result.

---

## F-003: Sprint Goal

### Functional Requirements

**FR-003.1**: Every Active Sprint in `AGENT_BACKLOG.md` SHALL have exactly one Sprint Goal.

**FR-003.2**: The Sprint Goal SHALL be a single sentence describing the most important outcome of the sprint.

**FR-003.3**: The Sprint Goal SHALL be set or confirmed by the Product Owner role before work begins.

**FR-003.4**: At sprint review, the Sprint Goal SHALL be evaluated: Achieved / Partially Achieved / Not Achieved.

**FR-003.5**: When priority conflicts arise during a sprint, the Sprint Goal SHALL be the tiebreaker — work that advances the goal takes priority.

### Technical Requirements

**TR-003.1 — Backlog Format**: Add structured header to `AGENT_BACKLOG.md` Active Sprint section:
```markdown
## Active Sprint

**Sprint Goal**: Establish a working CI pipeline that runs tests on every PR to main.
**Sprint**: 2
**Started**: 2026-03-05
**Goal Status**: In Progress
```

**TR-003.2 — Validation**: `scripts/validate-sprint.mjs` checks:
- Sprint Goal field is non-empty
- Goal Status is one of: `In Progress`, `Achieved`, `Partially Achieved`, `Not Achieved`
- Sprint number is sequential

**TR-003.3 — Orchestrator Integration**: `/orchestrate` at session start reads and displays the Sprint Goal. All task prioritization references the goal. `/orchestrate --assess-only` includes goal progress assessment.

**TR-003.4 — Sprint Review Output**: At sprint end, the goal evaluation is written to `docs/history/sprint-reviews/sprint-N-review.md`.

### Context Bloat Mitigation

The Sprint Goal is a single sentence. It's already minimal. It appears once in `AGENT_BACKLOG.md` and is read (not duplicated) by the orchestrator. No per-agent injection needed — agents see it when they read the backlog, which they already do.

---

## F-004: Structured Retrospective

### Functional Requirements

**FR-004.1**: A retrospective SHALL be generated at the end of every sprint or session that completes significant work.

**FR-004.2**: The retrospective SHALL be triggered automatically by `/handoff`.

**FR-004.3**: Minimum required sections:
- What went well (at least 1 item)
- What didn't work (at least 1 item)
- Action items (concrete, assigned to a team, with priority)

**FR-004.4**: Action items from retrospectives SHALL be added to `AGENT_BACKLOG.md` as process improvement tasks (type: `process`, default priority: P2).

**FR-004.5**: Previous sprint's retro action items SHALL be reviewed at next sprint planning — completion rate tracked.

### Technical Requirements

**TR-004.1 — Output Location**: `docs/history/lessons-learned/NNNN-YYYY-MM-DD-sprint-N-retrospective.md`

**TR-004.2 — Template Extension**: Extend `TEMPLATE-lesson.md` with a `## Retrospective` section (or use it as-is — the existing template already covers what-worked, what-didn't, action-items).

**TR-004.3 — /handoff Integration**: Modify `/handoff` behavior:
```
1. Generate handoff summary (existing behavior)
2. NEW: Prompt retrospective generation
   - Analyze events.log for the current session
   - Extract: tasks completed, blockers encountered, rework incidents
   - Auto-populate "What went well" from completed items
   - Auto-populate "What didn't work" from blocked items and rework
   - Generate draft action items from patterns (e.g., "3 items blocked by same dependency → action: resolve dependency")
3. Write retrospective file
4. Extract action items → append to AGENT_BACKLOG.md
```

**TR-004.4 — Automated Analysis Script**: `scripts/generate-retro.mjs`
```
Input:  events.log entries for current session/sprint
Output: Pre-populated retrospective markdown with:
  - Completed items (from events.log type: "task-completed")
  - Blocked items (from events.log type: "task-blocked")
  - Rework events (from events.log type: "task-reopened" or DoD failures)
  - Suggested action items based on patterns
```

**TR-004.5 — Action Item Tracking**: Each action item in the retro gets a unique ID (e.g., `RETRO-S2-001`). These IDs appear in `AGENT_BACKLOG.md` so completion can be tracked across sprints.

### Context Bloat Mitigation

Retro generation runs as a script analyzing `events.log`. Agents don't carry retro instructions — `/handoff` calls the script and appends the output. The agent sees a completed retrospective document, not the generation logic.

---

## F-005: Story Points / Relative Estimation

### Functional Requirements

**FR-005.1**: Every work item in `AGENT_BACKLOG.md` SHALL have a story point estimate before entering the Active Sprint.

**FR-005.2**: Scale: 1 (trivial), 2 (small), 3 (medium), 5 (large), 8 (very large), 13 (must decompose).

**FR-005.3**: Items estimated at 13 SHALL NOT enter the Active Sprint — they must be decomposed into smaller items.

**FR-005.4**: Actual complexity SHALL be recorded at completion for calibration.

**FR-005.5**: Estimation accuracy SHALL be tracked in sprint metrics (estimate vs actual delta).

**FR-005.6**: Items tagged `complexity: complex` or `complexity: chaotic` (Cynefin classification) SHALL require a spike before estimation.

### Technical Requirements

**TR-005.1 — Backlog Schema Change**: Add `Estimate` and `Actual` columns to `AGENT_BACKLOG.md` tables:
```markdown
| Priority | Team | Task | Phase | Status | Estimate | Actual | Notes |
```

**TR-005.1a — Backlog Parser Migration**: `.agentkit/engines/node/src/backlog-store.mjs` regex parser and table renderer must be updated to recognise the new `Estimate` and `Actual` columns. This is a prerequisite for TR-005.1; without it, existing markdown ingestion/output will break. Add to Phase 1 implementation manifest.

**TR-005.2 — Validation**: DOR validation (`scripts/validate-dor.mjs`) checks:
- `estimated` field is populated
- Value is in allowed set: `[1, 2, 3, 5, 8]`
- Items with estimate 13+ are rejected with message: "Decompose before sprint entry"

**TR-005.3 — Sprint Capacity**: Add to `AGENT_BACKLOG.md` sprint header:
```markdown
**Sprint Capacity**: 21 pts | **Committed**: 18 pts | **Buffer**: 3 pts (15%)
```

**TR-005.4 — Calibration Data**: `scripts/sprint-metrics.mjs` calculates:
- Per-team estimation accuracy: `avg(|estimate - actual|)` over last 3 sprints
- Systematic bias: does the team consistently over- or under-estimate?
- Output stored in `metrics/sprint-N.md`

**TR-005.5 — Estimation Guidance**: NOT injected into agent context. Instead, stored in `DOR.md` as a reference table:
```markdown
### Estimation Reference
| Points | Meaning | Example |
|--------|---------|---------|
| 1 | Trivial — config change, typo fix | Update a constant |
| 2 | Small — single file, well-understood | Add a field to a model |
| 3 | Medium — 2-3 files, some unknowns | New API endpoint with tests |
| 5 | Large — multiple files, cross-module | Feature with API + UI + tests |
| 8 | Very large — significant unknowns | New subsystem or major refactor |
| 13 | Epic — must decompose | Do not sprint this directly |
```

### Context Bloat Mitigation

Agents don't carry the estimation scale in their instructions. When an agent is asked to estimate, it reads `DOR.md` (which it would read anyway for readiness). The scale is stored once. Calibration happens in scripts, not in agent context.

---

## F-006: Daily Standup / Agent Sync

### Functional Requirements

**FR-006.1**: A sync mechanism SHALL exist so agents can see what other agents are working on, have found, or are blocked by.

**FR-006.2**: Sync SHALL occur at session start (via `/orchestrate`) and at natural breakpoints during long sessions.

**FR-006.3**: Each active agent/team SHALL report:
- Working on: Current task and status
- Found/Discovered: Anything that affects other teams
- Blocked by: What's preventing progress
- Need from: Which team they need something from

**FR-006.4**: The orchestrator SHALL use sync data to detect:
- Conflicting changes (two agents modifying the same area)
- Unnoticed blockers (agent A blocked while agent B could help)
- Information gaps (agent A discovered something agent B needs)

**FR-006.5**: Sync data SHALL persist in a known file location for cross-session visibility.

### Technical Requirements

**TR-006.1 — State File**: `.claude/state/sync.json` (NOT markdown — machine-readable):
```json
{
  "session": "2026-03-05-001",
  "updated": "2026-03-05T10:30:00Z",
  "entries": [
    {
      "team": "backend",
      "working_on": { "task": "API route structure", "backlog_id": "P1-T1-001", "status": "in_progress" },
      "discovered": ["Express router needs middleware refactor for nested routes"],
      "blocked_by": null,
      "needs_from": [{ "team": "data", "what": "user model schema" }]
    }
  ]
}
```

**TR-006.2 — Why JSON, Not Markdown**:
- Markdown syncs are read by agents, costing context tokens every time
- JSON is read by scripts that produce a concise summary
- The script outputs only what's relevant to the requesting agent
- Example: Backend agent gets "DATA team discovered: Prisma doesn't support composite keys — consider surrogate keys" but NOT the full status of all 10 teams

**TR-006.3 — Sync Script**: `scripts/agent-sync.mjs`
```
Commands:
  sync update --team <id> --working-on <task> [--discovered <msg>] [--blocked <msg>] [--needs <team:what>]
  sync read --for <team-id>   # Returns only entries relevant to this team
  sync read --all             # Full sync board (for orchestrator)
  sync conflicts              # Detect teams working on overlapping scopes
```

**TR-006.4 — Conflict Detection**:
```
For each pair of active teams:
  If team_A.working_on.scope OVERLAPS team_B.working_on.scope:
    Emit warning: "CONFLICT: {team_A} and {team_B} both touching {overlap_area}"
```
Scope overlap is determined by comparing file globs from `teams.yaml` against files mentioned in task descriptions.

**TR-006.5 — Orchestrator Integration**:
- `/orchestrate` at session start: runs `sync read --all`, displays summary, runs conflict detection
- `/orchestrate` at task assignment: runs `sync read --for <team>`, includes relevant discoveries from other teams in the assignment context
- `/handoff`: runs `sync update` with final status before closing session

**TR-006.6 — Relevant-Only Filtering**:
The critical context-saving feature: when an agent starts work, they receive ONLY sync entries that match their scope or mention their team. Not the full board.

```
Backend agent starting work receives:
  "Sync: DATA needs your input on surrogate keys. TESTING completed API test scaffolding."

Backend agent does NOT receive:
  "FRONTEND working on component library. DOCS updating ADR template. INFRA reviewing Terraform."
```

### Context Bloat Mitigation

This is the most context-sensitive item in Phase 1.

| Design decision | Context savings |
|----------------|----------------|
| JSON state file, not markdown | Scripts process it — agents don't read raw file |
| Relevant-only filtering | Agent sees 2-3 lines, not 10 team statuses |
| Script-generated summaries | One sentence per relevant team, not full reports |
| No sync instructions in agent context | Orchestrator calls the script — agents just receive the output |

---

## Cross-Cutting Technical Requirements

### TR-CC-1: teams.yaml Process Section

> **Schema Migration Notice**: The current `teams.yaml` does NOT have a `process:` section. Adding this block is a **schema change** that requires updates to the sync engine (`synchronize.mjs`). The sync engine's YAML parser must be updated to:
> 1. Accept the new `process:` top-level key without treating it as an error or unresolved placeholder
> 2. Make the `process:` section available to orchestrator templates and scripts
> 3. Not attempt to map `process:` entries to team definitions
>
> This should be implemented as the first task in Phase 1, before any process scripts are created, since all scripts depend on reading config from this section.

All Phase 1 items are referenced from a single `process:` block in `teams.yaml`:

```yaml
process:
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
```

Single source of truth. Agents inherit process rules through tooling, not through duplicated instructions.

### TR-CC-2: Script Architecture

All validation/generation scripts follow the same pattern:

```
scripts/
  validate-dod.mjs      # DOD gate check
  validate-dor.mjs      # DOR gate check
  validate-sprint.mjs   # Sprint structure check
  generate-retro.mjs    # Retrospective generation from events.log
  sprint-metrics.mjs    # Velocity/calibration metrics
  agent-sync.mjs        # Sync state management
```

Common interface:
```
node scripts/<script>.mjs <command> [--flags]
Exit code 0 = pass, 1 = fail
Output: JSON to stdout for programmatic consumption
Output: Human-readable summary to stderr for agent display
```

**Script extension model**: Scripts that are extended across phases (notably `sprint-metrics.mjs`, which gains features in SPEC-PROC-001 through SPEC-PROC-004) use a **subcommand monolith** pattern — a single script with multiple subcommands, NOT separate scripts that share a library. This keeps the `teams.yaml` process section simple (one script path per concern) and avoids import/dependency management across script files.

```
# sprint-metrics.mjs subcommands (grows across phases):
node scripts/sprint-metrics.mjs calibration   # Phase 1: estimation accuracy
node scripts/sprint-metrics.mjs velocity      # Phase 2: velocity & flow
node scripts/sprint-metrics.mjs capacity      # Phase 2: capacity recommendation
node scripts/sprint-metrics.mjs cycle-time    # Phase 4: cycle time tracking (F-023)
node scripts/sprint-metrics.mjs dora          # Phase 4: DORA metrics (F-032)
node scripts/sprint-metrics.mjs kaizen        # Phase 4: improvement counter (F-052)
node scripts/sprint-metrics.mjs report        # All phases: full sprint report
```

Each subcommand is a self-contained function within the script. Shared utilities (date parsing, backlog reading, events.log querying) are internal helper functions — not exported modules.

### TR-CC-3: Command Integration

All process scripts are internal to the orchestrator — they are NOT registered as user-facing commands in `commands.yaml`. Instead, existing commands invoke them at the appropriate phase boundaries.

| Script | Invoked By | When | User-Visible? |
|--------|-----------|------|---------------|
| `validate-dod.mjs` | `/orchestrate` | Task Completion phase | No — result shown as "DOD: PASS/FAIL" |
| `validate-dor.mjs` | `/orchestrate` | Sprint Planning phase | No — result shown in planning output |
| `validate-sprint.mjs` | `/orchestrate` | Session Start | No — result shown in assessment |
| `generate-retro.mjs` | `/handoff` | Session End (step 2 of handoff) | Yes — retro file link in handoff summary |
| `sprint-metrics.mjs` | `/orchestrate` | Sprint Planning (capacity); Sprint End (report) | No — metrics shown as summary line |
| `agent-sync.mjs` | `/orchestrate`, `/handoff` | Session Start (read), Task Assignment (read --for), Session End (update) | No — sync data shown as filtered summary |
| `wip-check.mjs` | `/orchestrate` | Task Assignment phase | No — shown as "Backend: 2/2 (FULL)" |
| `swarm-check.mjs` | `/orchestrate` | Assessment phase | No — shown as "SWARM ALERT" if triggered |
| `sprint-lifecycle.mjs` | `/orchestrate` | Sprint boundaries | No — shown as "Sprint 2: session 3/5" |
| `generate-review.mjs` | `/orchestrate` | Sprint End | Yes — review file link in output |
| `burndown-update.mjs` | `/orchestrate` | After task completion | No — updates AGENT_BACKLOG.md silently |
| `backlog-refine.mjs` | `/orchestrate` | Pre-sprint-planning | No — refinement report in planning output |
| `backlog-health.mjs` | `/orchestrate` | Sprint Planning | No — "Tech debt: 35% — consider dedicated sprint" |
| `generate-status.mjs` | `/orchestrate` | End of every `/orchestrate` call | Yes — STATUS.md updated |
| `code-ownership.mjs` | `/orchestrate` | Sprint Planning (cross-training input) | No — bus factor shown in planning |
| `andon.mjs` | `/orchestrate` | Any phase (stop-the-line trigger) | Yes — blocks further work with alert |

**No new commands are introduced.** All process enforcement flows through the existing `/orchestrate` and `/handoff` commands. The only user-visible change is that these commands now produce richer output (DOD/DOR status, WIP status, burndown warnings, etc.).

**Flags**: No new flags are added to existing commands. The process checks are automatic — they run based on the orchestrator phase, not user flags. If a future need arises for opt-out (e.g., `--skip-dor`), it would be added to `/orchestrate` in `commands.yaml` at that time.

---

### TR-CC-4: Events Log Integration

All scripts append structured entries to `.claude/state/events.log`:
```json
{"timestamp": "...", "type": "dod-check", "result": "fail", "missing": ["tests-pass"], "task": "P1-T1-001"}
{"timestamp": "...", "type": "dor-check", "result": "pass", "task": "P2-T2-003"}
{"timestamp": "...", "type": "retro-generated", "sprint": 2, "action_items": 3}
{"timestamp": "...", "type": "sync-update", "team": "backend", "conflicts": []}
```

This creates an audit trail that the retro generator can analyze for patterns.

### TR-CC-5: No Agent Instruction Changes for Phase 1

**Critical constraint**: Phase 1 should NOT add any text to agent `domain-rules`, `responsibilities`, or `role` fields in `agents.yaml`. All enforcement happens through:
1. `teams.yaml` `process:` config (read by orchestrator)
2. Validation scripts (called by orchestrator)
3. Result summaries (delivered to agents as 1-2 line messages)

If we need to tell an agent about a process, we add it as a script output message, not an instruction.

---

## File Manifest

Files to create:
```
DOD.md                          # Definition of Done (repo root)
DOR.md                          # Definition of Ready (repo root)
scripts/validate-dod.mjs        # DOD validation script
scripts/validate-dor.mjs        # DOR validation script
scripts/validate-sprint.mjs     # Sprint structure validation
scripts/generate-retro.mjs      # Retrospective generator
scripts/sprint-metrics.mjs      # Velocity & calibration metrics
scripts/agent-sync.mjs          # Agent sync state management
```

Files to modify:
```
.agentkit/spec/teams.yaml       # Add process: section
AGENT_BACKLOG.md                # Add Sprint Goal, Estimate/Actual columns
```

Files NOT modified:
```
.agentkit/spec/agents.yaml      # No agent instruction changes
AGENTS.md                       # No regeneration needed
```

---

## Dependencies

```
F-001 (DOD) ────────► Required by F-004 (Retro analyzes DOD failures)
F-002 (DOR) ────────► Required by F-005 (Estimation is a DOR criterion)
F-003 (Sprint Goal) ► No dependencies — standalone
F-004 (Retro) ──────► Depends on events.log (already exists)
F-005 (Estimation) ─► Depends on F-002 (DOR validates estimates)
F-006 (Sync) ───────► No dependencies — standalone, but feeds into Phase 2 swarming
```

Recommended implementation order: F-003 → F-001 → F-002 → F-005 → F-006 → F-004

---

## Acceptance Criteria

| Item | Acceptance Criteria |
|------|-------------------|
| F-001 DOD | `scripts/validate-dod.mjs` runs against a sample task, returns structured pass/fail. DOD.md exists and is parseable |
| F-002 DOR | `scripts/validate-dor.mjs` validates a backlog item. Items missing criteria are flagged. 13-point items rejected |
| F-003 Sprint Goal | `AGENT_BACKLOG.md` has Sprint Goal field. `/orchestrate` displays it at session start |
| F-004 Retro | `/handoff` generates a retro file. Action items appear in AGENT_BACKLOG.md. Previous retro actions reviewed at planning |
| F-005 Estimation | Backlog has Estimate/Actual columns. DOR validation checks estimation. Sprint capacity calculated |
| F-006 Sync | `sync update` writes to sync.json. `sync read --for <team>` returns filtered results. Conflict detection works |
