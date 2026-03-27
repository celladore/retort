# Architectural Findings: Tool-Neutral Agent Hub Pattern

**Date:** 2026-03-17
**Status:** Analysis complete — pending adoption decision
**Repositories analysed:** `agentkit-forge` (main), `Mystira.workspace` (dev)

---

## Executive Summary

AgentKit Forge and Mystira.workspace have independently evolved two complementary approaches to multi-agent configuration. AgentKit Forge uses a **spec-driven sync engine** that generates tool-specific output from YAML specs. Mystira.workspace uses a **hand-authored tool-neutral hub** (`.agents/`) shared across all agent tools. Neither approach alone is sufficient — but combining them creates a significantly stronger architecture.

This document captures findings from a structural comparison and recommends a convergence path.

---

## 1. Current Architecture: AgentKit Forge

### Directory Map

```
.agentkit/
  spec/           ← YAML source of truth (project, teams, commands, rules)
  templates/      ← Output templates for 15+ tools
  engines/        ← Node.js sync engine
  overlays/       ← Per-repo customisations
  bin/            ← Cross-platform CLI scripts

.claude/
  agents/         ← 39 agent persona definitions (generated)
  commands/       ← 42 slash commands (generated)
  rules/          ← Domain rules + languages/ subdirectory (generated)
  skills/         ← 30+ skill definitions (generated)
  hooks/          ← 14 lifecycle hooks (shell scripts)
  state/          ← Orchestrator state, events log, task files
  plans/          ← Implementation plans (runtime)
```

### Strengths

| Capability                   | Detail                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| **Multi-tool sync**          | One YAML change propagates to Claude, Cursor, Copilot, Gemini, Cline, Windsurf, Roo (15+ targets) |
| **Automated enforcement**    | Shell hooks block destructive commands, protect templates, validate pre-push                      |
| **Spec-driven architecture** | CI drift check ensures generated output matches spec — no silent divergence                       |
| **Team orchestration**       | 13 teams with task delegation protocol, fan-out, and chained handoff                              |
| **Quality gates**            | 5-phase lifecycle with enforcement at each transition                                             |

### Weaknesses

| Issue                              | Impact                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Tool-specific output dirs**      | Every tool gets its own copy of agents, rules, commands — no shared layer agents can read across tools |
| **No cross-session traces**        | `/handoff` captures session state but doesn't preserve reasoning context or mental models              |
| **No directory-boundary metadata** | Agents must read full `README.md` or spec YAML to understand project structure                         |
| **Flat agent listing**             | 39 agents in one directory with no categorisation (empty category dirs exist but unused)               |
| **No reflective guards**           | Enforcement is hook-based only — agents without shell access bypass all governance                     |
| **No strategic roadmaps**          | Backlog tracks tasks; nothing tracks multi-session strategic goals                                     |
| **State accumulation**             | `events.log` grows unbounded; no rotation, archival, or freshness signals                              |

---

## 2. Current Architecture: Mystira.workspace

### Directory Map

```
.agents/                          ← Tool-neutral hub (shared across ALL agents)
  guards/                         ← Constraint-based governance rules
    memory-governance.md
    respect-shared-docs.md
    skill-autonomy-guard.md
  skills/                         ← Shared domain knowledge
    end-session/SKILL.md
    mystira-css-tokens/SKILL.md
    obsidian-styling/SKILL.md
  traces/                         ← Cross-session investigative findings
    2026-03-16-handover-ui-infra-aesthetics.md
    2026-03-16-obsidian-washing-trace.md
  history/                        ← Per-conversation artifacts
    {uuid}/
      task.md, walkthrough.md, implementation_plan.md
      agent_trace_n7.md, media__*.png, *.resolved
  roadmaps/                       ← Strategic planning
    agent-handover.md
    guard-enforcement.md
    multi-agent-collaboration.md
    ui-finalization.md

.claude/settings.json             ← Claude-specific hooks/permissions only
.gemini/skills/                   ← Gemini-specific skills (e.g. antigravity-trace-standard)
.serena/memories/                 ← Serena MCP server memories (another tool-specific store)
.cursor/rules/                    ← Empty placeholder
.windsurf/rules/                  ← Empty placeholder

.readme.yaml                      ← Machine-readable project metadata (root)
apps/.readme.yaml                 ← Per-directory metadata
packages/.readme.yaml             ← Per-directory metadata
```

### Strengths

| Capability               | Detail                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **Tool-neutral hub**     | `.agents/` is readable by any agent regardless of platform — no tool-specific parsing required    |
| **Reflective guards**    | YAML frontmatter + regex patterns — agents self-check during planning; no shell dependency        |
| **Cross-session traces** | Captures outgoing agent's mental model, blocked work, and first-3-tool-calls for incoming agent   |
| **`.readme.yaml`**       | Structured, parseable project metadata at directory boundaries — cheaper than parsing markdown    |
| **Full audit trail**     | Per-conversation-ID history with task lists, walkthroughs, plans, screenshots, `.resolved` copies |
| **Strategic roadmaps**   | Multi-session goals that bridge individual task backlogs (4 active roadmaps)                      |
| **Investigation traces** | Dated traces capture root-cause analysis with architectural guards derived from debugging         |

