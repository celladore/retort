# PRD-006: Retort PWA/Desktop Visual Configuration

## Status

Draft

## Module / Feature Name

Retort Visual Configuration PWA/Desktop Module

## Marketing Name

Retort Visual Editor (PWA/Desktop)

## Platform / Mesh Layers

- Build-time orchestration and configuration mesh
- Progressive Web App (PWA, browser-based) — primary delivery
- Tauri-based desktop application (Windows, macOS, Linux) — follow-up delivery

## Primary Personas

- Product Managers (PMs)
- Designers
- Team Leads
- Developers on cross-functional teams
- Any team member who needs to configure agent overlays and orchestration rules
  but prefers GUI over CLI

## Core Value Proposition

Enables any team member to configure, customize, and validate agentkit overlays
and orchestration rules in minutes — without requiring CLI or Git expertise.
Shifts overlay management from "developer chore" to "team capability."

## Priority

P0 — Critical to enable organization-wide adoption and eliminate friction for
non-developers.

## License Tier

- MIT Open Source (core features)
- Commercial overlays/extensions possible in future tiers

## Readiness

In Development — General Availability (GA) launch coordinated with
CLI/GitHub Action strategy per
[PRD-005](PRD-005-mesh-native-distribution.md) and
[ADR-07](../architecture/decisions/07-delivery-strategy.md).

## TL;DR

A schema-driven visual overlay/config editor and sync dashboard, deployable as a
PWA or desktop app, that democratizes orchestration and delivers CLI parity and
safety for the whole team. The UI is a presentation layer only — all logic lives
in the retort engine, communicated via a JSON-RPC bridge.

## Problem Statement

CLI-based overlay management restricts participation to engineers, creating
silos, slowdowns, and operational risk by excluding PMs, designers, and team
leads from agent orchestration or safe review/change workflows.

Specific pain points:

- **Terminal literacy barrier** — non-developer team members cannot create,
  review, or edit overlays without asking an engineer for help.
- **YAML editing risk** — manual YAML edits are error-prone (indentation,
  schema violations, key typos). Errors are only caught at sync time, not at
  edit time.
- **No visual feedback** — CLI users cannot preview the impact of overlay
  changes before committing. Sync diffs are text-only and require git fluency
  to interpret.
- **Audit opacity** — who changed what, when, and why is only visible through
  git history, which non-engineers rarely inspect.
- **Onboarding friction** — new team members must install Node.js, learn the
  CLI, and understand the overlay directory structure before making their first
  change.

Research data: user interviews highlight PM and designer blockers with CLI.
Support logs (2023) show most onboarding tickets are config/CLI-related.

## Core Challenge

Deliver configuration and audit capabilities for the entire team and provide
CI-grade validation — without forcing users through code/CLI/Git workflows they
don't understand or trust. The UI must produce byte-identical outputs to the CLI
to maintain trust and auditability.

## Current State

Overlay management is limited to CLI and YAML in source control. Any changes
demand a terminal, local CLI installation, or a PR-based change process —
discouraging whole-team adoption and rapid iteration. Only advanced team members
can update or validate configuration.

## Why Now

- AI agent orchestration is a team discipline, not a developer-only task.
- PWA and desktop application technology (Tauri) are now robust enough to
  provide high-quality UI for complex configuration editing.
- The hybrid distribution model (PRD-005) creates the foundation — the npm
  package and JSON-RPC API make a thin UI shell viable without logic
  duplication.
- Customer feedback consistently ranks "non-CLI overlay editing" as the top
  requested capability, especially from PMs and designers.

## Goals and Objectives

### Business Goals

- Expand retort adoption in large organizations beyond the engineering
  team.
- Drive engagement from PMs, designers, and team leads (not just developers).
- Reduce dev team support and onboarding burden by at least 70%.
- Support positive NPS and organic expansion through word-of-mouth from
  non-developer users.

### User Goals

- Complete overlay onboarding in under 2 minutes.
- Get real-time validation and error feedback at the field level.
- Understand and trace configuration impact immediately (visual diff).
- Transfer overlay/config maintenance fluidly among team members regardless
  of technical background.

### Non-Goals (Out of Scope)

- No mobile-first PWA optimizations in v1.
- No non-GitHub CI integrations in v1 (see PRD-005 non-goals).
- No direct template editing or arbitrary YAML editor — provide read-only YAML
  view and rollback/undo only. Advanced YAML editing is planned as a potential
  future enhancement.
