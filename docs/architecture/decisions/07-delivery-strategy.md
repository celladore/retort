# ADR-07: Delivery Strategy (Refined) — AgentKit Forge Distribution

## Status

**Proposed**

## Date

2024-05-31

## Context

AgentKit Forge, a core platform for deploying mesh-native agents at scale, faces rising friction in delivering updates, onboarding new customers, and supporting diverse consumption models. Historically, Forge delivery methods lagged industry and developer best practices, relying on manual binary distribution and ad hoc integrations. This produced pain for both CLI-first engineers and UI-oriented operators, delayed onboarding, and created avoidable support overhead amid growing cloud-native adoption.

**Executive Summary:**
Market analysis, customer interviews, and operational metrics all highlight these delivery inefficiencies as blockers for broader adoption and hamper ecosystem integration efforts. To support customer GTM targets for Q3–Q4 2024—especially for mid-market and enterprise cohorts—Forge must move to a modern, multi-modal distribution model. This ADR formalizes the shift to three distribution mechanisms: npm (modern package distribution), GitHub Actions (automation-centric CI/CD), and PWA (progressive web onboarding), providing consistency, reliability, and seamless migration for varied user segments.

### Option A: Git Submodule (Status Quo)

The forge repository is added as a git submodule at `.agentkit/`. All specs, templates, engines, and docs live inside the consumer repo. Sync runs locally.

**How it works today:**

```bash
git submodule add https://github.com/org/agentkit-forge.git .agentkit
pnpm -C .agentkit install
node .agentkit/engines/node/src/cli.mjs init --repoName my-project
node .agentkit/engines/node/src/cli.mjs sync
```

### Option B: npm Package with CLI

Publish agentkit-forge as an npm package (`agentkit-forge`). The consumer installs it as a devDependency. The CLI is exposed via `npx agentkit-forge <command>`. Specs and templates ship inside the package. Overlays remain in the consumer repo.

**Consumer workflow:**

```bash
npm install -D agentkit-forge
npx agentkit-forge init --repoName my-project
npx agentkit-forge sync
```

**Overlay location:** `.agentkit/overlays/<repoName>/` (same as today, but the engine and templates come from `node_modules/`).

### Option C: Standalone CLI (Global Install / npx)

Publish a lightweight CLI tool that fetches templates and specs on demand from a registry or CDN. No persistent footprint beyond the overlay directory and generated outputs.

**Consumer workflow:**

```bash
npx agentkit-forge@latest init --repoName my-project
npx agentkit-forge@latest sync
```

**Key difference from Option B:** no `devDependency` entry, no `node_modules/` footprint. The tool is ephemeral — invoked when needed, not installed permanently.

### Option D: GitHub Action (CI-First)

Deliver the forge as a GitHub Action. Sync runs in CI on push/PR, and generated outputs are committed back (or checked for drift). Local development uses `npx` for ad-hoc sync.

**Consumer workflow:**

```yaml
# .github/workflows/agentkit-sync.yml
- uses: org/agentkit-forge-action@v3
  with:
    overlay: my-project
    version: '3.4.0'
```

### Option E: Template Repository + Upstream Sync

Publish agentkit-forge as a GitHub template repository. Consumers create repos from the template. Updates are pulled via `git merge` from the upstream template remote.

**Consumer workflow:**

```bash
# Initial
gh repo create my-project --template org/agentkit-forge-template

# Update
git remote add forge-upstream https://github.com/org/agentkit-forge-template.git
git fetch forge-upstream
git merge forge-upstream/main --allow-unrelated-histories
```

### Option F: Hybrid — npm Package + GitHub Action

Combine Options B and D. The npm package handles local development (`npx agentkit-forge sync`). The GitHub Action handles CI enforcement (drift detection, auto-sync on version bumps). Both share the same engine and templates from the npm package.

### Option G: PWA / Lightweight Desktop UI

Wrap the forge engine in a small UI shell — either a Progressive Web App (served locally via the CLI or hosted) or a lightweight desktop app (Tauri preferred over Electron for size). The UI provides a visual overlay editor, sync dashboard, version manager, and diff previewer. Under the hood it delegates to the same engine as the npm package.

**Architecture:**

