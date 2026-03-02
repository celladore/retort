<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Domain-specific AI assistant instructions for IaC. -->
# Instructions — Infrastructure as Code

Apply these rules when editing `.tf`, `.tfvars`, `.hcl`, `terragrunt.hcl`, or
files in `infra/`, `terraform/`, `terragrunt/`, or `modules/` directories.

{{#if infraIacToolchain}}
## Toolchain

- **IaC tools**: {{infraIacToolchain}}
{{#if infraStateBackend}}- **State backend**: {{infraStateBackend}} (remote, with locking enabled){{/if}}
{{#if infraLockProvider}}- **Lock provider**: {{infraLockProvider}}{{/if}}
{{#if infraModulesRepo}}- **Modules repo**: {{infraModulesRepo}}{{/if}}
{{/if}}

{{#if infraNamingConvention}}
## Resource Naming

All cloud resources must follow this naming convention:

```
{{infraNamingConvention}}
```

{{#if infraOrg}}- **Organisation prefix**: `{{infraOrg}}`{{/if}}
{{#if infraDefaultRegion}}- **Default region**: `{{infraDefaultRegion}}`{{/if}}

Use `locals` blocks to compose names from variables. Never hardcode organisation,
environment, or region values.
{{/if}}

## Resource Tagging

**Every taggable resource must include all mandatory tags.** This is enforced during
code review. Use a shared `locals` block or Terragrunt `inputs` to apply tags
consistently across all resources.

{{#if infraMandatoryTags}}
### Mandatory Tags (required)

{{#each infraMandatoryTagsList}}- `{{.}}`
{{/each}}

These tags must be present on every taggable resource — no exceptions.
A missing mandatory tag will block the PR.

**Example — Terraform `locals` block:**

```hcl
locals {
  mandatory_tags = {
{{#each infraMandatoryTagsList}}    "{{.}}" = var["{{.}}"]
{{/each}}  }
}
```

**Example — Terragrunt `inputs`:**

```hcl
inputs = {
  tags = {
{{#each infraMandatoryTagsList}}    "{{.}}" = local["{{.}}"]
{{/each}}  }
}
```

**Example — Azure provider default tags:**

```hcl
provider "azurerm" {
  features {}
  default_tags {
{{#each infraMandatoryTagsList}}    "{{.}}" = var["{{.}}"]
{{/each}}  }
}
```
{{/if}}
{{#unless infraMandatoryTags}}
> No mandatory tags are configured. Define them in `.agentkit/spec/project.yaml`
> under `infrastructure.tagging.mandatory`.
{{/unless}}

{{#if infraOptionalTags}}
### Optional Tags (recommended)

{{#each infraOptionalTagsList}}- `{{.}}`
{{/each}}

Add optional tags for cost analysis, team ownership, and lifecycle tracking.
{{/if}}

## Safety Rules

1. **Plan before apply** — always run `terraform plan` and review the diff.
   CI must include a plan stage with human approval before `apply`.
   Never use `-auto-approve` in production.
2. **Remote state** — state must be stored remotely with locking. Never commit
   `.tfstate` files. Configure via Terragrunt to avoid duplication.
3. **No hardcoded secrets** — use Key Vault / Secrets Manager references or
   environment variables in CI. Mark sensitive variables `sensitive = true`.
4. **Versioned modules** — reusable infrastructure must be in versioned modules
   with `README.md`, `variables.tf`, `outputs.tf`, and `examples/`.
5. **Format and validate** — `terraform fmt -check` and `terraform validate`
   must pass. Run `terraform fmt` before committing.
6. **No drift** — never manually modify Terraform-managed resources. Import
   manual changes into state immediately.

{{#if ruleConventions}}
## Project Conventions

The following conventions are enforced in **{{projectName}}** and derived from
`.agentkit/spec/rules.yaml`:

{{ruleConventions}}
{{/if}}
