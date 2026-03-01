<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. GitHub Copilot repository-wide instructions. -->
<!-- Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot -->
# GitHub Copilot Instructions

You are assisting with a project managed by the AgentKit Forge framework.
Follow these instructions for all code generation, suggestions, and chat responses.

## Project Context

{{#if stackLanguages}}- **Languages**: {{stackLanguages}}{{/if}}
{{#if stackFrontendFrameworks}}- **Frontend**: {{stackFrontendFrameworks}}{{/if}}
{{#if stackBackendFrameworks}}- **Backend**: {{stackBackendFrameworks}}{{/if}}
{{#if stackCssFrameworks}}- **CSS**: {{stackCssFrameworks}}{{/if}}
{{#if stackOrm}}- **ORM**: {{stackOrm}}{{/if}}
{{#if stackDatabase}}- **Database**: {{stackDatabase}}{{/if}}
{{#if stackMessaging}}- **Messaging**: {{stackMessaging}}{{/if}}
{{#if architecturePattern}}- **Architecture**: {{architecturePattern}}{{/if}}
{{#if architectureApiStyle}}- **API Style**: {{architectureApiStyle}}{{/if}}
{{#if hasMonorepo}}- **Monorepo**: {{monorepoTool}}{{/if}}
- **Default Branch**: {{defaultBranch}}
{{#if projectPhase}}- **Phase**: {{projectPhase}}{{/if}}

## Core Workflow

This project uses a 5-phase orchestration lifecycle:

1. **Discovery** — Understand the codebase before making changes (`/discover`)
2. **Planning** — Define tasks with clear acceptance criteria (`/plan`)
3. **Implementation** — Write code in small, reversible increments
4. **Validation** — Run quality gates before marking work complete (`/check`)
5. **Ship** — Final review, merge, and deploy (`/review`)

Always start by reading `UNIFIED_AGENT_TEAMS.md` and `AGENT_TEAMS.md` to
understand team assignments, ownership boundaries, and escalation paths.

## Coding Conventions

- **Minimal diffs** — Change only what is necessary. Do not reformat unrelated
  code or reorganize imports unless that is the explicit task.
- **Backwards compatibility** — Avoid breaking existing public APIs. When a
  breaking change is unavoidable, document it clearly and provide a migration
  path.
- **Add tests** — Every behavioral change should include at least one test that
  would have failed before the change and passes after.
- **No secrets** — Never generate, log, or include API keys, tokens, passwords,
  or connection strings in code or comments. Use environment variables or secret
  managers exclusively.
- **Error handling** — Prefer explicit error handling over silent failures.
  Return meaningful error messages that help operators diagnose issues without
  leaking internal details.
- **Type safety** — Use the strongest type guarantees available in the language
  (TypeScript strict mode, Rust's type system, Python type hints with mypy).
{{#if commitConvention}}- Follow {{commitConvention}} commit convention.{{/if}}
{{#if branchStrategy}}- Branch strategy: {{branchStrategy}}.{{/if}}

{{#if hasLogging}}
## Logging

Use {{loggingFramework}} for all logging.{{#if hasStructuredLogging}} Use structured logging — never use raw `console.log` or `Console.WriteLine`.{{/if}}{{#if hasCorrelationId}} Include correlation IDs in all log entries.{{/if}}
{{#if loggingLevel}}- Default level: `{{loggingLevel}}`{{/if}}
{{#if loggingSinks}}- Sinks: {{loggingSinks}}{{/if}}
{{/if}}

{{#if hasErrorHandling}}
## Error Handling

Strategy: {{errorStrategy}}.{{#if hasGlobalHandler}} A global error handler is configured — do not add catch-all handlers in individual endpoints.{{/if}}{{#if hasCustomExceptions}} Use the project's custom exception types.{{/if}}
{{/if}}

{{#if hasAuth}}
## Authentication & Authorization

Provider: {{authProvider}}{{#if authStrategy}}, strategy: {{authStrategy}}{{/if}}.{{#if hasRbac}} RBAC is enforced.{{/if}}{{#if hasMultiTenant}} Multi-tenant — never leak data across tenants.{{/if}}
{{/if}}

{{#if hasCaching}}
## Caching

Provider: {{cachingProvider}}.{{#if cachingPatterns}} Patterns: {{cachingPatterns}}.{{/if}}{{#if hasDistributedCache}} Distributed cache — consider invalidation across nodes.{{/if}}
{{/if}}

{{#if hasApiVersioning}}
## API Conventions

{{#if hasApiVersioning}}- Versioning: {{apiVersioning}}{{/if}}
{{#if hasApiPagination}}- Pagination: {{apiPagination}}{{/if}}
{{#if apiResponseFormat}}- Response format: {{apiResponseFormat}}{{/if}}
{{#if hasRateLimiting}}- Rate limiting is enabled{{/if}}
{{/if}}

{{#if hasDbMigrations}}
## Database

- Migrations: {{dbMigrations}}{{#if hasDbSeeding}} with seeding{{/if}}
{{#if dbTransactionStrategy}}- Transactions: {{dbTransactionStrategy}}{{/if}}
{{#if hasConnectionPooling}}- Connection pooling is enabled{{/if}}
{{/if}}

## Testing

{{#if testingUnit}}- **Unit**: {{testingUnit}}{{/if}}
{{#if testingIntegration}}- **Integration**: {{testingIntegration}}{{/if}}
{{#if testingE2e}}- **E2E**: {{testingE2e}}{{/if}}
{{#if testingCoverage}}- **Coverage target**: {{testingCoverage}}%{{/if}}

Always run the full test suite before creating a pull request. Never disable or skip existing tests without explicit justification.

## Repository Conventions

- `UNIFIED_AGENT_TEAMS.md` — Canonical team definitions and workflow phases
- `AGENT_TEAMS.md` — Repo-specific team mapping and ownership
- `AGENT_BACKLOG.md` — Current work items and priorities
- `docs/` — Architecture Decision Records (ADRs), runbooks, and guides
- `CLAUDE.md` — Claude-specific project context and conventions

When referencing documentation, always check these files first before making
assumptions about project structure or conventions.

## Documentation

{{#if hasPrd}}- **PRDs**: `{{prdPath}}`{{/if}}
{{#if hasAdr}}- **ADRs**: `{{adrPath}}`{{/if}}
{{#if hasApiSpec}}- **API Spec**: `{{apiSpecPath}}`{{/if}}
{{#if hasTechnicalSpec}}- **Technical Spec**: `{{technicalSpecPath}}`{{/if}}
{{#if hasDesignSystem}}- **Design System**: `{{designSystemPath}}`{{/if}}
- See `AGENTS.md` for universal agent instructions.
- See `QUALITY_GATES.md` for quality gate definitions.

{{#if hasIntegrations}}
## External Integrations

{{#each integrations}}- {{.name}} — {{.purpose}}
{{/each}}
{{/if}}

{{#if hasFeatureFlags}}
## Feature Flags

Provider: {{featureFlagProvider}}. Gate new features behind flags.
{{/if}}

{{#if hasAnyInfraConfig}}

## Infrastructure Conventions

{{#if infraNamingConvention}}- Naming convention: `{{infraNamingConvention}}`
{{/if}}
{{#if infraDefaultRegion}}- Default region: {{infraDefaultRegion}}{{/if}}
{{#if infraOrg}}- Organisation prefix: {{infraOrg}}{{/if}}
{{#if infraIacToolchain}}- Preferred IaC toolchain: {{infraIacToolchain}}{{/if}}
{{#if infraStateBackend}}- State backend: {{infraStateBackend}}{{/if}}
{{#if infraMandatoryTags}}- Mandatory tags: {{infraMandatoryTags}}{{/if}}
{{/if}}

{{#if hasAnyMonitoringConfig}}

## Observability

{{#if monitoringProvider}}- Monitoring provider: {{monitoringProvider}}{{/if}}
{{#if alertingProvider}}- Alerting provider: {{alertingProvider}}{{/if}}
{{#if tracingProvider}}- Tracing provider: {{tracingProvider}}{{/if}}
{{#if tracingSamplingRate}}- Trace sampling rate: {{tracingSamplingRate}}{{/if}}
{{#if hasCentralisedLogging}}- Centralised logging: enabled{{/if}}
{{/if}}

{{#if hasAnyComplianceConfig}}

## Compliance and DR

{{#if complianceFramework}}- Framework: {{complianceFramework}}{{/if}}
{{#if drRpoHours}}- DR RPO (hours): {{drRpoHours}}{{/if}}
{{#if drRtoHours}}- DR RTO (hours): {{drRtoHours}}{{/if}}
{{#if drTestSchedule}}- DR test schedule: {{drTestSchedule}}{{/if}}
{{#if auditEventBus}}- Audit event bus: {{auditEventBus}}{{/if}}
{{/if}}

## Working with Issues

- Read the full issue description and all comments before starting
- Link your changes to the relevant issue number in commit messages
- If the issue is ambiguous, list your assumptions in the PR description
- Break large issues into smaller, independently reviewable PRs

## Development Workflow

1. Create a feature branch from the default branch
2. Make small, focused commits with descriptive messages
3. Run the project's lint, test, and build commands before pushing
4. Open a PR with a clear summary, test plan, and checklist
5. Address review feedback in follow-up commits (do not force-push)

## Quality Gates

Before marking any task as complete, verify:

- [ ] All existing tests pass
- [ ] New tests cover the change
- [ ] Linter reports no new warnings
- [ ] Build succeeds
- [ ] No secrets or credentials in the diff
- [ ] Documentation is updated if behavior changed

## Safety Rules

1. **Never** commit secrets, API keys, or credentials
2. **Never** force-push to {{defaultBranch}}
3. **Never** run destructive commands without confirmation
4. **Always** run tests before creating a PR
5. **Always** document breaking changes
6. **Always** write tests for new functionality
