# {{repoName}}

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
  {{#if commitConvention}}- **Conventional Commits (MANDATORY)**: All commit messages AND PR titles must use the format `type(scope): description`. Types: feat, fix, docs, style, refactor, test, chore, ci, perf, build, revert. Do NOT use natural-language titles like "Plan: Something" — CI will reject them.{{/if}}
  {{#if branchStrategy}}- Branch strategy: {{branchStrategy}}.{{/if}}
  {{#if codeReview}}- Code review: {{codeReview}}.{{/if}}
- **Generated file sync**: After editing any file in `.agentkit/spec/`, you MUST run `pnpm -C .agentkit agentkit:sync` and commit the regenerated output before pushing. CI drift checks will fail otherwise.

{{#if hasLogging}}

## Logging

Use {{loggingFramework}} for all logging.{{#if hasStructuredLogging}} Use structured logging — never use raw `console.log` or `Console.WriteLine`.{{/if}}{{#if hasCorrelationId}} Include correlation IDs in all log entries for distributed tracing.{{/if}}
{{#if loggingLevel}}- Default level: `{{loggingLevel}}`{{/if}}
{{#if loggingSinks}}- Sinks: {{loggingSinks}}{{/if}}
{{/if}}

{{#if hasErrorHandling}}

## Error Handling

Strategy: {{errorStrategy}}.{{#if hasGlobalHandler}} A global error handler is configured — do not add catch-all handlers in individual endpoints.{{/if}}{{#if hasCustomExceptions}} Use the project's custom exception types rather than generic exceptions.{{/if}}
{{/if}}

{{#if hasAuth}}

## Authentication & Authorization

Provider: {{authProvider}}{{#if authStrategy}}, strategy: {{authStrategy}}{{/if}}.{{#if hasRbac}} Role-based access control (RBAC) is enforced — always check permissions before granting access to resources.{{/if}}{{#if hasMultiTenant}} This is a multi-tenant application — never leak data across tenants.{{/if}}
{{/if}}

{{#if hasCaching}}

## Caching

Provider: {{cachingProvider}}.{{#if cachingPatterns}} Patterns: {{cachingPatterns}}.{{/if}}{{#if hasDistributedCache}} Uses distributed cache — always consider cache invalidation across nodes.{{/if}}
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

{{#if hasIntegrations}}

## External Integrations

{{#each integrations}}- {{.name}} — {{.purpose}}
{{/each}}
Treat external service boundaries carefully. Mock integrations in tests. Handle failures gracefully with retries and circuit breakers where appropriate.
{{/if}}

{{#if hasDocScaffolding}}
## Documentation

{{#if hasPrd}}- **PRDs**: `{{prdPath}}`{{/if}}
{{#if hasAdr}}- **ADRs**: `{{adrPath}}`{{/if}}
{{#if hasApiSpec}}- **API Spec**: `{{apiSpecPath}}`{{/if}}
{{#if hasTechnicalSpec}}- **Technical Spec**: `{{technicalSpecPath}}`{{/if}}
{{#if hasDesignSystem}}- **Design System**: `{{designSystemPath}}`{{/if}}
{{#if hasBrandGuide}}- **Brand Guide**: `{{brandGuidePath}}` — {{brandName}} (primary: `{{brandPrimaryColor}}`){{/if}}
{{#if hasStorybook}}- **Storybook** available for component preview{{/if}}
{{#if hasQualityGates}}- **Quality Gates**: `QUALITY_GATES.md`{{/if}}
- **Runbook**: `RUNBOOK_AI.md`
{{/if}}

{{#if hasTeamOrchestration}}
## Agent Teams

This project uses a multi-team orchestration model. Teams are specialized by domain:

- Start with `/orchestrate` to assess the current state and coordinate work.
- Use `/plan` to create structured implementation plans before coding.
{{#if hasQualityGates}}- Run `/check` to verify quality gates (lint, test, build) before committing.{{/if}}
{{#if hasSessionHandoff}}- Use `/handoff` to document session state for continuity.{{/if}}

See `UNIFIED_AGENT_TEAMS.md` for full team definitions and workflow phases.
See `COMMAND_GUIDE.md` for when to choose `/orchestrate`, `/plan`, `/project-review`, and other commands.
{{/if}}

{{#if hasFeatureFlags}}

## Feature Flags

Provider: {{featureFlagProvider}}. Gate new features behind flags. Never remove a flag without verifying it is fully rolled out.
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