```
┌─────────────────────────────────────┐
│  PWA / Tauri Desktop Shell          │
│  ┌───────────┐  ┌────────────────┐  │
│  │ Overlay   │  │ Sync Dashboard │  │
│  │ Editor    │  │ (status, diff) │  │
│  └───────────┘  └────────────────┘  │
│  ┌───────────┐  ┌────────────────┐  │
│  │ Version   │  │ Tool Toggle    │  │
│  │ Manager   │  │ (add/remove)   │  │
│  └───────────┘  └────────────────┘  │
├─────────────────────────────────────┤
│  agentkit-forge engine (npm pkg)    │
│  specs ─► templates ─► outputs      │
└─────────────────────────────────────┘
```

**Consumer workflow (PWA):**

```bash
npx agentkit-forge ui              # launches localhost:4827
# Browser opens → visual wizard for init, overlay editing, sync
```

**Consumer workflow (Tauri desktop):**

```bash
# Download from releases page or:
brew install agentkit-forge         # macOS
winget install agentkit-forge       # Windows
# Open app → point at repo → visual init + sync
```

**What the UI surfaces:**

- **Overlay editor** — form-based editing of `settings.yaml` with validation, autocomplete for render targets, and live preview of what sync will generate.
- **Sync dashboard** — one-click sync with a visual diff of what changed, grouped by tool (Claude, Cursor, Copilot, etc.).
- **Version manager** — see current version, available updates, changelog, one-click upgrade with rollback.
- **Tool toggle** — visual grid of available render targets. Enable/disable with checkboxes instead of `cli add`/`remove` commands.
- **Health check** — visual report from `doctor` and `healthcheck` commands.

**Key trade-off:** The UI is a _complement_ to the CLI, not a replacement. Power users and CI still use the CLI/action. The UI lowers the barrier for the other 80% of the team who interact with forge configuration infrequently.

## Key Metrics

| Metric                       | Definition                                                           | Why It Matters                                             |
| ---------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Onboarding time**          | Minutes from zero to first successful `sync` for a new consumer repo | First impression determines adoption velocity              |
| **Update friction**          | Steps required to adopt a new forge version                          | High friction leads to version drift and stale configs     |
| **CI integration effort**    | Lines of CI config required to validate/sync                         | DevOps overhead scales with number of consumer repos       |
| **Repo footprint**           | MB of forge artifacts committed to consumer repo                     | Affects clone times, review noise, storage costs           |
| **Customization depth**      | Can consumers override specs, templates, commands, and rules?        | Core value proposition — must not regress                  |
| **Version pinning**          | Can consumers lock to a specific forge version?                      | Prevents surprise breaking changes                         |
| **Offline capability**       | Can sync run without network access after initial setup?             | Required for air-gapped environments and flaky connections |
| **Private registry support** | Works with private npm registries / GitHub Packages / Artifactory?   | Enterprise requirement for internal distribution           |
| **Multi-language support**   | Does it require Node.js in the consumer repo?                        | Rust, Python, .NET consumers may not have Node.js          |
| **Rollback speed**           | Time to revert to previous forge version after a bad update          | Safety net for breaking changes                            |
| **Non-CLI accessibility**    | Can non-terminal users (PMs, designers, leads) use it effectively?   | Determines whole-team adoption vs. dev-only tooling        |

## Weighted Decision Matrix

Scores are 1–5 (1 = poor, 5 = excellent). Weights sum to 100. The addition of Option G (PWA/Desktop UI) prompted a new metric — **Non-CLI accessibility** — which shifts 3 points from Repo footprint (10 → 7) and 2 points from Offline capability (5 → 3) to fund the new 5-point weight, reflecting the reality that whole-team adoption matters more than disk savings or air-gap edge cases.

| Criterion                    |  Weight | A: Submodule | B: npm pkg | C: Standalone CLI | D: GH Action | E: Template Repo | F: npm + GH Action | G: PWA / Desktop UI |
| ---------------------------- | ------: | -----------: | ---------: | ----------------: | -----------: | ---------------: | -----------------: | ------------------: |
| **Onboarding time**          |      20 |            2 |          4 |                 5 |            3 |                3 |                  4 |                   5 |
| **Update friction**          |      15 |            1 |          4 |                 5 |            4 |                2 |                  5 |                   5 |
| **CI integration effort**    |      10 |            2 |          4 |                 3 |            5 |                2 |                  5 |                   3 |
| **Repo footprint**           |       7 |            1 |          3 |                 5 |            5 |                1 |                  4 |                   4 |
| **Customization depth**      |      15 |            5 |          5 |                 4 |            3 |                5 |                  5 |                   4 |
| **Version pinning**          |      10 |            3 |          5 |                 4 |            5 |                2 |                  5 |                   4 |
| **Offline capability**       |       3 |            5 |          5 |                 2 |            1 |                5 |                  4 |                   4 |
| **Private registry support** |       5 |            4 |          5 |                 4 |            4 |                3 |                  5 |                   4 |
| **Multi-language support**   |       5 |            3 |          2 |                 3 |            5 |                4 |                  3 |                   4 |
| **Rollback speed**           |       5 |            3 |          5 |                 4 |            5 |                2 |                  5 |                   5 |
| **Non-CLI accessibility**    |       5 |            1 |          1 |                 1 |            2 |                1 |                  2 |                   5 |
| **Weighted Total**           | **100** |      **241** |    **393** |           **390** |      **377** |          **266** |            **445** |             **430** |

