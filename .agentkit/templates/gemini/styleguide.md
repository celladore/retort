<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown style guide for Gemini Code Assist code review. -->
<!-- Docs: https://developers.google.com/gemini-code-assist/docs/customize-gemini-behavior-github -->
# Style Guide — {{repoName}}

This style guide is auto-generated from the project's rule definitions.
See `AGENTS.md` for universal project conventions.

## General Principles

- Write minimal, focused diffs — change only what is necessary.
- Maintain backwards compatibility; document breaking changes.
- Every behavioral change must include tests.
- Never commit secrets, API keys, or credentials.
- Prefer explicit error handling over silent failures.
- Use the strongest type safety available for the language.

{{#if hasLogging}}
## Logging

Use {{loggingFramework}} for all logging.{{#if hasStructuredLogging}} Use structured logging.{{/if}}{{#if hasCorrelationId}} Include correlation IDs.{{/if}}
{{/if}}

{{#if hasErrorHandling}}
## Error Handling

Strategy: {{errorStrategy}}.{{#if hasCustomExceptions}} Use custom exception types.{{/if}}
{{/if}}

{{#if hasAuth}}
## Authentication

Provider: {{authProvider}}{{#if authStrategy}} ({{authStrategy}}){{/if}}.{{#if hasRbac}} RBAC enforced.{{/if}}
{{/if}}

{{#if commitConvention}}
## Commit Convention

Follow {{commitConvention}} commits.
{{/if}}

## Quality Gates

Before marking any work complete:

1. All existing tests pass
2. New tests cover the change
3. Linter reports no new warnings
4. Build succeeds
5. No secrets in the diff
6. Documentation updated if behavior changed
