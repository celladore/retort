# Router Specialist Implementation Plan v3 (Reference Stub)

> Consumer-repo reference only.
> Authoritative implementation planning lives upstream in `justaghost/agentkit-forge`.

## Source of truth

- Canonical repo: `https://github.com/justaghost/agentkit-forge`
- Canonical migration scope: `router core trio + architecture sync docs`
- Local generated `.agentkit` content may be overwritten by sync.

## Upstream links (fill when created)

- Upstream issue: `[deferred]`
- Upstream PR(s): `[deferred]`
- Runtime handoff tracking (`phoenixvc/ai-gateway`): `[deferred]`

## Local purpose in `phoenixvc/chaufher`

- Keep route-level references to upstream router-specialist artifacts.
- Track linkage status for governance and downstream teams.
- Avoid authoritative implementation edits in generated router-specialist files.

## Upstream sync scope note

- This migration pass also requires upstream alignment for AgentKit command/hook contract updates across:
  - `.agentkit/docs/guides/COMMAND_REFERENCE.md`
  - `.agentkit/docs/getting-started/QUICK_START.md`
  - `.agentkit/spec/commands.yaml`
  - `.agentkit/templates/claude/hooks/guard-destructive-commands.sh`
  - `.agentkit/templates/claude/hooks/protect-sensitive.sh`
  - `.agentkit/templates/claude/hooks/session-start.sh`
  - `.agentkit/templates/claude/hooks/setup-environment.sh`
  - `.agentkit/templates/claude/hooks/warn-uncommitted.sh`
  - `.agentkit/templates/claude/commands/delegate.md`
  - `.agentkit/templates/claude/commands/mode.md`
  - `.agentkit/templates/claude/commands/tasks.md`
- Authoritative changes for these files belong in `justaghost/agentkit-forge`; local copies track linkage only.

## Current status

- Ownership model documented locally: `done`
- Upstream issue/spec publication: `pending`
- Upstream command/hook contract sync (11 files): `pending`
- Local-to-upstream linkback IDs: `pending`
