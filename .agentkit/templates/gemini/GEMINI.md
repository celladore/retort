<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown (no frontmatter). Gemini reads GEMINI.md as hierarchical context. -->
<!-- Docs: https://geminicli.com/docs/cli/gemini-md/ -->
# {{repoName}} — Gemini Instructions

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

## Coding Standards

- Write minimal, focused diffs — change only what is necessary.
- Maintain backwards compatibility; document breaking changes.
- Every behavioral change must include tests.
- Never commit secrets, API keys, or credentials. Use environment variables.
- Prefer explicit error handling over silent failures.
- Use the strongest type safety available for the language.
{{#if commitConvention}}- Follow {{commitConvention}} commit convention.{{/if}}
{{#if branchStrategy}}- Branch strategy: {{branchStrategy}}.{{/if}}
{{#if codeReview}}- Code review: {{codeReview}}.{{/if}}

{{#if hasLogging}}
## Logging

Use {{loggingFramework}} for all logging.{{#if hasStructuredLogging}} Use structured logging — never use raw `console.log` or `Console.WriteLine`.{{/if}}{{#if hasCorrelationId}} Include correlation IDs in all log entries.{{/if}}
{{#if loggingLevel}}- Default level: `{{loggingLevel}}`{{/if}}
{{#if loggingSinks}}- Sinks: {{loggingSinks}}{{/if}}
{{/if}}

{{#if hasErrorHandling}}
## Error Handling

Strategy: {{errorStrategy}}.{{#if hasGlobalHandler}} A global error handler is configured.{{/if}}{{#if hasCustomExceptions}} Use the project's custom exception types.{{/if}}
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
Treat external service boundaries carefully. Mock integrations in tests.
{{/if}}

## Documentation

{{#if hasPrd}}- **PRDs**: `{{prdPath}}`{{/if}}
{{#if hasAdr}}- **ADRs**: `{{adrPath}}`{{/if}}
{{#if hasApiSpec}}- **API Spec**: `{{apiSpecPath}}`{{/if}}
{{#if hasTechnicalSpec}}- **Technical Spec**: `{{technicalSpecPath}}`{{/if}}
{{#if hasDesignSystem}}- **Design System**: `{{designSystemPath}}`{{/if}}
- See `AGENTS.md` for universal agent instructions.
- See `QUALITY_GATES.md` for quality gate definitions.

{{#if hasFeatureFlags}}
## Feature Flags

Provider: {{featureFlagProvider}}. Gate new features behind flags.
{{/if}}

{{#if containerized}}
## Infrastructure

{{#if cloudProvider}}- **Cloud**: {{cloudProvider}}{{/if}}
{{#if iacTool}}- **IaC**: {{iacTool}}{{/if}}
- **Containerized**: Docker
{{#if environments}}- **Environments**: {{environments}}{{/if}}
{{/if}}

## Code Review Guidelines

When reviewing code, focus on:

1. **Correctness** — Does the code do what it claims?
2. **Security** — Are there injection, auth, or data exposure risks?
3. **Testing** — Are new behaviors covered by tests?
4. **Maintainability** — Is the code readable and well-structured?
5. **Performance** — Are there obvious performance concerns?
6. **Conventions** — Does it follow established project patterns?