### Weaknesses

| Issue                              | Impact                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| **No automation**                  | Hand-authored files with no sync engine — changes don't propagate across tools    |
| **Trust-based enforcement**        | Reflective guards have zero automated consequences if an agent ignores them       |
| **No spec validation**             | No CI check that guard patterns are valid regex or that skills follow a schema    |
| **Accumulation without lifecycle** | `traces/` and `history/` grow unbounded — no freshness signal or retention policy |
| **Dual maintenance**               | `.readme.yaml` + `README.md` will drift without validation                        |
| **No team orchestration**          | No task delegation protocol, no fan-out, no dependency chains                     |

---

## 3. Pattern Comparison Matrix

| Concern                            | AgentKit Forge                | Mystira                      | Winner      | Notes                                                            |
| ---------------------------------- | ----------------------------- | ---------------------------- | ----------- | ---------------------------------------------------------------- |
| Multi-tool output generation       | Sync engine (15+ targets)     | Manual per-tool              | **Forge**   | Automation beats manual every time                               |
| Agent discoverability across tools | Tool-specific dirs only       | `.agents/` neutral hub       | **Mystira** | Agents from any tool can read `.agents/`                         |
| Governance enforcement             | Shell hooks (automated)       | Guards (reflective)          | **Draw**    | Both needed — automated for capable tools, reflective for others |
| Cross-session continuity           | `/handoff` (task state only)  | Traces + history + roadmaps  | **Mystira** | Mental model capture is qualitatively superior to task lists     |
| Project structure discovery        | `.agentkit/spec/project.yaml` | `.readme.yaml` at boundaries | **Mystira** | Boundary-level metadata is more granular and cheaper to read     |
| Quality gate enforcement           | CI drift check + hooks        | None                         | **Forge**   | Mystira has no automated validation                              |
| Team coordination                  | 13 teams + task protocol      | None                         | **Forge**   | Mystira is single-agent focused                                  |
| Strategic planning                 | Backlog only                  | Roadmaps as first-class      | **Mystira** | Roadmaps bridge session-level and project-level goals            |
| Schema versioning                  | None                          | None                         | **Neither** | Both lack format evolution strategy                              |
| Cost attribution                   | Rules exist, no tracking      | None                         | **Neither** | Both describe cost awareness but don't measure it                |

---

## 4. Key Innovations Worth Adopting

### 4.1 `.agents/` as Tool-Neutral Hub

**What it is:** A top-level directory (not nested under any tool-specific dir) containing shared agent infrastructure: guards, skills, traces, history, roadmaps.

**Why it matters:** Currently, an agent running in Cursor cannot discover Claude's agent personas. An agent in Gemini cannot read Claude's skills. The sync engine generates parallel copies, but there's no shared canonical location. `.agents/` solves this by providing one directory that all tools can read natively.

**Adoption implication:** The sync engine should generate `.agents/` content as a first-class output target alongside `.claude/`, `.cursor/`, etc. Tool-specific dirs become thin wrappers containing only platform hooks and permissions.

### 4.2 Reflective Guards

**What it is:** Markdown files with YAML frontmatter (name, enabled, regex pattern) and natural-language instructions that agents self-check during planning.

**Why it matters:** Shell hooks only work for tools that execute commands through a shell. Browser-based agents, API-only agents, and agents in sandboxed environments bypass hook enforcement entirely. Guards provide a portable fallback.

**Verified guard format (from Mystira):**

```yaml
---
name: memory-governance
enabled: true
description: Requires user consent before any memory write operation
---
# Memory Governance Guard
**Pattern**: `\.claude/.*memory|\.serena/.*memories|\.gemini/.*brain`
**Instruction**:
1. Before writing to any memory path matching the pattern, pause
2. Inform the user what you intend to write and why
3. Proceed only with explicit consent
```

Three guards exist: `memory-governance` (protects cross-tool memory stores), `respect-shared-docs` (protects `CLAUDE.md`, `README.md`, shared docs from unasked modification), `skill-autonomy-guard` (prevents skills/subagents from writing to memory indices without human command).

**Adoption implication:** Guards should complement (not replace) hooks. The sync engine can generate hooks from guard definitions for tools that support them, while the guard files themselves remain readable by any agent.

### 4.3 `.readme.yaml` at Directory Boundaries

**What it is:** Structured YAML files at directory boundaries containing machine-readable metadata: tech stack, workspace structure, build targets, local services.

