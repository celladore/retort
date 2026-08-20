# apps/marketing

Draft static marketing landing page for retort. Single self-contained file —
no build step, no framework, no dependencies.

## Status

- **Deployed** — live at [retort.celladoresystems.com](https://retort.celladoresystems.com/)
  (Railway; DNS managed in `celladore-org/infrastructure/dns`, PR
  [celladore/celladore-org#11](https://github.com/celladore/celladore-org/pull/11)).
  See "Deployment" below.
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
- `Dockerfile` / `Caddyfile` — deploy config for Railway. Caddy serves
  `index.html` as-is; no build step, matching the rest of this page's
  zero-dependency design.

## Deployment

Hosted on Railway (project `retort`, service `marketing`), fronted by
`retort.celladoresystems.com` via a Cloudflare DNS-only CNAME managed in
`celladore-org/infrastructure/dns` (not in this repo — see that repo's
README "How a record gets added" for why DNS lives there instead of here).

Known gap: the Railway service currently builds from the
`feat/marketing-railway-deploy` branch, not `dev`/`main` — that's the only
place this Dockerfile/Caddyfile exist until this PR merges. Once merged to
`dev`, the Railway service's source branch should be switched to `dev`
(the custom-domain CNAME target is stable across that change, so no DNS
follow-up is needed).

## Not yet done

- No favicon beyond an inline SVG data URI placeholder.
- Not added to `pnpm-workspace.yaml` (it's a bare static file, no
  `package.json`, so it doesn't need to be).
