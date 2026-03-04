---
mode: 'agent'
description: '{{commandDescription}}'
generated_by: '{{lastAgent}}'
last_model: '{{lastModel}}'
last_updated: '{{syncDate}}'
# Format: YAML frontmatter + Markdown body. Copilot reusable prompt.
# Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot
---

# {{commandName}}

{{commandDescription}}

{{#if commandPrompt}}
{{commandPrompt}}
{{else}}

## Instructions

When invoked, follow the AgentKit Forge orchestration lifecycle:

1. **Understand** the request and any arguments provided
2. **Scan** relevant files to build context
3. **Execute** the task following project conventions and command-specific checks (tests/lint/build when applicable)
4. **Validate** the output with explicit quality gates (`/check` and `pnpm check-all` where applicable)
5. **Report** results clearly
   {{/if}}

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
- See `UNIFIED_AGENT_TEAMS.md` for team ownership and escalation
- See `AGENT_TEAMS.md` for repo-specific team boundaries
- See `AGENT_BACKLOG.md` for active work items
- See `CLAUDE.md` for project context and workflow
- See `docs/` for architecture, runbooks, and guides
