<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Copilot domain-specific instructions. -->
<!-- Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot -->
# Copilot Instructions — Documentation

Apply these rules when editing files in `docs/`, `*.md`, or `*.mdx`.

## Markdown Conventions

- Use ATX-style headings (`#`, `##`, `###`). Do not use setext (underline) style.
- Add a single blank line before and after headings, code blocks, and lists.
- Use fenced code blocks with a language identifier (e.g., ```typescript).
- Prefer reference-style links for URLs that appear more than once.
- Keep lines at a reasonable length; do not hard-wrap prose at 80 columns
  (let the renderer handle wrapping).

## Architecture Decision Records (ADRs)

When creating an ADR, use this template:

```
# ADR-NNNN: Title

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-XXXX

## Context
What is the issue or decision we need to make?

## Decision
What did we decide?

## Consequences
What are the trade-offs and implications?
```

- Number ADRs sequentially.
- Never delete an ADR; mark it as Deprecated or Superseded instead.
- Keep the Context section factual and the Decision section concise.

## General Guidelines

- Write in active voice and present tense.
- Use second person ("you") for instructions and tutorials.
- Define acronyms on first use.
- Include a brief summary or purpose statement at the top of every document.
- Validate Markdown with markdownlint before committing.
