# ADR-12: Introduce Expansion Analyst Agent

## Status

**Accepted**

## Date

2026-03-04

## Context

Retort has excellent execution infrastructure — orchestrator, task protocol,
team routing, review gates, handoff chains — but lacks a strategic analysis layer
that identifies **what is missing** from a repository. The discovery engine reports
what exists; nothing systematically identifies gaps in documentation, testing,
security posture, or architectural completeness.

Several existing agents touch adjacent concerns (retrospective analyst extracts
lessons, quality agent reviews code, product agent manages PRDs), but none
proactively scans the codebase to produce ranked, actionable suggestions for
improvements, missing specs, or undocumented decisions.

Key forces:

- Teams routinely miss documentation gaps, untested code paths, and missing ADRs
  because no systematic gap-detection mechanism exists.
- The `project-completeness.mjs` engine scores project metadata completeness but
  does not analyze the actual codebase for structural or content gaps.
- Generated specification documents (ADR, PRD, functional/technical specs) would
  reduce the manual overhead of documentation, but carry risk of hallucinated
  requirements and maintenance burden.
- Any agent that **suggests new work** has an inherent bias toward generating more
  work, requiring stronger human-in-the-loop controls than execution agents.

## Decision

We will introduce an **Expansion Analyst** agent, implemented in four phases:

1. **Phase 1 (current)**: Analysis engine only — read-only gap detection that
   produces scored, ranked suggestions as structured output. No file writes, no
   task creation, no orchestrator integration.
2. **Phase 2**: Suggestion persistence and approval workflow — store suggestions
   in `.claude/state/suggestions/`, add approve/reject/defer lifecycle.
3. **Phase 3**: Specification generation — template-based draft document creation
   for approved suggestions (ADRs, PRD templates, functional/technical outlines).
4. **Phase 4**: Full integration — connect to task protocol, handoff chains, event
   logging, and orchestrator Phase 1 as an optional step.

### Design Principles

- **Suggestions, not actions**: The agent produces recommendations. It never
  autonomously creates tasks, writes code, or modifies files without explicit
  human approval.
- **Explicit invocation only**: Triggered via `/expand` command. Never runs
  automatically during orchestration phases.
- **Separate storage**: Suggestions live in `.claude/state/suggestions/`, distinct
  from the task protocol. Suggestions are proposals, not tasks.
- **Consume, don't duplicate**: The analysis engine consumes discovery output and
  project metadata rather than re-scanning the repository independently.
- **Rejection memory**: Previously rejected suggestions are remembered and not
  re-surfaced unless the codebase changes significantly in the relevant area.
- **Configurable thresholds**: Maximum suggestion count, minimum impact level,
  and category filters are all configurable per invocation.

## Phase Gates

Each phase requires explicit validation before proceeding to the next. These
gates prevent over-investment in infrastructure before the core analysis quality
is proven.

### Gate 1 → Phase 2 (Suggestion Storage & Approval)

**Trigger**: Phase 1 analysis engine has been run against **3+ real repositories**
and the following criteria are met:

| Criterion                  | Threshold                                                                                           | How to Measure                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Signal-to-noise ratio**  | ≥ 70% of suggestions rated "useful" by a human reviewer                                             | Run analysis, have a developer rate each suggestion as useful/noise |
| **Category coverage**      | Suggestions span ≥ 3 of 6 categories (documentation, feature, architecture, security, testing, ops) | Check category distribution in output                               |
| **Deduplication accuracy** | < 10% of suggestions duplicate existing backlog items or each other                                 | Cross-reference output against AGENT_BACKLOG.md                     |
| **Scoring coherence**      | Top-3 ranked suggestions match human intuition about highest-impact gaps                            | Compare agent ranking to developer ranking                          |
| **False positive rate**    | < 20% of suggestions identify "gaps" that aren't actually gaps                                      | Developer review flags false positives                              |
| **Performance**            | Analysis completes in < 60 seconds for a 10K-file repo                                              | Time the run                                                        |

**Decision**: If these thresholds are met, proceed to Phase 2. If signal-to-noise
is below 50%, revisit the analyzer design before continuing.

### Gate 2 → Phase 3 (Spec Generation)

**Trigger**: Phase 2 suggestion store has been used for **2+ approval cycles**
and the following criteria are met:

