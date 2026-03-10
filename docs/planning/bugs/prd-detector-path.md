# BUG-001: PRD Detector Path Bug in discover.mjs

**Created**: 2026-03-06
**Priority**: P0
**Status**: not-started
**Category**: bugs
**Source**: Extracted from `plan.md` Part 3
**History**: —

## Goal

Fix the PRD document detector in `discover.mjs` so it actually finds PRDs stored in `docs/product/`.

## Bug Description

In `.agentkit/engines/node/src/discover.mjs` line 215, the `DOC_ARTIFACT_DETECTORS` entry for PRDs only searches:

```javascript
{ name: 'prd', label: 'PRDs', dirs: ['docs/prd', 'docs/PRD'], files: ['PRD.md', 'docs/PRD.md'] }
```

But actual PRDs live in `docs/product/` (e.g., `docs/product/PRD-005-mesh-native-distribution.md`). The detector will **never find them**.

## Proposed Fix

Add `docs/product` to the `dirs` array:

```javascript
{ name: 'prd', label: 'PRDs', dirs: ['docs/prd', 'docs/PRD', 'docs/product'], files: ['PRD.md', 'docs/PRD.md'] }
```

## Files to Modify

| File                                         | Change                                     |
| -------------------------------------------- | ------------------------------------------ |
| `.agentkit/engines/node/src/discover.mjs`    | Add `docs/product` to PRD detector dirs    |

## Acceptance Criteria

- [ ] `docs/product` is included in PRD detector dirs
- [ ] `/discover` correctly finds PRDs in `docs/product/`
- [ ] No regression — existing `docs/prd` and `docs/PRD` paths still work

## Risks

- Minimal — single-line addition to an array

## References

- Source: `plan.md` Part 3 ("Additional Bug: PRD Detector Doesn't Find PRDs")
- Prerequisite for: INT-001 (intake agent needs PRD discovery)

---

**Author**: AI (extracted from plan.md)
**Reviewed**: No
