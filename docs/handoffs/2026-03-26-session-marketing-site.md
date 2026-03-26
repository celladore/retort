# Handoff: Retort Marketing Site — Frontend Agent

**Date:** 2026-03-26
**Prepared for:** Frontend agent driving retort marketing
**Related repo:** `C:\Users\smitj\repos\codeflow-website` — reference marketing site (Next.js + Tailwind)

---

## What Is Retort

**Retort** (brand name: **AgentKit Forge**) is a spec-driven framework for multi-tool AI agent orchestration. It takes YAML specs and generates AI tool configurations for 15+ platforms (Claude, Cursor, Windsurf, Copilot, Codex, Cline, Roo, Warp, Gemini, MCP, and more) from a single source of truth.

**Value proposition in one line:**

> Write your agent team once in YAML — ship to every AI tool automatically.

**Version:** 3.1.0 · **Phase:** active

**Mission (from brand spec):**

> Empowering teams to orchestrate, configure, and unify AI toolchains with simplicity and confidence.

**Product promise:**

> The fastest, most reliable, and transparent AI agent infrastructure — delivering power, trust, and clarity from prototype to production.

**Brand attributes:** empowering, collaborative, inviting, flexible, approachable, modern

---

## Brand Tokens (canonical source: `.agentkit/spec/brand.yaml`)

| Token        | Value           | Usage                          |
| ------------ | --------------- | ------------------------------ |
| Primary      | `#1976D2`       | CTAs, links, active states     |
| Accent coral | `#FD8369`       | Highlights, hover              |
| Accent teal  | `#23BFAA`       | Success states, secondary CTAs |
| Surface      | `#F7F9FB`       | Page backgrounds               |
| Deep neutral | `#222A30`       | Headings, body text            |
| Primary font | `Inter`         | All UI text                    |
| Mono font    | `IBM Plex Mono` | Code, config outputs           |

Read the full token set from `retort/.agentkit/spec/brand.yaml` — it includes semantic colours (success `#1EDB90`, warning `#FBC02D`, error `#ED2F4B`), spacing scale, motion values, and accessibility requirements.

---

## Target Audience (from `docs/product/04_personas.md`)

Read that file. Expected personas:

- **Engineering teams** adopting multi-tool AI workflows (Claude + Cursor + Copilot side by side)
- **AI-forward CTOs/tech leads** standardising agent behaviour across a team
- **Solo developers** who use 3+ AI tools and want consistent agent personas

---

## What the Marketing Site Needs

### Must-have pages

1. **Homepage** (`/`) — hero, value prop, supported tools grid (15+ logos), 3-step "how it works", social proof / GitHub stars
2. **Features** (`/features`) — spec-driven sync, 15+ tool targets, agent registry, quality gates, team orchestration
3. **Docs / Getting Started** (`/docs`) — or link to external docs (TBD); at minimum a "Quick Start" section
4. **Pricing / Open Source** (`/pricing`) — clarify the model (open source? hosted? both?)
5. **About** — mission, team, phoenixvc org context

### Key UI components

- **Tool compatibility grid** — logos for Claude, Cursor, Windsurf, GitHub Copilot, Codex, Cline, Roo, Warp, Gemini, MCP, VS Code, JetBrains, Windsurf, ai (OpenAI), etc.
- **YAML → output demo** — side-by-side: spec YAML on left, rendered `.claude/agents/backend.md` on right
- **Agent registry preview** — table showing sample agents from `REGISTRY.json` (id, name, category, role)
- **Terminal/code snippet** — `pnpm -C .agentkit retort:sync` with animated output
- **"39 agents, 15 tools, 1 spec"** stat bar

---

## Reference Site

`codeflow-website/` is a Next.js 16 + React 19 + Tailwind CSS marketing site for a related product. Use it as:

- **Tech stack reference** — same stack is appropriate for retort marketing
- **Component patterns** — nav, hero, feature grid, CTA sections
- **Do NOT** copy content — retort and CodeFlow are different products

Read `codeflow-website/README.md` and scan `codeflow-website/src/` to understand the component structure before starting.

---

## Tech Stack for the New Site

Consistent with the workspace default and `codeflow-website`:

|                 |                                           |
| --------------- | ----------------------------------------- |
| Framework       | Next.js 15+ (App Router)                  |
| Language        | TypeScript                                |
| Styling         | Tailwind CSS v4                           |
| Package manager | **pnpm** (mandatory — workspace standard) |
| Hosting         | Azure Static Web Apps or Netlify (TBD)    |
| Analytics       | TBD                                       |

---

## Existing Assets to Pull From

| Source                         | What to extract                                               |
| ------------------------------ | ------------------------------------------------------------- |
| `.agentkit/spec/brand.yaml`    | All colour tokens, fonts, spacing, motion — this is canonical |
| `.claude/agents/REGISTRY.json` | Live agent data for the agent registry demo component         |
| `.claude/agents/REGISTRY.md`   | Markdown version of the same                                  |
| `docs/product/01_prd.md`       | Problem statement and goals (even if partially filled)        |
| `docs/product/04_personas.md`  | Target audience                                               |
| `CLAUDE.md` (retort root)      | Feature list, command reference, team structure               |
| `AGENTS.md`                    | Agent capabilities narrative                                  |

---

## Session Scope

This session is **discovery + architecture only**:

1. Read `codeflow-website` to understand the existing pattern
2. Read retort brand spec, personas, and PRD
3. Decide: new repo (`retort-website`) or subdirectory of retort (`apps/website/`)?
4. Produce a site map (pages + sections per page)
5. Produce a component inventory (what components are needed)
6. Produce a `package.json` skeleton and recommended folder structure
7. **Do not build the site yet** — output is a plan document at `docs/product/prd/PRD-marketing-site.md`

---

## Constraints

- Brand tokens must come from `.agentkit/spec/brand.yaml` — do not hardcode colours
- pnpm only — no npm or yarn
- If creating a new repo, confirm with user before doing so (do not create repos unilaterally)
- The site must be statically exportable (`next export`) to keep hosting costs low
- No framework-specific CMS — content lives in MDX or static JSON files
