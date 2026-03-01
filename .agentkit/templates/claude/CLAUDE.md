<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown project instructions. Claude reads CLAUDE.md from the repo root. -->
<!-- Docs: https://docs.anthropic.com/en/docs/claude-code/memory#claudemd -->
# {{repoName}} — Claude Code Instructions

## Project Overview

{{#if projectDescription}}{{projectDescription}}{{/if}}

This repository uses **AgentKit Forge** to manage AI agent team workflows across multiple tools.

- **Repository**: {{repoName}}
- **Default Branch**: {{defaultBranch}}
- **Framework Version**: {{version}}
{{#if projectPhase}}

- **Phase**: {{projectPhase}}

{{/if}}

{{#if stackLanguages}}

## Tech Stack

- **Languages**: {{stackLanguages}}
{{#if stackFrontendFrameworks}}- **Frontend**: {{stackFrontendFrameworks}}{{/if}}
{{#if stackBackendFrameworks}}- **Backend**: {{stackBackendFrameworks}}{{/if}}
{{#if stackCssFrameworks}}- **CSS**: {{stackCssFrameworks}}{{/if}}
{{#if stackOrm}}- **ORM**: {{stackOrm}}{{/if}}
{{#if stackDatabase}}- **Database**: {{stackDatabase}}{{/if}}
{{#if stackMessaging}}- **Messaging**: {{stackMessaging}}{{/if}}
{{#if architecturePattern}}- **Architecture**: {{architecturePattern}}{{/if}}
{{#if architectureApiStyle}}- **API Style**: {{architectureApiStyle}}{{/if}}
{{#if hasMonorepo}}- **Monorepo**: {{monorepoTool}}{{/if}}
{{/if}}

## Quick Reference

| Command         | Purpose                                      |
| --------------- | -------------------------------------------- |
| `/orchestrate`  | Master coordinator — assess, plan, delegate  |
| `/discover`     | Scan codebase, detect tech stacks            |
| `/healthcheck`  | Pre-flight validation                        |
| `/review`       | Code review with quality gates               |
| `/check`        | Universal quality gate (lint + test + build) |
| `/plan`         | Structured planning before implementation    |
| `/build`        | Build project (auto-detects stack)           |
| `/test`         | Run tests (auto-detects stack)               |
| `/format`       | Format code (auto-detects stack)             |
| `/deploy`       | Deployment automation                        |
| `/security`     | Security audit                               |
| `/sync-backlog` | Update AGENT_BACKLOG.md                      |
| `/handoff`      | Session handoff summary                      |

## Team Commands

| Command          | Team                | Focus                     |
| ---------------- | ------------------- | ------------------------- |
| `/team-backend`  | Backend (T1)        | API, services, core logic |
| `/team-frontend` | Frontend (T2)       | UI, components, PWA       |
| `/team-data`     | Data (T3)           | DB, models, migrations    |
| `/team-infra`    | Infrastructure (T4) | IaC, cloud resources      |
| `/team-devops`   | DevOps (T5)         | CI/CD, containers         |
| `/team-testing`  | Testing (T6)        | Quality, coverage         |
| `/team-security` | Security (T7)       | Auth, compliance          |
| `/team-docs`     | Documentation (T8)  | Docs, guides              |
| `/team-product`  | Product (T9)        | Features, PRDs            |
| `/team-quality`  | Quality (T10)       | Review, refactor          |

## Workflow

### 5-Phase Lifecycle

1. **Discovery** — Understand requirements, scan codebase (`/discover`)
2. **Planning** — Design solution, create ADRs (`/plan`)
3. **Implementation** — Write code, add tests (team commands)
4. **Validation** — Verify quality, run gates (`/check`, `/review`)
5. **Ship** — Deploy, document, hand off (`/deploy`, `/handoff`)

### Standard Session Flow

```text
/orchestrate --assess-only → Understand current state
/plan                     → Design implementation
/team-<name>              → Execute with appropriate team
/check                    → Verify quality gates
/review                   → Code review
/handoff                  → Document session for continuity
```

## Cross-Cutting Conventions

{{#if hasLogging}}

### Logging

{{#if loggingFramework}}Use {{loggingFramework}} for all logging.{{/if}}
{{#if hasStructuredLogging}} Use structured logging — never use raw `console.log` or `Console.WriteLine`.{{/if}}
{{#if hasCorrelationId}} Include correlation IDs in all log entries.{{/if}}

{{#if loggingLevel}}- Default level: `{{loggingLevel}}`{{/if}}
{{#if loggingSinks}}- Sinks: {{loggingSinks}}{{/if}}

{{/if}}
{{#if hasErrorHandling}}

### Error Handling

{{#if errorStrategy}}Strategy: {{errorStrategy}}.{{/if}}
{{#if hasGlobalHandler}} A global error handler is configured.{{/if}}
{{#if hasCustomExceptions}} Use the project's custom exception types.{{/if}}

{{/if}}
{{#if hasAuth}}

### Authentication

{{#if authProvider}}Provider: {{authProvider}}{{#if authStrategy}}, strategy: {{authStrategy}}{{/if}}.{{/if}}
{{#if hasRbac}} RBAC is enforced.{{/if}}

{{/if}}
{{#if hasCaching}}

### Caching

{{#if cachingProvider}}Provider: {{cachingProvider}}.{{/if}}
{{#if cachingPatterns}} Patterns: {{cachingPatterns}}.{{/if}}
{{#if hasDistributedCache}} Distributed cache — consider invalidation across nodes.{{/if}}

{{/if}}
{{#if hasApiVersioning}}

### API

- Versioning: {{apiVersioning}}
{{#if hasApiPagination}}- Pagination: {{apiPagination}}{{/if}}
{{#if apiResponseFormat}}- Response format: {{apiResponseFormat}}{{/if}}

{{/if}}
{{#if hasDbMigrations}}

### Database

- Migrations: {{dbMigrations}}
{{#if dbTransactionStrategy}}- Transactions: {{dbTransactionStrategy}}{{/if}}

{{/if}}

## Testing

{{#if testingUnit}}- **Unit**: {{testingUnit}}{{/if}}
{{#if testingIntegration}}- **Integration**: {{testingIntegration}}{{/if}}
{{#if testingE2e}}- **E2E**: {{testingE2e}}{{/if}}
{{#if testingCoverage}}- **Coverage target**: {{testingCoverage}}%{{/if}}

Always run the full test suite before creating a PR.

## Architecture

- **Agents**: `.claude/agents/` — Specialized AI agents by category
- **Commands**: `.claude/commands/` — Slash command definitions
- **Rules**: `.claude/rules/` — Domain-specific coding rules
- **Hooks**: `.claude/hooks/` — Lifecycle hooks (session-start, protect-sensitive, etc.)
- **State**: `.claude/state/` — Orchestrator state and session tracking

{{#if hasAnyPattern}}

### Declared Implementation Patterns

{{#if hasPatternRepository}}- Repository pattern{{/if}}
{{#if hasPatternCqrs}}- CQRS{{/if}}
{{#if hasPatternEventSourcing}}- Event sourcing{{/if}}
{{#if hasPatternMediator}}- Mediator{{/if}}
{{#if hasPatternUnitOfWork}}- Unit of work{{/if}}
{{/if}}

## Documentation

{{#if hasPrd}}- **PRDs**: `{{prdPath}}`{{/if}}
{{#if hasAdr}}- **ADRs**: `{{adrPath}}`{{/if}}
{{#if hasApiSpec}}- **API Spec**: `{{apiSpecPath}}`{{/if}}
{{#if hasDesignSystem}}- **Design System**: `{{designSystemPath}}`{{/if}}

All project documentation follows the unified 8-category structure in `docs/`:

| Category           | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `01_product/`      | Product vision, strategy, personas, metrics    |
| `02_architecture/` | System design, diagrams, ADRs, tech stack      |
| `03_api/`          | API reference, authentication, versioning      |
| `04_development/`  | Setup, coding standards, testing, contributing |
| `05_deployment/`   | CI/CD, environments, releases, monitoring      |
| `06_security/`     | Threat model, compliance, incident response    |
| `07_operations/`   | SLAs, on-call, capacity, performance           |
| `08_reference/`    | Glossary, acronyms, FAQ, tool config           |

{{#if hasIntegrations}}

## External Integrations

{{#each integrations}}- {{.name}} — {{.purpose}}
{{/each}}
{{/if}}

{{#if hasContainerized}}

## Infrastructure

{{#if cloudProvider}}- **Cloud**: {{cloudProvider}}{{/if}}
{{#if iacTool}}- **IaC**: {{iacTool}}{{/if}}

- **Containerized**: {{#if containerRuntime}}{{containerRuntime}}{{else}}not specified{{/if}}

{{#if environments}}- **Environments**: {{environments}}{{/if}}
{{/if}}

{{#if infraNamingConvention}}

## Infrastructure Conventions

- **Naming convention**: `{{infraNamingConvention}}`
{{#if infraDefaultRegion}}- **Default region**: {{infraDefaultRegion}}{{/if}}
{{#if infraOrg}}- **Organisation prefix**: {{infraOrg}}{{/if}}
{{#if infraIacToolchain}}- **Preferred IaC toolchain**: {{infraIacToolchain}}{{/if}}
{{#if infraStateBackend}}- **State backend**: {{infraStateBackend}}{{/if}}
{{#if infraLockProvider}}- **State lock provider**: {{infraLockProvider}}{{/if}}
{{#if infraMandatoryTags}}- **Mandatory tags**: {{infraMandatoryTags}}{{/if}}
{{/if}}

{{#if hasMonitoring}}

## Observability

- **Monitoring provider**: {{monitoringProvider}}
{{#if hasMonitoringDashboards}}- **Dashboards**: required{{/if}}
{{#if hasAlerting}}- **Alerting provider**: {{alertingProvider}}{{/if}}
{{#if alertingChannels}}- **Alert channels**: {{alertingChannels}}{{/if}}
{{#if hasTracing}}- **Tracing provider**: {{tracingProvider}}{{/if}}
{{#if tracingSamplingRate}}- **Trace sampling rate**: {{tracingSamplingRate}}{{/if}}
{{#if hasCentralisedLogging}}- **Centralised logging**: enabled{{/if}}
{{#if loggingRetentionDays}}- **Log retention (days)**: {{loggingRetentionDays}}{{/if}}
{{/if}}

{{#if hasCompliance}}

## Compliance and Resilience

{{#if complianceFramework}}- **Framework**: {{complianceFramework}}{{/if}}
{{#if drRpoHours}}- **DR RPO (hours)**: {{drRpoHours}}{{/if}}
{{#if drRtoHours}}- **DR RTO (hours)**: {{drRtoHours}}{{/if}}
{{#if drTestSchedule}}- **DR test schedule**: {{drTestSchedule}}{{/if}}
{{#if hasAuditAppendOnly}}- **Audit mode**: append-only{{/if}}
{{#if auditEventBus}}- **Audit event bus**: {{auditEventBus}}{{/if}}
{{/if}}

## Task Delegation Protocol

Work is delegated between agents using **task files** in `.claude/state/tasks/`.
Each task is a JSON file with a lifecycle: `submitted → accepted → working → completed/failed/rejected`.

**Key rules:**

- The **orchestrator** creates tasks and assigns them to teams.
- Teams **accept or reject** tasks based on scope and accepted types.
- On completion, teams add **artifacts** (files changed, test results) and optionally set `handoffTo` for downstream teams.
- The orchestrator processes handoffs and manages **dependency chains** (`dependsOn` / `blockedBy`).
- Tasks support **fan-out** (parallel delegation) and **chained handoff** (sequential delegation).

See `.claude/state/tasks/` for active task files. See `UNIFIED_AGENT_TEAMS.md` for team coordination protocol.

## Safety Rules

1. **Never** commit secrets, API keys, or credentials
2. **Never** force-push to {{defaultBranch}}
3. **Never** run destructive commands without confirmation
4. **Always** run `/check` before creating a PR
5. **Always** document breaking changes in ADRs
6. **Always** write tests for new functionality

## References

- [COMMAND_GUIDE.md](./COMMAND_GUIDE.md) — When to use orchestrate vs plan vs project-review
- [AGENTS.md](./AGENTS.md) — Universal agent instruction file
- [UNIFIED_AGENT_TEAMS.md](./UNIFIED_AGENT_TEAMS.md) — Full team specification
- [AGENT_BACKLOG.md](./AGENT_BACKLOG.md) — Current backlog
- [QUALITY_GATES.md](./QUALITY_GATES.md) — Definition of done per phase
- [RUNBOOK_AI.md](./RUNBOOK_AI.md) — Recovery procedures
