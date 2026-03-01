<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Copilot domain-specific instructions. -->
<!-- Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot -->
# Copilot Instructions — {{ruleDomain}}

{{#if ruleDescription}}{{ruleDescription}}

{{/if}}
{{#if ruleAppliesTo}}
## Applies To

```
{{ruleAppliesTo}}
```

{{/if}}
## Conventions

{{#if ruleConventions}}
{{ruleConventions}}
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
