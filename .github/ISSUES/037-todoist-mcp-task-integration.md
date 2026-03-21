# feat(mcp): Integrate Retort tasks with Todoist through MCP

**Priority:** P2 — Medium
**Labels:** `enhancement`, `mcp`, `tasks`, `todoist`, `integration`
**Blocked by:** #014

---

## Problem

Retort has task and backlog concepts, but there is no dedicated issue to evaluate syncing or integrating them with Todoist through MCP.

---

## Scope

Evaluate whether Todoist-through-MCP should support:

- pushing Retort tasks to Todoist
- importing Todoist tasks into Retort backlog/task views
- one-way vs two-way sync
- tagging/project mapping
- priority/status translation
- conflict handling and ownership boundaries

---

## Implementation Plan

### Step 1: Define integration direction

Decide whether the initial target should be:

- export only
- import only
- bidirectional sync

### Step 2: Define mapping model

Map Retort concepts to Todoist concepts:

- task type
- priority
- assignee/team
- labels
- due dates
- project grouping

### Step 3: Define guardrails

Clarify conflict and ownership rules so Todoist does not become an unsafe parallel source of truth by accident.

---

## Acceptance Criteria

- [ ] Todoist-through-MCP integration has a support recommendation
- [ ] Mapping between Retort tasks and Todoist concepts is documented
- [ ] Sync direction and conflict model are documented
- [ ] Follow-up implementation work is identified if warranted

---

## Related

- Task lifecycle work: `.github/ISSUES/003-task-delegation-completion.md`
- MCP umbrella: `.github/ISSUES/013-trae-mcp-alignment-umbrella.md`
