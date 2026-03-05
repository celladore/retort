<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Windsurf command template. -->
<!-- Docs: https://docs.windsurf.com/windsurf/cascade -->

# /{{commandName}} — {{commandDescription}}

## When to Use

Invoke this command when the user requests or implies the
`{{commandName}}` operation.

## Purpose

{{commandDescription}}

## Shared State

This command participates in the shared workflow state. Read and update:

- **AGENT_BACKLOG.md** — Prioritized work items; read before starting, update when adding/completing tasks
- **.windsurf/state/orchestrator.json** — Phase, team status, metrics; read for context
- **.windsurf/state/events.log** — Append a log line when completing significant actions

{{#if commandFlags}}
## Flags

{{commandFlags}}

{{/if}}
## Implementation

Execute the steps defined in the corresponding command (`.windsurf/commands/{{commandName}}.md`). The full specification and allowed tools are in that file.

## Related Commands

- `/orchestrate` — Full lifecycle coordination (uses this command as a phase)
- `/plan` — Structured planning before implementation
- `/project-review` — Comprehensive project audit
- See `COMMAND_GUIDE.md` for when to choose each command

{{#if isSyncBacklog}}
## Intake Semantics

- Tracker: `{{issueTracker}}`
- Intake owner team: `{{intakeOwnerTeam}}`
- Operations team: `{{intakeOperationsTeam}}`
- Cadence: `{{intakeCadence}}`
{{#if intakeSecurityEscalationTeams}}- Security-critical escalation: `{{intakeSecurityEscalationTeams}}`{{/if}}
{{#if intakeBlockedEscalationTeams}}- Blocked cross-team escalation: `{{intakeBlockedEscalationTeams}}`{{/if}}

Run sync-backlog against the configured tracker with ownership-based routing and escalation.
{{/if}}
