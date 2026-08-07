# Agent Dispatch Capability — Implementation Spec

**Status:** Complete — all four phases implemented
**Owner:** TEAMFORGE (T11)
**ADR:** [ADR-11 Native Agent Dispatch](../../architecture/decisions/11-native-agent-dispatch.md)
**Target:** Retort v3.2.0

> **Implementation status.** All four phases have landed:
>
> - All 38 agents emit valid subagent frontmatter, with `isolation: worktree` on 14
>   code-writing agents and `disallowedTools: Write, Edit, NotebookEdit` on 18 read-only ones.
> - The full `dispatch:` block is honoured — `when-to-use`, `can-dispatch`, `tools-mode`,
>   `model`, `isolation`, `background`, `color`.
> - `can-dispatch` defaults by category: 13 coordinator agents keep the `Agent` tool, the
>   other 25 receive `disallowedTools: Agent`.
> - Model routing is live: 4 agents on `haiku`, 5 on `opus`, 29 inheriting.
> - `max-subagent-spawn-depth: 2` in teams.yaml emits
>   `env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` into `.claude/settings.json`.
> - `orchestrate.md` and `team-TEMPLATE.md` describe the reconciled protocol, selected by
>   `dispatch.mode: native | task-file` in settings.yaml (overlay key: `dispatchMode`).
>
> The "Current State" table below describes the pre-implementation baseline and is kept
> for context.

## Summary

Make retort's generated agent personas into real, dispatchable Claude Code subagents, derive
their runtime guardrails from spec fields that already exist, and reconcile the task-JSON
delegation protocol with native `Agent`-tool dispatch.

## Current State

| Artefact          | Location                                                 | Problem                                                                                                |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Agent template    | `.agentkit/templates/claude/agents/TEMPLATE.md`          | Opens with an HTML comment. No YAML frontmatter block.                                                 |
| Emitter           | `.agentkit/engines/node/src/platform-syncer.mjs:714-736` | Renders template → `insertHeader` → writes. Header is a comment, so nothing ever produces frontmatter. |
| Var builder       | `.agentkit/engines/node/src/var-builders.mjs:444-478`    | Builds 20+ prose variables. Emits no runtime fields.                                                   |
| `preferred-tools` | `var-builders.mjs:447` → `agentToolsList`                | Rendered as a "Preferred Tools" bullet list. Documentation, not an allowlist.                          |
| Settings          | `.agentkit/templates/claude/settings.json`               | Has `permissions.allow` / `permissions.deny`. No `env` block.                                          |
| Depth constant    | `var-builders.mjs:35-39` `inferMaxHandoffChainDepth`     | Returns 3/5/7 by team count. Models handoff chains, not spawn nesting.                                 |

Verification that the agents are unregistered: run a session rooted at the repo and inspect
the available agent types. Retort's `backend`, `security-auditor`, and `test-lead` are absent
while plugin agents are present.

## Schema Additions

### `dispatch` block (per agent, `.agentkit/spec/agents/*.yaml`)

All fields optional; the block itself is optional.

```yaml
- id: backend
  category: engineering
  name: Backend Engineer
  role: >
    Senior backend engineer responsible for API design...
  accepts: [implement, review, plan]
  dispatch:
    when-to-use: >
      Use for API endpoints, service-layer architecture, business logic, and
      server-side performance work under apps/api, services, or controllers.
    can-dispatch: false # default derived from category — see table
    tools-mode: inherit # inherit | allowlist
    model: inherit # inherit | haiku | sonnet | opus | fable | <full-id>
    isolation: auto # auto | worktree | none  — auto derives from accepts
    background: false
    color: green
```

| Field          | Type        | Default             | Emits                              |
| -------------- | ----------- | ------------------- | ---------------------------------- |
| `when-to-use`  | string      | derived (see below) | `description:`                     |
| `can-dispatch` | bool        | by category         | `Agent` in `tools:`                |
| `tools-mode`   | enum        | `inherit`           | whether `tools:` is emitted at all |
| `model`        | enum/string | `inherit`           | `model:`                           |
| `isolation`    | enum        | `auto`              | `isolation:`                       |
| `background`   | bool        | unset               | `background:`                      |
| `color`        | enum        | by category         | `color:`                           |

