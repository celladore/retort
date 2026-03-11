---
{{#if commandDescription}}
description: {{escapeYamlString commandDescription}}
{{/if~}}
allowed-tools: Bash(git *), Bash(find *), Bash(ls *), Bash(cat *), Bash(head *), Bash(test *), Bash(wc *)
generated_by: '{{lastAgent}}'
last_model: '{{lastModel}}'
last_updated: '{{syncDate}}'
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# Start — New User Entry Point

{{#if commandDescription}}
## Context

{{commandDescription}}
{{/if}}

{{commandPrompt}}
