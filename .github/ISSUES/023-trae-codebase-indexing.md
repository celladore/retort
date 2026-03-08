# feat(indexing): Revisit codebase indexing support and guidance for TRAE-style workflows

**Priority:** P1 — High
**Labels:** `enhancement`, `indexing`, `trae`, `dx`
**Blocked by:** None

---

## Problem

TRAE documents explicit codebase indexing behavior, but AgentKit Forge does not yet define a corresponding framework posture for indexing-aware workflows.

Reference:

- https://docs.trae.ai/ide/codebase-indexing?_lang=en

Questions to resolve:

- What should AgentKit Forge assume about indexing availability?
- Which generated instructions should be indexing-aware?
- How should indexing limitations or stale index behavior be handled?
- What repo guidance improves indexing quality in large or multi-root workspaces?

---

## Proposed Subtasks

### 1. Define indexing assumptions

Document what generated tooling may assume about codebase indexing and retrieval quality.

### 2. Improve repository guidance for indexing

Identify repo patterns that improve indexability:

- clear entry points
- source-of-truth docs
- reduced duplication
- stable generated file organization

### 3. Handle stale or partial indexing

Document fallback behavior when indexing is incomplete, stale, or absent.

### 4. Evaluate spec/template implications

Determine whether indexing-aware instructions belong in generated rules/commands/platform docs.

---

## Acceptance Criteria

- [ ] Indexing assumptions are documented
- [ ] Repo guidance for improving indexing quality is captured
- [ ] Fallback behavior for weak indexing is documented
- [ ] Template/spec impacts are identified

---

## Related

- TRAE docs: https://docs.trae.ai/ide/codebase-indexing?_lang=en
