# project.yaml Reference

Complete schema for `.agentkit/spec/project.yaml`. All fields are optional — sync
works with generic output when fields are missing. Run `agentkit init` to
auto-detect values or `agentkit discover` to preview what would be detected.

---

## Project Identity

```yaml
name: my-project # Repository / project name
description: 'Short description of the project'
phase: active # greenfield | active | maintenance | legacy
```

- **`name`** — Used as `{{projectName}}` in templates.
- **`description`** — Injected as `{{projectDescription}}`.
- **`phase`** — Injected as `{{projectPhase}}`. Guides how agents approach the codebase (e.g., `greenfield` = fewer conventions to follow, `legacy` = cautious changes).

---

## Stack

```yaml
stack:
  languages:
    - typescript
    - csharp
  frameworks:
    frontend:
      - next.js
      - react
    backend:
      - asp.net-core
    css:
      - tailwind
  orm: prisma # prisma | ef-core | drizzle | typeorm | sqlalchemy | diesel | sequelize
  database:
    - postgresql
    - redis
  search: elasticsearch # elasticsearch | meilisearch | algolia
  messaging:
    - signalr
    - rabbitmq
```

- **`languages`** — Array of tech stack identifiers. Becomes `{{stackLanguages}}` (comma-separated).
- **`frameworks.frontend`** — Becomes `{{stackFrontendFrameworks}}`.
- **`frameworks.backend`** — Becomes `{{stackBackendFrameworks}}`.
- **`frameworks.css`** — Becomes `{{stackCssFrameworks}}`.
- **`orm`** — Single ORM name → `{{stackOrm}}`.
- **`database`** — Array or string → `{{stackDatabase}}`.
- **`search`** — Search engine → `{{stackSearch}}`.
- **`messaging`** — Array or string → `{{stackMessaging}}`.

---

## Architecture

```yaml
architecture:
  pattern: clean-architecture # clean-architecture | hexagonal | mvc | microservices | monolith | serverless
  apiStyle: rest # rest | graphql | grpc | mixed
  monorepo: true
  monorepoTool: turborepo # turborepo | nx | lerna | pnpm-workspaces
```

- **`pattern`** → `{{architecturePattern}}`.
- **`apiStyle`** → `{{architectureApiStyle}}`.
- **`monorepo`** → `{{hasMonorepo}}` (boolean).
- **`monorepoTool`** → `{{monorepoTool}}`.

---

## Documentation

```yaml
documentation:
  hasPrd: true
  prdPath: docs/prd/
  hasAdr: true
  adrPath: docs/adr/
  hasApiSpec: true
  apiSpecPath: docs/api/openapi/
  hasTechnicalSpec: false
  technicalSpecPath: null
  hasDesignSystem: true
  designSystemPath: packages/ui/
  storybook: true
  designTokensPath: styles/tokens/
```

Each `has*` field becomes a template boolean (e.g., `{{hasPrd}}`). Path fields
become `{{prdPath}}`, `{{adrPath}}`, etc. These control conditional sections in
generated configs — for example, templates can include PRD references only when
`hasPrd` is true.

---

## Deployment

```yaml
deployment:
  cloudProvider: azure # aws | azure | gcp | vercel | netlify | self-hosted | none
  containerized: true
  environments:
    - dev
    - staging
    - prod
  iacTool: bicep # terraform | bicep | pulumi | cdk | none
```

- **`cloudProvider`** → `{{cloudProvider}}`.
- **`containerized`** → `{{hasContainerized}}` (boolean).
- **`environments`** → `{{environments}}` (comma-separated).
- **`iacTool`** → `{{iacTool}}`.

---

## Process

```yaml
process:
  branchStrategy: github-flow # trunk-based | github-flow | gitflow
  commitConvention: conventional # conventional | semantic | none
  codeReview: required-pr # required-pr | optional | none
  teamSize: small # solo | small | medium | large
```

All fields map to same-named template variables: `{{branchStrategy}}`,
`{{commitConvention}}`, `{{codeReview}}`, `{{teamSize}}`.

---

## Testing

```yaml
testing:
  unit:
    - vitest
    - xunit
  integration:
    - supertest
  e2e:
    - playwright
  coverage: 80 # Target coverage percentage (0-100)
```

- **`unit`** → `{{testingUnit}}` (comma-separated).
- **`integration`** → `{{testingIntegration}}`.
- **`e2e`** → `{{testingE2e}}`.
- **`coverage`** → `{{testingCoverage}}`.

---

## Integrations

```yaml
integrations:
  - name: Azure AD B2C
    purpose: authentication
  - name: Stripe
    purpose: payments
  - name: SendGrid
    purpose: email
```

Available as `{{integrations}}` (array for `{{#each}}` blocks) and
`{{hasIntegrations}}` (boolean). Inside `{{#each integrations}}`, use
`{{.name}}` and `{{.purpose}}`.

