# PRD-005: Retort Mesh-Native Distribution

## Status

Draft

## Module / Feature Name

Retort Distribution & Orchestration Layer

## Marketing Name

Retort (Unified Delivery)

## Platform / Mesh Layers

- Build-time configuration mesh layer
- Node.js ecosystem (npm registry, CLI tooling)
- GitHub Actions (CI/CD automation)
- PWA / Desktop UI (browser-native onboarding and management)

## Primary Personas

- Developers (CLI-first)
- DevOps / Platform Engineers (CI/CD automation)
- Product Managers (overlay and config reviewers)
- Non-CLI team members — designers, engineering leads (visual config editors)

## Core Value Proposition

Empowers teams to configure and sync multi-tool AI agent setups from a single
source of truth—via CLI, CI, or GUI—minimizing drift and friction. Replaces the
current submodule-based delivery with a modern, multi-modal distribution model
that serves every team member regardless of technical background.

## Priority

P0 — Critical. Foundational to adoption and team-wide enablement.

## License Tier

- MIT License (Open Source) — core CLI, package, and action
- Overlays for proprietary/enterprise extension (future)

## Readiness

In Development — targeting GA for CLI/package/action and PWA UI per the phased
timeline below.

## TL;DR

Unified, frictionless delivery of Retort via npm, GitHub Action, and a
GA PWA UI — accelerating onboarding and enabling configuration by any team
member with minimal operational burden. This PRD codifies the delivery strategy
approved in [ADR-07](../architecture/decisions/07-delivery-strategy.md).

## Problem Statement

Teams struggle with multi-tool AI configuration drift and slow onboarding due to
submodule-based delivery. Existing workflows demand deep Git and Node.js
expertise, creating high friction for new or non-developer users and
significantly limiting team-wide participation and velocity.

Specific pain points in the current state:

- **Clone and submodule initialization** — `git clone` does not recurse
  submodules by default; new contributors must remember `--recurse-submodules`
  or run `git submodule update --init`.
- **Manual npm/project setup** — separate `pnpm install` inside the submodule
  directory before any forge command works.
- **Multi-step update ceremony** — bumping to a new forge version requires
  entering the submodule, pulling, exiting, staging, committing, re-syncing, and
  committing again. Two commits for one logical change.
- **Configuration drift** — without CI enforcement, generated outputs go stale
  silently. Teams with >4 AI tools are disproportionately affected.
- **CLI-only access** — only advanced team members can update or validate
  configuration; PMs, designers, and leads are locked out.

Research data: onboarding surveys show legacy submodule installs take 12–18
minutes on average, with ~30% of first-time users requiring manual support.

## Core Challenge

Reduce configuration drift, eliminate submodule/Node.js onboarding friction,
broaden access to non-CLI personas, and enforce quality/config validation by
default — all without regressing the overlay customization depth that is the
forge's core differentiator.

## Why Now

- High entry friction is the top blocker for team-wide adoption.
- AI agent adoption is surging; without a universal config delivery standard,
  disparate toolchains will proliferate, fragmenting productivity and quality.
- Advances in npm, GitHub Actions, and PWA technologies now make frictionless,
  robust delivery attainable on all fronts.
- Customer GTM targets for Q3–Q4 2024 (especially mid-market and enterprise
  cohorts) depend on a modern distribution model.

## Goals and Objectives

### Business Goals

- Maximize Retort adoption across all user segments.
- Eliminate configuration drift in all enabled project repositories.
- Minimize operational support needs (L2/L3 ticket reduction).
- Establish veritasvault.ai as the standard for mesh-native AI configuration.

### User Goals

- Allow any team member (developer or not) to easily onboard, sync, and update
  AI agent configurations from one location (CLI, CI, or UI).
- Drastically reduce manual and confusing onboarding steps.
- Empower non-CLI users to manage overlays and configurations visually.

### Non-Goals (Out of Scope)

- Support for non-GitHub CI/CD platforms (Bitbucket, GitLab, etc.) in v1.
- Automated migration tooling from legacy submodule setups (manual guide only).
- Full alternative-ecosystem/plugin compatibility beyond stubbed prototypes.
- Native desktop app (Tauri) — deferred pending PWA adoption data.

