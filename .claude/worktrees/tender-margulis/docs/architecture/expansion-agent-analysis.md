# Feature Expansion Agent — Feasibility Analysis

**Date**: 2026-03-04
**Status**: Draft / Under Review
**Author**: Analysis Session

---

## 1. Executive Summary

This document analyzes the feasibility, design considerations, and integration strategy for adding a **Feature Expansion/Addition Agent** to retort. The agent would analyze a repository's current state and suggest new features, missing capabilities, documentation gaps, and architectural improvements — then optionally generate specification artifacts (ADR, PRD, functional specs, technical specs) for approved suggestions.

**Verdict**: The idea is **sound but must be carefully scoped**. The repository already has strong primitives that support this (team routing, task protocol, review gates, documentation structure, discovery engine). However, the agent carries unique risks around scope creep, hallucinated requirements, and autonomy overreach that demand explicit human-in-the-loop controls beyond what existing agents require.

---

## 2. Repository Fitness Assessment

### 2.1 What Already Exists That Supports This

| Existing Capability                 | Location                   | Relevance                                                                   |
| ----------------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| **Discovery engine**                | `discover.mjs`             | Already scans repo structure, tech stacks, file categories, team boundaries |
| **Retrospective analyst agent**     | `agents.yaml`              | Extracts issues and lessons — a narrower form of "suggest improvements"     |
| **Product agent**                   | `agents.yaml`              | Already owns PRDs, feature definitions, roadmap — natural collaborator      |
| **Docs agent**                      | `agents.yaml`              | Owns documentation, ADRs, guides — would execute doc generation             |
| **Quality agent**                   | `agents.yaml`              | Reviews code quality, suggests enhancements — overlapping concern           |
| **Project completeness assessment** | `project-completeness.mjs` | Evaluates reliability, security, architecture, ops fitness                  |
| **Documentation structure**         | `docs.yaml`                | Defines full doc hierarchy with ADR numbering ranges, categories, templates |
| **Task protocol**                   | `task-protocol.mjs`        | File-based A2A delegation with dependencies, handoffs, artifacts            |
| **Handoff chains**                  | `teams.yaml`               | Auto-routing of completed work to downstream teams                          |
| **Review gates**                    | `review-runner.mjs`        | 10-criterion review before approval — blocks low-quality output             |
| **Phase lifecycle**                 | `orchestrator.mjs`         | 5-phase workflow (discover → plan → implement → validate → ship)            |

### 2.2 What Does NOT Exist

- **No systematic gap analysis** — discovery tells you what IS there, not what's MISSING
- **No cross-referencing against best practices** — no agent compares your repo against industry norms
- **No prioritized suggestion pipeline** — the retrospective analyst captures lessons but doesn't proactively suggest new work
- **No spec generation workflow** — docs agent writes docs but doesn't generate structured PRDs/ADRs from analysis
- **No "what should we build next" reasoning** — product agent acts on instructions, doesn't generate them

### 2.3 Verdict on Fit

The gap is real. The repository has excellent _execution_ infrastructure (orchestrator, task protocol, teams, review gates) but lacks a _strategic analysis_ layer that generates well-reasoned suggestions about what to build, document, or improve. The expansion agent fills this gap.

---

## 3. How the Feature Expansion Agent Would Work

### 3.1 Core Responsibilities

The agent should operate in two distinct modes:

**Mode 1: Analysis & Suggestion (read-only)**

- Scan repository structure, code, config, tests, and documentation
- Identify gaps, missing capabilities, undocumented areas, architectural risks
- Cross-reference against project metadata (`project.yaml`), declared conventions, and industry best practices
- Produce a ranked list of suggestions with rationale, impact assessment, and effort estimate
- Output: A structured suggestion report (not code, not files — just recommendations)

**Mode 2: Specification Generation (write, human-gated)**

- For each _approved_ suggestion, generate appropriate specification artifacts
- ADR for architectural decisions
- PRD for product features
- Functional spec for behavior definitions
- Technical spec for implementation design
- Output: Draft documents placed in the correct `docs/` category paths per `docs.yaml`

### 3.2 Analysis Factors — What It Should Evaluate

