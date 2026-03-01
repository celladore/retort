# project.yaml Reference

> Canonical configuration for project-level metadata consumed by
> AgentKit Forge's sync engine. All fields are **optional** — if
> missing, sync produces generic output.

## Sections

### Identity

| Field | Type | Example |
|-------|------|---------|
| `name` | string | `"chaufher"` |
| `description` | string | `"Ride-hailing platform"` |
| `phase` | enum | `greenfield \| active \| maintenance \| legacy` |

### Stack

| Field | Type | Example |
|-------|------|---------|
| `stack.languages` | string[] | `[typescript, csharp]` |
| `stack.frameworks.frontend` | string[] | `[next.js, react]` |
| `stack.frameworks.backend` | string[] | `[asp.net-core]` |
| `stack.frameworks.css` | string[] | `[tailwind]` |
| `stack.orm` | string | `prisma` |
| `stack.database` | string[] | `[postgresql, redis]` |
| `stack.search` | string | `elasticsearch` |
| `stack.messaging` | string[] | `[signalr]` |

### Architecture

| Field | Type | Example |
|-------|------|---------|
| `architecture.pattern` | enum | `clean \| hexagonal \| mvc \| microservices \| monolith \| serverless` |
| `architecture.apiStyle` | enum | `rest \| graphql \| grpc \| mixed` |
| `architecture.monorepo` | boolean | `false` |
| `architecture.monorepoTool` | enum | `turborepo \| nx \| lerna \| pnpm-workspaces` |

### Documentation

| Field | Type | Example |
|-------|------|---------|
| `documentation.hasPrd` | boolean | `true` |
| `documentation.prdPath` | string | `docs/01_product/` |
| `documentation.hasAdr` | boolean | `false` |
| `documentation.adrPath` | string | `docs/03_architecture/03_decisions/` |
| `documentation.hasApiSpec` | boolean | `false` |
| `documentation.apiSpecPath` | string | `docs/api/openapi/` |
| `documentation.hasTechnicalSpec` | boolean | `false` |
| `documentation.technicalSpecPath` | string | — |
| `documentation.hasDesignSystem` | boolean | `false` |
| `documentation.designSystemPath` | string | `packages/ui/` |
| `documentation.storybook` | boolean | `false` |
| `documentation.designTokensPath` | string | `styles/tokens/` |

### Deployment

| Field | Type | Allowed values |
|-------|------|----------------|
| `deployment.cloudProvider` | enum | `aws \| azure \| gcp \| vercel \| netlify \| self-hosted \| none` |
| `deployment.containerized` | boolean | — |
| `deployment.environments` | string[] | `[dev, staging, prod]` |
| `deployment.iacTool` | enum | `terraform \| bicep \| pulumi \| cdk \| terragrunt \| none` |

### Infrastructure

IaC conventions, naming, and resource management.

| Field | Type | Allowed values / Example |
|-------|------|--------------------------|
| `infrastructure.namingConvention` | string | `"{org}-{env}-{project}-{resourcetype}-{region}"` |
| `infrastructure.defaultRegion` | string | `southafricanorth`, `eastus` |
| `infrastructure.org` | string | `nl`, `contoso` |
| `infrastructure.iacToolchain` | string[] | `[terraform, terragrunt]` |
| `infrastructure.stateBackend` | enum | `azurerm \| s3 \| gcs \| consul \| local \| none` |
| `infrastructure.modulesRepo` | string | `git::https://github.com/org/tf-modules.git` |
| `infrastructure.lockProvider` | enum | `blob-lease \| dynamodb \| consul \| none` |
| `infrastructure.tagging.mandatory` | string[] | `[environment, project, owner, cost-center]` |
| `infrastructure.tagging.optional` | string[] | `[team, created-by]` |

### Observability

Monitoring, alerting, tracing, and centralised logging.

| Field | Type | Allowed values |
|-------|------|----------------|
| `observability.monitoring.provider` | enum | `azure-monitor \| datadog \| prometheus \| grafana-cloud \| cloudwatch \| none` |
| `observability.monitoring.dashboards` | boolean | — |
| `observability.alerting.provider` | enum | `azure-monitor \| pagerduty \| opsgenie \| grafana \| none` |
| `observability.alerting.channels` | string[] | `[email, slack, teams]` |
| `observability.tracing.provider` | enum | `application-insights \| jaeger \| zipkin \| otel-collector \| none` |
| `observability.tracing.samplingRate` | number | `0.0`–`1.0` |
| `observability.logging.centralised` | boolean | — |
| `observability.logging.retentionDays` | number | `30`, `90`, `365` |

### Compliance

Governance, disaster recovery, and audit policies.

| Field | Type | Allowed values |
|-------|------|----------------|
| `compliance.framework` | enum | `soc2 \| iso27001 \| pci-dss \| hipaa \| gdpr \| internal \| none` |
| `compliance.disasterRecovery.rpoHours` | number | RPO in hours |
| `compliance.disasterRecovery.rtoHours` | number | RTO in hours |
| `compliance.disasterRecovery.backupSchedule` | enum | `daily \| weekly \| continuous \| none` |
| `compliance.disasterRecovery.geoRedundancy` | boolean | — |
| `compliance.audit.enabled` | boolean | — |
| `compliance.audit.appendOnly` | boolean | append-only event log |
| `compliance.audit.eventBus` | enum | `service-bus \| event-hub \| sns \| none` |

### Process

| Field | Type | Allowed values |
|-------|------|----------------|
| `process.branchStrategy` | enum | `trunk-based \| github-flow \| gitflow` |
| `process.commitConvention` | enum | `conventional \| semantic \| none` |
| `process.codeReview` | enum | `required-pr \| optional \| none` |
| `process.teamSize` | enum | `solo \| small \| medium \| large` |

### Testing

| Field | Type | Allowed values |
|-------|------|----------------|
| `testing.unit` | string[] | `[vitest, xunit]` |
| `testing.integration` | string[] | `[playwright]` |
| `testing.e2e` | string[] | `[playwright, cypress]` |
| `testing.coverage` | number | `0`–`100` |

### Integrations

```yaml
integrations:
  - name: Azure AD B2C
    purpose: authentication
```

### Cross-cutting Concerns

See the inline comments in `project.yaml` for the full list of
`crosscutting.*` fields (logging, error handling, authentication,
caching, API, database, performance, feature flags, environments).

## Template Variables

The sync engine flattens `project.yaml` into camelCase template
variables. For example:

| YAML path | Template var |
|-----------|-------------|
| `infrastructure.namingConvention` | `{{infraNamingConvention}}` |
| `infrastructure.defaultRegion` | `{{infraDefaultRegion}}` |
| `infrastructure.org` | `{{infraOrg}}` |
| `infrastructure.iacToolchain` | `{{infraIacToolchain}}` |
| `observability.monitoring.provider` | `{{monitoringProvider}}` |
| `compliance.framework` | `{{complianceFramework}}` |
| `compliance.disasterRecovery.rpoHours` | `{{drRpoHours}}` |

Boolean flags follow the `has*` pattern:
`{{hasMonitoring}}`, `{{hasAlerting}}`, `{{hasTracing}}`,
`{{hasCompliance}}`, `{{hasDr}}`, `{{hasAudit}}`, etc.