## Measurable Objectives

| Objective                         | Baseline            | Target                    | Measurement Method                | Owner               | Target Date    |
| --------------------------------- | ------------------- | ------------------------- | --------------------------------- | ------------------- | -------------- |
| Onboarding time (MTTFS)           | ~15 min (submodule) | ≤3 min (CLI), ≤1 min (UI) | Timed onboarding test per release | Dev Experience Lead | GA launch      |
| Monthly Active Installs (MAI)     | 175                 | 500+                      | npm download stats + action usage | Product Owner       | Q4 2024        |
| Overlay edits by non-dev personas | <5%                 | >50%                      | UI session analytics (Mixpanel)   | Dev Experience Lead | GA +90 days    |
| CI drift events in enabled repos  | Regular             | 0                         | GitHub Action check results       | DevOps Owner        | GA +30 days    |
| Onboarding support tickets        | 12/mo               | ≤2/mo                     | Support system tracking           | Product Owner       | Post-migration |
| Upgrade failure rate              | 8%                  | <1%                       | npm update error telemetry        | Engineering Lead    | GA +30 days    |
| NPS for delivery experience       | 48                  | 65+                       | Quarterly survey                  | Product Owner       | Q4 2024        |

Metric legend:

- **MTTFS:** Mean Time to First Success — zero to first successful `sync`.
- **MAI:** Monthly Active Installs — unique `npm install` + action runs.
- **GA:** General Availability milestone per timeline below.

## Stakeholders

| Stakeholder            | Role                    | Responsibility                                     |
| ---------------------- | ----------------------- | -------------------------------------------------- |
| Product Owner          | Direction, Approval     | Feature scope, acceptance criteria, GTM alignment  |
| Tech Lead              | Technical Guidance      | Architecture, code review, ADR ownership           |
| Core Engineering       | Build & Maintenance     | Engineering delivery across all three channels     |
| DevOps Owner           | Automation, Integration | CI/CD adoption, drift detection, action publishing |
| Pilot Customer(s)      | Early Feedback          | Validation, pilot deployment, NPS input            |
| Head of Dev Experience | UX, Docs                | Usability, onboarding content, accessibility       |

## User Personas and Stories

### CLI Developer

Motivated by speed and automation. Wants "one and done" installs and instant
environment parity.

**Pain:** Submodules, multiple manual steps, repo drift.

As a developer, I can install and sync Retort in one minute using
npm/CLI.

Acceptance criteria:

- Clean install with a single command (`npm install -D retort`).
- Overlays auto-pulled from package; no submodule checkout required.
- `npx retort sync` produces identical outputs to the submodule flow.

### DevOps / Platform Owner

Cares about CI/CD, repeatable, error-free delivery.

**Pain:** Detecting and remediating repo/config drift across many consumer repos.

As a DevOps engineer, I can validate config drift in CI via a one-line GitHub
Action.

Acceptance criteria:

- CI detects and flags drift with actionable diff output in PR checks.
- Action fails the check if generated outputs diverge from committed files.
- Optional auto-commit mode for repos that want CI to keep outputs in sync.

### Product Manager

Needs to request, review, or adjust overlays without engineering overhead.

**Pain:** Reliance on developers for every configuration change.

As a PM, I can add a new overlay through the UI without terminal or Git
knowledge.

Acceptance criteria:

- Changes reflected in overlays with validity checks; no CLI or commit needed.
- Schema-driven form validates input before saving.
- Changes are auditable via overlay edit trail.

### Designer / Lead (Non-CLI Editor)

Wants visual configuration, not command-line.

**Pain:** Locked out of workflow by CLI/Git literacy barriers.

As a design lead, I can toggle AI tool render targets on and off using a visual
interface.

Acceptance criteria:

- Checkbox grid of available render targets in the PWA UI.
- Changes trigger a sync preview (diff) before applying.
- No terminal, Node.js, or Git knowledge required.

## Use Cases and Core Flows

### Primary Use Cases