The agent should evaluate suggestions across these dimensions:

#### Input Signals (what it reads)

1. **Codebase structure** — file organization, module boundaries, missing layers
2. **Test coverage gaps** — untested code paths, missing integration tests, no E2E tests
3. **Documentation gaps** — code without docs, APIs without specs, decisions without ADRs
4. **Configuration gaps** — missing CI stages, no monitoring, no alerting, no IaC
5. **Security posture** — missing auth, no input validation, no rate limiting, no audit logging
6. **Dependency health** — outdated packages, known vulnerabilities, missing lock files
7. **Project metadata** — declared phase, stack, patterns, compliance requirements vs. actual state
8. **Historical patterns** — recurring issues from `docs/history/issues/`, lessons learned
9. **Existing backlog** — what's already planned in `AGENT_BACKLOG.md` (avoid duplicates)
10. **Industry norms** — common patterns for the declared architecture/stack that are absent

#### Scoring Criteria (how it ranks suggestions)

1. **Impact** — How much does this improve reliability, security, developer experience, or user value?
2. **Effort** — How much work is required? (T-shirt sizing: XS, S, M, L, XL)
3. **Risk of NOT doing it** — What breaks or degrades if this is ignored?
4. **Dependency count** — How many other changes depend on or are blocked by this?
5. **Alignment** — Does this match the project's declared phase, priorities, and constraints?
6. **Novelty** — Is this genuinely missing, or just differently organized?

#### Anti-Signals (what it should NOT suggest)

- Features that contradict the project's declared architecture patterns
- Work that duplicates existing backlog items
- Changes that would break existing API contracts without justification
- Premature optimization for projects in greenfield/active phase
- Compliance requirements not relevant to the project's declared compliance framework

### 3.3 Suggestion Output Format

```yaml
suggestions:
  - id: SUG-001
    category: documentation # documentation | feature | architecture | security | testing | ops
    title: 'Add ADR for task protocol design decisions'
    rationale: >
      The A2A-lite task protocol is a core architectural decision with specific
      tradeoffs (file-based vs. message queue, atomic operations, lock semantics).
      No ADR documents why these choices were made.
    impact: medium
    effort: S
    risk_if_skipped: low # the code works, but rationale will be lost
    alignment: high # docs.yaml defines ADR structure, agents.yaml has docs agent
    suggested_artifacts:
      - type: ADR
        path: docs/architecture/decisions/
        template: adr-template
    depends_on: []
    blocks: []
    status: pending_review # pending_review | approved | rejected | deferred
```

---

## 4. What Should Be Kept Separate vs. Integrated

### 4.1 Keep SEPARATE from existing agents

| Concern                | Why Separate                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Analysis logic**     | The expansion agent's analysis engine (gap detection, scoring, cross-referencing) is fundamentally different from execution. It should be its own module, not bolted onto the product or quality agent.                |
| **Suggestion storage** | Suggestions should live in their own state area (e.g., `.claude/state/suggestions/`) separate from tasks. Suggestions are NOT tasks — they are proposals that may become tasks after approval.                         |
| **Scoring algorithm**  | The ranking/scoring logic should be configurable and separate from the agent definition, allowing projects to tune weights without modifying agent code.                                                               |
| **Approval workflow**  | The approval gate for suggestions must be distinct from the task protocol's status transitions. A suggestion goes through `pending_review → approved/rejected/deferred`, and only approved suggestions generate tasks. |

### 4.2 INTEGRATE with existing systems

