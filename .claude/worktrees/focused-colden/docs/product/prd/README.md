# PRD Library

Product Requirement Documents for Retort and projects using it.

---

## About PRDs

PRDs (Product Requirement Documents) define the "what" and "why" of features before implementation begins. They serve as the authoritative reference for scope, requirements, success criteria, and acceptance tests.

## PRD Location

PRDs are stored in `docs/product/` using the naming convention:

```text
PRD-{NNN}-{slug}.md
```

Where `{NNN}` is a zero-padded sequential number and `{slug}` is a lowercase-hyphenated summary.

## Available PRDs

| PRD                                                                | Title                                     | Status |
| ------------------------------------------------------------------ | ----------------------------------------- | ------ |
| [PRD-001](../PRD-001-llm-decision-engine.md)                       | LLM Decision Engine                       | Active |
| [PRD-002](../PRD-002-llm-selection-scorecard-guide.md)             | LLM Selection Scorecard Guide             | Active |
| [PRD-003](../PRD-003-agent-to-llm-weighted-matrix-config-guide.md) | Agent-to-LLM Weighted Matrix Config Guide | Active |
| [PRD-005](../PRD-005-mesh-native-distribution.md)                  | Mesh-Native Distribution                  | Draft  |
| [PRD-006](../PRD-006-pwa-desktop-visual-configuration.md)          | PWA/Desktop Visual Configuration          | Draft  |
| [PRD-007](../PRD-007-adopter-autoupdate.md)                        | Adopter Autoupdate                        | Draft  |

## Current P1 product backlog

From the [Agent Backlog](../../AGENT_BACKLOG.md) (synced from GitHub), the following P1 items are assigned to product and not yet covered by a PRD:

| Issue                                                             | Title                                                                   | Notes                                                                                                                                                                             |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GH#371](https://github.com/JustAGhosT/retort/issues/371) | fix(state): state cleanup, validation, session-start directory creation | Agent state management: ensure directories exist, clean stale tasks, validate state. **Plan:** [PLAN-gh371](../../planning/PLAN-gh371-state-cleanup-validation-session-start.md). |
| [GH#328](https://github.com/JustAGhosT/retort/issues/328) | fix(budget-guard): verify and address budget-guard workflow logic       | Budget-guard workflow step logic issues from test execution                                                                                                                       |

Consider drafting PRDs for these when scope is stable. An implementation plan exists for GH#371; GH#328 can have a plan added when scope is agreed.

## Creating a New PRD

1. Use the next sequential number (e.g. after PRD-007 the next is **008**): `PRD-008-{descriptive-slug}.md`
2. Place the file in `docs/product/`
3. Include at minimum: Problem Statement, Goals, Non-Goals, Requirements, Success Criteria, and Acceptance Tests
4. Link the PRD from this index

## Related Documentation

- [Product Overview](../README.md) — Product vision and strategy
- [User Stories](../02_user_stories.md) — User stories derived from PRDs
- [Roadmap](../03_roadmap.md) — Feature timeline and prioritization
- [Implementation plans](../../planning/README.md) — Planning docs (e.g. PLAN-gh371) for P1/P2 items