- No runtime agent execution or monitoring in the UI (this is a configuration
  tool, not an observability platform).

## Measurable Objectives

| Objective                             | Baseline         | Target              | Measurement Method              | Owner               | Target Date   |
| ------------------------------------- | ---------------- | ------------------- | ------------------------------- | ------------------- | ------------- |
| Overlays created in UI by non-devs    | 0%               | ≥75%                | UI session analytics (Mixpanel) | Dev Experience Lead | GA +90 days   |
| Median onboarding completion time     | N/A              | <120 seconds        | In-app timer telemetry          | UX/UI Designer      | GA +90 days   |
| Support escalations (UI-based errors) | Baseline tracked | −70%                | Support ticket system           | Product Owner       | GA launch     |
| NPS among non-dev users               | Baseline TBD     | >60                 | Post-onboarding survey          | Product Owner       | GA launch     |
| UI/CLI output parity                  | N/A              | 100% byte-identical | CI regression suite             | Engineering Lead    | Every release |

Metric legend:

- **GA:** General Availability milestone per timeline below.
- **Non-dev:** any user without a developer or DevOps role designation.
- **Output parity:** overlay sync outputs from UI and CLI must be identical.

## Stakeholders

| Stakeholder               | Role                   | Responsibility                                         |
| ------------------------- | ---------------------- | ------------------------------------------------------ |
| Product Owner             | Strategy, Requirements | Feature scope, success measurement, go/no-go           |
| Developer Experience Lead | Technical Architecture | CLI/engine integration, JSON-RPC API                   |
| UX/UI Designer            | Design, Onboarding     | UI/UX flows, onboarding wizard, accessibility          |
| Pilot Users               | Validation             | User feedback, pilot deployment, NPS input             |
| Engineering Lead          | Delivery               | Architecture reviews, release coordination             |
| QA                        | Quality                | Test coverage for GUI flows, regression, parity checks |
| DevOps                    | Integration            | CI/CD validation, deployment, desktop distribution     |

## User Personas and Stories

### Product Manager

Seeks visual, safe control over agent overlays. Needs onboarding clarity and
audit trail visibility. Never opens a terminal by choice.

As a PM, I want to create and preview a new overlay through an intuitive form,
so I can validate changes without writing code or asking an engineer.

Acceptance criteria:

- Overlay creation wizard completes in under 2 minutes.
- All fields are documented in-UI with contextual tooltips.
- Schema validation runs in real-time; invalid states are blocked.
- Changes are visible as a diff preview before syncing.

### Designer

Wants to customize agent overlays (tool toggles, themes) and see quick
previews. Avoids CLI entirely.

As a designer, I want to theme an agent repo visually and see the result
instantly, without learning YAML syntax or running terminal commands.

Acceptance criteria:

- Visual tool toggle grid (checkboxes for render targets).
- Live preview updates as fields are changed.
- "Show YAML" toggle for read-only inspection (no raw editing).

### Tech Lead

Requires auditability, validation checks, and the ability to review team
changes visually before they reach the repository.

As a team lead, I want to review and approve overlay changes in the app, with
full visibility into diffs and audit history.

Acceptance criteria:

- Change log shows who edited what, when, with before/after values.
- Diff preview matches what would appear in a git diff after sync.
- Rollback to any previous overlay version with one click.

### Developer

Wants CLI parity, schema accuracy, and the ability to review visual edits made
by non-developer teammates.

As a developer, I want confidence that overlays created in the UI produce
identical sync outputs to CLI-created overlays.

Acceptance criteria:

- UI sync output is byte-identical to `npx retort sync` output.
- "Show YAML" view displays the exact YAML that will be written.
- All CLI capabilities for overlay management are accessible in the UI.

## Use Cases and Core Flows

### Primary Use Cases

- **Create new overlay** — guided wizard with stack detection and render target
  selection.
- **Edit existing overlay** — form-based, schema-driven editing with live
  validation.
- **Preview output** — side-by-side YAML diff (old vs. new) before syncing.
- **Sync changes** — push to CI/GitHub Action or sync locally.
- **Undo/rollback** — revert to any previous overlay state.
- **View audit logs** — full change history with actor, timestamp, and diff.

### Core Flow

