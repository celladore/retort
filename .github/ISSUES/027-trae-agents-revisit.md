# feat(agent): Revisit agent strategy for TRAE compatibility and one-click import workflows

**Priority:** P1 — High
**Labels:** `enhancement`, `agent`, `trae`, `dx`
**Blocked by:** None

---

## Problem

TRAE provides both agent overview guidance and custom agents ready for one-click import. Retort should revisit whether its agent model and generated outputs map well to those capabilities.

References:

- https://docs.trae.ai/ide/agent-overview?_lang=en
- https://docs.trae.ai/ide/custom-agents-ready-for-one-click-import

Areas to revisit:

- agent packaging/export model
- one-click import compatibility
- agent granularity and overlap
- team agents vs specialist agents vs skills
- metadata required for better import and discoverability

---

## Proposed Subtasks

### 1. Audit current agent model against TRAE import expectations

Review whether existing generated agent outputs contain the right metadata and shape.

### 2. Revisit agent portfolio size and overlap

Identify over-specialization, duplication, and missing platform-oriented personas.

### 3. Evaluate export/import affordances

Determine whether Retort should emit TRAE-ready agent artifacts directly or via an adapter/export step.

---

## Acceptance Criteria

- [ ] Current agent strategy is audited against TRAE docs
- [ ] One-click import implications are documented
- [ ] Agent overlap/gaps are identified
- [ ] Follow-up implementation tasks are identified if needed

## Implementation Notes (2026-03-20)

Issue 040 (elegance-guidelines) from `feat/kit-domain-selection-onboarding` adds per-agent
design guidance that improves agent quality independent of platform. The kit-based filtering
work means agent-related generation is more stack-aware. TRAE-specific agent packaging/import
format audit remains outstanding — this should be prioritised in the next sprint.

---

## Note

**Status: Deferred** (2026-03-21)

Issue #040 (`elegance-guidelines`) from PR #432 improves agent quality through per-agent design guidance, independent of platform. The kit-based domain filtering work makes agent-related generation more stack-aware. However, TRAE-specific agent packaging (one-click import format, metadata requirements, export model) has not been addressed and remains a follow-up.

Agent catalog filtering by active kit is a natural next enhancement — defer to after the TRAE format audit is completed. Reference the domain filtering approach (`filterDomainsByStack()`) as the model to follow.

---

## Related

- TRAE docs: https://docs.trae.ai/ide/agent-overview?_lang=en
- TRAE docs: https://docs.trae.ai/ide/custom-agents-ready-for-one-click-import
- Related: `.github/ISSUES/040-agents-should-consider-architectural-elegance.md` (elegance field merged)
