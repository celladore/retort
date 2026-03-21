# Router Integration Governance Rollout Tracker

## Scope

Issue-first governance rollout for router-specialist integration with no direct implementation changes in `.agentkit` templates/spec in this phase.

## Milestone

- Repository: `phoenixvc/retort`
- Milestone: `Router Integration Governance Rollout` (`#1`)

## Epic and child issues

- Epic: #159 — [Issue #159](https://github.com/phoenixvc/retort/issues/159)
- A: #160 — [Issue #160](https://github.com/phoenixvc/retort/issues/160)
- B: #161 — [Issue #161](https://github.com/phoenixvc/retort/issues/161)
- C: #162 — [Issue #162](https://github.com/phoenixvc/retort/issues/162)
- D: #163 — [Issue #163](https://github.com/phoenixvc/retort/issues/163)
- E: #164 — [Issue #164](https://github.com/phoenixvc/retort/issues/164)
- F: #165 — [Issue #165](https://github.com/phoenixvc/retort/issues/165)
- G: #166 — [Issue #166](https://github.com/phoenixvc/retort/issues/166)

## Branch governance rollout (new)

- Tracker: #167 — [Issue #167](https://github.com/phoenixvc/retort/issues/167)
- Policy: #168 — [Issue #168](https://github.com/phoenixvc/retort/issues/168)
- Infrastructure: #169 — [Issue #169](https://github.com/phoenixvc/retort/issues/169)
- Immediate guardrail: #170 — [Issue #170](https://github.com/phoenixvc/retort/issues/170)

## Dependency map

- #160 blocked by #159
- #161 blocked by #160
- #162 blocked by #160
- #163 blocked by #160
- #164 blocked by #161, #162, #163
- #165 blocked by #161
- #166 blocked by #164, #165
- #168 blocked by #167
- #169 blocked by #167
- #170 blocked by #167

Dependency links are also recorded as GitHub issue comments (`Blocked by: ...`) on each issue for machine-searchable traceability.

## Required closure checklist language (for every child issue)

Each child issue must include and satisfy this closure gate before status moves to done:

- [ ] Evidence references include all render targets: `claude`, `cursor`, `windsurf`, `copilot`, `gemini`, `codex`, `roo`, `cline`, `warp`, `ai`, `mcp`.
- [ ] Dependency/blocker references are present and current.
- [ ] Milestone remains assigned.
- [ ] Scope remains issue-first governance (no direct implementation edits in this phase).

## Plan decisions (locked)

- Issue-first governance only in `retort` for this phase.
- One dedicated milestone for coordinated execution.
- Full render-target matrix is in scope.
- FinOps scope includes rule domain + Phase 1 spec doc + skill note.
- ai-gateway scope includes guidance + command-docs contract; runtime flags deferred.
- Branch-governance rollout tracked via #167/#168/#169 and linked from #159.

## Backlog registration note

`AGENT_BACKLOG.md` is generated and marked `DO NOT EDIT`; direct manual row insertion is intentionally avoided. Dependency and status tracking for this rollout is therefore recorded in milestone issue metadata and this tracker document until source-spec-driven backlog generation is updated.

## Ready-to-implement file map

- See [governance_issue_file_impact_map.md](governance_issue_file_impact_map.md) for exact per-issue file targets.
