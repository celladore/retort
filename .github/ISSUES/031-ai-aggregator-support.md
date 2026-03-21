# feat(platform): Add support strategy for AI aggregators such as LobeHub

**Priority:** P1 — High
**Labels:** `enhancement`, `platform`, `aggregator`, `ai`, `dx`
**Blocked by:** None

---

## Problem

Retort currently focuses mostly on editor and agent-runtime targets, but there is a separate class of tools that act as AI aggregators or orchestration hubs.

Example requested category:

- LobeHub

Potentially similar surfaces may include:

- multi-model chat hubs
- prompt/router workspaces
- agent dashboards
- bring-your-own-provider AI shells

The framework needs a clear answer for whether and how such tools should be supported.

---

## Proposed Scope

### 1. Define the category

Name and define the category, for example:

- AI aggregators
- AI workspaces
- multi-provider agent shells
- orchestration hubs

### 2. Define support modes

Possible support modes:

- exported prompts/instructions
- agent bundle export
- rules/skills export
- MCP configuration guidance
- docs-only support

### 3. Evaluate LobeHub as the reference case

Assess:

- import/export compatibility
- agent and prompt packaging fit
- memory/MCP integration relevance
- maintenance burden

---

## Acceptance Criteria

- [ ] The aggregator category is named and defined
- [ ] LobeHub is evaluated as the reference case
- [ ] Support modes are documented
- [ ] Follow-up implementation work is identified if warranted

---

## Related

- Umbrella: `.github/ISSUES/029-platform-support-umbrella.md`