- **Greenfield onboarding:** New projects bring in Forge via npm or UI and
  initialize overlays in minutes.
- **Overlay customization:** Users create and edit overlays in UI and/or CLI,
  synced to repo.
- **CI drift detection:** GitHub Action flags and blocks config drift on PRs.
- **Non-dev overlay editing:** PMs/designers use PWA UI to update overlays.
- **Update adoption workflow:** Teams receive update diff, can approve/apply/
  rollback via CLI or UI.

### Core Flows

#### Flow 1: CLI Onboarding (Developer)

```
npm install -D retort
  → npx retort init --repoName my-project
  → npx retort sync
  → git add . && git commit
```

#### Flow 2: CI Drift Detection (DevOps)

```yaml
# .github/workflows/agentkit-sync.yml
- uses: org/retort-action@v3
  with:
    overlay: my-project
    version: '3.4.0'
# Action runs sync, compares outputs, fails check if drift detected
```

#### Flow 3: UI Onboarding (Non-CLI User)

```
npx retort ui
  → Browser opens PWA at localhost:4827
  → Visual wizard: detect stack → select render targets → create overlay
  → Click "Sync" → review diff → apply
```

### User Flow Matrix

| Step         | CLI / Automation          | UI Path                | Outcome                |
| ------------ | ------------------------- | ---------------------- | ---------------------- |
| Install      | `npm i -D retort` | PWA onboarding wizard  | Retort ready   |
| Sync / init  | `npx retort sync` | "Sync Now" in UI       | Overlays in place      |
| Overlay mgmt | CLI commands              | Dashboard editor       | Changes committed      |
| Drift check  | GitHub Action step        | CI status in UI        | Drift flagged/cleared  |
| Update       | `npm update` + sync       | "Apply/Rollback" in UI | State current/restored |

### Edge Cases

- **Offline usage:** Warn user, allow limited overlay edits, queue sync for next
  online session. Tauri/PWA service worker caches engine locally.
- **Overlay YAML parse errors:** UI and CLI highlight errors with line numbers,
  block invalid commits, provide remediation prompts.
- **Conflicting overlay updates:** Detect concurrent edits, present merge/resolve
  options with visual diff.
- **Failed sync in CI:** CI job fails with actionable error message and diff
  summary; rollback queued if auto-commit mode is enabled.
- **Partial update rollbacks:** Allow restoring last known good state via
  `npm install retort@previous-version` + sync, or one-click rollback in
  UI with version history.

## Functional Requirements

### Distribution Channels

- **npm package** — CLI and SDK bundled as `retort`. Published to npm
  (and optionally private registries). Supports `--registry` flag for
  GitHub Packages / Artifactory.
- **GitHub Action** — `org/retort-action@v3`. Drift detection, overlay
  validation, and optional auto-commit. Published to GitHub Actions marketplace.
- **PWA UI** — launched via `npx retort ui` on `localhost:4827`.
  Schema-driven overlay editor, sync dashboard, version manager, health report.

### Core Capabilities

- Overlay directory (`.agentkit/overlays`) persisted into consumer repo as the
  only forge artifact.
- Sync engine resolves templates and specs from the npm package installation
  path (`import.meta.resolve` or `require.resolve`) instead of relative paths.
- Semantic versioning with lock file support for deterministic builds.
- Migration path from submodule: documented manual guide (automated tooling
  is a non-goal for v1).
- Stub/plugin system for future alternative ecosystem integration.

### CLI Commands

| Command                       | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| `retort init`         | Initialize overlays for a new consumer repo        |
| `retort sync`         | Regenerate outputs from current overlays and specs |
| `retort ui`           | Launch PWA UI on localhost:4827                    |
| `retort doctor`       | Health check — validate environment and config     |
| `retort overlay edit` | Open overlay in editor with schema validation      |

### UI Screens

- **Init wizard** — repo name, tech stack detection (from `discover`), render
  target selection via checkboxes, overlay creation.
- **Overlay editor** — schema-driven form mirroring `settings.yaml`. Field
  validation, autocomplete, "Show YAML" toggle for power users.