| Integration Point           | How                                                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discovery engine**        | The expansion agent should consume discovery output as input, not re-scan the repo independently. Extend `discover.mjs` to export structured data the expansion agent can consume.             |
| **Task protocol**           | When a suggestion is approved, the expansion agent creates tasks via the existing `createTask()` protocol, assigned to appropriate teams (docs, product, backend, etc.).                       |
| **Handoff chains**          | Generated spec documents should trigger handoff chains — e.g., an approved ADR suggestion creates a task for the docs agent, which on completion hands off to the relevant engineering team.   |
| **Orchestrator phases**     | The expansion agent should run during Phase 1 (Discovery) or as a standalone command. It should NOT run during Phase 3 (Implementation) — analysis and execution must be temporally separated. |
| **Documentation structure** | Generated documents must follow `docs.yaml` conventions — correct paths, naming, ADR numbering ranges per team.                                                                                |
| **Review gates**            | Generated specs should go through the existing review process before being considered final.                                                                                                   |
| **Project metadata**        | The agent must read `project.yaml` to understand declared phase, stack, compliance, and process — this is its primary context.                                                                 |
| **Event logging**           | All analysis runs and suggestion state changes must be logged to `events.log` for auditability.                                                                                                |
| **Backlog**                 | Approved suggestions should appear in `AGENT_BACKLOG.md` as planned work items.                                                                                                                |

### 4.3 Architectural Boundary

```
┌─────────────────────────────────────────────────┐
│                 Expansion Agent                  │
│                                                  │
│  ┌──────────────┐   ┌──────────────────────┐    │
│  │ Analysis     │   │ Spec Generator       │    │
│  │ Engine       │   │ (ADR/PRD/Func/Tech)  │    │
│  │              │   │                      │    │
│  │ - Gap detect │   │ - Template rendering │    │
│  │ - Scoring    │   │ - Doc placement      │    │
│  │ - Ranking    │   │ - Cross-referencing  │    │
│  └──────┬───────┘   └──────────┬───────────┘    │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌──────────────┐   ┌──────────────────────┐    │
│  │ Suggestion   │   │ Approval Gate        │    │
│  │ Store        │   │ (human-in-the-loop)  │    │
│  │ .claude/     │   │                      │    │
│  │ state/       │   │ pending → approved   │    │
│  │ suggestions/ │   │        → rejected    │    │
│  └──────────────┘   │        → deferred    │    │
│                      └──────────┬───────────┘    │
└─────────────────────┬───────────┘────────────────┘
                      │
          ┌───────────▼───────────┐
          │  Existing Systems     │
          │                       │
          │  - Task Protocol      │
          │  - Handoff Chains     │
          │  - Team Routing       │
          │  - Review Gates       │
          │  - Event Log          │
          │  - Backlog            │
          └───────────────────────┘
```

---

## 5. Human-in-the-Loop Controls

This is the most critical design consideration. An agent that suggests new work has an inherent bias toward generating more work. Without strong controls, it becomes a noise generator.

### 5.1 Control Points

| Control                   | Description                                                                                                                         | Implementation                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Explicit invocation**   | The agent NEVER runs automatically. It must be explicitly triggered via `/expand` or `/analyze` command.                            | Add to `commands.yaml` as a non-workflow command. No auto-trigger in orchestrator phases. |
| **Suggestion-not-action** | The agent produces suggestions, never directly creates tasks, writes code, or modifies files (in analysis mode).                    | Separate analysis output from execution. Suggestions are inert data until approved.       |
| **Batch approval**        | Humans review the full suggestion list and approve/reject/defer each item individually.                                             | Interactive approval UI or markdown-based review (checkboxes in a generated file).        |
| **Scope limits**          | Configurable maximum number of suggestions per run (default: 10). Prevents overwhelming output.                                     | Config in `project.yaml` or command flag: `--max-suggestions 10`.                         |
| **Category filters**      | Humans can restrict analysis to specific categories (e.g., only documentation gaps, only security).                                 | Command flags: `--category documentation,security`.                                       |
| **Confidence threshold**  | Only surface suggestions above a configurable confidence/impact threshold.                                                          | Flag: `--min-impact medium`. Low-confidence suggestions are logged but not displayed.     |
| **Diff preview**          | Before generating any spec document, show a preview of what would be created (title, path, outline).                                | Two-phase: first show plan, then generate on confirmation.                                |
| **Audit trail**           | Every analysis run, every suggestion, every approval/rejection is logged with timestamp and rationale.                              | Events logged to `events.log`. Suggestion state changes tracked in suggestion files.      |
| **Rejection memory**      | Previously rejected suggestions are remembered and not re-suggested unless the codebase changes significantly in the relevant area. | Store rejection history in `.claude/state/suggestions/rejected/` with fingerprints.       |
| **Rate limiting**         | Prevent running the analysis more than N times per session/day to avoid analysis paralysis.                                         | Session-scoped counter in orchestrator state.                                             |

