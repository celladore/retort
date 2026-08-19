# Whitespace-Pre Rendering Regression in Landing Page Code Blocks Resolution - Historical Summary

**Completed**: 2026-08-19
**Bug ID**: N/A (found during self-review, no separate issue filed)
**PR**: [#616](https://github.com/celladore/retort/pull/616)
**Severity**: Medium — visible, but confined to one not-yet-shipped page

## Problem Description

`apps/marketing/index.html` has two code-mockup blocks (a YAML spec preview
in the hero, and a terminal-output walkthrough in Quick Start) styled with
`white-space: pre`, which makes the browser render HTML _source_
whitespace — indentation, line breaks — literally, exactly as if it were a
`<pre>` element. A prior formatting pass ran Prettier's `--write` over the
file to fix CI's Prettier check. Prettier reflows long or multi-span
`<div>` children onto multi-line, indented source for readability — a
correct, ordinary thing for it to do to normal markup — but it has no
awareness of `white-space: pre` semantics. Every div it reflowed inside
those two blocks introduced a large, ugly dead-space gap in the actual
rendered page: a full-page screenshot went from 4424px to 4669px tall.

## Root Cause Analysis

`white-space: pre` and Prettier's HTML formatter are both individually
correct; the bug is at their intersection, and nothing in the toolchain
knows about it. Prettier has no way to know that whitespace is
semantically significant inside a given element — that's a property of
the CSS, invisible to a source-only formatter. Any future `prettier --write`
over this file would silently reintroduce the same gaps unless the
affected blocks are explicitly excluded from reformatting.

## Solution Implemented

1. Collapsed the affected `<div>` children back to single-line source
   inside both blocks, restoring the original tight rendering.
2. Added `<!-- prettier-ignore -->` immediately before each of the two
   `white-space: pre` containers, so Prettier skips them permanently —
   fixing the immediate regression without leaving it able to recur on
   the next formatting pass.

### Code Changes

- **`apps/marketing/index.html`**: `<!-- prettier-ignore -->` added above
  the hero YAML-preview container and the `id="terminal-block"` Quick
  Start container; the divs Prettier had wrapped onto multiple indented
  lines inside both were collapsed back to single lines.

### Testing

- **Unit Tests**: N/A — no unit test layer for static HTML.
- **Integration Tests**: none added for this specific rendering behavior
  in this PR (see Prevention Measures — logged as a follow-up rather than
  written inline, per this repo's test-delegation convention).
- **Manual Testing**: full Playwright e2e suite (`npx playwright test`,
  5 specs) re-run and green after the fix; `prettier --check` re-run
  clean on the touched file.

## Verification

Verified both quantitatively and visually, not just "tests still pass":

### Before/After Comparison

- Full-page screenshot height: 4669px (broken) → 4424px (fixed) — the
  delta matches the number of spuriously-wrapped lines removed.
- Visual re-inspection of both light and dark full-page screenshots
  confirms the `test:` / `lint:` and terminal-output lines render flush
  and inline again in both themes, with no dead-space gaps.

### Regression Testing

`<!-- prettier-ignore -->` is a structural guard, not a one-time content
fix — it prevents the next `prettier --write` from reintroducing the same
class of bug on these two blocks specifically. It does not, on its own,
prevent a similar bug on a _new_ `white-space: pre` block added later
without the same annotation (see Prevention Measures).

## Impact Assessment

The broken rendering never reached production — it was introduced and
caught within the same unmerged PR, via the "look and feel" self-review
this PR's author was asked to perform. No end user was ever exposed to it.

## Prevention Measures

- `<!-- prettier-ignore -->` now marks both `white-space: pre` blocks
  (implemented in this fix).
- Follow-up (not done inline, delegated per this repo's
  `agent-delegation.md` convention): add an e2e assertion that fails on
  this failure mode specifically — e.g. asserting each line of the two
  blocks' rendered `innerText` starts flush-left
  (`not.toMatch(/^\s+\S/)` per line, skipping the intentional blank
  16px-spacer divs to avoid a false positive there). A pure
  screenshot-height assertion would be too brittle to keep as a
  permanent regression guard.

## Lessons Learned

A formatter that reflows source whitespace and a CSS rule that makes
source whitespace significant are individually unremarkable and mutually
invisible to each other — the combination has to be caught by actually
rendering and looking at the page, not by any purely textual check
(`prettier --check`, a diff, or CI). This is why "look at the evidence"
(the screenshots) was the step that found it, not any automated gate.

---

**Fix Author**: Claude (background session, PR #616)
**Reviewer**: pending
**Status**: Resolved