- **Sync dashboard** — one-click sync. Output grouped by tool (Claude Code,
  Cursor, Copilot, Windsurf). Inline diff viewer.
- **Version manager** — current version badge, available update with changelog,
  "Update + Re-sync" button, rollback to previous version.
- **Health report** — visual rendering of `doctor` and `healthcheck` output.
  Red/amber/green status per check.

## Non-Functional Requirements

- **Runtime:** Node.js 22+ cross-platform (Windows, macOS, Linux).
- **Browser:** PWA compliant with modern browsers (Chrome, Edge; Safari best-effort).
- **Performance:** CLI sync completes in <5 seconds for typical overlay sets.
  UI loads in <2 seconds on localhost.
- **Security:** Sandboxed template rendering. Defense against path traversal in
  overlay resolution. Continuous dependency scanning (SAST) and formal security
  review process.
- **Accessibility:** WCAG 2.1 AA compliance — keyboard navigable, colorblind
  safe, ARIA labels, clear focus indicators, screen reader support.
- **Resilience:** Non-blocking fallback if npm registry is unreachable (use
  cached package). Dual-publish critical updates for registry redundancy.

## Mesh Layer Mapping

| Forge Layer                | Role                                                       |
| -------------------------- | ---------------------------------------------------------- |
| Orchestration (build-time) | Overlays are source-of-truth; sync engine produces outputs |
| Output renderers           | Config writers for all supported AI tools                  |
| Distribution channels      | npm package, GitHub Action, PWA UI                         |
| Plugin extension hooks     | Stubbed in v1; extensible for future integrations          |
| Connections                | Overlay dir ↔ CLI ↔ UI ↔ GitHub Action                     |

## APIs and Integrations

### Required APIs

- **CLI commands** — `retort init`, `sync`, `ui`, `doctor`,
  `overlay edit`.
- **UI ↔ Engine API** — JSON-RPC bridge over local HTTP. The UI is a
  presentation layer only; all logic lives in the engine. Same API can be
  consumed by IDE extensions later.
- **GitHub Action interface** — overlay validation, drift detection, diff
  summary output, optional auto-commit.

### External Dependencies

| Dependency            | Purpose              | Fallback                          |
| --------------------- | -------------------- | --------------------------------- |
| npm registry          | Package distribution | Private registry / cached install |
| Node.js 22+           | Dev-time runtime     | Required — no fallback            |
| GitHub Actions runner | CI drift detection   | Manual CLI sync                   |
| Modern browser        | PWA UI               | CLI fallback                      |

### Data Models

- **Project/spec YAML schemas** — canonical specs shipped inside npm package.
- **Overlay inheritance trees** — per-repo overlays in `.agentkit/overlays/`.
- **Render target registry** — AI tool config writers (Claude Code, Cursor,
  Copilot, Windsurf, etc.).
- **Plugin/discovery registry** — stubbed, extensible in future releases.

## User Experience and Entry Points

### Onboarding Flow

**CLI path:**

```bash
npm install -D retort        # or npm install -g retort
npx retort init --repoName my-project
npx retort sync
```

**UI path:**

```bash
npx retort ui
# Browser opens → visual wizard → detect stack → select tools → create overlay → sync
```

**CI path:**

```yaml
- uses: org/retort-action@v3
  with:
    overlay: my-project
    version: '3.4.0'
```

### Primary UX Flows

- Edit overlays in UI with live schema validation and accessible error messages.
- Sync overlays anytime from CLI or UI ("one-click sync").
- Review changelogs and diffs of overlay updates prior to applying.
- Rollback to previous overlay versions via UI or CLI.
- Error handling: guided remediation for YAML errors, merge conflicts, and CI
  drift incidents.

### Day-Zero Experience

Minimal manual steps, rapid path to first agent deployed or registered:

| Persona       | Path                            | Time to First Sync    |
| ------------- | ------------------------------- | --------------------- |
| Developer     | `npm install` + `init` + `sync` | ~3 min                |
| Non-developer | PWA wizard                      | ~1 min                |
| DevOps        | GitHub Action added to workflow | ~5 min (including PR) |