### Score Breakdown

**Weighted totals** (Weight x Score, summed):

| Option                  | Calculation                                                                     |   Total |
| ----------------------- | ------------------------------------------------------------------------------- | ------: |
| **A: Submodule**        | 20(2) + 15(1) + 10(2) + 7(1) + 15(5) + 10(3) + 3(5) + 5(4) + 5(3) + 5(3) + 5(1) | **241** |
| **B: npm Package**      | 20(4) + 15(4) + 10(4) + 7(3) + 15(5) + 10(5) + 3(5) + 5(5) + 5(2) + 5(5) + 5(1) | **393** |
| **C: Standalone CLI**   | 20(5) + 15(5) + 10(3) + 7(5) + 15(4) + 10(4) + 3(2) + 5(4) + 5(3) + 5(4) + 5(1) | **390** |
| **D: GH Action**        | 20(3) + 15(4) + 10(5) + 7(5) + 15(3) + 10(5) + 3(1) + 5(4) + 5(5) + 5(5) + 5(2) | **377** |
| **E: Template Repo**    | 20(3) + 15(2) + 10(2) + 7(1) + 15(5) + 10(2) + 3(5) + 5(3) + 5(4) + 5(2) + 5(1) | **266** |
| **F: npm + GH Action**  | 20(4) + 15(5) + 10(5) + 7(4) + 15(5) + 10(5) + 3(4) + 5(5) + 5(3) + 5(5) + 5(2) | **445** |
| **G: PWA / Desktop UI** | 20(5) + 15(5) + 10(3) + 7(4) + 15(4) + 10(4) + 3(4) + 5(4) + 5(4) + 5(5) + 5(5) | **430** |

**Summary:** Weighting reflects current business priorities: adoption velocity, personalization to persona needs, reduction in support burden, and long-term platform/partner extensibility. The Hybrid model outpaces all others.

## Score Justifications

- **Onboarding Speed:** PWA and Hybrid excel by enabling zero-friction starts for UI professionals and automation-ready journeys for devs; npm is workflow native but CLI-only.
- **Ecosystem Integration:** Hybrid unlocks all future integrations (npm for devs, Actions for CI, PWA for SSO and browser auth); others are siloed.
- **Maintenance Overhead:** Hybrid is higher cost, but justified by cross-persona coverage; npm and PWA are lightweight but narrow.
- **User Persona Coverage:** Only Hybrid enables direct workflows for both CLI-first and operator personas; others cater to one camp.
- **Future-Proofing:** Hybrid allows incremental extensibility without lock-in to a single distribution mode.
- **Security & Auditability:** All modern methods score highly, but Hybrid reduces risk by avoiding over-indexing on GitHub-only access (key for regulated installs).

## Decision

**Executive Recommendation:** Adopt the Hybrid distribution model (npm + GitHub Action + PWA) as the baseline, launching all three as Generally Available for new installs. This ensures fast onboarding, automation-centric distribution, and a browser-native experience.

| Layer                  | Purpose                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **npm (Node package)** | Primary for CLI and SDK distribution, developer-focused.                                                                |
| **GitHub Action**      | Official path for CI-driven installs and upgrades; the only supported CI for new deployments.                           |
| **PWA**                | General Availability for UI-driven onboarding; targeted for greenfield projects, zero-dependency browser installs only. |

All legacy/manual mechanisms to be deprecated by end of Q3 2024.

## Implementation Plan

### Phase 1 (June–July 2024)

- npm package publication pipeline, verification, and monitor baseline metrics
- GA release of PWA for greenfield customers; strict separation from legacy install flows

### Phase 2 (August 2024)

- GitHub Action made mandatory for CI/CD installs; documentation updates and champion enablement
- Migration guides and CLI tooling for user self-service onboarding

### Milestones

