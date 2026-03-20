# ADR-09: PM Agent Loader Design

**Status**: Accepted
**Date**: 2026-03-05
**Deciders**: Project team
**Relates to**: SPEC-pm-capability-overhaul

## Context

Agent personas (product-manager, project-shipper, release-manager) are defined in
`.agentkit/spec/agents.yaml` and rendered as `.claude/agents/*.md` files by the sync
engine. However, team commands (`/team-product`, `/team-backend`, etc.) never reference
these agent files. The personas exist but are never loaded, meaning agent-specific
expertise, conventions, and responsibilities are not available during team work.

## Decision

Inject agent persona context at **sync time** via the team command template, not at
runtime. The sync engine resolves which agents belong to each team and injects a
summary into the generated team command file.

### Resolution Logic

```
1. Check teams.yaml for explicit `agents: [id1, id2]` on the team
2. If not found, fall back to matching agents whose category === teamId
3. Return array of {id, name, role, category}
```

### Template Injection

```handlebars
{{#if teamHasAgents}}
  ## Agent Personas When working in this team's scope, embody these specialist perspectives:
  {{teamAgentSummaries}}
{{/if}}
```

## Alternatives Considered

### Runtime Loading

Load agent `.md` files dynamically when a team command runs. Rejected because:

- Claude Code slash commands don't support dynamic file inclusion
- Would add latency and complexity to every team command invocation
- No way to guarantee the agent file exists at runtime

### Separate Agent Commands

Create `/agent-product-manager` etc. as standalone commands. Rejected because:

- Fragments the workflow — users must remember to invoke agent commands separately
- Doesn't integrate agent expertise into the team context naturally
- Increases command proliferation

## Consequences

### Positive

- Agent expertise is now available in team commands automatically
- Zero runtime overhead — resolved at sync time
- Teams without agents simply omit the section (no bloat)
- Easy to extend — add agents to a team by updating teams.yaml

### Negative

- Increases generated team command file size (adds ~10-30 lines per agent)
- Requires re-sync when agent definitions change
- Agent context is static — can't adapt based on runtime conditions

### Neutral

- Follows the existing sync-time template rendering pattern
- Consistent with how other template variables work