### `max-subagent-spawn-depth` (`.agentkit/spec/teams.yaml`)

New top-level setting, default `2`, valid range `1`–`3`.

**Deliberately independent of `max-handoff-chain-depth`.** See ADR-11 §4 — handoff depth is
a sequential chain with additive cost; spawn depth is a tree with multiplicative cost. The
current repo would emit `7` if derived, which is a token-budget hazard.

## Derivation Rules

### `description` (required — this is the delegation trigger)

Claude selects subagents by matching this field. `role` is a capability statement and matches
poorly. Resolution order:

1. `dispatch.when-to-use` verbatim, if present.
2. Otherwise derive: `Use for {accepts joined} work in {first 3 focus globs}. {first sentence of role}`

Truncate to 500 chars. Phase 1 ships derivation; `when-to-use` is backfilled per agent in
Phase 2 by the `prompt-engineer` persona.

### `name`

`agent.id`, validated against `^[a-z][a-z0-9-]*$`. Must not contain `:` — Claude Code refuses
to load such files and logs to the debug log. All 38 current ids already conform.

Optional `agent-name-prefix` setting (default empty) prepends e.g. `retort-` to mitigate
collisions with plugin agents that use generic names.

### `isolation` — from `accepts`

| `accepts` contains                                                    | `isolation` |
| --------------------------------------------------------------------- | ----------- |
| `implement`, `fix`, `refactor`, `migration`, `test`                   | `worktree`  |
| only `review`, `investigate`, `plan`, `audit`, `discover`, `document` | omitted     |

Implements [worktree-isolation.md](../../../.claude/rules/worktree-isolation.md) declaratively.
Note the rule's own table already draws this exact line — this codifies it.

### `disallowedTools` — from `accepts`

| `accepts` contains a write type                                       | `disallowedTools`           |
| --------------------------------------------------------------------- | --------------------------- |
| yes (`implement`, `fix`, `refactor`, `migration`, `test`, `document`) | omitted                     |
| no (read-only agent)                                                  | `Write, Edit, NotebookEdit` |

Worked examples against the current spec:

- `backend` — `accepts: [implement, review, plan]` → write-capable, `isolation: worktree`
- `forge` — `accepts: [plan, review, investigate, document]` → write-capable (`document`), no worktree
- `security-auditor` — `accepts: [review, investigate]` → read-only, `disallowedTools` set

### `can-dispatch` — default by category

| Category                                                                  | Default | Rationale                                                             |
| ------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| `team-creation`, `strategic-operations`, `project-management`             | `true`  | Coordinator roles; the team graph already models them fanning out     |
| `engineering`, `testing`, `operations`                                    | `false` | Leaf executors — a backend agent spawning agents is where budgets die |
| `product`, `design`, `marketing`, `cost-operations`, `feature-management` | `false` | Analysis roles; no fan-out modelled                                   |

Per-agent `dispatch.can-dispatch: true` overrides. Emission:

- `can-dispatch: true` + `tools-mode: inherit` → **omit `tools:`** (inherits `Agent` and everything else)
- `can-dispatch: false` + `tools-mode: inherit` → `disallowedTools: Agent` (plus any read-only denials)
- `tools-mode: allowlist` → `tools:` from `preferred-tools`, with `Agent` appended iff `can-dispatch`

> `Agent(type1, type2)` allowlist syntax is **not** usable here. It applies only to an agent
> running as the main thread via `claude --agent`; inside a subagent definition the
> parenthesised type list is ignored. Restricting _which_ agents may be spawned must go
> through `permissions.deny: ["Agent(<name>)"]` in `settings.json`.

