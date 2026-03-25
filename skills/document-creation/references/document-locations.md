# Document Locations — Canonical Map

Reference for all document types: where they live, naming conventions, and format.
Used by the `document-creation` skill and any agent creating written artifacts.

---

## Strategic Documents

| Type | Location | Naming | Notes |
|---|---|---|---|
| Architecture Decision Record (ADR) | `docs/architecture/decisions/` | `NNNN-kebab-title.md` | Increment NNNN from last ADR |
| Architecture overview | `docs/architecture/` | `topic.md` | Stable reference, no date |
| Technical proposal / RFC | `docs/proposals/` | `YYYY-MM-DD-topic.md` | Date-prefixed |
| Risk register | `docs/planning/risks.md` | Fixed name | Append new entries, never overwrite history |

---

## Product Documents

| Type | Location | Naming | Notes |
|---|---|---|---|
| PRD (Product Requirements Doc) | `docs/product/prd/` | `YYYY-MM-DD-feature-name.md` | Use status field in frontmatter |
| Feature spec (implementation-level) | `docs/product/specs/` | `YYYY-MM-DD-feature-name.md` | |
| Acceptance criteria | Inside the PRD or linked Linear/GitHub issue | — | Do not create separate files per AC |
| Roadmap | `org-meta/.roadmap.yaml` | Fixed name | YAML, AI-readable; human summary in `docs/roadmap.md` |
| Backlog | `org-meta/.todo.yaml` | Fixed name | YAML; do not create ad-hoc TODO files |
| Sprint retrospective | `docs/product/retros/` | `YYYY-MM-DD-sprintN.md` | |

---

## Client-Facing Documents

**These do NOT go in the repository.**

| Type | Location | Notes |
|---|---|---|
| Client spec / brief | Notion — project workspace | See project-specific Notion structure |
| Status update / report | Notion or email | |
| Scope of work | Notion | |
| Invoice / billing notes | External billing system | |

If a client spec needs a corresponding internal dev spec, create both:
- Client version → Notion
- Dev version → `docs/product/specs/` with a note: `client-doc: [Notion link]`

The sync-agent monitors drift between the two.

---

## Technical Reference Documents

| Type | Location | Naming | Notes |
|---|---|---|---|
| README | Package / app root | `README.md` | Always paired with `.readme.yaml` |
| Agent-readable metadata | Same dir as README | `.readme.yaml` | See Dual-File Convention below |
| CLAUDE.md | Repo root or `.claude/` | Fixed | AI agent instructions; do not auto-create |
| Runbook | `docs/runbooks/` | `topic.md` | Stable; update in place |
| Onboarding guide | `docs/onboarding/` | `topic.md` or `README.md` | |
| API reference | `docs/api/` | `service-name.md` or OpenAPI yaml | |
| OpenAPI spec | `openapi/` or `docs/api/` | `service-name.yaml` | |
| Migration guide | `docs/migrations/` | `vX-to-vY.md` | |
| Contributing guide | Repo root | `CONTRIBUTING.md` | Fixed name |

---

## Release Documents

| Type | Location | Naming | Notes |
|---|---|---|---|
| Changelog | Repo root | `CHANGELOG.md` | Keep-a-Changelog format; prepend new entries |
| GitHub Release body | GitHub Releases (not in repo) | — | Generated from changelog entry |
| User-facing release notes | Docs site or Notion | — | Plain language; not a repo file |
| Upgrade guide | `docs/migrations/` | `vX-to-vY.md` | Link from CHANGELOG |

---

## Session / AI Continuity Documents

| Type | Location | Naming | Notes |
|---|---|---|---|
| Session handoff | `org-meta/docs/handoffs/` | `YYYY-MM-DD-topic.md` | Created by `document-history` skill |
| Agent trace / finding | `.agents/traces/` | `YYYY-MM-DD-topic.md` | Agents can write here without user approval |
| Investigation finding | `.agents/traces/` | `YYYY-MM-DD-investigation.md` | |
| Session log / history | `.agents/history/` | `YYYY-MM-DD-session.md` | |
| Architecture roadmap (AI) | `.agents/roadmaps/` | `topic.md` | Long-term AI planning docs |
| Memory index | Project memory dir | `MEMORY.md` | Never write directly; update via memory system |