### 5.2 Approval Workflow

```
Human runs: /expand --category documentation,architecture

Agent produces:
  ┌─────────────────────────────────────────────┐
  │ EXPANSION ANALYSIS REPORT                   │
  │                                              │
  │ Found 7 suggestions (filtered from 12)       │
  │ Categories: documentation (4), arch (3)      │
  │                                              │
  │ [ ] SUG-001: Add ADR for task protocol       │
  │     Impact: medium | Effort: S | Risk: low   │
  │                                              │
  │ [ ] SUG-002: Create PRD for expansion agent  │
  │     Impact: high | Effort: M | Risk: medium  │
  │                                              │
  │ [ ] SUG-003: Document orchestrator phases    │
  │     Impact: medium | Effort: S | Risk: low   │
  │     ...                                      │
  └─────────────────────────────────────────────┘

Human reviews, marks approved items.

Agent ONLY THEN generates specs for approved items:
  → Creates tasks via task protocol
  → Assigns to appropriate teams
  → Generates draft documents
  → Triggers review gates
```

### 5.3 What the Agent Must NEVER Do Without Approval

1. Create tasks in the task queue
2. Write files to the repository
3. Modify existing documentation
4. Change backlog priorities
5. Trigger handoff chains
6. Modify orchestrator state
7. Run implementation commands
8. Push changes to git

---

## 6. Generating ADR/PRD/Func/Tech Spec Documentation — Assessment

### 6.1 Is This a Good Idea?

**Yes, with caveats.**

**Why it's good:**

- The repository already defines a complete documentation hierarchy in `docs.yaml`
- Templates and conventions exist for ADRs, PRDs, and engineering docs
- Having structured specs improves onboarding, decision tracking, and alignment
- Auto-generating _draft_ specs from analysis reduces the manual overhead of documentation
- The docs agent already has the infrastructure to manage these documents

**Why it needs caution:**

- Generated specs are only as good as the analysis — hallucinated requirements are worse than no requirements
- Spec proliferation creates maintenance burden — every generated doc must be maintained
- Draft quality varies — some suggestions will produce excellent specs, others will be too generic
- Generated ADRs risk losing the _actual_ decision context that only humans possess

### 6.2 Recommended Approach

1. **Generate drafts, not finals** — All generated specs are explicitly marked as `Status: Draft` and require human review before being considered authoritative
2. **Prefer ADRs and gap-fill docs** — These have the highest value-to-risk ratio. ADRs document decisions already made (just not written down). Gap docs fill obvious holes.
3. **Be cautious with PRDs** — PRDs define _what to build_, which requires product judgment the agent doesn't have. Generate PRD _templates_ with questions, not PRDs with answers.
4. **Technical specs should be outlines** — Generate the structure (sections, concerns to address, interfaces to define) but not the content. The implementing team fills in details.
5. **Always cross-reference** — Every generated doc must reference the suggestion ID, the analysis that triggered it, and existing related docs. No orphan documents.

### 6.3 Template Strategy

```
Expansion Agent generates:
  ├── ADR → Full draft (decision, context, consequences)
  │         because the information exists in the codebase
  │
  ├── PRD → Structured template with questions
  │         because product decisions need human input
  │
  ├── Functional Spec → Behavior outline with acceptance criteria skeleton
  │                      because behavior needs validation
  │
  └── Technical Spec → Section outline with interface signatures
                        because implementation details need engineering input
```

---

## 7. Risk Analysis

### 7.1 Risks of Implementing

