# .ai — Tool-Agnostic AI Rules

These rule files provide portable, tool-agnostic conventions that work across
multiple AI-assisted development environments:

- **Cursor** — reads `.ai/cursorrules`
- **Windsurf** — reads `.ai/windsurfrules`
- **Continue** — reads `.ai/continuerules`
- **GitHub Copilot** — can reference `.ai/` directory in custom instructions

## Purpose

The `.ai/` directory establishes a shared baseline so every AI assistant in
your workflow follows the same principles regardless of IDE or plugin.

## Core Principles

1. **Prefer small, reversible changes** — Each commit should be easy to review
   and safe to revert.
2. **Keep builds and tests green** — Never merge code that breaks CI. Run
   quality gates before marking work as complete.
3. **Never touch secrets** — Do not read, print, modify, or commit `.env`
   files, tokens, API keys, or credential stores.
4. **Include validation commands** — Every task summary should list the exact
   commands needed to verify the change (e.g., `npm test`, `cargo clippy`).
5. **Follow the orchestration workflow** — Use `/discover`, `/healthcheck`,
   `/plan`, `/check`, and `/review` to stay coordinated.

## Usage

During `agentkit init`, these files are copied into the target repository's
`.ai/` directory. They are intentionally kept short so AI assistants include
the full text in their context window without truncation.

Customize the files after generation to match your project's specific
conventions and tool chain.
