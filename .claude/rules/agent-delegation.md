# Agent Delegation Rules

## Test Writing

- After implementation changes are complete, delegate test authoring to `/team-testing`
- Do not write tests inline during a bug fix or feature, except to update a stale assertion directly caused by the same edit
- Rationale: TESTING is specialized; inline test-writing consumes session context without adding value over delegation

## Updating Agent Instructions

- When asked how to update Claude's conduct, rules, or CLAUDE.md, divert immediately to `/team-forge` or `/claude-md-management:revise-claude-md`
- Do not self-answer the question or offer to edit instruction files directly
- Rationale: instruction authorship belongs to the user and forge agents, not to the agent being instructed
