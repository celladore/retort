---
name: {{agentDispatchName}}
description: {{escapeYamlString agentDescription}}
{{#if agentModel}}model: {{agentModel}}
{{/if}}{{#if agentTools}}tools: {{agentTools}}
{{/if}}{{#if agentDisallowedTools}}disallowedTools: {{agentDisallowedTools}}
{{/if}}{{#if agentIsolation}}isolation: {{agentIsolation}}
{{/if}}{{#if agentColor}}color: {{agentColor}}
{{/if}}---

<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: YAML frontmatter + Markdown body. Claude Code subagent definition. -->
<!-- Docs: https://docs.anthropic.com/en/docs/claude-code/sub-agents -->

# {{agentName}}

{{#if retortRemapTarget}}

> **Routing note**: This agent is mapped to **{{retortRemapTarget}}** in `.retortconfig`.
> Invoke `{{retortRemapTarget}}` directly for project-specific behaviour.

{{/if}}

## Role

{{agentRole}}

## Repository Context

{{#if stackLanguages}}- **Tech stack:** {{stackLanguages}}{{/if}}
{{#if stackFrontendFrameworks}}- **Frontend:** {{stackFrontendFrameworks}}{{/if}}
{{#if stackBackendFrameworks}}- **Backend:** {{stackBackendFrameworks}}{{/if}}
{{#if stackDatabase}}- **Database:** {{stackDatabase}}{{/if}}
{{#if architecturePattern}}- **Architecture:** {{architecturePattern}}{{/if}}
{{#if defaultBranch}}- **Default branch:** {{defaultBranch}}{{/if}}
{{#if hasBrandGuide}}- **Brand:** {{brandName}} (primary: `{{brandPrimaryColor}}`) — spec at `{{brandGuidePath}}`{{/if}}

Always scan the codebase within your focus area (the repo folders and modules you're assigned or listed under 'Focus Areas') before making changes.

{{shared_sharedState}}
{{shared_concurrencyControls}}

## Category

{{agentCategory}}

## Focus Areas

{{agentFocusList}}

## Responsibilities

{{agentResponsibilitiesList}}

## Preferred Tools

{{agentToolsList}}

{{#if agentDomainRules}}

## Domain Rules

{{agentDomainRules}}
{{/if}}

{{#if agentConventions}}

## Conventions

{{agentConventions}}
{{/if}}

{{#if agentExamples}}

## Examples

{{agentExamples}}
{{/if}}

{{#if agentAntiPatterns}}

## Anti-Patterns

{{agentAntiPatterns}}
{{/if}}

{{shared_guidelines}}

{{shared_prRules}}
