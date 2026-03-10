# DX-001 → DX-002: Developer Experience Improvements

**Created**: 2026-03-10
**Priority**: P2–P3
**Status**: not-started
**Category**: bugs
**Source**: Extracted from `.agentkit/docs/reference/FOLLOW_UP_ISSUES.md` (Issues 6–7)
**History**: —

## Goal

Two DX improvements for test reliability and platform coverage.

---

## DX-001: Add linter guard for test file imports (P2)

**Type**: Bug / DX

The project linter strips `spawnSync` from `child_process` in test files, causing `ReferenceError` failures. A workaround (separate test file) is in place, but the root cause (linter config) is not fixed.

**Fix options**:
- Add ESLint rule or `.eslintrc` override to prevent auto-removal of `child_process` imports in test files
- Configure `eslint-plugin-unused-imports` exceptions for test files using `spawnSync`
- Document in CONTRIBUTING.md

## DX-002: Add parameterized stateDir test for all platforms (P3)

**Type**: Enhancement / Testing

The `{{stateDir}}` template variable is tested for Claude, Cursor, Copilot, Codex, and Windsurf but not for newer platforms (Gemini, Cline, Roo, Warp).

**Fix**: Create a parameterized test iterating over all platforms with state directories automatically.

---

## Files to Modify

| File                     | Change                                       |
| ------------------------ | -------------------------------------------- |
| `.eslintrc` / ESLint config | Add exception for child_process in tests  |
| Test files               | Add parameterized stateDir test              |

## References

- Source: `.agentkit/docs/reference/FOLLOW_UP_ISSUES.md` Issues 6–7

---

**Author**: AI (extracted from FOLLOW_UP_ISSUES.md)
**Reviewed**: No
