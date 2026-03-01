<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Copilot domain-specific instructions. -->
<!-- Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot -->
# Language-Specific Copilot Instructions

This directory contains Copilot instruction files, one per programming language
detected in **{{projectName}}**. Each file provides language-specific coding
conventions, testing patterns, and tooling requirements.

## Active Languages

| File | Language | Applies to |
|------|----------|-----------|
{{#if hasLanguageTypeScript}}| [`typescript.md`](./typescript.md) | TypeScript / JavaScript | `*.ts`, `*.tsx`, `*.js`, `*.mjs` |
{{/if}}
{{#if hasLanguagePython}}| [`python.md`](./python.md) | Python | `*.py`, `pyproject.toml` |
{{/if}}
{{#if hasLanguageRust}}| [`rust.md`](./rust.md) | Rust | `*.rs`, `Cargo.toml` |
{{/if}}
{{#if hasLanguageDotnet}}| [`dotnet.md`](./dotnet.md) | .NET / C# | `*.cs`, `*.csproj`, `*.sln` |
{{/if}}
{{#if hasLanguageBlockchain}}| [`blockchain.md`](./blockchain.md) | Blockchain / Smart Contracts | `*.sol`, `contracts/**` |
{{/if}}

## How It Works

GitHub Copilot can apply path-specific instructions from `.github/instructions/`.
These files are loaded when you edit files matching the language's file patterns.
To activate them, reference the instruction files in your VS Code or Copilot
configuration.

## Adding a New Language

1. Create `<language>.md` in this directory.
2. Follow the header format used by existing files.
3. Add the new entry to the table above.
4. Reference this file in `.github/instructions/README.md`.

## Generated From

These files are generated from:

- **Project config**: `stack.languages` in `.agentkit/spec/project.yaml`
- **Rule specs**: per-domain entries in `.agentkit/spec/rules.yaml`
- **Templates**: `.agentkit/templates/copilot/language-instructions/`
