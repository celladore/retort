# ADR-08: Introduce Expansion Analyst Agent

## Status

**Accepted**

## Date

2026-03-04

## Context

AgentKit Forge has excellent execution infrastructure — orchestrator, task protocol,
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

- Feasibility analysis: `docs/03_architecture/expansion-agent-analysis.md`
- Task protocol: `.agentkit/engines/node/src/task-protocol.mjs`
- Discovery engine: `.agentkit/engines/node/src/discover.mjs`
- Project completeness: `.agentkit/engines/node/src/project-completeness.mjs`
