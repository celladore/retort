---
name: '{{commandName}}'
description: '{{commandDescription}}'
generated_by: '{{lastAgent}}'
last_model: '{{lastModel}}'
last_updated: '{{syncDate}}'
# Format: YAML frontmatter + Markdown body. Codex agent skill definition.
# Docs: https://developers.openai.com/codex/guides/agents-md
---

# {{commandName}}

{{commandDescription}}

## Usage

Invoke this skill when you need to perform the `{{commandName}}` operation.

## Instructions

1. Parse command arguments and identify requested scope/files
2. Scan relevant files and adjacent tests/docs before changes
3. Execute the task with minimal diffs and explicit error handling
4. Validate using concrete checks (prefer `pnpm check-all`, plus command-specific test/lint/build)
5. Report outcomes with changed files, checks run, and any follow-up actions

## Output

- Return a concise summary with status (`success`/`partial`/`failed`)
- Include validation evidence (exit code, failing command, or passing summary)
- Include next-step remediation when checks fail

## Project Context

- Repository: {{repoName}}
- Default branch: {{defaultBranch}}
  {{#if stackLanguages}}- Tech stack: {{stackLanguages}}{{/if}}

## Conventions

- Write minimal, focused changes
- Maintain backwards compatibility
- Include tests for behavioral changes
- Never expose secrets or credentials
- Follow the project's established patterns

{{#if isSyncBacklog}}
## Intake Semantics

- Tracker: `{{issueTracker}}`
- Intake owner team: `{{intakeOwnerTeam}}`
- Operations team: `{{intakeOperationsTeam}}`
- Cadence: `{{intakeCadence}}`
{{#if intakeSecurityEscalationTeams}}- Security-critical escalation: `{{intakeSecurityEscalationTeams}}`{{/if}}
{{#if intakeBlockedEscalationTeams}}- Blocked cross-team escalation: `{{intakeBlockedEscalationTeams}}`{{/if}}

For backlog sync, use tracker-neutral intake and ownership-aware routing based on configured intake values.

### Issue Field Routing

Route issues to teams by area: `backend`→team-backend, `frontend`→team-frontend, `data`→team-data, `infra`→team-infra, `devops`→team-devops, `testing`→team-testing, `security`→team-security, `docs`→team-docs, `product`→team-product, `quality`→team-quality, `cli`→team-backend, `sync-engine`→team-devops.

**Priority:** P0 (Critical) · P1 (High) · P2 (Medium) · P3 (Low) · P4 (Trivial)
**Severity (bugs):** critical · high · medium · low
**Escalation:** severity=critical + area in [security,infra,backend] → cc {{intakeSecurityEscalationTeams}}; impact=all users + P0 → cc {{intakeBlockedEscalationTeams}}
{{/if}}