> **Corrected during implementation.** The third row above would emit `tools:` _and_
> `disallowedTools:` for a read-only agent in allowlist mode — the same restriction stated
> twice, in two languages, with no documented precedence between them. As shipped,
> `tools:` is the single authority in allowlist mode: the read-only denials are subtracted
> from the list and `disallowedTools` is omitted. An allowlist that resolves to nothing
> falls back to `inherit` with a warning rather than emitting an empty `tools:`, which
> would launch a subagent with no tools at all.

### `model`

Default `inherit`. Recommended assignments, implementing `aicost-model-routing`:

| Model     | Agents                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `haiku`   | `coverage-tracker`, `dependency-watcher`, `roadmap-tracker`, `environment-manager`                         |
| `inherit` | all engineering, testing, product, design agents                                                           |
| `opus`    | `security-auditor`, `role-architect`, `team-validator`, `spec-compliance-auditor`, `retrospective-analyst` |

## Emitter Changes

### `.agentkit/templates/claude/agents/TEMPLATE.md`

Prepend a frontmatter block. Conditionals must not emit blank keys — an empty `tools:` causes
a zero-tools launch failure.

```handlebars
--- name:
{{agentDispatchName}}
description:
{{agentDescription}}
{{#if agentModel}}model:
  {{agentModel}}
{{/if}}{{#if agentTools}}tools:
  {{agentTools}}
{{/if}}{{#if agentDisallowedTools}}disallowedTools:
  {{agentDisallowedTools}}
{{/if}}{{#if agentIsolation}}isolation:
  {{agentIsolation}}
{{/if}}{{#if agentColor}}color:
  {{agentColor}}
{{/if}}---
```

### `.agentkit/engines/node/src/platform-syncer.mjs`

> **Corrected during implementation.** An earlier draft of this spec claimed `insertHeader`
> prepends the `GENERATED` comment at position 0 and would therefore land _above_ the
> frontmatter and break YAML parsing — flagged as the highest-risk change here. That was
> wrong. `template-utils.mjs` already has a `.md`/`.mdc` branch that locates the closing
> `\n---` and inserts the header after it; position-0 prepend is only the no-frontmatter
> fallback. No change to `insertHeader` was needed, and `template-utils.mjs` is untouched —
> which also means its ~25 other callers carry no risk from this work.

`syncClaudeAgents` gains a warning when a rendered agent does not begin with `---`. That is
the silent-failure mode worth guarding: a file that looks correct and registers as nothing.
A regression test asserts, across all emitted agents, that no HTML comment precedes the
closing `---`.

### `.agentkit/engines/node/src/var-builders.mjs`

Add to `buildAgentVars`: `agentDispatchName`, `agentDescription`, `agentModel`, `agentTools`,
`agentDisallowedTools`, `agentIsolation`, `agentColor`. Add exported pure helpers
`deriveAgentIsolation(accepts)`, `deriveDisallowedTools(accepts, canDispatch)`,
`deriveCanDispatch(category, dispatch)`, `deriveAgentDescription(agent)` so each is unit
testable in isolation.

### `.agentkit/templates/claude/settings.json`

> **Corrected during implementation.** The template is `JSON.parse`d, not rendered — a
> `{{maxSubagentSpawnDepth}}` placeholder would survive verbatim into the generated file.
> The `env` block is therefore built in `syncClaudeSettings`, alongside the permissions
> and hook wiring that are already merged in the same way. The value is stringified:
> `settings.json` env values must be strings, not numbers.

```json
{
  "env": {
    "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "2"
  }
}
```

## Protocol Reconciliation

Keep both. Assign each a role.

```text
orchestrator
  ├─ 1. write .claude/state/tasks/<id>.json   (status: submitted)   ← durable record
  ├─ 2. Agent(subagent_type: <team>, prompt: "...taskId: <id>...")  ← execution
  │       ├─ reads task file, acquires lease, status → working
  │       ├─ does the work in its own context window
  │       └─ writes artifacts, status → completed, returns summary
  └─ 3. reads returned summary; processes handoffTo from the task file
```