| Criterion                  | Threshold                                                                                | How to Measure                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Approval rate**          | ≥ 40% of suggestions are approved (not rejected/deferred)                                | Track approve/reject/defer counts in suggestion store          |
| **Rejection memory works** | 0 re-surfaced previously-rejected suggestions (unless codebase changed in relevant area) | Check rejected/ directory fingerprints against new suggestions |
| **Workflow friction**      | Approval workflow completes in < 5 minutes for a batch of 10 suggestions                 | Time the review cycle                                          |
| **Downstream utility**     | ≥ 2 approved suggestions have been manually converted to tasks or documents              | Track whether approvals lead to actual work                    |

**Decision**: If approved suggestions are consistently leading to real work,
the spec generation layer adds value. If approval rate is below 25%, the
analysis quality needs improvement — return to Phase 1 tuning.

### Gate 3 → Phase 4 (Full Integration)

**Trigger**: Phase 3 spec generation has produced **5+ draft documents** and
the following criteria are met:

| Criterion                        | Threshold                                                                                 | How to Measure                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Draft quality**                | ≥ 60% of generated drafts require only minor edits (not rewrites)                         | Human reviewer rates each draft as minor-edit / major-rewrite / unusable |
| **Template fitness**             | Generated docs follow docs.yaml conventions (correct paths, naming, numbering)            | Automated validation against docs.yaml                                   |
| **No hallucinated requirements** | < 10% of generated content contains fabricated requirements or incorrect cross-references | Human review flags hallucinations                                        |
| **Review gate pass rate**        | ≥ 50% of generated specs pass existing review gates on first submission                   | Track review-runner results                                              |
| **Maintenance cost**             | Generated docs don't create orphan/stale documents within 30 days                         | Check for staleness after one month                                      |

**Decision**: If generated specs are consistently useful and pass review gates,
full integration with task protocol and orchestrator is justified. If draft
quality is below 40%, the generation templates need rework — stay in Phase 3.

### Stopping Conditions

Development should **stop entirely** if any of the following are observed:

- **Analysis produces mostly noise**: Signal-to-noise ratio stays below 50% after
  two rounds of analyzer tuning
- **No one uses it**: The `/expand` command is not invoked voluntarily by
  developers after the initial trial period
- **Suggestion fatigue**: Developers consistently defer or ignore suggestions
  rather than engaging with them (approval rate stays below 15%)
- **Negative ROI**: Time spent reviewing suggestions exceeds time saved by
  having them identified automatically

## Consequences

### Positive

- Systematic identification of documentation, testing, security, and architecture gaps
- Reduced manual overhead for creating specification documents
- Cross-referencing against project metadata catches misalignment between declared and actual state
- Phased rollout lets us validate analysis quality before building the full pipeline
- Structured suggestion format enables tracking, prioritization, and audit trails

### Negative

- Risk of suggestion fatigue if thresholds are set too low
- Generated specifications may contain hallucinated requirements that require careful human review
- Adds a new agent category (analysis/strategy) that must be maintained alongside execution agents
- The scoring algorithm requires tuning per project to avoid low-value noise

### Neutral

- The expansion analyst occupies a new niche between the existing product and quality agents
- Suggestion storage introduces a new state directory that must be managed

## Alternatives Considered

### Extend the Retrospective Analyst

- Pros: Already exists, captures issues and lessons
- Cons: Retrospective by nature — looks backward at what happened, not forward at what's missing. Different analysis mode.
- Why rejected: The expansion analyst's gap-detection and scoring engine is fundamentally different from retrospective analysis.

### Extend the Quality Agent

- Pros: Already reviews code quality and suggests enhancements
- Cons: Quality agent focuses on existing code quality, not missing capabilities or documentation gaps. Adding strategic analysis would bloat its responsibilities.
- Why rejected: Separation of concerns — execution review vs. strategic gap analysis are distinct roles.

### Extend Project Completeness Scoring

- Pros: Already scores metadata completeness
- Cons: Only checks project.yaml fields, not actual codebase content. Would need a complete rewrite to analyze code, docs, tests, and config.
- Why rejected: Project completeness is a metadata validator, not a codebase analyzer.

### Do Nothing — Rely on Manual Identification

- Pros: Zero implementation cost, humans maintain full control
- Cons: Gaps are routinely missed, documentation debt accumulates, no systematic process
- Why rejected: The gap is real and growing. Manual identification doesn't scale.

## References

- Feasibility analysis: `docs/architecture/expansion-agent-analysis.md`
- Task protocol: `.agentkit/engines/node/src/task-protocol.mjs`
- Discovery engine: `.agentkit/engines/node/src/discover.mjs`
- Project completeness: `.agentkit/engines/node/src/project-completeness.mjs`
