# feat(mcp): Add priority MCP integrations for TRAE alignment

**Priority:** P1 — High
**Labels:** `enhancement`, `mcp`, `integration`, `trae`
**Blocked by:** #014

---

## Problem

The highest-value MCP servers requested for early alignment are not yet tracked as a coherent implementation set.

Priority references:

- <https://docs.trae.ai/ide/01fzsij0?_lang=en>
- <https://docs.trae.ai/ide/model-context-protocol?_lang=en>

Priority servers requested:

- TestSprite
- Notion
- Gitingest-MCP
- Minidoracat/mcp-feedback-enhanced

---

## Implementation Plan

### Step 1: Triage each priority server

For each server, document:

- primary use case
- expected user value
- credential / environment requirements
- local vs hosted execution model
- overlap with existing Retort capabilities
- target support level

### Step 2: Define framework integration surface

For each server, decide whether Retort should add:

- documentation only
- recommended install/onboarding workflow
- generated config snippets
- validation hooks
- command or skill integration guidance

### Step 3: Add platform guidance

Update generated docs/guidance so MCP-capable IDE users can understand:

- when to use each priority server
- prerequisites
- security considerations
- expected maintenance burden

### Step 4: Sequence implementation

Suggested order:

1. Notion (#033)
2. TestSprite
3. Gitingest-MCP
4. Minidoracat/mcp-feedback-enhanced

Reasoning:

- Notion and TestSprite have broader team utility
- Gitingest-MCP is strong for repo ingestion and summarization workflows
- Feedback-enhanced MCP improves interactive agent loops after the core path is stable

### Step 5: Track adjacent high-value MCP follow-ups

Beyond the first four priority MCPs, keep the following adjacent follow-ups visible:

- Notion MCP client support details: `033-notion-mcp-client-support.md`
- Documentation MCP and Pandoc workflows: `035-documentation-mcp-and-pandoc-support.md`
- Self-hosted Retort MCP server strategy: `036-self-hosted-mcp-server-strategy.md`
- Todoist-through-MCP task integration: `037-todoist-mcp-task-integration.md`
- InsForge MCP evaluation: `034-insforge-mcp-support.md`

---

## Acceptance Criteria

- [ ] Each priority server has a documented recommendation and support level
- [ ] Security/prerequisite notes exist for all four servers
- [ ] The rollout order is documented
- [ ] Dedicated follow-up tickets exist for Notion-specific planning and adjacent MCP opportunities
- [ ] Resulting work can be split into implementation-sized follow-ups if needed

---

## Related

- Umbrella: `.github/ISSUES/013-trae-mcp-alignment-umbrella.md`
- Dedicated Notion MCP ticket: `.github/ISSUES/033-notion-mcp-client-support.md`
