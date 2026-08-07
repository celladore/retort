# Native agent dispatch Launch - Historical Summary

**Launched**: 2026-08-07
**PR**: #574
**Feature Type**: New Feature

## Feature Overview

Retort generated 38 agent personas into `.claude/agents/*.md` and **none of them was
registrable**. Every file opened with an HTML comment instead of YAML frontmatter, so
Claude Code scanned and skipped all 38. This work makes them real, dispatchable subagents
and reconciles the two delegation protocols that had been documented side by side without
either one executing.

## User Problem Solved

Three things were broken and only the first was visible.

1. **The task delegation protocol was role-play.** `orchestrate.md` specified a task JSON
   lifecycle with `dependsOn`/`blockedBy` derivation, DFS cycle detection with SHA-256
   cycle IDs, lock leasing with TTL, two-phase commit, and `HANDOFF_DEPTH_EXCEEDED`
   events. All of it ran inside a single main-thread context writing JSON files to itself.
   No second agent ever ran, so none of the concurrency machinery was exercised.

2. **The spec was far ahead of the emitter.** `accepts`, `depends-on`, `notifies`,
   `handoff-chain`, `decision-model`, `retry-policy`, `negotiation`, `lookahead`, and
   `confidence` were all modelled in YAML and all rendered as prose. They described a
   runtime that did not exist.

3. **The worktree isolation rule could not be followed.** It told callers to pass
   `isolation: "worktree"` to the Agent tool, and its own worked example dispatched
   `feature-dev:code-architect` — a plugin agent — because no retort agent was
   dispatchable.

The runtime capability was never the gap. Claude Code subagents already nest. The gap was
emission.

## Implementation Details

### Architecture

Guardrails are **derived from spec fields that already existed** rather than authored
twice. `accepts` already classified each agent's task types; it became the source for both
runtime guarantees:

- No write-capable type in `accepts` → `disallowedTools: Write, Edit, NotebookEdit`.
- A code-writing type in `accepts` → `isolation: worktree`.

That turns the worktree rule from an instruction the caller must remember into a property
of the agent definition, and makes read-only agents structurally read-only.

Restriction is **subtractive**. Agents inherit the full subagent toolset and lose
capability explicitly. Promoting the existing `preferred-tools` field to a `tools:`
allowlist would have silently stripped `Agent`, `TodoWrite`, `WebSearch`, `Skill`, and
every MCP tool from all 38 agents — disabling nesting repo-wide as a side effect of
reinterpreting data that was never written for that purpose.

### Components

- **`var-builders.mjs`** — `deriveAgentDescription`, `deriveAgentIsolation`,
  `deriveDisallowedTools`, `deriveCanDispatch`, `deriveAgentTools`,
  `resolveMaxSubagentSpawnDepth`, `resolveDispatchMode`, `buildTeamDispatchTable`. Pure
  functions, unit-tested in isolation.
- **`templates/claude/agents/TEMPLATE.md`** — the frontmatter block. One template change
  converted 38 documents into 38 agents.
- **`platform-syncer.mjs`** — warns when a rendered agent does not begin with `---`, and
  builds the `env` block in `syncClaudeSettings`.
- **`spec-validator.mjs`** — `validateAgentDispatch` plus spawn-depth bounds.
- **`orchestrate.md` / `team-TEMPLATE.md`** — the reconciled protocol.

### API Changes

New spec surface, all optional and backwards compatible:

| Where           | Key                        | Default     | Effect                                  |
| --------------- | -------------------------- | ----------- | --------------------------------------- |
| `agents/*.yaml` | `dispatch.when-to-use`     | derived     | `description:` — the delegation trigger |
| `agents/*.yaml` | `dispatch.can-dispatch`    | by category | withholds or grants the `Agent` tool    |
| `agents/*.yaml` | `dispatch.tools-mode`      | `inherit`   | `inherit` or `allowlist`                |
| `agents/*.yaml` | `dispatch.model`           | `inherit`   | `model:`                                |
| `agents/*.yaml` | `dispatch.isolation`       | `auto`      | overrides the `accepts` derivation      |
| `agents/*.yaml` | `dispatch.background`      | unset       | `background:`                           |
| `agents/*.yaml` | `dispatch.color`           | by category | `color:`                                |
| `teams.yaml`    | `max-subagent-spawn-depth` | `2`         | `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`  |
| `settings.yaml` | `dispatch.mode`            | `native`    | `native` or `task-file`                 |

### Database Changes

None.

## User Experience

`/orchestrate` now writes the task file and then dispatches a real subagent with the
`taskId`. The subagent works in its own context window and returns a summary; the task
file is what survives the session. `/team-<name>` invoked directly still scans the queue
as before.

### UI Changes

None — this is a CLI/agent framework.

### Documentation

- [ADR-11](../../architecture/decisions/11-native-agent-dispatch.md) — the decision, now
  Accepted, with an Implementation Notes section recording where the decision and the
  shipped code diverged.
- [Implementation spec](../../planning/agents-teams/agent-dispatch-capability.md) — schema,
  derivation rules, phasing, test plan, and inline corrections.
