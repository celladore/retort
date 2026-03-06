# AGENTS.md Guide

## What is AGENTS.md?

`AGENTS.md` is a universal agent instruction file that tells AI coding tools
about your project — its tech stack, architecture, conventions, testing strategy,
and how agents should behave when working on your code. It is an emerging
standard stewarded by the Agentic AI Foundation under the Linux Foundation.

AgentKit Forge generates `AGENTS.md` automatically from your `project.yaml` and
spec files. It is always generated regardless of which render targets are
enabled — every sync produces a fresh `AGENTS.md` at the repository root.

## Which Tools Read It?

`AGENTS.md` is natively supported by a growing number of AI coding tools:

- **OpenAI Codex** — Reads `AGENTS.md` + `AGENTS.override.md` at every directory level before executing tasks.
- **Google Jules** — Automatically looks for `AGENTS.md` in the repo root before every task.
- **GitHub Copilot** — VS Code auto-detects and applies instructions to all chat requests.
- **Roo Code** — Loads after mode-specific rules, before generic rules.
- **Cline** — Loads alongside `.clinerules/`.
- **Cursor** — Recognized as part of the AGENTS.md initiative.
- **Amp** — Native support.
- **Factory** — Native support.
- **OpenCode** — Native support.
- **Amazon Q Developer** — Announced support.
- **Sourcegraph Cody** — Reads AGENTS.md for project context.
- **Aider** — Reads AGENTS.md + conventions file.

Because these tools read `AGENTS.md` natively, they do not require dedicated
render targets or template files in AgentKit Forge — the universal `AGENTS.md`
is sufficient.

## What Gets Included?

The content of `AGENTS.md` is generated from:

1. **`project.yaml`** — Tech stack, architecture, frameworks, conventions, testing,
   cross-cutting concerns, deployment, and integrations.
2. **Template** — `templates/root/AGENTS.md` provides the structure with
   `{{#if}}` conditionals and `{{#each}}` loops that produce sections only when
   the corresponding data exists in `project.yaml`.
3. **Spec files** — Team definitions, command references, and rule summaries
   from `teams.yaml`, `commands.yaml`, and `rules.yaml`.

Sections that have no data (e.g., no auth provider configured) are omitted
automatically — the output is never bloated with empty placeholders.

## Best Practices

### Keep project.yaml Accurate

`AGENTS.md` is only as good as the data in `project.yaml`. After running
`agentkit init`, review `project.yaml` and fill in any details the discovery
pass missed — especially cross-cutting concerns (auth, caching, error handling)
and deployment details.

### Don't Edit AGENTS.md Directly

`AGENTS.md` is regenerated on every `sync`. Any manual edits will be lost.
Instead, edit the source:

- **Project-level context** → Edit `.agentkit/spec/project.yaml`.
- **Template structure** → Edit `.agentkit/templates/root/AGENTS.md`.

### Commit Strategy

`AGENTS.md` is gitignored by default because it is always regenerated. Each
developer runs `agentkit sync` after cloning to produce their local copy.

If your team prefers to commit `AGENTS.md` (e.g., for tools that read it
directly from the GitHub repository without local checkout), remove the
`/AGENTS.md` line from `.gitignore`.

### AGENTS.override.md for Monorepos

OpenAI Codex supports `AGENTS.override.md` at every directory level in a
monorepo. This allows per-package or per-service overrides. AgentKit Forge does
not yet generate these automatically, but you can create them manually:

```
packages/
  api/
    AGENTS.override.md    # API-specific overrides
  web/
    AGENTS.override.md    # Web-specific overrides
AGENTS.md                 # Root-level (generated)
```

Each `AGENTS.override.md` is merged with the root `AGENTS.md` by tools that
support it. Other tools (Jules, Copilot, etc.) only read the root file.

### Keep It Focused

`AGENTS.md` should contain instructions that are relevant to _all_ AI tools
working on your codebase. Tool-specific instructions belong in their dedicated
configs (`CLAUDE.md`, `.cursor/rules/`, etc.).

Good content for `AGENTS.md`:

- Tech stack and framework versions
- Architecture pattern and API style
- Testing requirements and coverage targets
- Code conventions (naming, file structure, patterns)
- Security and compliance requirements
- Integration boundaries (external APIs, auth providers)

Content that belongs elsewhere:

- Tool-specific slash commands → `commands.yaml`
- IDE-specific rules → `rules.yaml` + tool templates
- Permission lists → `settings.yaml`

---

## References

- [TOOLS.md](./TOOLS.md) — Full list of supported tools and what they generate
- [PROJECT_YAML_REFERENCE.md](./PROJECT_YAML_REFERENCE.md) — Schema for project.yaml
- [CUSTOMIZATION.md](./CUSTOMIZATION.md) — Overlay system and render targets
