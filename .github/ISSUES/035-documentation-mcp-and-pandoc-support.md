# feat(mcp): Evaluate documentation MCP and Pandoc-oriented content workflows

**Priority:** P1 — High
**Labels:** `enhancement`, `mcp`, `documentation`, `pandoc`, `content`
**Blocked by:** #014

---

## Problem

There is no dedicated ticket for documentation-focused MCP workflows, despite strong relevance to Retort.

Pandoc also appeared in the marketplace screenshots, and documentation-oriented MCP support could be valuable for:

- content transformation
- markdown/doc generation pipelines
- multi-format exports
- docs QA and publishing workflows

---

## Suggestions

Candidate documentation-MCP use cases worth evaluating:

- documentation retrieval/search MCPs for style guides, ADRs, PRDs, and API docs
- Pandoc MCP for converting markdown to docx/html/pdf-friendly flows
- content validation or publishing MCPs
- docs synchronization between repo and external knowledge systems
- structured doc generation assistants for specs, changelogs, and handoffs

---

## Implementation Plan

### Step 1: Define the documentation MCP category

Clarify what belongs in this category:

- retrieval/search/documentation context servers
- transform/export servers such as Pandoc
- publishing/sync servers

### Step 2: Evaluate Pandoc specifically

Assess whether Pandoc MCP support should help with:

- markdown-to-docx
- markdown-to-html
- markdown-to-pdf-oriented workflows
- frontmatter-preserving transformations

### Step 3: Identify Retort-specific value

Potential value areas:

- PRDs and ADR exports
- handoff document export
- changelog publishing
- proposal/review packet generation

---

## Acceptance Criteria

- [ ] Documentation MCP category is described with examples
- [ ] Pandoc MCP is evaluated as a concrete candidate
- [ ] Documentation-oriented use cases for Retort are listed
- [ ] Follow-up implementation work is identified if warranted

---

## Related

- MCP umbrella: `.github/ISSUES/013-trae-mcp-alignment-umbrella.md`
