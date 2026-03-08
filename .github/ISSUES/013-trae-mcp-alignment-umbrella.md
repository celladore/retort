# feat(trae): Align MCP support with TRAE marketplace capabilities

**Type:** Feature Proposal + Platform Alignment
**Priority:** High
**Labels:** `enhancement`, `mcp`, `integration`, `trae`, `dx`
**Blocked by:** None
**Blocks:** #014, #015, #016, #017, #018

---

## Summary

Add first-class support for high-value MCP integrations and MCP-oriented framework behavior so AgentKit Forge can better interoperate with TRAE-style MCP workflows.

This umbrella tracks:

- Core MCP support alignment with TRAE documentation
- Prioritized MCP servers requested for early support
- Category-based expansion plan for broader marketplace coverage
- Spec, template, docs, and workflow updates needed to make MCP support durable

Primary reference:

- https://docs.trae.ai/ide/model-context-protocol?_lang=en
- https://docs.trae.ai/ide/01fzsij0?_lang=en

Priority MCPs explicitly requested:

- TestSprite
- Notion
- Gitingest-MCP
- Minidoracat/mcp-feedback-enhanced

Additional screenshot-visible MCP categories worth grouping:

- Browser / automation
- Git / repository / issue management
- Database / data access
- Design / Figma
- Memory / knowledge graph
- Desktop / filesystem / command execution
- Search / research / documentation retrieval
- Messaging / collaboration

---

## Problem

AgentKit Forge already generates MCP-related assets (for example `.mcp/a2a-config.json`) and contains early A2A/task delegation concepts, but the framework does **not yet present a coherent strategy** for:

1. Selecting and prioritizing high-value MCP servers
2. Modeling MCP server categories in spec/config
3. Generating platform guidance for MCP-enabled IDEs such as TRAE
4. Documenting supported vs experimental MCP integrations
5. Providing opinionated onboarding for commonly useful MCP servers

This creates a gap between:

- What MCP-capable IDEs now expose in marketplace workflows
- What AgentKit Forge can scaffold, document, validate, and maintain

---

## Goals

- Define a canonical MCP support strategy for AgentKit Forge
- Prioritize practical MCP servers with clear user value
- Add documentation, config, and generated output support where justified
- Avoid server-by-server sprawl without governance
- Create a phased rollout path by MCP category

---

## Proposed Scope

### Phase 1: Foundation

- Define supported MCP categories and maturity levels
- Add documented criteria for adopting MCP servers
- Add a central inventory/spec surface for supported MCP integrations
- Clarify what is runtime support vs documentation guidance vs generated config support

### Phase 2: Priority Integrations

Prioritize the user-requested set first:

- TestSprite
- Notion
- Gitingest-MCP
- Minidoracat/mcp-feedback-enhanced

### Phase 3: Category Expansion

Add category-based follow-up tickets for the broader marketplace set, including:

- Browser / devtools
- Repo / git / issue workflows
- Database / storage
- Design / Figma
- Search / docs / research
- Desktop / filesystem / shell
- Memory / graph / knowledge

---

## Deliverables

- MCP support strategy document
- Spec updates (if needed) for MCP inventory / enablement metadata
- Generated docs or platform guidance updates for MCP-capable IDEs
- Validation rules for MCP-related config
- Prioritized integration notes for the first supported servers

---

## Acceptance Criteria

- [ ] MCP support strategy is documented with category grouping and support levels
- [ ] Priority MCP servers are triaged with concrete implementation approach
- [ ] At least one canonical spec/config location exists for MCP integration metadata
- [ ] TRAE-facing guidance references the official MCP documentation
- [ ] Follow-on sub-issues cover the highest-value MCP categories and integrations

---

## Related

- TRAE MCP docs: https://docs.trae.ai/ide/model-context-protocol?_lang=en
- TRAE popular MCPs: https://docs.trae.ai/ide/01fzsij0?_lang=en
- Figma support umbrella: `.github/ISSUES/024-trae-figma-support.md`
- Memory support umbrella: `.github/ISSUES/019-trae-memory-support-umbrella.md`

---

## Sub-Issues

| #   | File                                        | Title                                                   | Priority | Status |
| --- | ------------------------------------------- | ------------------------------------------------------- | -------- | ------ |
| 014 | `014-trae-mcp-foundation.md`                | Define MCP support model, categories, and governance    | P1       | Open   |
| 015 | `015-priority-mcp-integrations.md`          | Add priority MCP integrations for TRAE alignment        | P1       | Open   |
| 016 | `016-mcp-category-browser-devtools.md`      | Evaluate browser and devtools MCP category support      | P2       | Open   |
| 017 | `017-mcp-category-repo-data-research.md`    | Evaluate repo, data, and research MCP category support  | P2       | Open   |
| 018 | `018-mcp-category-desktop-collab-memory.md` | Evaluate desktop, collaboration, and memory MCP support | P2       | Open   |