| Risk                                                                               | Severity | Mitigation                                                             |
| ---------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| **Suggestion fatigue** — Agent generates too many low-value suggestions            | High     | Confidence threshold, category filters, max suggestions limit          |
| **Hallucinated gaps** — Agent identifies "gaps" that aren't actually gaps          | Medium   | Cross-reference with project.yaml declared scope; human review gate    |
| **Scope creep** — Expansion agent gradually takes over product decisions           | High     | Hard boundary: suggestions only, never autonomous action               |
| **Maintenance burden** — Generated docs become stale quickly                       | Medium   | Generated docs flagged as drafts; staleness checks in review           |
| **Analysis paralysis** — Teams spend more time reviewing suggestions than building | Medium   | Rate limiting, session-scoped run limits                               |
| **Duplicate work** — Suggestions overlap with existing backlog or in-progress work | Low      | Cross-reference AGENT_BACKLOG.md, active tasks, and suggestion history |

### 7.2 Risks of NOT Implementing

| Risk                                                                                    | Severity | Notes                                                     |
| --------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| **Undocumented decisions** — Architecture decisions go unrecorded                       | Medium   | Already happening — no ADRs exist for core design choices |
| **Blind spots** — Teams don't notice missing test coverage, security gaps, or doc holes | Medium   | Project completeness assessment partially covers this     |
| **Reactive-only improvement** — Issues are found in production, not during development  | Low      | Review gates catch some of this                           |

---

## 8. Implementation Recommendation

### 8.1 Phase the Implementation

**Phase 1: Analysis Engine Only (Low Risk)**

- Build the gap analysis engine as a standalone module
- Output: structured JSON/YAML suggestion report to stdout
- No file writes, no task creation, no integration with orchestrator
- Command: `/expand analyze [--category X] [--max-suggestions N]`
- This validates the analysis quality before building the full pipeline

**Phase 2: Suggestion Storage & Approval (Medium Risk)**

- Add suggestion persistence in `.claude/state/suggestions/`
- Add approval workflow (approve/reject/defer)
- Add rejection memory to avoid re-suggesting
- Command: `/expand review` to approve/reject suggestions

**Phase 3: Spec Generation (Medium Risk)**

- Add template-based document generation for approved suggestions
- Integrate with docs.yaml paths and conventions
- Generated docs marked as Draft status
- Command: `/expand generate [--suggestion SUG-001]`

**Phase 4: Full Integration (Higher Risk)**

- Connect to task protocol for approved+generated items
- Add handoff chain integration
- Add event logging and backlog sync
- Add to orchestrator Phase 1 as optional step

### 8.2 Phase Gates — When to Proceed

Each phase has explicit go/no-go criteria. Do not begin a phase until the
previous phase's gate conditions are met.

#### Gate 1: Phase 1 → Phase 2 (Analysis → Suggestion Store)

Run the analysis engine against **3+ real repositories** and validate:

- **Signal-to-noise ≥ 70%** — At least 70% of suggestions rated "useful" by a
  human reviewer. Below 50% means the analyzer design needs rework.
- **Category spread ≥ 3/6** — Suggestions cover at least 3 of the 6 categories
  (documentation, feature, architecture, security, testing, ops).
- **Dedup accuracy < 10% overlap** — Less than 10% of suggestions duplicate
  existing backlog items or each other.
- **Scoring matches intuition** — Top-3 ranked suggestions align with what a
  developer would independently identify as highest-impact gaps.
- **False positive rate < 20%** — Less than 20% of identified "gaps" aren't
  actually gaps.
- **Performance < 60s** — Analysis completes in under 60 seconds for a 10K-file
  repository.

#### Gate 2: Phase 2 → Phase 3 (Suggestion Store → Spec Generation)

Use the approval workflow for **2+ review cycles** and validate:

- **Approval rate ≥ 40%** — At least 40% of suggestions are approved (not
  rejected or deferred). Below 25% signals analysis quality problems.
- **Rejection memory works** — Zero re-surfaced rejected suggestions unless the
  codebase changed in the relevant area.
- **Workflow friction < 5 min** — Reviewing and approving/rejecting 10
  suggestions takes less than 5 minutes.
- **Downstream utility ≥ 2** — At least 2 approved suggestions have been
  manually converted into tasks or documents (proving the suggestions lead to
  real work).

#### Gate 3: Phase 3 → Phase 4 (Spec Generation → Full Integration)

Generate **5+ draft documents** from approved suggestions and validate:

- **Draft quality ≥ 60% minor-edit** — At least 60% of generated drafts need
  only minor edits, not complete rewrites.
