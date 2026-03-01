---
name: "{{commandName}}"
description: "{{commandDescription}}"
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude skill definition.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory
---

# {{commandName}}

{{commandDescription}}

## Usage

Invoke this skill when you need to perform the `{{commandName}}` operation.

## Instructions

1. Parse any arguments provided
2. Scan relevant files to understand the current state
3. Execute the task following project conventions
4. Validate the output against quality gates
5. Report results clearly

## Project Context

- Repository: {{repoName}}
- Default branch: {{defaultBranch}}
{{#if stackLanguages}}- Tech stack: {{stackLanguages}}{{/if}}

## Conventions

- Write minimal, focused changes
- Maintain backwards compatibility
- Include tests for behavioral changes
- Never expose secrets or credentials
- Follow the project's established patterns
