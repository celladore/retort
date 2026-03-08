# feat(context): Add guidance for automated context compaction workflows

**Priority:** P1 — High
**Labels:** `enhancement`, `context`, `trae`, `orchestration`
**Blocked by:** None

---

## Problem

TRAE documents automated context compaction, but AgentKit Forge does not yet define how its generated prompts, workflows, and orchestration model should behave when context is compacted automatically.

Reference:

- https://docs.trae.ai/ide/context-compaction?_lang=en

This matters for:

- long-running orchestration sessions
- agent handoffs
- durable task state
- memory interactions
- minimizing important context loss

---

## Proposed Subtasks

### 1. Define compactable vs non-compactable state

Identify what must survive compaction, including:

- active tasks
- orchestration state
- critical decisions
- user constraints
- unresolved blockers

### 2. Update handoff/documentation patterns

Ensure generated handoff and summary formats preserve the right state for compacted sessions.

### 3. Review prompt/rule verbosity impact

Revisit prompt and rule design so compaction pressure is reduced without losing critical instructions.

### 4. Align with memory strategy

Clarify how compaction interacts with future memory support.

---

## Acceptance Criteria

- [ ] Context compaction strategy is documented
- [ ] Durable vs transient session state is identified
- [ ] Handoff/summary outputs are reviewed for compaction resilience
- [ ] Interaction with memory support is addressed

---

## Related

- TRAE docs: https://docs.trae.ai/ide/context-compaction?_lang=en
- Memory umbrella: `.github/ISSUES/019-trae-memory-support-umbrella.md`
