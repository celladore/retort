---
mode: "agent"
description: "{{commandDescription}}"
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Copilot reusable prompt.
# Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot
---

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

## References

- See `AGENTS.md` for universal project instructions