```
1. Launch PWA/Desktop App
   └─ PWA: `npx retort ui` → browser opens localhost:4827
   └─ Desktop: open Tauri app → select repo folder

2. Select or connect to a repository
   └─ App scans for `.agentkit/overlays/` directory

3. Choose action
   ├─ Create new overlay → guided wizard
   │   └─ Repo name → stack detection → render target checkboxes → create
   └─ Edit existing overlay → schema-driven form editor

4. Edit with live validation
   └─ Per-field validation, tooltips, "Show YAML" toggle

5. Preview changes
   └─ Side-by-side diff (current vs. proposed)

6. Sync or rollback
   ├─ "Sync Now" → engine runs sync, outputs updated
   └─ "Rollback" → restore previous overlay version
```

### User Flow Matrix

| Step           | PWA Path                | Desktop Path            | Outcome         |
| -------------- | ----------------------- | ----------------------- | --------------- |
| Launch         | `npx retort ui` | Open app                | UI ready        |
| Connect repo   | Auto-detect from CWD    | "Open Repo" file picker | Repo linked     |
| Create overlay | Wizard form             | Wizard form             | Overlay created |
| Edit overlay   | Schema-driven editor    | Schema-driven editor    | Changes staged  |
| Preview        | Side-by-side diff       | Side-by-side diff       | Impact visible  |
| Sync           | One-click sync          | One-click sync          | Outputs updated |
| Rollback       | Version history picker  | Version history picker  | State restored  |

### Edge Cases

- **Overlay YAML fails schema validation:** UI highlights the invalid field(s)
  with inline error messages and disables the sync button until resolved.
- **Overlay conflict detected (manual YAML edits outside UI):** UI prompts the
  user to reconcile visually with a merge/diff view.
- **PWA loses file system access:** Clear notification banner with recovery
  instructions; draft edits preserved in browser storage.
- **Desktop app version mismatch with CLI:** Migration assistant detects version
  skew and prompts upgrade before proceeding.
- **Operating offline:** UI warns, continues in "draft" mode with local edits
  queued. Syncs automatically when connectivity is restored.
- **Concurrent edits by multiple users:** Last-write-wins with conflict
  detection; audit log preserves both versions.

## Functional Requirements

### Application Shell

- **PWA (primary):** Single-page application served by
  `npx retort ui` on `localhost:4827`. Lightweight framework (Preact,
  Svelte, or plain web components). Service worker for offline caching. Runs in
  any modern browser.
- **Tauri desktop (follow-up):** Wraps the same web UI. ~5 MB binary (vs.
  ~150 MB for Electron). Built-in auto-updater. Distributed via GitHub Releases,
  Homebrew (`brew install retort`), or winget.

### Overlay CRUD

- Create, read, update, and delete overlays through form-based UI.
- Schema-driven field rendering: each overlay property maps to a typed form
  control with validation rules derived from the YAML schema.
- Per-field documentation tooltips generated from schema descriptions.

### Diff and Preview

- Integrated YAML diff preview (side-by-side or unified view).
- Diff engine: Monaco Editor or CodeMirror with syntax highlighting.
- Preview shows exactly what `sync` will generate, grouped by tool
  (Claude Code, Cursor, Copilot, Windsurf, etc.).

### Audit and History

- Change log records every overlay edit with: actor, timestamp, field changed,
  old value, new value.
- Full undo/rollback to any previous overlay state.
- Audit trail exportable as JSON for compliance.

### Engine Communication

- JSON-RPC bridge over local HTTP to the retort engine.
- No direct file system access from the browser — all mutations go through the
  engine API.
- Same API contract consumed by CLI internally, ensuring parity.
- API is extensible for future IDE plugins (VS Code, JetBrains).

### Error Handling

- Real-time schema validation with inline field-level error messages.
- Actionable remediation prompts (not just "invalid value").
- Sync errors displayed with full context and suggested fixes.
- Global error boundary prevents UI crashes from propagating.

### Offline Support

- PWA: service worker caches UI shell and last-known overlay state.
- Tauri: engine bundled locally; full offline capability after first launch.
- Edits made offline are queued and synced on reconnection.

### Required API Endpoints