## Accessibility Requirements

- Conformance to WCAG 2.1 AA.
- Keyboard navigation for all UI flows.
- ARIA-compliant controls with clear focus and tabbing for screen readers.
- Color contrast ratios meeting AA thresholds.
- Alternative text for all visual elements.
- Plaintext-first documentation output.
- Colorblind-friendly status indicators (not color-only).

## Success Metrics

### Leading Indicators

- npm and GitHub Action install/adoption rates.
- Number of overlay sessions and edits in UI by non-CLI users.
- First-sync success rates (onboarding completion).
- Time to first successful sync (MTTFS).

### Lagging Indicators

- Incidents of stale or drifted configs in CI-enabled repos.
- Frequency of rollbacks triggered.
- Percentage of overlays maintained by non-developer personas.
- Support escalation rate per adoption.
- NPS for delivery experience.

### Measurement Plan

- **Mixpanel events** for install, overlay edit, sync, and onboard flows.
- **CI pipeline logs** for drift detection events and error rates.
- **Customer surveys** at 1, 3, and 6 months post-adoption.
- **Overlay edit trail audit** segmented by persona (CLI vs. UI, dev vs.
  non-dev).
- **Review cadence:** biweekly operational review, quarterly business review.

## Timeline and Milestones

| Phase   | Scope                                                                    | Target Date  | Dependencies               |
| ------- | ------------------------------------------------------------------------ | ------------ | -------------------------- |
| Phase 1 | npm package publication pipeline, verification, baseline metrics         | Month 1 (Q2) | npm registry, Node.js 22+  |
| Phase 1 | GA release of PWA for greenfield customers                               | Month 1 (Q2) | UX design, browser testing |
| Phase 2 | GitHub Action mandatory for CI/CD installs; docs and champion enablement | Month 2 (Q2) | GH Actions marketplace     |
| Phase 2 | Migration guides and CLI tooling for self-service onboarding             | Month 2 (Q2) | Phase 1 stable             |
| Phase 3 | Plugin/alternative-ecosystem stub                                        | Month 3 (Q2) | Core stubs, pilot feedback |

### Key Milestones

| Milestone                                | Target Date |
| ---------------------------------------- | ----------- |
| Hybrid launch GA (npm + Action + PWA)    | 2024-08-01  |
| Legacy deprecation (manual/cloud binary) | 2024-09-30  |
| PWA GA for all browser-based onboarding  | 2024-09-30  |
| Plugin stub v1                           | Q3 2024     |

## Constraints and Dependencies

### Technical Constraints

- Node.js 22+ required in development environments.
- CLI and sync tools operate at dev/build time only.
- Overlay files must be mergeable and resilient to partial failures.
- PWA UI restricted to tested browsers (Chrome, Edge); Safari best-effort.
- Template resolution paths must work from both `node_modules/` and global
  install locations.

### Business Constraints

- Budget limited to core UI, CI, and plugin system skeleton — no direct
  support for automated submodule migration.
- Focus is on new (greenfield) and actively migrated adoptions only.
- Three distribution channels must stay in sync on every release — monorepo CI
  pipeline required.

### Dependencies

| Dependency                                   | Owner               | Risk Level |
| -------------------------------------------- | ------------------- | ---------- |
| npm registry and distribution infrastructure | Platform Lead       | Medium     |
| GitHub Actions platform and runner fidelity  | DevOps Owner        | Low        |
| Browser deployment and UX collaboration      | Dev Experience Lead | Medium     |
| Pilot feedback loops from target customers   | Product Owner       | Medium     |

## Risks and Mitigations

