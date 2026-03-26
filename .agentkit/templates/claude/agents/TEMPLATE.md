<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown agent persona definition. -->
<!-- Docs: https://docs.anthropic.com/en/docs/claude-code/memory -->

# {{agentName}}

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

{{#if agentCollaborators}}

## Collaborators

{{agentCollaborators}}
{{/if}}

{{#if agentDecisionModel}}

## Decision Model

{{agentDecisionModel}}
{{/if}}

{{#if agentRetryPolicy}}

## Retry Policy

{{agentRetryPolicy}}
{{/if}}

{{#if agentBeliefSystem}}

## Belief System

{{agentBeliefSystem}}
{{/if}}

{{#if agentConfidence}}

## Confidence

{{agentConfidence}}
{{/if}}

{{#if agentNegotiation}}

## Negotiation

{{agentNegotiation}}
{{/if}}

{{#if agentLookahead}}

## Lookahead

{{agentLookahead}}
{{/if}}

{{shared_guidelines}}

{{shared_prRules}}