| Milestone                                | Date       |
| ---------------------------------------- | ---------- |
| Hybrid launch GA                         | 2024-08-01 |
| Legacy deprecation (manual/cloud binary) | 2024-09-30 |
| PWA: GA for all browser-based onboarding | 2024-09-30 |

**Note:** PWA has NO support for CLI migration.

### Ecosystem Support

- Roadmap inclusion: Partner repository support
- (Stub) Feature: Automated compatibility checks for major mesh-native runtimes

## Consumer Experience After Migration

### CLI-First Personas

**Install AgentKit Forge via npm:**
| Layer | Audience | Problem it solves |
| -------------------- | ---------- | ------------------------------------------------------ |
| **npm package** | Developers | Local sync, version pinning, offline support |
| **GitHub Action** | CI/DevOps | Drift detection, automated validation |
| **PWA / Desktop UI** | Whole team | Visual config editing, discoverability, non-CLI access |

### Implementation Plan

#### Phase 1 — npm Package (weeks 1–3)

1. **Restructure the repository** for npm publishing:
   - `src/` — CLI entry point and engine (currently `engines/node/src/`)
   - `templates/` — all Mustache templates
   - `spec/` — canonical YAML specs
   - `bin/agentkit-forge` — CLI binary entry point
2. **Add `package.json`** with:
   - `"name": "agentkit-forge"`
   - `"bin": { "agentkit-forge": "./bin/agentkit-forge" }`
   - `"files": ["src/", "templates/", "spec/", "bin/"]`
3. **Update the sync engine** to resolve templates/specs from the package installation path (`import.meta.resolve` or `require.resolve`) instead of relative `../../` paths.
4. **Preserve overlay location** at `.agentkit/overlays/<repoName>/` in the consumer repo — this directory is the only forge artifact that lives in the consumer repo.
5. **Publish to npm** (or a private registry for enterprise consumers).

#### Phase 2 — GitHub Action (weeks 3–5)

1. **Create `action.yml`** that:
   - Installs the npm package at the specified version.
   - Runs `agentkit-forge sync` with the consumer's overlay.
   - Compares generated outputs against committed files (drift detection).
   - Fails the check if drift is detected (with a diff summary).
2. **Add an optional auto-commit mode** for repos that want CI to keep outputs in sync automatically.
3. **Publish the action** to the GitHub Actions marketplace.

#### Phase 3 — Migration (weeks 5–7)

1. **Write a migration script** (`agentkit-forge migrate-from-submodule`) that:
   - Reads the current overlay from `.agentkit/overlays/`.
   - Removes the git submodule.
   - Installs the npm package.
   - Re-runs sync to verify output parity.
2. **Update documentation** (Quick Start, CLI Installation, Onboarding).
3. **Deprecate the submodule approach** with a 6-month sunset period.

#### Phase 4 — PWA / Desktop UI (weeks 7–12)

1. **Choose the shell framework:**
   - **PWA (recommended first)** — lower build/distribution overhead. Ship as `npx agentkit-forge ui` which starts a local server on `localhost:4827`. Uses a lightweight framework (Preact, Svelte, or plain web components). Runs in any browser. No app store, no code signing, no platform-specific builds.
   - **Tauri (follow-up)** — for teams that want a native app experience. Wraps the same web UI. Smaller binary than Electron (~5 MB vs ~150 MB). Auto-updater built in. Distribute via GitHub Releases, Homebrew, or winget.
2. **Core UI screens:**
   - **Init wizard** — repo name, tech stack detection (from `discover`), render target selection via checkboxes, overlay creation.
   - **Overlay editor** — schema-driven form that mirrors `settings.yaml`. Field validation, autocomplete for known values, "Show YAML" toggle for power users.
   - **Sync dashboard** — one-click sync button. Output grouped by tool (Claude Code, Cursor, Copilot, Windsurf). Inline diff viewer (Monaco or CodeMirror) showing what changed.
   - **Version manager** — current version badge, available update with changelog summary, "Update + Re-sync" button, rollback to previous version.
   - **Health report** — visual rendering of `doctor` and `healthcheck` output. Red/amber/green status per check.
3. **API boundary** — the UI communicates with the forge engine via a thin JSON-RPC or REST layer over the local server. No direct file system access from the browser. The same API can be consumed by IDE extensions later.
4. **Distribution:**
   - PWA: `npx agentkit-forge ui` (zero install, opens browser).
   - Tauri: GitHub Releases with `brew install agentkit-forge` / `winget install agentkit-forge`.
   - Both auto-update when the underlying npm package updates.

### Consumer Experience After Migration

**Developer (CLI-first):**

