<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown rules file. Warp reads WARP.md (or AGENTS.md) from the repo root. -->
<!-- Docs: https://docs.warp.dev/agent-platform/capabilities/rules -->
# {{repoName}} — Warp Instructions

{{#if projectDescription}}{{projectDescription}}{{/if}}

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

## Quick Commands

| Action | Command |
|--------|---------|
| Install dependencies | See stack-specific section below |
| Build | See stack-specific section below |
| Test | See stack-specific section below |
| Lint | See stack-specific section below |
| Format | See stack-specific section below |

## Coding Standards

- Write minimal, focused diffs — change only what is necessary.
- Maintain backwards compatibility; document breaking changes.
- Every behavioral change must include tests.
- Never commit secrets, API keys, or credentials.
- Prefer explicit error handling over silent failures.
- Use the strongest type safety available for the language.
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

Always run the full test suite before creating a pull request.

{{#if hasIntegrations}}
## External Integrations

{{#each integrations}}- {{.name}} — {{.purpose}}
{{/each}}
{{/if}}

## Documentation

{{#if hasPrd}}- **PRDs**: `{{prdPath}}`{{/if}}
{{#if hasAdr}}- **ADRs**: `{{adrPath}}`{{/if}}
{{#if hasApiSpec}}- **API Spec**: `{{apiSpecPath}}`{{/if}}
{{#if hasTechnicalSpec}}- **Technical Spec**: `{{technicalSpecPath}}`{{/if}}
{{#if hasDesignSystem}}- **Design System**: `{{designSystemPath}}`{{/if}}
- See `AGENTS.md` for universal agent instructions.
- See `QUALITY_GATES.md` for quality gate definitions.
- See `RUNBOOK_AI.md` for recovery procedures.

{{#if hasFeatureFlags}}
## Feature Flags

Provider: {{featureFlagProvider}}. Gate new features behind flags.
{{/if}}

{{#if envConfigStrategy}}
## Environment Configuration

Strategy: {{envConfigStrategy}}.
{{#if envNames}}- Environments: {{envNames}}{{/if}}
{{#if envFilePattern}}- Template: `{{envFilePattern}}`{{/if}}
{{/if}}

{{#if containerized}}
## Infrastructure

{{#if cloudProvider}}- **Cloud**: {{cloudProvider}}{{/if}}
{{#if iacTool}}- **IaC**: {{iacTool}}{{/if}}
- **Containerized**: Docker
{{#if environments}}- **Environments**: {{environments}}{{/if}}
{{/if}}

## Safety Rules

1. **Never** commit secrets, API keys, or credentials
2. **Never** force-push to {{defaultBranch}}
3. **Never** run destructive commands without confirmation
4. **Always** run tests before creating a PR
5. **Always** document breaking changes
6. **Always** write tests for new functionality