**Why it matters:** Agents currently parse human-written README.md files to understand project structure — expensive on tokens and error-prone. `.readme.yaml` provides the same information in a format that requires zero interpretation.

**Verified `.readme.yaml` schema (from Mystira root):**

```yaml
purpose: 'Mystira — AI-powered interactive storytelling...'
version: '0.5.2-alpha'
tech_stack:
  dotnet: '9.0'
  node: '22.x'
  react: '19.x'
workspace_type: 'dotnet-sln + pnpm monorepo'
workspace_managers: ['dotnet sln', 'pnpm workspaces']
local_services:
  api: { port: 5001, path: 'apps/api' }
  web: { port: 3000, path: 'apps/web' }
agent_tooling:
  guards: '.agents/guards/'
  skills: '.agents/skills/'
last_synced: '2026-03-16'
```

Sub-directory variants (`apps/.readme.yaml`, `packages/.readme.yaml`) list contained projects with `name`, `path`, `stack`, `description`, and `sub_solutions` fields.

**Adoption implication:** `.agentkit/spec/project.yaml` already contains most of this data. The sync engine should emit `.readme.yaml` files at relevant directory boundaries, derived from the spec.

### 4.4 Cross-Session Traces

**What it is:** Dated markdown files capturing the outgoing agent's mental model, design intuition, blocked/pending work, and concrete next steps for the incoming agent.

**Why it matters:** Git commits and `/handoff` documents capture _what_ happened. Traces capture _why_ and _what the agent was thinking_. This reasoning context is exactly what's lost between sessions and what forces incoming agents to re-derive conclusions.

**Adoption implication:** Extend the `/handoff` command to write structured traces. Add a freshness field (`valid_until` or `relevance_decay`) and implement cleanup in session-start hooks.

### 4.5 Strategic Roadmaps

**What it is:** Markdown files in `.agents/roadmaps/` that describe multi-session goals, phased delivery plans, and coordination protocols.

**Why it matters:** Backlogs track individual tasks. Roadmaps provide the strategic frame that tells agents _why_ tasks exist and how they fit together. An agent asked to "improve auth" can check the roadmap to know whether that means "patch the JWT bug" or "migrate to OAuth2 as part of the compliance initiative."

**Adoption implication:** Add `.agents/roadmaps/` as a managed directory. Roadmaps should have lifecycle metadata (created, updated, status: active/completed/abandoned) and be referenced from the orchestrator state.

---

## 5. Cross-Agent Ecosystem Implications

### 5.1 Standardisation Opportunity

The `.agents/` pattern is simple enough to become a cross-project convention. If formalised with a JSON Schema for guards and a directory layout spec, it could be adopted by any AI agent system — not just AgentKit Forge consumers.

### 5.2 Lock-In Assessment

| Component                | Lock-in risk                                | Mitigation                                                                            |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `.agentkit/` sync engine | Medium — Node.js/pnpm dependency            | Document the output format; allow alternative generators                              |
| `.agents/` hub           | Low — plain markdown, no tooling dependency | Formalise the schema so other tools can generate/consume                              |
| `.claude/hooks/`         | High — shell-specific, platform-specific    | Generate from `.agents/guards/` so the canonical source is portable                   |
| `.readme.yaml`           | Low — standard YAML                         | Publish a schema; align with existing conventions (`.devcontainer/`, `.editorconfig`) |

### 5.3 Missing Capabilities (Neither Repo Addresses)

1. **Agent capability declaration** — No mechanism for an agent to declare its tools, context window, or model capabilities for task routing
2. **Per-session cost attribution** — Cost rules exist but no measurement infrastructure
3. **Concurrent edit conflict resolution** — No protocol for when two agents modify the same file simultaneously
4. **Schema versioning** — No migration strategy when file formats evolve

---

## 6. Recommendations

| Priority | Action                                               | Effort | Impact                                      |
| -------- | ---------------------------------------------------- | ------ | ------------------------------------------- |
| **P0**   | Adopt `.agents/` as sync output target               | Medium | Enables tool-neutral agent discovery        |
| **P0**   | Resolve empty `.claude/agents/` category dirs        | Low    | Unblocks agent reorganisation               |
| **P1**   | Implement `.readme.yaml` generation                  | Low    | Reduces token cost for project discovery    |
| **P1**   | Add guards to `.agents/guards/` with hook generation | Medium | Portable governance + automated enforcement |
| **P2**   | Extend `/handoff` to write traces                    | Low    | Preserves reasoning context across sessions |
| **P2**   | Add roadmaps directory to state model                | Low    | Strategic context for multi-session work    |
| **P3**   | Formalise schemas (guards, traces, `.readme.yaml`)   | Medium | Enables cross-project adoption              |
| **P3**   | Add retention policy for traces/history              | Low    | Prevents unbounded accumulation             |