---

## Cross-cutting Concerns

### Logging

```yaml
crosscutting:
  logging:
    framework: serilog # serilog | winston | pino | bunyan | python-logging | log4net | nlog | none
    structured: true
    correlationId: true
    level: information # trace | debug | information | warning | error | critical
    sink:
      - console
      - applicationInsights
```

- **`framework`** → `{{loggingFramework}}`, `{{hasLogging}}` (true if not 'none').
- **`structured`** → `{{hasStructuredLogging}}`.
- **`correlationId`** → `{{hasCorrelationId}}`.
- **`level`** → `{{loggingLevel}}`.
- **`sink`** → `{{loggingSinks}}` (comma-separated).

### Error Handling

```yaml
errorHandling:
  strategy: problem-details # problem-details | custom-envelope | raw | none
  globalHandler: true
  customExceptions: true
  errorCodes: false
```

- **`strategy`** → `{{errorStrategy}}`, `{{hasErrorHandling}}`.
- **`globalHandler`** → `{{hasGlobalHandler}}`.
- **`customExceptions`** → `{{hasCustomExceptions}}`.

### Authentication

```yaml
authentication:
  provider: azure-ad-b2c # azure-ad | azure-ad-b2c | auth0 | firebase | cognito | keycloak | custom-jwt | none
  strategy: jwt-bearer # jwt-bearer | cookie | session | api-key | oauth2-code
  multiTenant: false
  rbac: true
```

- **`provider`** → `{{authProvider}}`, `{{hasAuth}}`.
- **`strategy`** → `{{authStrategy}}`.
- **`multiTenant`** → `{{hasMultiTenant}}`.
- **`rbac`** → `{{hasRbac}}`.

### Caching

```yaml
caching:
  provider: redis # redis | memcached | in-memory | none
  patterns:
    - cache-aside
    - write-through
  distributedCache: true
```

- **`provider`** → `{{cachingProvider}}`, `{{hasCaching}}`.
- **`patterns`** → `{{cachingPatterns}}` (comma-separated).
- **`distributedCache`** → `{{hasDistributedCache}}`.

### API

```yaml
api:
  versioning: url-segment # url-segment | header | query-string | media-type | none
  pagination: cursor # cursor | offset | keyset | none
  responseFormat: envelope # envelope | raw | json-api | hal
  rateLimiting: true
```

- **`versioning`** → `{{apiVersioning}}`, `{{hasApiVersioning}}`.
- **`pagination`** → `{{apiPagination}}`, `{{hasApiPagination}}`.
- **`responseFormat`** → `{{apiResponseFormat}}`.
- **`rateLimiting`** → `{{hasRateLimiting}}`.

### Database

```yaml
database:
  migrations: code-first # code-first | sql-scripts | auto | none
  seeding: true
  transactionStrategy: unit-of-work # unit-of-work | per-request | manual | none
  connectionPooling: true
```

- **`migrations`** → `{{dbMigrations}}`, `{{hasDbMigrations}}`.
- **`seeding`** → `{{hasDbSeeding}}`.
- **`transactionStrategy`** → `{{dbTransactionStrategy}}`.
- **`connectionPooling`** → `{{hasConnectionPooling}}`.

### Performance

```yaml
performance:
  bundleBudget: 250 # KB limit for frontend bundles
  lazyLoading: true
  imageOptimization: true
```

- **`bundleBudget`** → `{{bundleBudget}}`.
- **`lazyLoading`** → `{{hasLazyLoading}}`.
- **`imageOptimization`** → `{{hasImageOptimization}}`.

### Feature Flags

```yaml
featureFlags:
  provider: launchdarkly # launchdarkly | azure-app-config | unleash | flagsmith | custom | none
```

- **`provider`** → `{{featureFlagProvider}}`, `{{hasFeatureFlags}}`.

### Environments

```yaml
environments:
  naming:
    - dev
    - staging
    - prod
  configStrategy: env-vars # env-vars | config-files | vault | app-config | none
  envFilePattern: .env.example
```

- **`naming`** → `{{envNames}}` (comma-separated).
- **`configStrategy`** → `{{envConfigStrategy}}`.
- **`envFilePattern`** → `{{envFilePattern}}`.

---

## Template Variable Summary

All variables derived from `project.yaml` are available in every template
(`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `WARP.md`, `copilot-instructions.md`,
etc.) via `{{variableName}}` syntax. Boolean variables can be used in
`{{#if hasAuth}}...{{/if}}` conditional blocks. Array variables can be used in
`{{#each integrations}}...{{/each}}` iteration blocks.

---

## References

- [CUSTOMIZATION.md](./CUSTOMIZATION.md) — Overlay system, render targets, presets
- [ARCHITECTURE.md](./ARCHITECTURE.md) — How `flattenProjectYaml()` works internally
- [TOOLS.md](./TOOLS.md) — What each render target generates
