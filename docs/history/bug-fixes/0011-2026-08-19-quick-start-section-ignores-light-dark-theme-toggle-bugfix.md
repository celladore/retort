# Quick Start Section Ignores Light/Dark Theme Toggle Resolution - Historical Summary

**Completed**: 2026-08-19
**Bug ID**: N/A (reported via screenshot in the same session, no separate issue filed)
**PR**: [#616](https://github.com/celladore/retort/pull/616)
**Severity**: Medium — visible on every page load in light mode, confined to one not-yet-shipped page

## Problem Description

In light mode, the `<section id="quickstart">` band ("Four commands from
empty repo to synced configs") stayed dark regardless of the theme toggle,
producing a large, page-dominating dark block sitting between two light
sections — reported by the user from a light-mode screenshot as "dark
colors in light mode."

## Root Cause Analysis

The section's background was hardcoded to `var(--deep)`, a token defined
almost identically dark in both palettes (`#18232a` light / `#101a20`
dark — a 6-hex-digit difference), unlike every other section on the page,
which uses `var(--surface)` or the inherited `var(--bg)` and correctly
alternates between light and dark shades. `--deep` exists specifically for
small "always-dark IDE window" mockup cards (the hero YAML preview, the
Quick Start terminal card) — a legitimate, intentional pattern borrowed
here for the full-bleed section background, where it does not belong: a
page-chrome element should follow the theme, not imitate a code editor.

Because the section's interior text and chips were themselves hardcoded
for a dark backdrop (`#f7f9fb` / `#c4cdd4` text, a `rgba(247, 249, 251,
0.06)` white-tint chip background), simply swapping the section background
to `var(--surface)` would have made the text and chips nearly invisible
against the new light background — the section's whole interior had to be
tokenized in the same change, not just its background.

## Solution Implemented

1. Changed the section background from `var(--deep)` to `var(--surface)`,
   with `border-top`/`border-bottom: 1px solid var(--lineSoft)`, matching
   the established `<section id="how">` pattern so it now alternates with
   the surrounding sections like the rest of the page.
2. Replaced every hardcoded light-only color inside the section's left
   column (heading, paragraph, four step descriptions, inline `retort
check` code span) with the theme tokens `var(--fg)` / `var(--muted)`.
3. Added a new theme-reactive `--accentTeal` token (`#0f766e` light /
   `#23bfaa` dark) for the "Quick start" eyebrow label and the `01`–`04`
   step numerals — the original fixed `#23bfaa` teal has ~2.1:1 contrast
   against the new light `var(--surface)` background, well under the
   4.5:1 WCAG AA threshold this repo's `ts-wcag-aa` rule requires; `#0f766e`
   measures ~5.1:1 against `#f4f6f8` computed via the WCAG relative
   luminance formula.
4. Restyled the three bottom badge chips ("node ≥ 22", "zero runtime deps
   in generated output", "MIT") from `color: #c4cdd4` /
   `background: rgba(247, 249, 251, 0.06)` to `var(--muted)` /
   `var(--card)` with a `var(--line)` border, matching the chip pattern
   already used in the hero (`16 generated targets · one spec`).
5. Left the terminal mockup card (`background: #23303a` and its internal
   terminal-syntax colors) and the hero YAML-preview card (`var(--deep)`)
   unchanged — both are intentional, self-contained "code editor" elements
   that are conventionally dark regardless of page theme, distinct from
   the section chrome around them.

### Code Changes

- **`apps/marketing/index.html`**: added `--accentTeal` to both theme
  palettes; changed the Quick Start section's background/border and every
  hardcoded text/chip color inside it (excluding the terminal mockup card)
  to theme-aware tokens.
- **`docs/history/features/0004-2026-08-19-marketing-landing-page-feature.md`**:
  corrected the "Quick start (dark section)" component description, which
  this fix made inaccurate.

### Testing

- **Unit Tests**: N/A — no unit test layer for static HTML.
- **Integration Tests**: existing `e2e/marketing-landing.spec.mjs` suite
  (5 specs, including the theme-toggle and full-page screenshot specs)
  re-run and green; no new spec added inline, per this repo's
  test-delegation convention (`.claude/rules/agent-delegation.md`).
- **Manual Testing**: full Playwright e2e suite re-run (`npx playwright
test e2e/marketing-landing.spec.mjs`, 5/5 green); `prettier --check`
  re-run clean on the touched file; the Quick Start section was screenshotted
  directly (not just as part of the full-page capture) in both themes to
  confirm text/chip legibility close up.

## Verification

Verified visually, not just via passing tests — full-page thumbnails are
too small to catch a small-text contrast regression, so the Quick Start
section was captured on its own in both themes.

### Before/After Comparison

- Light mode: section background changed from a fixed dark navy to the
  same light grey (`var(--surface)`) used by the "How it works" section;
  heading/body text changed from illegible-on-light-eventually to `var(--fg)`
  / `var(--muted)`; badge chips gained a visible white-on-grey card
  treatment instead of an invisible white-tint-on-white background.
- Dark mode: no visible change — `var(--surface)` and the prior
  `var(--deep)` are close enough in the dark palette that the section
  still reads as part of the dark page, and the terminal card's own fixed
  dark background still stands out against it exactly as before.

### Regression Testing

Re-ran the full Playwright suite after the fix (5/5 passing, including the
theme-toggle correctness spec and the full-page screenshot capture spec)
and re-ran `prettier --check` on the touched file — both clean.

## Impact Assessment

The broken rendering never reached production — caught and fixed within
the same unmerged PR the page was introduced in. No end user was ever
exposed to it.

## Prevention Measures

- The section now uses the same `var(--surface)` + `var(--lineSoft)`
  border pattern as every other section, so a future edit that
  accidentally reintroduces a fixed dark background here reads as an
  obvious deviation from the surrounding markup on review.
- `--accentTeal` is now a real theme token instead of a literal repeated
  seven times across the file — any future use of this accent color
  inherits correct contrast in both themes automatically.

## Lessons Learned

A token that happens to resolve to visually similar values in both themes
(`--deep`) is easy to reach for anywhere "a dark background" is wanted,
but its intended scope was much narrower (small code-mockup cards) than
where it ended up being used (a full-bleed page section). The everything-is-
dark-anyway similarity between `--deep`'s two palette values is exactly
what let this ship without either theme's rendering looking obviously
"broken" in isolation — the bug was only visible as a _toggle_ not doing
anything, which a static screenshot of either theme alone doesn't show but
a side-by-side light/dark comparison catches immediately.

---

**Fix Author**: Claude (background session, PR #616)
**Reviewer**: pending
**Status**: Resolved