- **Template fitness** — Generated docs land in correct paths with correct
  naming per docs.yaml conventions.
- **Hallucination rate < 10%** — Less than 10% of generated content contains
  fabricated requirements or wrong cross-references.
- **Review gate pass rate ≥ 50%** — At least half of generated specs pass the
  existing review-runner on first submission.
- **No orphan docs** — Generated documents don't go stale within 30 days.

#### Stopping Conditions (Abandon Further Phases)

Stop investment entirely if:

- Signal-to-noise stays below 50% after two rounds of analyzer tuning
- Developers don't voluntarily use `/expand` after the trial period
- Approval rate stays below 15% (suggestion fatigue)
- Time reviewing suggestions exceeds time saved by automated identification

### 8.3 New Files and Spec Additions (unchanged)

```
New modules:
  .agentkit/engines/node/src/expansion-analyzer.mjs    — Core analysis engine
  .agentkit/engines/node/src/suggestion-store.mjs      — Suggestion CRUD + state
  .agentkit/engines/node/src/spec-generator.mjs        — Template-based doc generation

Spec additions:
  .agentkit/spec/agents.yaml      — Add expansion-analyst agent definition
  .agentkit/spec/commands.yaml    — Add /expand command with subcommands
  .agentkit/spec/teams.yaml       — Add expansion to product team's scope (or new team)

State additions:
  .claude/state/suggestions/      — Suggestion JSON files
  .claude/state/suggestions/rejected/  — Rejection history with fingerprints

Test additions:
  .agentkit/engines/node/src/__tests__/expansion-analyzer.test.mjs
  .agentkit/engines/node/src/__tests__/suggestion-store.test.mjs
  .agentkit/engines/node/src/__tests__/spec-generator.test.mjs
```

### 8.4 Agent Definition (Draft)

```yaml
- id: expansion-analyst
  category: product
  name: Expansion Analyst
  role: >
    Strategic analysis agent that identifies gaps, missing capabilities,
    undocumented decisions, and improvement opportunities in the codebase.
    Produces ranked suggestions with rationale and can generate draft
    specification documents for approved suggestions. Never acts
    autonomously — all suggestions require explicit human approval
    before any downstream action occurs.
  accepts:
    - analyze
  depends-on:
    - product # for context on product direction
    - quality # for code quality signals
    - docs # for documentation state
  notifies:
    - product # suggestions that affect product scope
    - docs # suggestions that require documentation
  focus:
    - '**/*' # reads everything, writes nothing (in analysis mode)
  responsibilities:
    - Analyze codebase for gaps in documentation, testing, security, and architecture
    - Cross-reference actual state against declared project metadata and conventions
    - Produce ranked, scored suggestions with clear rationale
    - Generate draft specification documents for approved suggestions only
    - Maintain suggestion history and rejection memory
    - Never create tasks, write code, or modify files without explicit approval
  domain-rules:
    - 'All suggestions must include rationale, impact score, effort estimate, and risk assessment'
    - 'Never re-suggest previously rejected items unless codebase changes in the relevant area'
    - 'Generated documents must be marked as Draft status'
    - 'Cross-reference existing backlog before suggesting to avoid duplicates'
    - "Respect project phase — don't suggest scaling work for greenfield projects"
```

---

## 9. Summary of Key Decisions

| Question                                         | Recommendation                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Should we build this?                            | **Yes**, phased approach starting with analysis-only                                                                               |
| Should it generate full ADR/PRD/func/tech specs? | **ADR drafts yes, PRD templates yes, func/tech outlines yes, full specs no**                                                       |
| Should it be a separate agent?                   | **Yes** — separate agent, separate storage, separate approval flow                                                                 |
| How does it integrate?                           | **Consumes** discovery output, **produces** suggestions, **creates tasks** only after approval via existing task protocol          |
| How do we keep humans in control?                | **Explicit invocation, suggestion-not-action, batch approval, scope limits, confidence thresholds, rejection memory, audit trail** |
| What's the biggest risk?                         | **Suggestion fatigue and hallucinated gaps** — mitigated by scoring thresholds and human review gates                              |
