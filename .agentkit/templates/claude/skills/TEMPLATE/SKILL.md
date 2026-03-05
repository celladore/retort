---
name: '{{commandName}}'
description: '{{commandDescription}}'
generated_by: '{{lastAgent}}'
last_model: '{{lastModel}}'
last_updated: '{{syncDate}}'
# Format: YAML frontmatter + Markdown body. Claude skill definition.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory
---

# {{commandName}}

{{commandDescription}}

## Usage

Invoke this skill when you need to perform the `{{commandName}}` operation.

{{#if commandFlags}}
## Flags

{{commandFlags}}

{{/if}}
## Instructions

**IMPORTANT:** This skill stub contains only metadata. The full prompt with
detailed instructions, output format, and criteria lives in the corresponding
command file. Before executing, **read** `.claude/commands/{{commandName}}.md`
for the complete instructions. Follow that file's guidance, not the generic
steps below.

Fallback steps (use only if the command file does not exist):

1. Parse any arguments provided
2. Scan relevant files to understand the current state
3. Execute the task following project conventions
4. Validate the output against quality gates
5. Report results clearly

## Progress Tracking

Use the `TodoWrite` tool to track progress through each phase or criterion
of the command. Create one todo item per phase, mark each `in_progress` as
you start it and `completed` when done. This gives the user visibility into
what has been reviewed or executed.

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
