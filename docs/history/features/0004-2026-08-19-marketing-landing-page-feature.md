# Marketing Landing Page Launch - Historical Summary

**Launched**: 2026-08-19
**PR**: [#616](https://github.com/celladore/retort/pull/616)
**Feature Type**: New Feature

## Feature Overview

A single self-contained static landing page (`apps/marketing/index.html`) for
Retort: hero, "how it works" (4-step spec → validate → sync → check), a grid
of the 16 config targets Retort generates in their native format, a
"quick start" dark section with a 4-command terminal walkthrough, and a
closing CTA. Light/dark theme toggle persisted via `data-theme` +
`aria-pressed`. No build step — one HTML file with inline styles and a
small inline script, plus a Playwright e2e suite that captures full-page
screenshots as visual evidence and guards against known factual
regressions (e.g. stale command names, placeholder GitHub links).

## User Problem Solved

Retort previously had no public-facing explanation of what it does or how
to start using it outside of the README. This page gives a prospective
adopter a 30-second answer ("spec-driven config for 16 AI tool targets")
and a copy-pasteable four-command path to trying it on their own repo.

## Implementation Details

### Architecture

Static HTML, no framework, no build step — deliberately matches the
project's "zero runtime deps in generated output" positioning. All styling
is inline (CSS custom properties on `:root` for the light/dark palette,
flipped via a `data-theme` attribute set by a small inline `<script>`).
Two code-mockup blocks (`.agentkit/spec/project.yaml` preview in the hero,
and the terminal walkthrough in Quick Start) use `white-space: pre` to
render as literal monospace text without a `<pre>` tag's default styling.

### Components

- **Header** — logo, version badge, nav links, theme toggle, GitHub link.
- **Hero** — value prop, CTA buttons, YAML spec code-mockup card.
- **How it works** — 4-step numbered card grid.
- **Targets grid** — 16 supported tool targets grouped by category (agents,
  editors & CI, protocols & docs), plus an integrations/files-written
  summary strip.
- **Quick start** (theme-aware section) — 4-step numbered list + a
  terminal-output mockup card that stays dark by convention in both themes
  (matching the hero's code-preview card).
- **CTA footer** — "try it on one repo" callout + site footer.

### API Changes

None — static content only.

### Database Changes

None.

## User Experience

Single scrolling page, fully responsive via flex-wrap columns that stack
below ~900px. Theme toggle switches the entire palette (background,
surface, text, border tokens) without a page reload.

### UI Changes

New page; no existing UI was modified.

### Documentation

`apps/marketing/README.md` documents how to preview the page locally and
the e2e test/screenshot workflow.

## Rollout Plan

Static file, deployed however the repo's hosting is configured (no
separate build/deploy pipeline was added in this PR — out of scope).

### Phasing

- **Phase 1** (this PR): page + e2e coverage, ready for review.
- **Phase 2** (future): wire into actual hosting/deploy target once decided.

### Monitoring

None yet — no analytics were added in this PR.

## Results

Not yet measurable — page has not shipped to production hosting as part
of this PR.

### Usage Statistics

N/A.

### User Feedback

N/A.

## Future Enhancements

- Add analytics once a hosting target is chosen.
- Consider a visual regression test guard for the two `white-space: pre`
  code blocks (see the companion bugfix doc,
  [0010](../bug-fixes/0010-2026-08-19-whitespace-pre-rendering-regression-in-landing-page-code-blocks-bugfix.md)) —
  logged as follow-up rather than done inline, per this repo's
  test-delegation convention.

## Related Work

- [0010-2026-08-19 — Whitespace-pre rendering regression in landing page code blocks](../bug-fixes/0010-2026-08-19-whitespace-pre-rendering-regression-in-landing-page-code-blocks-bugfix.md) —
  a rendering bug introduced during formatting cleanup of this same page,
  found and fixed within this PR.
- [0011-2026-08-19 — Quick Start section ignores light/dark theme toggle](../bug-fixes/0011-2026-08-19-quick-start-section-ignores-light-dark-theme-toggle-bugfix.md) —
  the Quick Start section's background and interior colors were hardcoded
  for a dark backdrop, so it never followed the toggle. Found from a
  light-mode screenshot and fixed within this PR.

---

**Product Manager**: N/A (solo PR)
**Tech Lead**: N/A (solo PR)
**Status**: Ready for review
