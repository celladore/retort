# Follow-Up Issues

These items should be filed as GitHub issues. Created during the review cycle of the brand theme feature.

---

## Issue 1: Generate brand guide static HTML page from brand.yaml

**Type**: Enhancement

### Summary

Add a new sync output that generates a static HTML brand guide page from `brand.yaml`. This would serve as a living visual reference for the brand, showing:

- Color swatches with hex values, roles, and rationale
- Typography samples with the configured font families and scale
- Spacing/layout tokens visualization
- Dark mode palette alongside light mode
- Accessibility compliance badges (WCAG level, contrast ratios)
- Motion/animation guidelines

### Motivation

The `brand.yaml` spec captures comprehensive brand data, but YAML is hard to visually evaluate. A generated HTML page would:

- Let designers and developers instantly see the brand palette
- Serve as onboarding documentation for new team members
- Be auto-generated during `agentkit sync` and kept in sync with brand changes
- Require zero manual effort to maintain

### Proposed Output

- **Path**: `docs/brand/index.html` (scaffold-once, or always-sync with a sentinel comment)
- **Template**: New Handlebars template in `templates/brand/index.html`
- **Trigger**: Generated when `hasBrandGuide: true` and a new `brandPage.enabled: true` toggle is set in `project.yaml`

### Implementation Notes

- Parse `brand.yaml` colors using the existing `brand-resolver.mjs` functions
- Generate inline CSS (no external dependencies) for portability
- Include both light and dark mode sections
- Use the brand's own typography tokens for the page itself
- Add color contrast ratio calculations using the existing accessibility spec values
- Consider generating a `docs/brand/tokens.json` sidecar in Style Dictionary format

### Acceptance Criteria

- [ ] `agentkit sync` generates `docs/brand/index.html` when enabled
- [ ] Page renders all primary, secondary, semantic, neutral colors as swatches
- [ ] Page shows typography scale with sample text
- [ ] Dark mode section visible
- [ ] No external CDN dependencies (fully self-contained HTML)
- [ ] Tests verify the page is generated and contains expected sections

---

## Issue 2: Generate CSS custom properties / design tokens from brand.yaml

**Type**: Enhancement

### Summary

Add a new sync output that generates CSS custom properties (`:root { --color-primary: #1976D2; }`) and/or a Style Dictionary–compatible `tokens.json` from `brand.yaml`.

### Motivation

Frontend projects need design tokens in consumable formats (CSS variables, JSON tokens). Currently `brand.yaml` is a YAML-only artifact. Generating CSS variables and JSON tokens would:

- Allow direct consumption in stylesheets without manual transcription
- Feed into build tools like Style Dictionary, Tailwind, or PostCSS
- Keep generated tokens always in sync with the canonical `brand.yaml`

### Proposed Outputs

- `styles/tokens/brand.css` — CSS custom properties for all colors, spacing, typography
- `styles/tokens/tokens.json` — Style Dictionary format
- Gated by a new `designTokens.enabled: true` toggle in `project.yaml`

---

## Issue 3: Brand inheritance / extends for multi-repo organizations

**Type**: Enhancement

### Summary

Support `extends: @org/brand` in `brand.yaml` to allow repos to inherit from a shared organizational brand spec, overriding only the fields they need.

### Motivation

Organizations with multiple repos sharing the same brand (e.g., ChaufHER rider app, ChaufHER driver app, ChaufHER admin) shouldn't duplicate `brand.yaml` across every repo. An extends mechanism would centralize brand management.

### Open Questions

- Should the base brand be fetched from an npm package, a URL, or a sibling directory?
- How to handle deep merges for nested color/typography structures?

---

## Issue 4: Theme preview command (`agentkit theme:preview`)

**Type**: Enhancement

### Summary

Add an `agentkit theme:preview` command that applies the brand theme temporarily to the current VS Code workspace without committing, so designers can validate colors before sync.

### Implementation Ideas

- Write a temporary `.vscode/settings.json` override
- Open a VS Code preview panel showing the resolved color slots
- Auto-revert after a timeout or on Ctrl+C

---

## Issue 5: WCAG contrast ratio validation in brand.yaml validation

**Type**: Enhancement

### Summary

Extend `validateBrandSpec()` to compute actual contrast ratios between foreground/background color pairs and warn when they fail the declared `accessibility.bodyContrast` and `accessibility.largeTextContrast` thresholds.

### Implementation Notes

- Use relative luminance formula per WCAG 2.1
- Check: brand color on white, brand color on dark background, semantic colors on their typical backgrounds
- Report as warnings (not errors) with the computed ratio vs. required ratio

---

## Issue 6: Add linter guard for test file imports

**Type**: Bug / DX
**Priority**: Medium

### Summary

The project linter (likely an import auto-organizer) repeatedly strips the `spawnSync` import from `child_process` in test files when it reformats them. This caused the prettier formatting test to fail with `ReferenceError: spawnSync is not defined` multiple times during development.

### Root Cause

The linter sees `spawnSync` as "unused" when it analyzes the file in isolation, because the prettier test block uses it inside a `describe()` callback that the linter may not fully trace.

### Fix Applied

Extracted the prettier test into its own file (`prettier.test.mjs`) so the `spawnSync` import is clearly the primary dependency and the linter will not strip it.

### Prevention

- Consider adding an ESLint rule or `.eslintrc` override to prevent auto-removal of `child_process` imports in test files
- If using `eslint-plugin-unused-imports`, configure exceptions for test files that use `spawnSync`
- Document in CONTRIBUTING.md that test files with shell-spawning tests should be isolated

---

## Issue 7: Add parameterized stateDir test for all platforms

**Type**: Enhancement / Testing
**Priority**: Low

### Summary

The `{{stateDir}}` template variable is resolved per-platform in `buildCommandVars()`. Test coverage now exists for Claude, Cursor, Copilot, Codex, and Windsurf but future platforms (Gemini, Cline, Roo, Warp) should also be covered if they support state directories.

### Suggestion

- When adding a new render target that uses `{{stateDir}}`, add a corresponding integration test
- Consider a parameterized test that iterates over all platforms with state directories automatically
