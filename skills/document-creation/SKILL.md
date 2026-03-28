---
name: document-creation
description: >
  This skill should be used when the user or any agent is about to create a new document,
  file, or written artifact. Triggers on: "create a document", "write a spec", "where
  should I put this", "create an ADR", "write a runbook", "document this feature",
  "add to the wiki", "write a post-mortem", "create a proposal", "draft a brief",
  "write meeting notes", "where do PRDs go", "create release notes", or any request
  to produce a persistent written artifact that needs to be stored somewhere.

  Also triggers when an agent is about to create a file that looks like documentation
  (*.md, *.yaml in docs/, *.txt design artifacts) without explicit location guidance.
version: 0.1.0
---

# Document Creation Skill

Before creating any document: classify the type, look up the canonical location, confirm
with the user if uncertain. Do not create documents in random locations.

## Step 1 — Classify the Document

| Category          | Types                                                       | Audience                    |
| ----------------- | ----------------------------------------------------------- | --------------------------- |
| **Strategic**     | ADR, proposal, RFP response, architecture brief             | Internal / engineering      |
| **Product**       | PRD, spec, acceptance criteria, feature brief               | Internal / cross-functional |
| **Client-facing** | Client spec, project brief, status update, invoice scope    | External / client           |
| **Technical**     | README, API doc, runbook, migration guide, onboarding guide | Developers                  |
| **Release**       | Changelog, release notes, upgrade guide                     | Public / consumers          |
| **Session/AI**    | Handoff doc, trace, investigation finding, session log      | AI agents / continuity      |
| **Project mgmt**  | Meeting notes, sprint retrospective, post-mortem, risk log  | Internal / team             |

## Step 2 — Look Up Canonical Location

See `references/document-locations.md` for the full location map.

Quick reference for the most common types:

| Document type   | Canonical location                                    | Format             |
| --------------- | ----------------------------------------------------- | ------------------ |
| ADR             | `docs/architecture/decisions/NNNN-title.md`           | Markdown           |
| PRD             | `docs/product/prd/YYYY-MM-DD-feature-name.md`         | Markdown           |
| README          | Project / package root — `README.md` + `.readme.yaml` | Dual-file          |
| Runbook         | `docs/runbooks/topic.md`                              | Markdown           |
| Changelog       | Project root `CHANGELOG.md`                           | Keep-a-Changelog   |
| Release notes   | GitHub Releases (not a file in repo)                  | Markdown           |
| Session handoff | `org-meta/docs/handoffs/YYYY-MM-DD-topic.md`          | Markdown           |
| Agent trace     | `.agents/traces/YYYY-MM-DD-topic.md`                  | Markdown           |
| Post-mortem     | `docs/incidents/YYYY-MM-DD-incident.md`               | Markdown           |
| Client spec     | **Notion** — not committed to repo                    | External           |
| API spec        | `docs/api/` or `openapi/`                             | OpenAPI / Markdown |

## Step 3 — Naming Conventions

- **Date-prefixed docs** (PRDs, handoffs, post-mortems, meeting notes): `YYYY-MM-DD-slug.md`
- **Sequentially-numbered docs** (ADRs): `NNNN-slug.md` where NNNN increments from the last
- **Stable reference docs** (runbooks, guides): `topic-name.md` — no date prefix
- **Root-level docs** (README, CHANGELOG, CLAUDE.md): fixed names, no prefix

All slugs: lowercase kebab-case. No spaces. No version numbers in filenames (versions go inside the doc).

## Step 4 — Audience Check

**Before writing:** confirm whether this document is:

- **Internal only** → commit to repo in the canonical location
- **Client-facing** → goes to Notion or the configured external system; do NOT commit to repo
- **AI-readable** → pair a `.readme.yaml` or use YAML frontmatter; see dual-file convention
- **Public** → consider if it belongs in a docs site rather than repo markdown

If a document spans audiences (e.g. a spec that's both client-facing AND needs to feed
the dev roadmap), create both artifacts: the client version in Notion, the AI-readable
version in the repo. The sync-agent handles drift between them.

## Step 5 — Check Before Creating

Before creating a new file:

1. Check whether the document already exists at the canonical location
2. Check whether an existing doc should be _updated_ rather than a new one created
3. If the location doesn't exist yet (e.g. no `docs/runbooks/` directory), create it — don't
   put the file somewhere else just because the directory is missing

## Creating a README (Dual-File Convention)

Every documented component maintains two files:

- `README.md` — human prose
- `.readme.yaml` — structured agent-readable metadata

See `references/document-locations.md § Dual-File Convention` for the full schema.

## Creating an ADR

ADRs record a significant architectural decision that is not obvious from the code.

```markdown
# NNNN. Title (active voice: "Use X for Y")

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by [NNNN](NNNN-title.md)
**Tags:** backend, data, security, infra, frontend (pick relevant)

## Context

What situation or constraint makes a decision necessary?

## Decision

What was decided? State it clearly in one sentence.

## Consequences

What becomes easier? What becomes harder? What risks are accepted?

## Considered Alternatives

- **Option A** — why rejected
- **Option B** — why rejected
```

Number by incrementing the last ADR in `docs/architecture/decisions/`.

## Creating a PRD

Use the format defined in `product-agent`. Location: `docs/product/prd/YYYY-MM-DD-feature-name.md`.
After creating, notify `product-agent` to register it in the roadmap.

## Creating a Post-Mortem

```markdown
# Incident: YYYY-MM-DD — Short title

**Severity:** P0 / P1 / P2
**Duration:** HH:MM
**Affected:** list services/users

## Timeline

| Time  | Event |
| ----- | ----- |
| HH:MM | ...   |

## Root Cause

One sentence.

## Contributing Factors

Bulleted list.

## Action Items

| Item | Owner | Due |
| ---- | ----- | --- |
| ...  | ...   | ... |

## What Went Well
```

## Additional Resources

- **`references/document-locations.md`** — full canonical location map for all document types,
  including project-specific overrides (e.g. Mystira-specific paths)
