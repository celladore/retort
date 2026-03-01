<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Cursor command template. -->
<!-- Docs: https://docs.cursor.com/context/rules -->
# {{commandName}}

{{commandDescription}}

## Instructions

When invoked, follow the AgentKit Forge orchestration lifecycle:

1. **Understand** the request and any arguments provided
2. **Scan** relevant files to build context
3. **Execute** the task following project conventions
4. **Validate** the output meets quality gates
5. **Report** results clearly

## Project Context

- Repository: {{repoName}}
- Default branch: {{defaultBranch}}
{{#if stackLanguages}}- Tech stack: {{stackLanguages}}{{/if}}

## Conventions

- Write minimal, focused diffs — change only what is necessary
- Maintain backwards compatibility
- Every behavioral change must include tests
- Never commit secrets or credentials
- Follow the project's coding standards and quality gates