- The task file is the **audit trail** — durable, portable, survives the session, and is the
  only representation that works on tools without native subagents.
- The returned summary is the **context transfer** — the only thing that enters the
  orchestrator's window.
- `dispatchMode: native | task-file` in `settings.yaml` selects the backend. `task-file`
  preserves today's behaviour for non-Claude targets and as an escape hatch.

Templates to update in Phase 4: `.agentkit/templates/claude/commands/orchestrate.md`
(Phase 3 delegation section) and `.agentkit/templates/claude/commands/team-TEMPLATE.md`
(Step 0 task queue — a dispatched agent is handed its `taskId` rather than scanning).

> **Added during implementation.** Dispatch needs a **team → agent routing table**, which
> this section did not account for. The task file names a _team_ in `assignees`; the `Agent`
> tool takes an _agent id_. Those coincide for `backend` and not for `testing`, whose lead
> agent is `test-lead` — an orchestrator deriving one from the other silently fails on most
> teams. `orchestrate.md` now renders the mapping from a `teamDispatchTable` var built by
> `buildTeamDispatchTable(teamsSpec, agentsSpec)`.
>
> Two instructions in `orchestrate.md` also became **wrong** rather than merely incomplete
> once Phases 1–3 landed, and Phase 4 corrects them:
>
> - "pass `isolation: "worktree"` in the Agent tool call" — isolation is a property of the
>   agent definition now, derived from `accepts` at sync time. The caller passing it is
>   redundant at best and contradictory at worst.
> - "Each team should accept or reject the task" — in `native` mode the dispatched agent
>   does that, inside its own context, holding its own lease.

## Phasing

| Phase | Change                                                                                               | Ships independently              | Risk                                                |
| ----- | ---------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------- |
| **1** | Frontmatter emitter: `name`, `description`, `color`, `model: inherit`. No dispatch, no restrictions. | Yes — 38 agents become invocable | Low. Blast radius is one template + `insertHeader`. |
| **2** | Guardrails: `disallowedTools` and `isolation` derived from `accepts`; `when-to-use` backfilled.      | Yes                              | Low. Subtractive only.                              |
| **3** | `dispatch` block, `can-dispatch` defaults, `max-subagent-spawn-depth` → `settings.json` env.         | Yes                              | Medium. Enables fan-out and its token cost.         |
| **4** | Protocol reconciliation in `orchestrate.md` and `team-TEMPLATE.md`.                                  | No — needs 1–3                   | Medium. Rewrites the largest command templates.     |

Phase 1 alone resolves the blocking defect. Phases 3–4 should not start until Phase 1 output
is confirmed registering in a live session.

> Phase 3 narrows capability rather than widening it: `can-dispatch` defaults leave the
> `Agent` tool with 13 coordinator agents and withhold it from the other 25, where before
> all 38 inherited it. The token-cost risk in the table is what fan-out _would_ cost if the
> defaults were inverted, not what this change introduces.

## Test Plan

Vitest under `.agentkit/engines/node/src/__tests__/`, coverage ≥ 80%, per `qa-coverage-threshold`.

### `var-builders` (unit, pure functions)

- `deriveAgentIsolation` — returns `worktree` for each write type; empty for each read-only type; empty for `[]`
- `deriveDisallowedTools` — read-only agent gets `Write, Edit, NotebookEdit`; write agent gets none; non-dispatcher gets `Agent`
- `deriveCanDispatch` — each category default; per-agent override wins both directions
- `deriveAgentDescription` — `when-to-use` wins; fallback derivation shape; 500-char truncation

### `platform-syncer` (integration)

- Emitted file parses as YAML frontmatter + body
- `name` and `description` present and non-empty for all 38 agents
- `name` matches `^[a-z][a-z0-9-]*$` and contains no `:`
- `GENERATED` header lands **after** the closing `---`, not before
- No key is emitted with an empty value (regression guard for zero-tools launch failure)
- Golden snapshot for `backend` (write-capable) and `security-auditor` (read-only)

### Settings

