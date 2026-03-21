# Retort Sync Feedback (pvc-costops-analytics)

This document captures practical feedback from using Retort v3.1.0 in this repository, with a focus on sync behavior, Windows developer experience, and documentation workflows.

## Summary

- Sync produces a large, multi-editor surface area (Claude/Cursor/Windsurf/Copilot/VSC) which is useful, but creates a lot of churn and line-ending noise on Windows.
- "Scaffold-once" behavior is sensible, but it's not obvious how to intentionally override generated docs content without editing generated outputs directly.
- The sync CLI emits `Warning: unresolved placeholders: {{placeholders}}` without pointing to the source file(s), which makes it hard to remediate.

## Observed Sync Output

From a sync run:

- `Editor theme: all output targets exist (scaffold-once) — skipping. Use --overwrite to regenerate.`
- `... 18 managed file(s) merged (user edits + template changes)`
- `Skipped 142 project-owned file(s) (already exist).`
- `Warning: unresolved placeholders: {{placeholders}}`

## Pain Points

### 1) Overriding generated documentation content is unclear

The generated docs under:

- `docs/operations/*`
- `docs/05_operations/*`

include scaffold placeholders (e.g., "Describe the incident response process…"). When attempting to update the relevant template(s) under `.agentkit/templates/docs/**`, those changes did not propagate to the generated docs after sync. In practice, the only reliable way to update the content was to edit the generated docs directly and rely on "managed file merge" to preserve changes.

Suggestion:

- Provide a documented override mechanism (repo-local overlay file mapping, or a supported `templates/` override directory that is guaranteed to be used).
- Consider printing which source template/spec file produced each generated output (especially for docs).

### 2) Unresolved placeholder warning lacks diagnostics

The message:

`Warning: unresolved placeholders: {{placeholders}}`

does not indicate:

- which file(s) contain the unresolved placeholders
- whether placeholders are in templates, overlays, or outputs

Suggestion:

- Emit the list of file paths containing unresolved placeholders (top N with counts).
- Provide a `--fail-on-unresolved-placeholders` and/or `--explain-placeholders` mode.

### 3) Windows line-ending churn and Git warnings

On Windows, Git warned that many generated files will convert LF→CRLF in working copy. This can cause:

- noisy diffs
- merge conflicts across dev environments
- unnecessary PR churn

Suggestion:

- Provide an optional `.gitattributes` template or guidance for consistent EOL in generated content.
- Optionally generate files with CRLF on Windows (or allow a configuration knob).

### 4) Running sync via pnpm may fail in restricted environments

In some environments, running:

`pnpm -C .agentkit agentkit:sync`

may attempt to write to user-level pnpm state/cache locations under `%LOCALAPPDATA%`, which can fail under restricted permissions. Running the sync via node was more reliable:

`node .agentkit/engines/node/src/cli.mjs sync`

Suggestion:

- Document a "node direct" fallback for sync in the runbook.
- Consider a sync option to force pnpm store/state dirs into repo-local paths.

## Repo-specific improvements enabled by sync

- Multi-editor instructions and rules are consistently generated for Claude/Cursor/Windsurf/Copilot.
- Documentation structure under `docs/` is scaffolded and kept consistent across runs (when not overridden).

## Recommended next steps (Retort)

- Add official support for repo-local overrides of specific generated docs (e.g., incident response).
- Improve unresolved placeholder diagnostics.
- Provide Windows-focused EOL guidance for generated files.
