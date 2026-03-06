# PRD Library

Product Requirement Documents for AgentKit Forge and projects using it.

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

## Creating a New PRD

1. Copy the numbering convention: `PRD-{next number}-{descriptive-slug}.md`
2. Place the file in `docs/product/`
3. Include at minimum: Problem Statement, Goals, Non-Goals, Requirements, Success Criteria, and Acceptance Tests
4. Link the PRD from this index

## Related Documentation

- [Product Overview](../README.md) — Product vision and strategy
- [User Stories](../02_user_stories.md) — User stories derived from PRDs
- [Roadmap](../03_roadmap.md) — Feature timeline and prioritization
