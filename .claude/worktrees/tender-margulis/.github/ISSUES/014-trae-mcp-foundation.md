# feat(mcp): Define MCP support model, categories, and governance

**Priority:** P1 — High
**Labels:** `enhancement`, `mcp`, `spec`, `governance`
**Blocked by:** None

---

## Problem

MCP support currently exists as scattered capability rather than a governed framework concern. Retort needs a clear model for deciding:

- Which MCP servers are officially supported
- Which MCP servers are merely documented or recommended
- How MCP categories map into specs, templates, docs, and validation
- How platform-specific guidance should differ for TRAE, Claude, Cursor, Windsurf, and others

Reference:

- https://docs.trae.ai/ide/model-context-protocol?_lang=en

---

## Implementation Plan

### Step 1: Define MCP support levels

Introduce explicit statuses such as:

- `documented`
- `generated-config`
- `validated`
- `first-class`
- `experimental`

### Step 2: Define MCP categories

Create a category taxonomy aligned to practical usage:

- browser-devtools
- repo-git-issues
- database-storage
- research-search-docs
- memory-knowledge
- design-figma
- desktop-filesystem-shell
- messaging-collaboration
- testing-quality

### Step 3: Add canonical metadata location

Add a canonical source of truth, for example one of:

- `.agentkit/spec/mcp.yaml`
- `project.yaml` MCP section
- `settings.yaml` MCP section

The chosen format should capture:

- server name
- category
- support level
- platform applicability
- required credentials / prerequisites
- generated outputs impacted

### Step 4: Validation and sync impact analysis

Update validator/sync architecture so MCP metadata can be:

- validated for shape and duplicates
- rendered into docs and platform instructions
- excluded cleanly when unsupported

### Step 5: Documentation governance

Document how a new MCP server is proposed, reviewed, and promoted between support levels.

---

## Acceptance Criteria

- [ ] A canonical MCP support model exists with support levels
- [ ] MCP categories are documented and reused consistently
- [ ] A source-of-truth metadata location is defined
- [ ] Validator/sync impact is specified
- [ ] Governance flow exists for adding new MCP servers

---

## Related

- Umbrella: `.github/ISSUES/013-trae-mcp-alignment-umbrella.md`
