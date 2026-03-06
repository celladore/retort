# AI Routing Gateway — Roadmap (Reference Stub)

> Consumer-repo reference only.
> Canonical roadmap and wave specs are maintained upstream in `justaghost/agentkit-forge`.

## Source of truth

- Canonical repo: `https://github.com/justaghost/agentkit-forge`
- Local generated copy status: `reference-only`
- Overwrite behavior: local generated content may be replaced during sync.

## Upstream links (fill when created)

- Upstream roadmap path: `[deferred]`
- Upstream issue: `[deferred]`
- Upstream PR(s): `[deferred]`

## Local routing references

- Implementation tracking pointer: `IMPLEMENTATION_PLAN_V3.md`
- Local linkage checklist: `IMPLEMENTATION_CHECKLIST.md`
- Ownership/migration policy: `UPSTREAM_MIGRATION_SPEC.md` <!-- Originally ../PLAN-sync-ownership-v0.2.2.md, file was never created -->

## Scope note (upstream command/hook sync)

This migration pass also tracks upstream command/hook contract alignment for:

- `.agentkit/docs/COMMAND_REFERENCE.md`
- `.agentkit/docs/QUICK_START.md`
- `.agentkit/spec/commands.yaml`
- `.agentkit/templates/claude/hooks/guard-destructive-commands.sh`
- `.agentkit/templates/claude/hooks/protect-sensitive.sh`
- `.agentkit/templates/claude/hooks/session-start.sh`
- `.agentkit/templates/claude/hooks/setup-environment.sh`
- `.agentkit/templates/claude/hooks/warn-uncommitted.sh`
- `.agentkit/templates/claude/commands/delegate.md`
- `.agentkit/templates/claude/commands/mode.md`
- `.agentkit/templates/claude/commands/tasks.md`

## Repository execution model (reference)

- `justaghost/agentkit-forge` owns router-specialist specs, templates, and contracts.
- `phoenixvc/ai-gateway` is runtime-home when runtime phases are activated.
- `phoenixvc/chaufher` retains reference-only generated artifacts for traceability.
- `phoenixvc/pvc-costops-analytics` consumes canonical telemetry contracts downstream.
