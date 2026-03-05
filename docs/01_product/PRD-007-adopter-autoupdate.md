# PRD-007: AgentKit Forge Adopter Autoupdate

## Status

Draft

## Module / Feature Name

AgentKit Forge Autoupdate for Adopter Repositories

## Marketing Name

AgentKit Forge Autoupdate

## Platform / Mesh Layers

- CLI toolchain (npm/npx-delivered `agentkit-forge` binary)
- GitHub Actions CI/CD automation layer
- Adopter repository bootstrap and governance pipeline

## Primary Personas

- Developers (CLI-first) who manage adopter repositories
- DevOps / Platform Engineers automating config drift detection and remediation
- Repository maintainers responsible for keeping AgentKit Forge versions current

## Core Value Proposition

Eliminates manual version tracking in adopter repositories by providing a
first-class autoupdate mechanism — delivered via CLI command, scheduled GitHub
Action, and/or Renovate/Dependabot integration — so adopting teams always run
on a supported AgentKit Forge version without manual intervention.

## Priority

P1 — High. Required to close the adoption lifecycle loop and prevent version
drift across the growing adopter base. Complements and depends on the delivery
strategy defined in [ADR-07](../03_architecture/02_decisions/07-delivery-strategy.md)
and [PRD-005](./PRD-005-mesh-native-distribution.md).

## License Tier

- MIT Open Source — autoupdate CLI command and GitHub Action
- Enterprise overlay hooks (future tier)

## Readiness

Planned — design phase pending delivery channel GA (see PRD-005 Phase 1–3).

## TL;DR

Provide a safe, opt-in autoupdate capability so that repositories adopting
AgentKit Forge can receive new forge versions without error-prone multi-step
manual upgrade ceremonies. Delivers update notifications, one-command upgrades,
and CI-enforced version freshness.

## Problem Statement

Repositories that adopt AgentKit Forge via git submodule or npm devDependency
today face a painful multi-step upgrade process:

1. Enter the submodule directory (or check npm for new versions manually)
2. Pull the new version (`git pull` or `npm update`)
3. Exit the submodule and re-run `agentkit:sync`
4. Stage, commit, and push two separate changesets
5. Validate that generated outputs are consistent with the new version

This ceremony creates high friction, leads to version drift (adopters running
stale forge versions for months), and triggers avoidable CI failures when new
forge versions introduce breaking template changes. Without autoupdate, the
forge's value erodes over time as adopter repos fall behind.

Specific pain points in the current state:

- **No version notification** — adopter repos have no in-band mechanism to
  learn that a new forge version is available.
- **Manual update ceremony** — updating the forge requires expert Git/npm
  knowledge and produces noisy, multi-step commits.
- **No rollback safety net** — adopters who update and discover regressions
  must manually revert, with no automated restore path.
- **CI blind spot** — there is no CI gate that warns when an adopter repo's
  forge version is more than N versions behind the current release.
