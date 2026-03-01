<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown rule for Windsurf Cascade AI. -->
<!-- Docs: https://docs.windsurf.com/windsurf/cascade -->
# Project Context

This repository uses the AgentKit Forge unified agent team framework.

## Key References

- UNIFIED_AGENT_TEAMS.md — Team definitions and workflow
- AGENT_TEAMS.md — Repo-specific team mapping
- AGENT_BACKLOG.md — Current work items

## Workflow

1. /discover — Scan codebase structure and conventions
2. /healthcheck — Validate build and test readiness
3. /plan — Create implementation plan with clear acceptance criteria
4. /check — Run quality gates (lint, test, build)
5. /review — Code review against team standards

{{#if hasAnyInfraConfig}}

## Infrastructure Conventions

{{#if infraNamingConvention}}- Naming convention: `{{infraNamingConvention}}`
{{/if}}{{#if infraDefaultRegion}}- Default region: {{infraDefaultRegion}}{{/if}}
{{#if infraOrg}}- Organisation prefix: {{infraOrg}}{{/if}}
{{#if infraIacToolchain}}- Preferred IaC toolchain: {{infraIacToolchain}}{{/if}}
{{#if infraStateBackend}}- State backend: {{infraStateBackend}}{{/if}}
{{/if}}

{{#if hasAnyMonitoring}}

## Observability

{{#if monitoringProvider}}- Monitoring provider: {{monitoringProvider}}{{/if}}
{{#if alertingProvider}}- Alerting provider: {{alertingProvider}}{{/if}}
{{#if tracingProvider}}- Tracing provider: {{tracingProvider}}{{/if}}
{{#if hasCentralisedLogging}}- Centralised logging: enabled{{/if}}
{{else}}

## No Monitoring

- No monitoring configured
{{/if}}

{{#if hasAnyComplianceConfig}}

## Compliance and DR

{{#if complianceFramework}}- Framework: {{complianceFramework}}{{/if}}
{{#if drRpoHours}}- DR RPO (hours): {{drRpoHours}}{{/if}}
{{#if drRtoHours}}- DR RTO (hours): {{drRtoHours}}{{/if}}
{{#if drTestSchedule}}- DR test schedule: {{drTestSchedule}}{{/if}}
{{#if auditEventBus}}- Audit event bus: {{auditEventBus}}{{/if}}
{{else}}

## No Compliance and DR

- No compliance/DR configuration
{{/if}}

## Non-negotiables

- Prefer small, reversible changes
- Keep builds and tests green at all times
- Never touch secrets or .env files
- Always include validation commands in task summaries
- Reference UNIFIED_AGENT_TEAMS.md for team assignments and escalation paths
