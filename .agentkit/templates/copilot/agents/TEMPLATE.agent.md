---
name: '{{agentName}}'
description: '{{agentRole}}'
generated_by: '{{lastAgent}}'
last_model: '{{lastModel}}'
last_updated: '{{syncDate}}'
# Format: YAML frontmatter + Markdown body. Copilot agent definition.
# Docs: https://docs.github.com/en/copilot/customizing-copilot/extending-copilot-agents-in-vs-code
---

# {{agentName}}

{{agentRole}}

## Repository Context

- **Repository:** {{repoName}}
- **Default branch:** {{defaultBranch}}
- **Primary context docs:** `CLAUDE.md`, `UNIFIED_AGENT_TEAMS.md`, `AGENT_TEAMS.md`, `AGENT_BACKLOG.md`, `docs/`
  {{#if stackLanguages}}- **Tech stack:** {{stackLanguages}}{{/if}}
  {{#if architecturePattern}}- **Architecture:** {{architecturePattern}}{{/if}}
  {{#if hasBrandGuide}}- **Brand:** {{brandName}} (primary: `{{brandPrimaryColor}}`) — spec at `{{brandGuidePath}}`{{/if}}

Scan the codebase within your focus area before making changes. Read `UNIFIED_AGENT_TEAMS.md` and `AGENT_TEAMS.md` first for ownership/escalation, then `AGENT_BACKLOG.md` and `CLAUDE.md` for current project context.

## Shared State

- `AGENT_BACKLOG.md` — Work items and priorities; read for work items, update when completing or adding tasks
- `AGENT_TEAMS.md` — Team boundaries and ownership
- `.claude/state/events.log` — Append when completing significant work
- `.claude/state/orchestrator.json` — Read for phase/team status

## Focus Areas

{{agentFocusList}}

## Responsibilities

{{agentResponsibilitiesList}}

## Tools

{{agentToolsList}}

{{#if agentDomainRules}}

## Domain Rules

{{agentDomainRules}}
{{/if}}

{{#if agentConventions}}

## Agent Conventions

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

## Conventions

- Work only within your focus area unless explicitly asked to cross boundaries
- Follow the project's coding standards in `AGENTS.md` and quality gates in `QUALITY_GATES.md`
- Run tests before committing changes
- Document any decisions or trade-offs made during implementation
- See `COMMAND_GUIDE.md` for when to use `/plan`, `/project-review`, or `/orchestrate`
