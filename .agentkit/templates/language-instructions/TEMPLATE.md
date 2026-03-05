<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Language/domain-specific AI assistant instructions. -->

# Instructions — {{ruleDomain}}

{{#if ruleDescription}}{{ruleDescription}}

{{/if}}
{{#if ruleAppliesTo}}

## Applies To

```
{{ruleAppliesTo}}
```

{{/if}}

{{#if ruleConventions}}
{{#if ruleHasEnforcement}}
## Enforcement Rules

These rules are hard constraints — violations block CI or are prevented by hooks.

{{ruleEnforcementConventions}}

{{/if}}
{{#if ruleHasAdvisory}}
## Advisory Rules

These rules are guidance for agents — violations are flagged but do not block CI.

{{ruleAdvisoryConventions}}

{{/if}}
{{/if}}
{{#unless ruleConventions}}
_No conventions defined for this domain yet. Add conventions to `.agentkit/spec/rules.yaml`
under the `{{ruleDomain}}` domain._
{{/unless}}

## Quality Gates

Before committing changes in this domain:

{{#if testingUnit}}- Run `{{testingUnit}}` to execute tests.{{/if}}
{{#if testingCoverage}}- Verify coverage meets the **{{testingCoverage}}%** threshold.{{/if}}

- Confirm the linter reports zero new errors.
- Ensure no secrets or credentials appear in the diff.