| Endpoint             | Method | Description                                  |
| -------------------- | ------ | -------------------------------------------- |
| `overlay/list`       | GET    | List all overlays in the connected repo      |
| `overlay/create`     | POST   | Create a new overlay from wizard data        |
| `overlay/update`     | PUT    | Update an existing overlay                   |
| `overlay/delete`     | DELETE | Remove an overlay                            |
| `overlay/sync`       | POST   | Run sync engine and return outputs           |
| `overlay/validate`   | POST   | Validate overlay against schema              |
| `overlay/diff`       | POST   | Generate diff preview (current vs. proposed) |
| `changelog/history`  | GET    | Retrieve edit history for an overlay         |
| `changelog/rollback` | POST   | Restore overlay to a previous version        |
| `error/report`       | POST   | Submit error telemetry                       |

## Non-Functional Requirements

- **Performance:** Initial UI load <3 seconds. Field validation <100ms.
  Sync preview generation <2 seconds for typical overlay sets.
- **Schema validation:** Real-time, field-level, derived from canonical YAML
  schema. Blocks invalid states from reaching the engine.
- **Accessibility:** WCAG 2.1 AA compliance — full keyboard navigation, ARIA
  role support, text contrast conforming to AA thresholds, all actions and
  readouts screen-reader accessible, comprehensive and actionable error
  feedback at all steps.
- **Security:** Desktop sandbox isolates file system access to the selected
  repo directory only. PWA has no direct FS access (engine-mediated). No
  sensitive data stored in browser storage beyond overlay drafts.
- **Reliability:** Persistent change logs survive browser/app restarts.
  Undo/rollback available for every modification. Draft auto-save every
  30 seconds.
- **Parity:** UI sync outputs must be byte-identical to CLI sync outputs.
  Verified by CI regression suite on every release.

## Mesh Layer Mapping

| Layer                 | Role                                                      |
| --------------------- | --------------------------------------------------------- |
| Presentation / UI     | Orchestration interface for `.agentkit/spec` overlays     |
| JSON-RPC bridge       | Communication layer between UI and engine                 |
| retort engine | All sync, validation, and output logic (shared with CLI)  |
| Overlay directory     | `.agentkit/overlays/` — source of truth persisted in repo |

State manipulations are routed through the retort sync engine. The UI
never bypasses the engine to write files directly — no runtime-layer or team
bypass is possible.

## Data Models

### Overlay Specification

- **Source format:** YAML (canonical, persisted in `.agentkit/overlays/`)
- **UI format:** Parsed JSON for form rendering and validation
- **Schema:** derived from canonical `spec/` definitions in the npm package

### Edit / Change Log

- Timeline of user actions for audit and rollback
- Fields: `actor`, `timestamp`, `overlay_name`, `field_path`, `old_value`,
  `new_value`, `action_type` (create/update/delete/rollback)

### Change Diff Model

- Before/after representation of overlay YAML for preview
- Rendered as unified or side-by-side diff in Monaco/CodeMirror

### UI Audit Events

- Log of user and system actions (login, overlay open, edit, sync, error)
- Stored locally; optionally exported for compliance

## User Experience and Entry Points

### Onboarding Flow

**PWA:**

```bash
npx retort ui
# Browser opens → guided repo selection → scan overlays → wizard
```

**Desktop (Tauri):**

```
1. Download from GitHub Releases (or brew install / winget install)
2. Open app → "Open Repo" → select project folder
3. App detects .agentkit/overlays/ → suggests management actions
4. Wizard-based creation or form-based editing
```

**First-run experience:**

1. Repo connection (auto-detect or manual selection)
2. Overlay scan — shows existing overlays or prompts to create first one
3. Guided wizard — repo name, stack detection, render target checkboxes
4. Real-time schema validation and inline documentation
5. Preview changes (diff) before first sync
6. One-click sync → overlay committed and outputs generated

### Primary UX Flows

- **Form-based overlay editing** — schema-driven, with contextual tooltips
  and live validation at the field level.
- **Diff/audit preview** — side-by-side or unified diff with rollback
  options. Grouped by tool (Claude Code, Cursor, etc.).
- **Sync** — one-click sync to engine; outputs shown with success/failure
  status per tool.
- **Version management** — current version badge, available updates with
  changelog, "Update + Re-sync" button, rollback to previous version.
- **Error recovery** — guided remediation for schema violations, merge
  conflicts, and sync failures.

### UI Screens

