<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Copilot domain-specific instructions. -->
<!-- Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot -->
# Path-Specific Copilot Instructions

This directory contains instruction files that GitHub Copilot applies based on
the file path being edited. Each `.md` file targets a specific area of the
codebase and provides domain-specific guidance.

## How It Works

GitHub Copilot Chat can load additional instructions from
`.github/copilot-instructions.md` (global) and from path-specific instruction
files referenced in VS Code settings or the Copilot configuration.

Files in this directory are organized by domain:

| File              | Scope                                    |
| ----------------- | ---------------------------------------- |
| `docs.md`         | Documentation, Markdown, ADRs            |
| `marketing.md`    | Marketing site, Next.js, React, CSS      |
| `rust.md`         | Rust crates, error handling, testing      |

## Adding New Instructions

1. Create a new `.md` file named after the domain (e.g., `python.md`).
2. Write clear, concise rules that Copilot should follow when editing files in
   that domain.
3. Keep instructions actionable — prefer "use X pattern" over "consider X".
4. Reference this directory in your Copilot or IDE configuration so the
   instructions are loaded automatically.

## Maintenance

- Review these files when project conventions change.
- Remove instructions that no longer apply to avoid confusing the model.
- Keep each file under 500 lines to stay within context window limits.
