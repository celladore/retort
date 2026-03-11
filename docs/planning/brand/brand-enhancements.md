# BR-001 → BR-005: Brand Feature Enhancements

**Created**: 2026-03-10
**Priority**: P2–P3
**Status**: not-started
**Category**: brand
**Source**: Extracted from `.agentkit/docs/reference/FOLLOW_UP_ISSUES.md` (Issues 1–5)
**History**: —

## Goal

Five enhancements to the `/brand` feature that extend brand.yaml into consumable frontend artifacts and add validation.

---

## BR-001: Generate brand guide static HTML page (P2)

Generate a self-contained HTML brand guide page from `brand.yaml` during `agentkit sync`.

- **Output**: `docs/brand/index.html`
- **Gated by**: `brandPage.enabled: true` in project.yaml
- Shows color swatches, typography, spacing, dark mode, accessibility badges
- No external CDN dependencies

## BR-002: Generate CSS custom properties / design tokens (P2)

Generate CSS variables and Style Dictionary JSON from `brand.yaml`.

- **Outputs**: `styles/tokens/brand.css`, `styles/tokens/tokens.json`
- **Gated by**: `designTokens.enabled: true` in project.yaml
- Consumable by Tailwind, PostCSS, Style Dictionary

## BR-003: Brand inheritance / extends (P3)

Support `extends: @org/brand` in `brand.yaml` for multi-repo brand inheritance.

- Centralized brand management for organizations with multiple repos
- Open questions: npm package vs URL vs sibling directory; deep merge strategy

## BR-004: Theme preview command (P3)

Add `agentkit theme:preview` to temporarily apply brand theme to VS Code without committing.

- Write temporary `.vscode/settings.json` override
- Auto-revert after timeout or Ctrl+C

## BR-005: WCAG contrast ratio validation (P2)

Extend `validateBrandSpec()` to compute actual contrast ratios and warn on failures.

- Use WCAG 2.1 relative luminance formula
- Report as warnings with computed ratio vs required ratio

---

## Files to Modify

| File                                            | Change                            |
| ----------------------------------------------- | --------------------------------- |
| `.agentkit/engines/node/src/brand-resolver.mjs` | Add HTML generation, token export |
| `.agentkit/engines/node/src/synchronize.mjs`    | Wire new sync outputs             |
| `.agentkit/spec/project.yaml`                   | Add feature toggles               |
| `.agentkit/templates/brand/index.html`          | New HTML template (BR-001)        |

## Acceptance Criteria

- [ ] BR-001: `agentkit sync` generates `docs/brand/index.html` when enabled
- [ ] BR-002: CSS custom properties file generated with all brand tokens
- [ ] BR-003: `extends` field resolves and deep-merges parent brand spec
- [ ] BR-004: Preview command applies and reverts theme cleanly
- [ ] BR-005: Validation warns on contrast ratio failures

## References

- Source: `.agentkit/docs/reference/FOLLOW_UP_ISSUES.md` Issues 1–5
- Depends on: `/brand` command (already merged)

---

**Author**: AI (extracted from FOLLOW_UP_ISSUES.md)
**Reviewed**: No