- **CLI toolchain dependency gap** — related issue: adopter repos may not
  have the required CLI tools installed to even perform an upgrade
  (see issue [#196](https://github.com/JustAGhosT/agentkit-forge/issues/196)).
- **Sync enforcement gap** — autoupdate is tightly coupled with the enforced
  sync contract described in issue
  [#194](https://github.com/JustAGhosT/agentkit-forge/issues/194); upgrading
  the forge version must trigger a re-sync before the PR passes validation.

## Core Challenge

Deliver safe, opt-in autoupdate that minimizes manual steps, prevents version
drift, and integrates with the existing sync-enforcement and CLI toolchain
governance already planned for adopter repos.

## Why Now

- PRD-005 (Mesh-Native Distribution) targets GA for the npm package delivery
  channel; autoupdate is a natural complement once the package is published.
- ADR-07 explicitly calls out "autoupdate support" as part of the `npm install
  -g agentkit-forge` CLI consumer experience.
- Governance enforcement (#194) and CLI toolchain requirements (#196) create the
  prerequisite infrastructure for autoupdate to function safely.
- Growing adopter base amplifies the support cost of manual upgrades.

## Goals and Objectives

### Business Goals

- Eliminate version-drift support tickets for adopter repositories.
- Increase the percentage of adopter repos on the current or previous stable
  forge version from < 60% to > 90% within 60 days of GA.
- Reduce mean forge upgrade time from ~20 minutes to < 5 minutes (CLI path)
  or < 1 minute (automated CI path).

### User Goals

- Receive clear, actionable notification when a forge update is available.
- Upgrade with a single CLI command or automated PR.
- Know immediately if an upgrade breaks existing overlays (rollback provided).

### Non-Goals (Out of Scope)

- Forced auto-update without explicit opt-in.
- Support for non-npm distribution channels in v1 (submodule update tooling
  is a migration concern for PRD-005 Phase 3).
- Notification channels outside CLI output and CI status (Slack, email, etc.)
  — deferred to a future notification add-on.

## Measurable Objectives

| Objective                       | Baseline        | Target              | Measurement Method             | Owner            | Target Date  |
| ------------------------------- | --------------- | ------------------- | ------------------------------ | ---------------- | ------------ |
| Adopter version currency (%)    | ~55% on current | ≥ 90% within 60d GA | Telemetry version histogram    | Product Owner    | GA + 60 days |
| Upgrade time (CLI path)         | ~20 min manual  | ≤ 5 min             | Timed upgrade test per release | Dev Experience   | GA           |
| Upgrade time (automated CI)     | N/A             | ≤ 1 min (PR opens)  | CI timer on update action      | DevOps Owner     | GA           |
| Rollback success rate           | N/A (manual)    | ≥ 99%               | Update failure + rollback test | Engineering Lead | GA + 30d     |
| Adopter NPS for upgrade process | N/A             | ≥ 65                | Quarterly survey               | Product Owner    | GA + 90d     |

## Stakeholders

| Stakeholder   | Role                | Responsibility                                          |
| ------------- | ------------------- | ------------------------------------------------------- |
| Product Owner | Direction, Approval | Feature scope, acceptance criteria, GTM alignment       |
| Tech Lead     | Technical Guidance  | Architecture, version resolution, rollback design       |
| Core Eng      | Build               | CLI command, Action workflow, Renovate config template  |
| DevOps Owner  | CI/CD Integration   | Update action publishing, drift-detection hook          |
| Pilot Adopter | Feedback            | Early validation, edge-case discovery, NPS input        |

## User Personas and Stories

### CLI Developer (Adopter Maintainer)

**Pain:** Has to manually track forge releases and run a multi-step update.

As a developer maintaining an adopter repo, I can run a single command to
check for and apply a forge update, with a dry-run preview of what changes.

Acceptance criteria:

- `agentkit-forge update` checks for new versions and prints a changelog summary.
- `agentkit-forge update --apply` upgrades and re-runs sync in one step.
- `agentkit-forge update --rollback` restores the previous version and outputs.
- The command fails fast with clear guidance if prerequisite CLI tools are
  missing (see issue #196).

### DevOps / Platform Owner (CI Automation)

**Pain:** No CI gate to catch stale forge versions before they cause drift or
incompatibilities.

As a DevOps engineer, I can configure a scheduled workflow that opens an
automated PR when the forge version in an adopter repo is more than one minor
version behind.

Acceptance criteria:

- A Renovate-compatible or standalone GitHub Action checks forge version weekly.
- The Action opens a PR with the version bump, re-runs sync, and validates drift.
- The PR body includes the forge changelog since the pinned version.
- A CI check (warn, not fail) flags repos where the forge version is stale.

### Repository Maintainer (Governance)

**Pain:** No visibility into which adopter repos are running outdated forge versions.

As a governance owner, I can see an inventory of adopter repos and their forge
versions from a central dashboard or report.

Acceptance criteria:

- Telemetry collects forge version per adopter repo (see issue #241 — analytics).
- A report/dashboard shows distribution of forge versions across adopter fleet.
- Stale adopter repos receive a CI advisory comment, not a hard failure.

## Use Cases and Core Flows

### Primary Use Cases

- **CLI upgrade:** Developer runs `agentkit-forge update --apply` → version
  bumped, sync re-run, outputs validated, PR opened.
- **Automated PR:** Scheduled GitHub Action opens a forge-version bump PR
  automatically when a new release is available.
- **Version check only:** `agentkit-forge update --check` prints current vs
  latest version without modifying anything.
- **Rollback:** `agentkit-forge update --rollback` restores the previous version
  if the new one broke overlay outputs.

### Core Flows

#### Flow 1: CLI One-Step Upgrade (Developer)

```text
agentkit-forge update --apply
  → checks latest published version
  → compares with pinned version in adopter repo
  → prints changelog summary
  → bumps version (npm or submodule)
  → re-runs agentkit-forge sync
  → validates generated output parity
  → opens draft PR on dev branch with diff
```

#### Flow 2: Automated CI Update PR (DevOps)

```yaml
# .github/workflows/agentkit-update.yml (generated template)
on:
  schedule:
    - cron: '0 9 * * 1'  # weekly Monday 9am
jobs:
  autoupdate:
    uses: org/agentkit-forge-action@v3
    with:
      mode: update
      overlay: my-project
      auto-pr: true
```

#### Flow 3: Version Check Only

```text
agentkit-forge update --check
  → Current: 3.2.1 (pinned in package.json)
  → Latest: 3.4.0
  → 2 minor versions behind. Run `agentkit-forge update --apply` to upgrade.
  → Changelog: [link to release notes]
```

### User Flow Matrix

| Step              | CLI Path                                    | Automated CI Path              | Outcome                            |
| ----------------- | ------------------------------------------- | ------------------------------ | ---------------------------------- |
| Detect update     | `agentkit-forge update --check`             | Scheduled Action detects delta | New version identified             |
| Preview changelog | Printed in CLI output                       | PR body contains changelog     | Team informed of changes           |
| Apply update      | `agentkit-forge update --apply`             | Action bumps version, re-syncs | Overlay outputs regenerated        |
| Validate          | Sync output diff printed; CI check          | PR checks validate drift       | Regression surfaced before merge   |
| Rollback          | `agentkit-forge update --rollback`          | Close PR / revert commit       | Previous state restored            |

## Functional Requirements

### CLI Commands

| Command                             | Description                                              |
| ----------------------------------- | -------------------------------------------------------- |
| `agentkit-forge update`             | Check for updates and print summary (no-op, dry-run)     |
| `agentkit-forge update --apply`     | Upgrade to latest version and re-run sync                |
| `agentkit-forge update --check`     | Alias for default: check-only, machine-readable output   |
| `agentkit-forge update --version X` | Upgrade to a specific version X (pinned upgrade)         |
| `agentkit-forge update --rollback`  | Restore previously pinned version and sync outputs       |

### GitHub Action

- Detects new forge versions vs. adopter repo's pinned version.
- Opens a PR with version bump, re-synced outputs, and changelog in body.
- PR targets the adopter repo's `dev` branch (aligned with the adopter governance workflow).
- Optionally blocks PR merge on adopter repo until forge version is current
  (configurable opt-in via `settings.yaml`).

### Version Resolution and Safety

- Reads current version from `package.json` (npm) or `.gitmodules` submodule
  revision (legacy path).
- Checks latest stable release from npm registry or GitHub Releases.
- Respects pre-release opt-out by default (only stable releases auto-applied).
- Provides `--pre-release` flag for adopters who want early access.
- Validates that sync produces identical outputs on both version A and version B
  before finalizing upgrade commit.

### Prerequisite Checks

- `update --apply` runs a preflight check equivalent to `agentkit-forge doctor`
  to validate CLI toolchain availability (addresses #196 requirements).
- If required tools are missing, upgrade is blocked with an actionable error
  message including installation instructions.
- Sync enforcement contract (per #194) is applied automatically:
  `update --apply` always re-runs sync as part of the upgrade flow.

## Non-Functional Requirements

- **Performance:** CLI version check completes in < 2 seconds; full update
  flow completes in < 30 seconds for typical overlay sets.
- **Safety:** Version rollback must restore outputs to bit-identical state
  within 10 seconds of invocation.
- **Security:** Version check fetches only public npm registry metadata;
  no credentials required for public registry. Private registry auth uses
  existing npm `--registry` configuration.
- **Offline behavior:** `update --check` fails gracefully with a clear message
  if the registry is unreachable. Cached version metadata used if available.

## Dependencies and Related Issues

| Issue | Title | Relationship |
| --- | --- | --- |
| [#196](https://github.com/JustAGhosT/agentkit-forge/issues/196) | adoption/startup-hooks: enforce required CLI toolchain | Prerequisite: autoupdate preflight reuses CLI toolchain validation |
| [#194](https://github.com/JustAGhosT/agentkit-forge/issues/194) | governance: enforce agentkit sync pre-PR for adopters | Prerequisite: `update --apply` must trigger sync to satisfy this gate |
| [PRD-005](./PRD-005-mesh-native-distribution.md) | Mesh-Native Distribution | Parent delivery strategy; autoupdate is a Phase 4+ CLI capability |
| [ADR-07](../03_architecture/02_decisions/07-delivery-strategy.md) | Delivery Strategy | Architectural decisions that autoupdate must respect (npm, GH Action) |
| [#241](https://github.com/JustAGhosT/agentkit-forge/issues/241) | feat(analytics): cross-repo usage telemetry | Future: telemetry can track autoupdate adoption and version currency |

## Milestone

This issue targets the **CLI Distribution & Delivery Improvements** milestone,
which groups delivery-method improvements for adopter repositories. Related
issues to include in this milestone:

- This autoupdate feature issue
- [#196](https://github.com/JustAGhosT/agentkit-forge/issues/196) — CLI toolchain enforcement
- [#194](https://github.com/JustAGhosT/agentkit-forge/issues/194) — agentkit sync enforcement

## Acceptance Criteria

- [ ] `agentkit-forge update` (check-only) prints current vs. latest version with changelog link.
- [ ] `agentkit-forge update --apply` upgrades, re-syncs, and validates output parity in one command.
- [ ] `agentkit-forge update --rollback` restores previous version and outputs.
- [ ] GitHub Action template generated by agentkit:sync supports weekly auto-update PRs.
- [ ] Preflight check validates CLI toolchain availability before attempting upgrade (covers #196).
- [ ] Upgrade flow always triggers sync, satisfying the pre-PR sync contract (covers #194).
- [ ] Changelog summary is shown in CLI output and in auto-generated PR body.
- [ ] Unit and integration tests cover: check, apply, rollback, missing-tool scenarios.
- [ ] Documentation updated: Quick Start, CLI Reference, Adopter Governance Guide.
- [ ] Telemetry event emitted on update (version, adopter repo ID, outcome) for #241 tracking.

## References

- [ADR-07: Delivery Strategy](../03_architecture/02_decisions/07-delivery-strategy.md)
- [PRD-005: Mesh-Native Distribution](./PRD-005-mesh-native-distribution.md)
- [PRD-006: PWA/Desktop Visual Configuration](./PRD-006-pwa-desktop-visual-configuration.md)
- [Issue #196: CLI Toolchain Enforcement](https://github.com/JustAGhosT/agentkit-forge/issues/196)
- [Issue #194: agentkit sync Enforcement for Adopters](https://github.com/JustAGhosT/agentkit-forge/issues/194)
