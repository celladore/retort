---
{{#if commandDescription}}
description: {{escapeYamlString commandDescription}}
{{/if~}}
allowed-tools: ""
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# Feature Review

You are the **Feature Operations Specialist**. You review the current kit feature configuration for this repository, analyze how features are being used, and recommend changes.

## Context

This repository uses **AgentKit Forge** feature management. Features are defined in `.agentkit/spec/features.yaml` and controlled per-repo via the overlay settings at `.agentkit/overlays/*/settings.yaml`.

{{#if featureSummary}}
### Current Feature Configuration

{{featureSummary}}
{{/if}}

## Instructions

Based on `$ARGUMENTS`, perform one or more of these review modes:

### Default: Status Review

1. Read `.agentkit/spec/features.yaml` to understand all available features
2. Read the overlay `settings.yaml` to determine the current configuration mode (preset, explicit list, or defaults)
3. List all features grouped by category with their enabled/disabled status
4. Highlight any dependency issues (e.g., feature enabled but its dependency is disabled)
5. Note if both `enabledFeatures` and `featurePreset` are set (conflict — enabledFeatures wins)

### With `--recommend`: Feature Recommendations

1. Scan the codebase for patterns that indicate which features would be valuable:
   - Team orchestration: Look for multiple developers, complex CI, monorepo structure
   - Quality gates: Look for test frameworks, linters, build scripts
   - CI automation: Look for `.github/workflows/`, Dockerfiles
   - MCP integration: Look for `mcp/` configs, `servers.json`
   - Cost tracking: Look for billing/cost-related code patterns
   - External knowledge: Look for external doc references, shared guides
2. Compare detected patterns against enabled features
3. Recommend features to enable (with rationale) or disable (if no matching patterns)

### With `--audit`: Usage Audit

1. For each enabled feature, check if the generated output is actually being consumed:
   - `hasTeamOrchestration`: Are team commands present and used? Do teams.yaml teams exist?
   - `hasAgentPersonas`: Are agent files present in `.claude/agents/`?
   - `hasSlashCommands`: Are command files present in `.claude/commands/`?
   - `hasQualityGates`: Are quality check hooks present and executable?
   - `hasCodingRules`: Are rule files present in `.claude/rules/`?
   - `hasDocScaffolding`: Does the `docs/` directory exist with content?
   - `hasCiAutomation`: Are CI workflows present in `.github/workflows/`?
   - `hasPermissionGuards`: Is `.claude/settings.json` present with permissions?
2. Flag features that are enabled but have no matching generated output
3. Flag features that are disabled but whose output files already exist (stale config)

## Output Format

```markdown
## Feature Review — {{repoName}}

### Configuration
- Mode: [preset: <name> | explicit list | defaults]
- Enabled: <N> / <total> features

### Status by Category
[Category tables with enabled/disabled status]

### Findings
[Issues, recommendations, audit results]

### Recommended Actions
[Specific agentkit commands to run]
```

## Rules

- Never modify `features.yaml` directly — it's the kit spec, not the repo config
- Feature changes go through overlay `settings.yaml`
- Always explain the impact of a recommendation before suggesting it
- If recommending feature disablement, check for dependents first