```bash
npm install -g agentkit-forge
```

- Immediate CLI and SDK access with autoupdate support

**Automated CI workflows through the official GitHub Action:**

- Integrated with organizational CI pipelines
- Semaphore for successful install/regression

### UI-Driven Personas

- Access PWA via web portal (SSO or OAuth)
- One-click onboarding; instant provisioning of project environment
- Self-service help and live chat within browser app

**Workflow:**
Day-zero onboarding: minimal manual steps, rapid path to first agent deployed or registered.

**Non-developer / visual preference (UI):**

```bash
npx agentkit-forge ui
# Browser opens → visual wizard → click through init → toggle tools → sync
```

**Or with the desktop app:**

```
1. Open AgentKit Forge app
2. Click "Open Repo" → select project folder
3. Visual wizard detects stack, suggests render targets
4. Click "Sync" → see diff of generated files
5. Commit from the app or switch to your git client
```

## Consequences

### Positive

- Adoption acceleration across all major target personas
- Fewer onboarding and upgrade failures, reducing L2/L3 support load
- Eliminates friction for greenfield PWA users and aligns with modern developer expectations
- Enables future extensibility (e.g., IDE plugins, third-party ecosystem hooks)

### Negative

- Increased operational complexity temporarily during migration
- Need for additional internal process alignment (release, security, audit)
- Unavoidable short-term cost to maintain three distribution channels

**In summary:**
Adopting the Hybrid model unlocks growth and developer satisfaction, at the cost of a controlled, time-limited increase in support and operational complexity.

## Risks and Mitigations

| Risk                                           | Probability | Business Impact | Mitigation                                                              |
| ---------------------------------------------- | ----------- | --------------- | ----------------------------------------------------------------------- |
| npm registry outages or delays                 | Medium      | Medium          | Dual-publish critical updates; status monitoring; fallback guides       |
| GitHub Actions ecosystem disruption            | Low         | High            | Maintain validated fallback/manual install path during launch           |
| PWA browser support fragmentation              | Medium      | Medium          | Restrict PWA to tested browsers (Chrome, Edge), clear communication     |
| Release process overhead (Hybrid complexity)   | High        | Medium          | Use monorepo + CI pipelines for update alignment, automate most ops     |
| User confusion during transition               | Medium      | Medium          | Clear migration comms, in-product prompts and guides                    |
| Security vulnerabilities in third-party routes | Medium      | High            | Continuous dependency scanning and SAST, formal security review process |

| Risk                                                                 | Mitigation                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Breaking change in forge breaks all consumers simultaneously         | Semantic versioning + lock files. Consumers only upgrade when they choose to.                                                        |
| Private registry not available for some orgs                         | Support `--registry` flag and document GitHub Packages / Artifactory setup.                                                          |
| Template resolution path changes break existing overlays             | Migration script validates output parity before completing.                                                                          |
| GitHub Action marketplace approval delays                            | Ship the npm package first (Phase 1). Action is additive, not blocking.                                                              |
| UI becomes a maintenance burden that distracts from core engine work | PWA-first (Phase 4a) keeps the build simple. Tauri native app (Phase 4b) is optional and only pursued if adoption data justifies it. |
| UI and CLI diverge in behavior                                       | Single JSON-RPC API layer used by both. UI is a presentation layer only — all logic lives in the engine.                             |
| Desktop app distribution (code signing, notarization)                | Defer Tauri to Phase 4b. PWA has zero distribution overhead — it's just a web page.                                                  |

## References

- AgentKit Forge Architectural Overview (Doc A1-Overview.pdf)
- CI/CD Integration Guide
- Ecosystem Compatibility Matrix
- Internal Security and Audit Policy
- Mesh-Native Distribution Survey (March 2024)
- [PRD-005: Mesh-Native Distribution](../../product/PRD-005-mesh-native-distribution.md)
- [PRD-007: Adopter Autoupdate](../../product/PRD-007-adopter-autoupdate.md) — follow-up capability
  building on the npm CLI distribution channel defined in this ADR; specifically the "Immediate CLI
  and SDK access with autoupdate support" requirement from the Consumer Experience section.
- [#196: adoption/startup-hooks: enforce required CLI toolchain availability](https://github.com/JustAGhosT/agentkit-forge/issues/196)
  — prerequisite for the autoupdate preflight checks.
- [#194: governance: enforce agentkit sync pre-PR for adopters](https://github.com/JustAGhosT/agentkit-forge/issues/194)
  — sync enforcement gate that autoupdate must satisfy.
