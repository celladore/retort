# retort

![Version](https://img.shields.io/badge/version-0.0.1-blue) ![Status](https://img.shields.io/badge/status-active-green) ![License](https://img.shields.io/badge/license-MIT-green)

> Universal AI agent scaffold — single YAML spec generates consistent tool configs for 15+ AI coding assistants, with MCP/A2A protocol integration.
>
> **retort** is the agent engineering foundation of the phoenixvc ecosystem, published as a public standalone template. Every AI coding tool has its own config format (`CLAUDE.md`, `.cursor/rules/`, `.windsurf/rules/`, `AGENTS.md`, etc.). Maintaining them by hand means duplicated effort and drift. retort solves this with a single source of truth: you define your project once in YAML, and `agentkit sync` generates consistent, project-aware configs for every tool your team uses.
>
> ---
>
> ## What it does
>
> - **Single YAML spec** — Define your project, team, commands, and rules once in `.agentkit/spec/project.yaml`.
> - - **Multi-tool generation** — Generates configs for 15+ tools: Claude Code, Cursor, Windsurf, Copilot, Codex, Gemini, Warp, Cline, Roo Code, Continue, Jules, Amp, Factory, and more.
>   - - **MCP/A2A integration** — Orchestration layer with slash commands, team routing, quality gates, and session state that works identically across all supported tools.
>     - - **Cross-platform** — Windows, macOS, Linux. Polyglot support (any language, any framework).
>       - - **Public template** — Designed to be cloned or used as a GitHub template. phoenixvc projects use it as their agent engineering baseline.
>        
>         - ---
>
> ## How it works
>
> ```
> .agentkit/spec/project.yaml   ← you describe your project once
> .agentkit/spec/*.yaml         ← teams, commands, rules, settings
> .agentkit/templates/          ← templates per tool
>         ↓
>     agentkit sync
>         ↓
> AGENTS.md, CLAUDE.md, .claude/, .cursor/, .windsurf/,
> .github/prompts/, GEMINI.md, WARP.md, .clinerules/, ...  ← generated
> ```
>
> 1. **`agentkit init`** — scans your repo, asks a few questions, writes `project.yaml`.
> 2. 2. **`agentkit sync`** — renders templates, generates all tool configs.
>   
>    3. ---
>   
>    4. ## Quick start
>   
>    5. ```bash
>       # Use as a GitHub template, or clone directly
>       npx agentkit init
>       npx agentkit sync
>       ```
>
> Or via pnpm:
>
> ```bash
> pnpm ak:setup   # install + sync in one step
> ```
>
> ---
>
> ## Repository layout
>
> ```
> retort/
> ├── .agentkit/              # AgentKit spec and templates
> │   ├── spec/               # project.yaml, team configs
> │   └── templates/          # per-tool templates
> ├── src/start/              # CLI entry point
> ├── db/                     # Database schema (if applicable)
> ├── migrations/             # DB migrations
> ├── scripts/                # Utility scripts (sync, split-pr)
> ├── docs/                   # Architecture, runbooks
> ├── infra/                  # Infra-as-code (if applicable)
> ├── package.json            # pnpm workspace root
> └── README.md
> ```
>
> ---
>
> ## Ecosystem
>
> retort is the agent engineering baseline for the phoenixvc platform. It connects to:
>
> | Repo | Role |
> |---|---|
> | [`cockpit`](https://github.com/phoenixvc/cockpit) | Desktop ops tool — uses retort scaffold internally; cockpit can invoke retort via CLI to bootstrap new agent projects |
> | [`ai-cadence`](https://github.com/phoenixvc/ai-cadence) | Project tracker — retort-based projects can read their tasks from ai-cadence via MCP |
> | [`ai-flume`](https://github.com/phoenixvc/ai-flume) | AI data plane — projects scaffolded with retort inherit ai-flume as their model gateway |
> | [`cognitive-mesh`](https://github.com/phoenixvc/cognitive-mesh) | Agent orchestration — retort-based agents are routed through cognitive-mesh for complex multi-agent tasks |
> | [`org-meta`](https://github.com/phoenixvc/org-meta) | Org registry — org-meta's CLAUDE.md and project specs are generated using retort |
>
> ---
>
> ## Inspiration
>
> - [**AgentKit**](https://github.com/inngest/agent-kit) — agent orchestration patterns and YAML-driven config generation
> - - [**dotfiles**](https://dotfiles.github.io) — the original single-source-of-truth config management pattern, adapted for AI tooling
>  
>   - ---
>
> ## Name
>
> **retort** — a retort is a sharp, witty response, but also a sealed laboratory vessel used for distillation and chemical reactions. Both meanings apply: retort gives you a precise, controlled response to the chaos of AI tool fragmentation (the sharp comeback), and it's a vessel in which agent configurations are synthesised from raw ingredients (the chemistry). The name sits comfortably alongside `cockpit` and `ai-flume` — slightly more playful, but intentional.
>
> The repo was previously called `agentkit-forge` internally. The public-facing name `retort` better reflects its standalone, template-first character.
> 
