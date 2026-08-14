# .readme.yaml Convention

`.readme.yaml` is a **directory exploration map**. An agent with no LSP / Serena
reads it instead of listing the tree or parsing `README.md`.

It is not a conversion of the README. Compact YAML for durable documents is
`{stem}.agent.yaml` (`skills/md-agent-yaml/schema.yaml`). Do not mix the shapes.

Machine schema: `readme-yaml.schema.yaml` (`schema: readme-map/v1`).

## Two kinds

**Index** (`apps/`, `packages/`, repo root of a monorepo): lists `children` so the
next hop is obvious.

**Leaf** (one app, package, or service): `entry_points` and `skip` so the agent
opens the right file instead of crawling.

A child listed on an index does not need its own `.readme.yaml` until that
directory itself needs a further map.

## Required fields

| Field | Index | Leaf |
| --- | --- | --- |
| `schema` | `readme-map/v1` | `readme-map/v1` |
| `kind` | `index` | `leaf` |
| `purpose` | yes | yes |
| `children` | yes | no |
| `entry_points` | optional | yes |
| `skip` | recommended | recommended |
| `last_synced` | yes | yes |

Optional on either: `name`, `type`, `stack`, `status`, `owner`, `depends_on`,
`deployment`. Those help orientation; they do not replace `children` / `entry_points`.

## Index example

```yaml
schema: readme-map/v1
kind: index
name: apps
purpose: "Application projects for the Mystira platform"
children:
  - name: publisher
    path: apps/publisher
    stack: typescript
    description: "Publisher frontend SPA"
  - name: identity
    path: apps/identity
    stack: dotnet
    description: "Identity/auth service"
skip:
  - publish
last_synced: "2026-08-14"
```

## Leaf example

```yaml
schema: readme-map/v1
kind: leaf
name: shared-ts
purpose: "Shared TypeScript utilities — dates, errors, validation."
type: package
stack: [typescript]
entry_points:
  - src/index.ts
skip:
  - dist
  - node_modules
last_synced: "2026-08-14"
```

## Explorer rule

1. Read `.readme.yaml` in the current directory (or the nearest ancestor).
2. Follow `children` or open `entry_points`.
3. Do not recurse into `skip`.
4. Use LSP / Serena only after the map has pointed at a symbol or file.

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