---

## Project Management Documents

| Type | Location | Naming | Notes |
|---|---|---|---|
| Post-mortem | `docs/incidents/` | `YYYY-MM-DD-incident.md` | |
| Meeting notes | `docs/meetings/` | `YYYY-MM-DD-topic.md` | |
| Decision log | `docs/decisions/` | Append to single file | For lightweight decisions not worth an ADR |
| OKR / goals | `docs/planning/` | `YYYY-goals.md` | |

---

## Dual-File Convention

Every component, app, package, or service that has a README should also have a `.readme.yaml` partner:

```
component/
├── README.md        # Human-readable prose
└── .readme.yaml     # Agent-readable structured metadata
```

### `.readme.yaml` Required Fields

```yaml
name: string                    # canonical name (matches directory/package name)
type: app | library | service | infrastructure | tool | package
description: string             # one sentence
status: active | deprecated | planned | experimental
stack: [string]                 # primary technologies
owner: string                   # GitHub team or individual (e.g. phoenixvc/backend)
```

### `.readme.yaml` Optional Fields

```yaml
version: string                 # semver if versioned
repo: string                    # GitHub URL
deployment:
  environments: [dev, staging, prod]
  url_pattern: https://...
  platform: azure-app-service | azure-swa | container-app | vercel | cloudflare
depends_on: [string]            # other services/packages this depends on
deprecated:
  reason: string
  replacement: string
  sunset_date: YYYY-MM-DD
client-doc: string              # Notion URL if a client-facing counterpart exists
```

### Type-specific Examples

**Library / shared package:**
```yaml
name: shared-messaging
type: library
description: Domain event types and message bus abstraction for Mystira services.
status: active
stack: [dotnet, csharp]
owner: phoenixvc/backend
```

**App / service:**
```yaml
name: story-generator
type: service
description: AI story generation API for Mystira interactive narratives.
status: active
stack: [dotnet, csharp, openai]
owner: phoenixvc/backend
deployment:
  environments: [dev, staging, prod]
  url_pattern: https://mys-{env}-story-gen.azurewebsites.net
  platform: azure-app-service
depends_on: [identity, shared-messaging]
```

**Infrastructure module:**
```yaml
name: infra-identity
type: infrastructure
description: Terraform module for the Mystira Identity service (Container App + Key Vault).
status: active
stack: [terraform, azure]
owner: phoenixvc/infra
```

---

## Project-Specific Overrides

<!-- TODO: Document any project-specific deviations from the canonical map above.
     Common overrides:
     - Different location for ADRs (some projects use docs/adr/ not docs/architecture/decisions/)
     - External docs platform (Confluence, GitBook, etc. instead of Notion)
     - Monorepo-level docs vs per-package docs

     Implemented for: mystira-workspace →
     - ADRs: docs/architecture/ (no decisions/ subdirectory confirmed)
     - Handoffs: org-meta/docs/handoffs/
     - Roadmap: org-meta/.roadmap.yaml
     - Backlog: org-meta/.todo.yaml
     - Client specs: Notion (workspace TBD — see sync-agent for bridging)
     - Skills: .agents/skills/ (mystira-specific) + org-meta/skills/ (canonical)
-->

_Not populated. Location overrides are project-specific._

---

## When No Canonical Location Exists

If the document type is not in this map:
1. Check the project's existing `docs/` structure for a natural fit
2. If nothing fits, propose a new directory to the user — do not guess
3. Once confirmed, add it to this reference file

Do not scatter docs in: project root (except fixed-name files), `src/`, `apps/`, or any
code directory. Documentation lives in `docs/`.
