# .readme.yaml Convention

Every documented component carries two files:

- `README.md` — human-readable prose
- `.readme.yaml` — agent-readable structured metadata

The `.readme.yaml` exists so that agents can scan the workspace quickly without parsing
markdown prose. It is the machine-readable source of truth for what a component is,
its stack, status, and key contacts.

## Required Fields

```yaml
name: string # Same as the directory/package name
type: string # app | library | package | service | infrastructure | tool
description: string # One sentence. What does this do?
status: string # active | deprecated | experimental | archived
stack: [string] # e.g. [dotnet, csharp, ef-core] or [typescript, react, vite]
owner: string # GitHub handle or team name
```

## Full Schema

```yaml
name: mystira-app-pwa
type: app
description: 'Blazor WebAssembly PWA — the main player-facing client application.'
status: active
stack:
  - dotnet
  - blazor
  - webassembly
  - pwa
owner: phoenixvc

# Optional but recommended
version: '1.0.0'
repo: https://github.com/phoenixvc/mystira-workspace
path: apps/app/src/Mystira.App.PWA

# Relationships
depends_on:
  - name: Mystira.App.Core
    type: package
    local: true
  - name: Mystira.App.API
    type: service
    local: true

# Deployment (services/apps)
deployment:
  environment: azure-static-web-apps
  url: https://app.mystira.io
  ci_workflow: .github/workflows/deploy-app.yml

# Docs
docs:
  adr_dir: docs/architecture/decisions
  history_dir: docs/history
  prd_dir: docs/product/prd

# Deprecation (if status: deprecated)
deprecated:
  reason: 'Replaced by apps/publisher'
  successor: apps/publisher
  deadline: '2026-06-01'
```

## Examples by Component Type

### Library / Package

```yaml
name: shared-ts
type: package
description: 'Shared TypeScript utilities — date formatting, error types, validation helpers.'
status: active
stack: [typescript]
owner: phoenixvc
version: '2.3.1'
```

### .NET API Service

```yaml
name: Mystira.App.API
type: service
description: 'Main application REST API — story sessions, user profiles, AI companion.'
status: active
stack: [dotnet, csharp, ef-core, postgresql]
owner: phoenixvc
deployment:
  environment: azure-container-apps
  url: https://api.mystira.io
  ci_workflow: .github/workflows/deploy-api.yml
depends_on:
  - name: Mystira.App.Core
    type: package
    local: true
  - name: Mystira.App.Infrastructure.Data
    type: package
    local: true
```

### Infrastructure Module

```yaml
name: infra-identity
type: infrastructure
description: 'Terraform module provisioning Azure resources for the identity service.'
status: active
stack: [terraform, azure]
owner: phoenixvc
path: infra/modules/identity
```

## ADR Format

When writing an ADR, use this template:

```markdown
# ADR-NNNN: <Title>

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
**Date:** YYYY-MM-DD
**Deciders:** <GitHub handles or team names>
**Tags:** <comma-separated: architecture, security, data, etc.>

## Context

<Why was this decision needed? What problem or constraint drove it?>

## Decision

<What was decided? Be concrete — name the pattern, library, or approach chosen.>

## Consequences

**Positive:**

- <Trade-off benefit 1>

**Negative / Trade-offs:**

- <Trade-off cost 1>

## Alternatives Considered

| Alternative | Reason rejected |
| ----------- | --------------- |
| <Option A>  | <Why not>       |
| <Option B>  | <Why not>       |
```

## Governance Notes

- `.readme.yaml` is **agent-written** — humans should not need to edit it manually
- `README.md` is **human-written** — agents may suggest edits but must get approval
- Both files are protected by the `respect-shared-docs` guard in `.agents/guards/`
- When creating a new component, write `.readme.yaml` first, then prose README
- On deprecation: update `status` to `deprecated`, add `deprecated:` block, do not delete