- `env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` present and equal to the configured value
- Value is out of range → validation error, not silent clamp

### Negative cases

- `tools-mode: allowlist` with empty `preferred-tools` → validation error at sync time
- Duplicate `name` across agents → validation error

## Open Questions

1. **Name prefixing.** Ship `agent-name-prefix` default-empty (collision risk with plugin
   agents named `backend`) or default-`retort-` (safe, uglier invocation)? Recommendation:
   default empty, `/doctor` warns on collision.
2. **Agent count.** 38 dispatchable agents is a large description-matching surface and may
   cause misrouted automatic delegation. Consider emitting frontmatter only for agents that
   are actually delegation targets (those appearing in some `notifies` or `handoff-chain`),
   leaving the rest as prose personas.
3. **Feature flag naming.** Reuse `agent-personas`, or add `native-dispatch` depending on it?
   Recommendation: a separate flag, so repos can keep personas without dispatch.
4. **`.agents/` hub.** ADR-10 proposes a tool-neutral hub. If adopted, does the frontmatter
   emitter target `.claude/agents/` only, or does `.agents/` carry a neutral agent manifest
   that each platform adapter translates? Recommendation: Phase 1 targets `.claude/` only;
   revisit at ADR-10 acceptance.

## Cross-Tool Applicability

| Runtime                                | Native nesting                                      | Retort output today                          | Phase 3–4 applicability                             |
| -------------------------------------- | --------------------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Claude Code                            | Yes — 3 layers default, env-tunable                 | `.claude/agents/`, commands, hooks, settings | Full                                                |
| Roo Code                               | Yes — Orchestrator/Boomerang `new_task`             | `.roo/rules/` only                           | Needs a mode emitter; out of scope                  |
| Codex CLI                              | Yes — multi-agent v2, configurable sub-agent models | `.codex/skills/` only                        | Out of scope                                        |
| Gemini CLI                             | Subagents since Apr 2026; nesting unverified        | `GEMINI.md`, `config.yaml`                   | Out of scope                                        |
| Cursor, Copilot, Windsurf, Junie, Warp | No agent-definition format emitted                  | rules/context only                           | `task-file` dispatch mode retains today's behaviour |

Non-Claude targets are exactly why the task-JSON protocol is retained rather than replaced.

## Findings — all resolved

These were raised alongside the spec and have since been fixed.

- **ADR index template** — `.agentkit/templates/docs/architecture/decisions/README.md`
  hardcoded retort's own ADR filenames and shipped them to every downstream repo. Replaced
  with a repo-agnostic guide; retort's own index rebuilt and current.
- **Duplicate ADR numbers** — three files claimed `08`. Renumbered via `git mv` to `12`, `13`,
  `14`; the directory is now a unique `01`–`14` sequence under one naming scheme.
- **Plugin agent in the worktree rule** — `worktree-isolation.md` now demonstrates `backend`
  (with `isolation: worktree`) and `security-auditor` (read-only) instead of
  `feature-dev:code-architect`.
- **Prettier gate red on a clean checkout** — 22 files failed, all but three of them
  generated sync output. Root cause was a `.prettierignore` gap, not formatting:
  `.claude/rules/**`, `.claude/settings.json`, and `CLAUDE.md` were never excluded despite
  `.claude/commands/**` and `.claude/agents/**` already being excluded for the same reason.
- **Six broken relative links across `docs/`** — including two ADR references to a
  `01-adopt-retort.md` that has never existed, and a link into a maintainer-local Claude
  memory path under the repository's former name.

### Open follow-up

A **self-maintaining ADR index** still needs an engine change: a var (e.g. `adrEntries`)
built by scanning the ADR directory for `NN-*.md` and parsing each file's H1 and status, so
the template can render the list with `{{#each}}`. That would keep the index current for
retort and every downstream repo, and would have caught the duplicate-`08` collision
automatically. Note that `docs/**` templates are `scaffold: once` — project-owned after the
first write — so a template-only fix does not reach an existing repo's checked-in copy.
