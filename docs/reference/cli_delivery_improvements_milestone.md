# CLI Distribution & Delivery Improvements Milestone Tracker

## Scope

Delivery-method improvements for adopter repositories: CLI toolchain enforcement,
agentkit sync governance, and first-class autoupdate capability. This milestone
groups the issues that collectively complete the "adoption lifecycle loop" for
repositories that have integrated AgentKit Forge.

## Milestone

- Repository: `JustAGhosT/agentkit-forge`
- Milestone: `CLI Distribution & Delivery Improvements`
- Milestone number: `#2` (created)

## Issues in this Milestone

| #                                                               | Title                                                                                           | Status | PRD / Spec                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| [#196](https://github.com/JustAGhosT/agentkit-forge/issues/196) | adoption/startup-hooks: enforce required CLI toolchain availability (gh, az, etc.)              | Open   | N/A                                                    |
| [#194](https://github.com/JustAGhosT/agentkit-forge/issues/194) | governance: enforce agentkit sync pre-PR (blocking) and post-commit (non-blocking) for adopters | Open   | N/A                                                    |
| [#258](https://github.com/JustAGhosT/agentkit-forge/issues/258) | feat(cli): implement autoupdate functionality for repositories adopting AgentKit Forge          | Open   | [PRD-007](../product/PRD-007-adopter-autoupdate.md)    |
| #                                                               | Title                                                                                           | Status | PRD / Spec                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| [#196](https://github.com/JustAGhosT/agentkit-forge/issues/196) | adoption/startup-hooks: enforce required CLI toolchain availability (gh, az, etc.)              | Open   | N/A                                                    |
| [#194](https://github.com/JustAGhosT/agentkit-forge/issues/194) | governance: enforce agentkit sync pre-PR (blocking) and post-commit (non-blocking) for adopters | Open   | N/A                                                    |
| [#258](https://github.com/JustAGhosT/agentkit-forge/issues/258) | feat(cli): implement autoupdate functionality for repositories adopting AgentKit Forge          | Open   | [PRD-007](../product/PRD-007-adopter-autoupdate.md)    |
| #                                                               | Title                                                                                           | Status | PRD / Spec                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| [#196](https://github.com/JustAGhosT/agentkit-forge/issues/196) | adoption/startup-hooks: enforce required CLI toolchain availability (gh, az, etc.)              | Open   | N/A                                                    |
| [#194](https://github.com/JustAGhosT/agentkit-forge/issues/194) | governance: enforce agentkit sync pre-PR (blocking) and post-commit (non-blocking) for adopters | Open   | N/A                                                    |
| [#258](https://github.com/JustAGhosT/agentkit-forge/issues/258) | feat(cli): implement autoupdate functionality for repositories adopting AgentKit Forge          | Open   | [PRD-007](../product/PRD-007-adopter-autoupdate.md)    |

> **Status update:** Milestone and autoupdate issue have been created.
>
> - Milestone: [#2](https://github.com/JustAGhosT/agentkit-forge/milestone/2)
> - Autoupdate issue: [#258](https://github.com/JustAGhosT/agentkit-forge/issues/258)
> - Cross-reference comments added on [#196](https://github.com/JustAGhosT/agentkit-forge/issues/196)
>   and [#194](https://github.com/JustAGhosT/agentkit-forge/issues/194)

## Cross-References (Issue Updates Applied)

The following updates were applied to GitHub issues after autoupdate issue
#258 was assigned:

### Issue #196 — adoption/startup-hooks: enforce required CLI toolchain

Template that was added to the issue body/comment:

```markdown
## Related

- See also: [feat(cli): implement autoupdate for adopter repositories](https://github.com/JustAGhosT/agentkit-forge/issues/258)
  — autoupdate preflight checks reuse the CLI toolchain validation requirements defined here.
- Milestone: CLI Distribution & Delivery Improvements
```

### Issue #194 — governance: enforce agentkit sync pre-PR for adopters

Template that was added to the issue body/comment:

```markdown
## Related

- See also: [feat(cli): implement autoupdate for adopter repositories](https://github.com/JustAGhosT/agentkit-forge/issues/258)
  — `update --apply` must trigger sync as part of its upgrade flow, satisfying the
  pre-PR sync enforcement contract defined here.
- Milestone: CLI Distribution & Delivery Improvements
```

## GitHub Issue Body for Autoupdate Feature

Copy the following as the body for the new GitHub issue:

---

**Title:** `feat(cli): implement autoupdate functionality for repositories adopting AgentKit Forge`

**Labels:** `enhancement`

**Milestone:** CLI Distribution & Delivery Improvements

**Body:**

```markdown
## Summary

Implement a first-class autoupdate mechanism so that repositories adopting
AgentKit Forge can receive and apply new forge versions without manual,
multi-step upgrade ceremonies.

## Context

The current submodule-based delivery requires adopters to manually pull new
versions, re-run sync, and commit two separate changesets. Without autoupdate,
adopter repos accumulate version drift, triggering avoidable CI failures when
new forge versions introduce breaking template changes.

This issue tracks delivery of the autoupdate capability as described in
[PRD-007](https://github.com/JustAGhosT/agentkit-forge/blob/dev/docs/product/PRD-007-adopter-autoupdate.md), building on the
delivery channel established in
[ADR-07](https://github.com/JustAGhosT/agentkit-forge/blob/dev/docs/architecture/decisions/07-delivery-strategy.md) and
[PRD-005](https://github.com/JustAGhosT/agentkit-forge/blob/dev/docs/product/PRD-005-mesh-native-distribution.md).

## Scope

- [ ] Add `agentkit-forge update` CLI command (check-only, dry-run by default).
- [ ] Add `agentkit-forge update --apply` — upgrades version, re-runs sync, validates outputs.
- [ ] Add `agentkit-forge update --rollback` — restores previous version and sync outputs.
- [ ] Add `agentkit-forge update --version X` — pin-upgrade to a specific version.
- [ ] GitHub Action template: scheduled workflow that opens an auto-update PR when the
      pinned forge version is behind the latest stable release.
- [ ] Preflight checks validate CLI toolchain availability before attempting upgrade
      (integrates with #196 requirements).
- [ ] Upgrade flow always triggers sync, satisfying the pre-PR sync contract (#194).
- [ ] Changelog summary displayed in CLI output and in auto-generated PR body.
- [ ] Telemetry event emitted on update (version, adopter repo ID, outcome) for #241.

## Acceptance Criteria

- [ ] `agentkit-forge update` (check-only) prints current vs. latest version with changelog link.
- [ ] `agentkit-forge update --apply` upgrades, re-syncs, and validates output parity in one command.
- [ ] `agentkit-forge update --rollback` restores previous version and outputs.
- [ ] GitHub Action template supports weekly auto-update PRs.
- [ ] Preflight check validates CLI toolchain (covers #196).
- [ ] Upgrade triggers sync, satisfying pre-PR sync contract (covers #194).
- [ ] Unit and integration tests cover: check, apply, rollback, missing-tool scenarios.
- [ ] Docs updated: Quick Start, CLI Reference, Adopter Governance Guide.

## Related

- Prereq: #196 — CLI toolchain enforcement (preflight check dependency)
- Prereq: #194 — agentkit sync pre-PR enforcement (sync gate dependency)
- Parent PRD: [PRD-007: Adopter Autoupdate](https://github.com/JustAGhosT/agentkit-forge/blob/dev/docs/product/PRD-007-adopter-autoupdate.md)
- Delivery strategy: [ADR-07](https://github.com/JustAGhosT/agentkit-forge/blob/dev/docs/architecture/decisions/07-delivery-strategy.md)
- Analytics: #241 (telemetry events for version tracking)
```

---

## Dependency Map

```text
#196 (CLI toolchain) ──────────┐
                                ├──► #258 (autoupdate)
#194 (sync enforcement) ───────┘
```

- Autoupdate blocked by: #196 (preflight CLI checks), #194 (sync enforcement gate)
- Autoupdate feeds into: #241 (telemetry/analytics)

## Required Closure Checklist (for each issue in milestone)

Before any issue in this milestone is closed:

- [ ] Acceptance criteria all checked.
- [ ] Milestone remains assigned.
- [ ] Cross-references to related issues are present and current.
- [ ] Tests added or updated.
- [ ] Documentation updated.
- [ ] Telemetry event emitted (where applicable).

## Plan Decisions

- CLI toolchain enforcement (#196) and sync enforcement (#194) are prerequisites
  for the autoupdate feature; they must reach a testable state before the
  autoupdate command can rely on their preflight/enforcement contracts.
- Autoupdate ships on the npm package delivery channel as defined in PRD-005/ADR-07.
- Rollback is a first-class feature, not an afterthought.
- No forced updates — opt-in only, with clear rollback path.