- Session handoffs [2026-08-07-02](../../handoffs/2026-08-07-02.md) and
  [2026-08-07-03](../../handoffs/2026-08-07-03.md).

## Rollout Plan

Four phases, each independently revertible. Phase 1 alone resolved the blocking defect.

### Phasing

- **Phase 1** — Frontmatter emitter: `name`, `description`, `color`, `model`. 38 agents
  became invocable. Verified live: Claude Code registered `backend`, `security-auditor`,
  `test-lead` and 35 others mid-session.
- **Phase 2** — Guardrails derived from `accepts`. 14 agents got `isolation: worktree`, 18
  became structurally read-only, enforced by the runtime as "All tools except Write, Edit,
  NotebookEdit".
- **Phase 3** — The full `dispatch:` block, `can-dispatch` defaults by category, and
  `max-subagent-spawn-depth` → `settings.json` env.
- **Phase 4** — Protocol reconciliation in `orchestrate.md` and `team-TEMPLATE.md`, behind
  `dispatch.mode`.

### Monitoring

The `[METRICS]` lines the team template already emits (`session_start`, `task_complete`,
`task_failed`) now come from real subagents rather than from the main thread narrating
itself, so per-team task counts become meaningful for the first time.

## Results

- 38 agents registrable; **13** hold the `Agent` tool, **25** carry `disallowedTools:
Agent`. Phase 3 narrowed capability — before it, all 38 inherited `Agent`.
- Model routing live: 4 agents on `haiku`, 5 on `opus`, 29 inheriting. This makes the
  `aicost-model-routing` rule executable rather than advisory.
- Spawn depth capped at 2, deliberately **not** derived from `max-handoff-chain-depth`
  (which infers 7 here). A handoff chain runs one agent at a time and costs additively; a
  spawn tree nests and multiplies.
- All 13 teams resolve to at least one agent — 8 previously resolved to none.
- Two repo-wide CI workflows repaired (see below).

### Usage Statistics

Not yet measurable — the feature ships with this PR.

### User Feedback

None yet.

## Lessons

Recorded here because each cost real time and none is obvious from the code.

**A non-blocking check that never runs looks exactly like one that passed.**
`coverage-report.yml` and `dependency-audit.yml` guarded their jobs with a job-level
`if: hashFiles(...)`. `hashFiles()` is only available in a step-level `if`; at job level
GitHub rejects the whole file. No annotation, no log, 0s duration. Both had failed 40/40
runs on every branch. They were found only because this work made someone read the check
list carefully.

**Sync in a worktree silently uses the wrong overlay.** `resolveOverlaySelection` falls
back to the directory basename, which for a harness-created worktree is not the repo name,
so it lands on `__TEMPLATE__` and regenerates everything with template defaults. The first
sync produced 439 changed files; with a `.agentkit-repo` marker, 62. Two independent
sessions hit this on the same day.

**Local sync being clean does not prove the CI drift check will pass.** A hand-maintained
file survived sync locally because the scaffold cache marked it user-edited. CI has no such
cache, treated it as pristine, and overwrote it.

**Agent categories and team ids are different vocabularies.** `resolveTeamAgents` matched
category to team id, which works for `testing` and fails for `backend` (categorised
`engineering`). Eight team commands shipped with no personas for however long, and nobody
noticed until dispatch needed a `subagent_type` and the routing table came out half empty.

**A comment containing template syntax is not a comment.** The first version of the
workflow fix explained itself with a literal `{{#if hasLanguageRust}}`, which unbalanced
the enclosing conditional and leaked raw handlebars into the generated YAML. The
regression test written minutes earlier caught it.

## Future Enhancements

- **`agent-name-prefix`** — specced, not implemented. 38 agents with generic names
  (`backend`, `data`, `infra`) occupy global agent-type space alongside plugin agents, and
  duplicate names resolve by filesystem read order, which is not documented precedence.
  Deferred because it changes every invocation name downstream and interacts with the new
  dispatch table; the choice between a default-empty and a default-`retort-` prefix is a
  maintainer decision, not an implementation detail.
- **Description-matching surface.** 38 dispatchable agents is a lot for automatic
  delegation to disambiguate. One option is emitting frontmatter only for agents that are
  real delegation targets — those appearing in some `notifies` or `handoff-chain`.
- **Cross-tool dispatch.** Roo Code and Codex CLI both support nesting but retort emits no
  agent-definition format for either. `task-file` mode retains today's behaviour there.

## Related Work

- [ADR-10 Tool-Neutral Agent Hub](../../architecture/decisions/10-tool-neutral-agent-hub.md)
  — if adopted, revisit whether `.agents/` carries a neutral agent manifest.
- [#571](https://github.com/phoenixvc/retort/pull/571) — overlaps on `platform-syncer.mjs`
  and two templates; already implements ADR index generation, which was deliberately
  dropped here on discovering the overlap.
- [Worktree isolation rule](../../../.claude/rules/worktree-isolation.md) — now enforceable
  by construction rather than by instruction.

---

**Product Manager**: JustAGhosT
**Tech Lead**: JustAGhosT
**Status**: Live
