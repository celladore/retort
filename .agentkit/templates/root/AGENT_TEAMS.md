---
agentkit:
  scaffold: managed
---
# Agent Teams — {{repoName}}

> Repo-local team mapping derived from `.agentkit/spec/teams.yaml`.
> Customize the **Status**, **Primary Scope**, **Tech Stack**, and **Lead Agent**
> columns for your repository. The orchestrator uses this file for task dispatch.

---

## Overview

This document maps the canonical Retort team definitions (see
[UNIFIED_AGENT_TEAMS.md](./UNIFIED_AGENT_TEAMS.md)) to the concrete structure
of this repository. Not all teams may be active — mark inactive teams so the
orchestrator skips them during dispatch.

---

## Team Roster

{{#if hasTeams}}
| Team | ID | Focus | Scope | Accepts | Handoff Chain | Status | Lead Agent |
| ---- | -- | ----- | ----- | ------- | ------------- | ------ | ---------- |
{{#each teamsList}}| {{.name}} | {{.id}} | {{.focus}} | {{.scopeDisplay}} | {{.acceptsDisplay}} | {{.handoffDisplay}} | Active | — |
{{/each}}
{{else}}
_No teams defined in `.agentkit/spec/teams.yaml`._
{{/if}}

---

## How to Customize

### Activating / Deactivating a Team

1. Change the **Status** column from `Inactive` to `Active` (or vice versa).
2. Fill in the **Primary Scope** with actual directory paths in this repo.
3. Set the **Tech Stack** to reflect the tools and frameworks used.
4. Assign a **Lead Agent** identifier (used for mentions and escalation).
5. Add any relevant notes about the team's role.

The orchestrator will skip inactive teams during `/orchestrate` dispatch.

### Adding Custom Scope Patterns

Each team's scope patterns determine which files the orchestrator will assign
to that team. Use glob patterns:

```
src/server/**       — all files under src/server/
src/api/*.ts        — TypeScript files directly in src/api/
tests/unit/server/* — server unit tests
```

---

## Scope Overlap Resolution

When multiple teams have overlapping scope patterns, the orchestrator uses
these priority rules:

1. **Most specific pattern wins.** A deeper path match takes precedence.
2. **Explicit assignment overrides.** A task explicitly assigned to a team
   via `--teams` flag takes precedence over pattern matching.
3. **Primary scope takes priority.** The team whose scope lists the most
   specific matching directory owns the file.

---

_Customize this file for your repository. User edits are preserved across syncs._
_Canonical team definitions: [UNIFIED_AGENT_TEAMS.md](./UNIFIED_AGENT_TEAMS.md)_
