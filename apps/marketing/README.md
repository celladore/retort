# apps/marketing

Draft static marketing landing page for retort. Single self-contained file —
no build step, no framework, no dependencies.

## Status

- **Draft** — not yet linked from any deploy workflow or hosting config.
- Visual design approved via Claude web (claude.ai) design mode; this HTML is
  a hand-converted static rebuild of that approved mockup (the original was
  delivered in Claude's internal DC component format, which needs a JS
  runtime to render and isn't suitable to ship as-is).
- Copy was fact-checked against the real repo and corrected in a few places
  where the mockup drifted from actual CLI commands/paths (see PR description
  for the full list) — e.g. `npx retort ...` → `pnpm -C .agentkit retort:...`,
  `.retort/*.yaml` → `.agentkit/spec/*.yaml`, and a few fabricated generated
  file paths swapped for the real ones.

## Structure

- `index.html` — the entire page: markup, inline CSS (brand tokens from
  `.agentkit/spec/brand.yaml`), and a small vanilla-JS theme toggle
  (localStorage-persisted) plus a copy-to-clipboard button for the quick-start
  terminal block. No external JS.
- Fonts load from Google Fonts (Inter + IBM Plex Mono); everything else is
  self-contained.

## Not yet done

- No hosting/deploy pipeline wired up.
- No favicon beyond an inline SVG data URI placeholder.
- Not added to `pnpm-workspace.yaml` (it's a bare static file, no
  `package.json`, so it doesn't need to be).