| Screen              | Purpose                           | Key Elements                              |
| ------------------- | --------------------------------- | ----------------------------------------- |
| **Init Wizard**     | First-time overlay setup          | Repo name, stack detect, tool checkboxes  |
| **Overlay Editor**  | Schema-driven form editing        | Field controls, tooltips, "Show YAML"     |
| **Sync Dashboard**  | One-click sync + output review    | Tool-grouped output, inline diff viewer   |
| **Version Manager** | Update and rollback control       | Version badge, changelog, rollback picker |
| **Health Report**   | Environment and config checks     | Red/amber/green status per check          |
| **Audit Trail**     | Change history and accountability | Timeline view, actor, diff per change     |

## Accessibility Requirements

- Full keyboard navigation for all flows (no mouse-only interactions).
- ARIA role support on all interactive elements.
- Text contrast conforming to WCAG 2.1 AA (minimum 4.5:1 for normal text).
- All actions and readouts screen-reader accessible.
- Focus indicators visible on all interactive elements.
- Alternative text for all visual elements (icons, status indicators).
- Color is never the sole indicator of state — icons/text labels accompany
  all status colors (red/amber/green).
- Comprehensive, actionable error feedback at all steps.

## Success Metrics

### Leading Indicators

- Number of overlays created in UI by non-engineers.
- Percentage of onboarding wizards completed successfully (vs. abandoned).
- Median time from launch to first overlay created.
- Error remediation time (time from error display to resolution in UI).

### Lagging Indicators

- Number of support escalations related to config/onboarding post-launch.
- Percentage of overlay drift between UI and CLI outputs (target: 0%).
- Frequency of reversion to CLI/manual workflows in pilot and production.
- NPS among non-developer users.

### Measurement Plan

- **UI telemetry** (Mixpanel) — usage flows, feature adoption, drop-off points.
- **In-app audit logs** — overlay edit frequency, actor distribution.
- **Onboarding time tracking** — timer from first launch to first successful
  sync.
- **NPS survey** — administered post-onboarding for PMs, designers, and leads.
- **Parity regression** — CI suite comparing UI and CLI sync outputs on every
  release.
- **Post-hoc overlay file edit history** — detect manual YAML edits outside UI.
- **Review cadence:** biweekly operational review, quarterly business review.

## Timeline and Milestones

| Phase        | Scope                                                            | Target Date       | Dependencies                                |
| ------------ | ---------------------------------------------------------------- | ----------------- | ------------------------------------------- |
| Alpha        | CRUD, onboarding wizard, JSON-RPC bridge, basic diff preview     | End Q1            | CLI bridge stable, overlay schema finalized |
| Beta         | Full error flows, audit logs, advanced diff, accessibility audit | Mid Q2            | Alpha feedback integration, UX review       |
| GA (PWA)     | Production PWA, telemetry, NPS survey, documentation             | End Q2            | QA sign-off, accessibility compliance       |
| GA (Desktop) | Tauri bundle, auto-updater, platform-specific testing            | Q3 (demand-gated) | PWA adoption data justifies investment      |

### Key Milestones

| Milestone                         | Target Date | Gate Criteria                       |
| --------------------------------- | ----------- | ----------------------------------- |
| JSON-RPC API contract finalized   | End Q1      | CLI and UI teams agree on interface |
| Alpha internal dogfood            | End Q1      | Core CRUD + wizard functional       |
| Beta pilot with 3+ customer teams | Mid Q2      | Onboarding <2 min, NPS >50          |
| PWA GA                            | End Q2      | All measurable objectives met       |
| Tauri desktop GA decision         | End Q2      | PWA adoption data reviewed          |

## Constraints and Dependencies

### Technical Constraints

- Node.js / retort CLI required for validation and sync (engine is not
  duplicated in the UI).
- Tauri desktop app has full file system access; browser PWA is limited by
  browser security model (all FS operations via engine API).
- UI and engine versions must be in lockstep — breaking schema changes must be
  coordinated across both.
- No mobile-optimized UI in v1.

### Business Constraints

- Limited resources for initial GA — prioritization essential. PWA first,
  desktop second.
- Focused on new (greenfield) deployments, not legacy submodule migration.
- Tauri/desktop shipping is gated on proven PWA demand (adoption metrics).

### Dependencies

| Dependency                               | Owner            | Risk Level     |
| ---------------------------------------- | ---------------- | -------------- |
| retort CLI/engine (JSON-RPC API) | Engineering Lead | Low (in-house) |
| UX/design collaboration                  | UX/UI Designer   | Medium         |
| QA test coverage (GUI flows, parity)     | QA Lead          | Medium         |
| Pilot users for early feedback           | Product Owner    | Medium         |
| Tauri build/signing infrastructure       | DevOps           | Low (deferred) |

