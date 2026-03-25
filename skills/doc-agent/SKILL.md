---
name: doc-agent
description: >
  This skill should be used when the user asks to "document what we built", "update the
  README", "write an ADR", "create a history document", "document this feature", "what
  docs are missing", "write a session handoff", "update CLAUDE.md", or "maintain the
  dual-file convention". Provides documentation workflows, ADR format, and dual-file
  (README.md + .readme.yaml) maintenance guidance.
version: 0.1.0
---

# Doc Agent Skill

Documentation workflows for session histories, READMEs, ADRs, and inline docs.
Delegates session history docs to retort's `document-history` skill.

## Before Creating Any Document

Load the `document-creation` skill first — it provides the canonical location map, naming
conventions, audience check, and templates for all document types. Do not decide where a
document lives from memory; always consult the location map.

## Dual-File Convention

Every documented component should maintain two files in parallel:
- `README.md` — human-readable, markdown prose
- `.readme.yaml` — agent-readable structured metadata

Schema and examples: `references/readme-yaml-convention.md` or the `document-creation`
skill's `references/document-locations.md § Dual-File Convention`.

## When to Write What

| Trigger | Output | Location (via document-creation skill) |
|---|---|---|
| Session ends with significant work | retort `document-history` | `org-meta/docs/handoffs/` |
| New service or package added | README.md + .readme.yaml | Package root |
| Architectural decision made | ADR | `docs/architecture/decisions/` |
| Public API changed | Inline doc update (XML/JSDoc/rustdoc) | In-source |
| Doc gap scan requested | Gap report by severity | Terminal output only |

## ADR Process

1. Check the project's current ADR registry for the next number (see project extension points)
2. Use the ADR format from `references/readme-yaml-convention.md` § "ADR Format"
3. Status starts as `Proposed` — only the user sets it to `Accepted`
4. Place in `docs/architecture/decisions/ADR-NNNN-kebab-title.md`

## Doc Gap Analysis

To assess what's missing:
1. `Glob **/*.cs,**/*.ts,**/*.rs` for public APIs without doc comments
2. `Glob **/README.md` vs `Glob **/src` — directories with source but no README
3. `Glob docs/architecture/decisions/` — confirm significant past decisions have ADRs
4. Report: **Blocking** (public API undocumented) → Important → Nice-to-have

## Additional Resources

### Reference Files

- **`references/readme-yaml-convention.md`** — Full .readme.yaml schema and examples
- **`document-creation` skill** → **`references/document-locations.md`** — Canonical location map for all document types
