# feat(mcp): Evaluate hosting our own MCP server for Retort

**Priority:** P1 — High
**Labels:** `enhancement`, `mcp`, `architecture`, `platform`
**Blocked by:** #014

---

## Problem

Retort currently consumes or plans around third-party MCP servers, but there is no dedicated issue evaluating whether the project should host its own MCP server.

This needs a deliberate architectural decision before ad hoc implementation begins.

---

## What would our own MCP server do?

Candidate responsibilities worth evaluating:

- expose Retort project/spec metadata to MCP-capable clients
- expose backlog/tasks/orchestrator state in a stable tool interface
- expose docs/ADR/PRD retrieval with project-aware filtering
- expose workflow execution surfaces safely
- expose project health/status summaries
- provide a stable adapter over Retort-native concepts instead of leaking file layout details

Possible non-goals:

- arbitrary shell execution without existing safety boundaries
- replacing all existing platform-native tooling
- building a giant catch-all MCP with no governance

---

## Implementation Plan

### Step 1: Define the product case

Answer whether a first-party MCP server would improve:

- interoperability
- platform portability
- discoverability of Retort capabilities
- safer integrations for external tools

### Step 2: Define candidate tool surface

Possible initial tool groups:

- project/discovery
- tasks/backlog
- documentation retrieval
- orchestration status
- validation/health summary

### Step 3: Define security model

Clarify:

- authentication
- read-only vs mutating tools
- workspace scoping
- secret handling
- approval boundaries

### Step 4: Decide deployment model

Options:

- local bundled MCP server
- standalone package
- optional service/adapter layer

---

## Acceptance Criteria

- [ ] A first-party MCP server product case is evaluated
- [ ] Candidate tool surface is documented
- [ ] Security model and boundaries are documented
- [ ] A go/no-go or phased recommendation is produced

---

## Related

- MCP umbrella: `.github/ISSUES/013-trae-mcp-alignment-umbrella.md`