## Risks and Mitigations

| Risk                                         | Probability | Impact | Mitigation                                                                  |
| -------------------------------------------- | ----------- | ------ | --------------------------------------------------------------------------- |
| UI and engine sync drift (output divergence) | Medium      | High   | Strict API contract; CI parity regression suite; version gating             |
| Insufficient desktop demand to justify Tauri | Low         | Medium | Phase Tauri release; focus on PWA metrics first; decision gate at end Q2    |
| Power user distrust of UI-generated overlays | Medium      | Medium | Provide read-only YAML view; reliable undo/rollback; byte-identical outputs |
| File/OS permission edge cases (desktop)      | Medium      | High   | Desktop permission checks at launch; robust error handling in PWA fallback  |
| Schema changes break existing UI forms       | Medium      | High   | Schema versioning; migration assistant; backward-compatible field additions |
| Accessibility compliance gaps at launch      | Low         | High   | Accessibility audit in Beta phase; automated a11y testing in CI             |
| Offline data loss (PWA)                      | Low         | Medium | Auto-save drafts to browser storage every 30s; sync queue on reconnect      |

## Open Questions

| Question                                                   | Owner            | Target Date    | Impact if Unresolved                 |
| ---------------------------------------------------------- | ---------------- | -------------- | ------------------------------------ |
| What % of UI overlay edits defines pilot/GA success?       | Product Owner    | Pre-pilot      | Unclear go/no-go criteria            |
| Should/when is YAML override available for advanced users? | Engineering Lead | Post-GA        | Limits power user trust and adoption |
| Which UI framework (Preact, Svelte, web components)?       | Engineering Lead | Alpha start    | Blocks UI development kickoff        |
| Tauri code-signing and notarization process?               | DevOps           | Pre-desktop GA | Blocks desktop distribution          |

## Appendix

### Research and Data

- User interviews highlight PM and designer blockers with CLI — non-developers
  report feeling "locked out" of overlay management.
- Support logs (2023): most onboarding tickets are config/CLI-related, with
  ~30% requiring manual engineering support.
- Competitive analysis: developer tooling GUIs provide fast onboarding but lack
  audit and schema-drift fidelity.
- Existing config drift pain is amplified in teams with >4 AI tools.

### Design Mockups (Planned)

- Overlay Editor form UI — schema-driven fields with validation states
- Onboarding Wizard — step-by-step guided flow with stack detection
- Side-by-side YAML diff preview — Monaco/CodeMirror based
- Change/audit trail interface — timeline view with actor and diff
- Version Manager — badge, changelog, rollback picker
- Health Check Report — red/amber/green status dashboard

### Technical Feasibility

- JSON-RPC CLI integration validated in proof-of-concept.
- Tauri PWA/desktop builds proven viable for cross-platform release (~5 MB
  binary).
- Schema-driven editing allows real-time feedback without duplicating engine
  logic.
- Security reviewed for sandbox and path traversal risks.
- Same JSON-RPC API can be consumed by IDE extensions (VS Code, JetBrains)
  in future phases.

### Competitive Analysis

| Capability                     | GitHub Copilot | Claude | Cursor | Retort |
| ------------------------------ | -------------- | ------ | ------ | -------------- |
| Multi-tool overlay system      | No             | No     | No     | **Yes**        |
| Visual GUI overlay editing     | No             | No     | No     | **Yes**        |
| Schema-driven validation in UI | No             | No     | No     | **Yes**        |
| Audit trail with rollback      | No             | No     | No     | **Yes**        |
| Drift detection in CI          | No             | No     | No     | **Yes**        |

No competitor currently provides a visual, schema-driven overlay editor with
audit history, rollback, and CI drift detection across AI tooling. This is a
first-mover opportunity for non-developer personas.

### Related Documents

- [PRD-005: Mesh-Native Distribution](PRD-005-mesh-native-distribution.md) —
  parent PRD covering the full hybrid delivery strategy
- [ADR-07: Delivery Strategy (Refined)](../architecture/decisions/07-delivery-strategy.md) —
  architectural decision record
- [ADR-01: Adopt Retort](../architecture/decisions/01-adopt-retort.md)
- [PRD-001: LLM Decision Engine](PRD-001-llm-decision-engine.md)