| Risk                                           | Impact | Probability | Mitigation                                                        |
| ---------------------------------------------- | ------ | ----------- | ----------------------------------------------------------------- |
| npm registry outages or delays                 | Medium | Medium      | Dual-publish critical updates; status monitoring; fallback guides |
| GitHub Actions ecosystem disruption            | High   | Low         | Maintain validated fallback/manual install path during launch     |
| PWA browser support fragmentation              | Medium | Medium      | Restrict to tested browsers (Chrome, Edge); clear communication   |
| Release process overhead (Hybrid complexity)   | Medium | High        | Monorepo + CI pipelines for update alignment; automate most ops   |
| User confusion during transition               | Medium | Medium      | Clear migration comms, in-product prompts and guides              |
| Security vulnerabilities in third-party routes | High   | Medium      | Continuous dependency scanning (SAST), formal security review     |
| CI drift detection fails silently              | High   | Medium      | Force action validation; pre-launch robustness testing            |
| Overlay YAML parse errors block users          | Medium | High        | Schema checks, UI error feedback with remediation help            |
| UI and CLI feature divergence                  | Medium | Medium      | Shared core engine; strictly decoupled presentation layer         |
| Support load exceeds expectations              | Medium | Low         | In-app docs, self-diagnosis/help pages, community resources       |

## Open Questions

| Question                                                        | Owner                         | Target Date | Impact if Unresolved                      |
| --------------------------------------------------------------- | ----------------------------- | ----------- | ----------------------------------------- |
| Priority and spec for non-Node.js wrappers (Rust, Python, .NET) | Product Owner, Engineering    | Q2 2024     | Slower adoption in alternative ecosystems |
| Plugin system phase timeline and extension API                  | Tech Lead                     | Q2 2024     | Limits alternative-tool expansion         |
| External ecosystem integration cadence (partner repos)          | Product Owner                 | Q3 2024     | Blocks broader mesh-native coverage       |
| Tauri desktop app: build or defer based on PWA adoption data?   | Product Owner, Dev Experience | Q4 2024     | Potential gap for offline-heavy users     |

## Appendix

### Research and Data

- Onboarding surveys showed legacy submodule installs take 12–18 minutes, with
  ~30% requiring manual support on first use.
- Top user feedback request: streamlined, non-CLI overlay editing (especially
  from PMs and designers).
- Existing config drift pain is amplified in teams with >4 AI tools.
- Market analysis and customer interviews highlight delivery inefficiencies as
  blockers for broader adoption (see ADR-07 executive summary).

### Design Mockups (Planned)

- Overlay Editor Wireframes
- Onboarding Wizard Flows
- Version Manager / History
- Diff Dashboard
- Health Check Report

### Technical Feasibility

- CLI, package, and action are stable under Node.js 22+.
- PWA UI interacts via local JSON-RPC bridge to CLI engine; no logic
  duplication.
- Plugin architecture is stubbed but defined for v2+ extension.
- Security reviewed for sandbox and path traversal risks.
- Same JSON-RPC API can be consumed by IDE extensions (VS Code, JetBrains)
  in future phases.

### Competitive Analysis

| Capability                | GitHub Copilot | Claude | Cursor | Retort        |
| ------------------------- | -------------- | ------ | ------ | --------------------- |
| Multi-tool overlay system | No             | No     | No     | **Yes**               |
| PWA / UI-based editing    | No             | No     | No     | **Yes**               |
| Drift detection in CI     | No             | No     | No     | **Yes**               |
| Ecosystem extensibility   | No             | Some   | No     | **Planned (stub v1)** |

No competitor currently provides unified overlays, visual UI, or mesh-native CI
drift detection across AI tooling. This is a first-mover opportunity.

### Related Documents

- [ADR-07: Delivery Strategy (Refined)](../architecture/decisions/07-delivery-strategy.md)
- [ADR-01: Adopt Retort](../architecture/decisions/01-adopt-retort.md)
- [ADR-03: Tooling Strategy](../architecture/decisions/03-tooling-strategy.md)
- [Architecture Overview](../architecture/01_overview.md)
- [PRD-001: LLM Decision Engine](PRD-001-llm-decision-engine.md)
- [PRD-007: Adopter Autoupdate](PRD-007-adopter-autoupdate.md) — follow-on CLI capability
  for keeping adopter repositories current with the latest forge version;
  builds on the npm/CLI delivery channel established by this PRD.
  See also: [#196](https://github.com/phoenixvc/retort/issues/196),
  [#194](https://github.com/phoenixvc/retort/issues/194).
