# ADR-07: Delivery Strategy — Getting AgentKit Forge into Consumer Repos

## Status

**Proposed**

## Date

2026-03-03

## Context

AgentKit Forge is currently delivered to consumer repositories via **git submodule**. The consumer clones the forge as `.agentkit/`, installs dependencies, runs `init` + `sync`, and commits the generated outputs.

This approach works but introduces friction:

- **Onboarding cost** — submodules are a git concept many developers find unintuitive. `git clone` does not initialize submodules by default; new contributors must remember `--recurse-submodules` or run `git submodule update --init`.
- **Update ceremony** — bumping to a new forge version requires `cd .agentkit && git pull origin main && cd .. && git add .agentkit && git commit`. Developers must also re-run `sync` and commit the regenerated outputs. Two commits for one logical change.
- **CI complexity** — every CI workflow must include submodule checkout steps, adding configuration surface area and increasing clone times.
- **Repo bloat** — the full forge repository (specs, templates, engines, docs, benchmarks, platform references) lives inside each consumer repo. Most of that content is only needed at sync time.
- **Discoverability** — new team members may not know the submodule exists or what it does until they encounter a broken checkout.

We need a delivery mechanism that reduces these pain points while preserving the forge's core value: a single source of truth for multi-tool AI agent configuration, with per-repo customization via overlays.

## Options Considered

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

## Score Justifications

### Option A: Git Submodule — 253 (Last Place)

- **Onboarding (2):** Requires understanding git submodules, manual `--recurse-submodules`, separate install step.
- **Update friction (1):** Multi-step process: enter submodule dir, pull, exit, stage, commit, re-sync, commit again.
- **CI integration (2):** Every workflow needs `submodules: recursive` and separate install.
- **Repo footprint (1):** Full forge repo (specs, templates, engines, benchmarks, docs) inside consumer repo.
- **Customization (5):** Full access to all specs/templates — can modify anything.
- **Version pinning (3):** Pinned to a commit SHA, but updating that pin is manual.
- **Offline (5):** Once cloned, everything is local.

### Option B: npm Package — 410

- **Onboarding (4):** One `npm install -D` command. Familiar to any Node.js developer.
- **Update friction (4):** Standard `npm update agentkit-forge` then re-sync.
- **Customization (5):** Overlays remain in the consumer repo; full spec override capability preserved.
- **Multi-language (2):** Requires Node.js and a package.json in the consumer repo.

### Option C: Standalone CLI — 400

- **Onboarding (5):** Zero install — `npx agentkit-forge@latest init` just works.
- **Update friction (5):** Always runs latest (or pinned) version. No dependency to update.
- **Offline (2):** Requires network to fetch the package on each invocation unless cached.
- **Customization (4):** Overlays work, but modifying internal templates requires ejection or overrides.

### Option D: GitHub Action — 385

- **CI integration (5):** Native GH Actions experience; single `uses:` line.
- **Multi-language (5):** Consumer repo needs no Node.js — action brings its own runtime.
- **Customization (3):** Limited to action inputs and overlay files. Cannot extend engine behavior.
- **Offline (1):** Requires CI to run. No local sync without a separate tool.

### Option E: Template Repository — 278

- **Customization (5):** Full source access — consumer owns the entire codebase.
- **Update friction (2):** `git merge` from upstream causes conflicts on every customized file.
- **Version pinning (2):** No semantic versioning. Consumers merge arbitrary upstream commits.

### Option F: npm Package + GitHub Action — 445

- **Update friction (5):** Dependabot/Renovate auto-creates PRs. CI validates the bump. Merge and done.
- **CI integration (5):** Action handles drift detection, auto-sync, and validation.
- **Customization (5):** Full overlay system preserved for local and CI use.
- **Version pinning (5):** Semantic versioning via npm. Lock file pins exact version.
- **Rollback (5):** `npm install agentkit-forge@previous-version` + sync. One command.
- **Non-CLI accessibility (2):** Still terminal-first. Non-dev team members must ask a developer to run commands.

### Option G: PWA / Desktop UI — 430

- **Onboarding (5):** Visual wizard walks through init. No terminal required. "Open app, point at repo, click Create." A PM or designer can configure an overlay without learning YAML.
- **Update friction (5):** App auto-updates (Tauri updater / PWA service worker). One-click "Update forge to v3.5" with changelog preview.
- **CI integration (3):** The UI is a local development tool. CI still needs the action or CLI underneath — the UI doesn't replace CI, it complements it.
- **Customization (4):** Form-based overlay editing handles 90% of use cases. Power users who need raw template overrides or engine extensions still drop to the CLI. The UI can expose an "eject to YAML" escape hatch.
- **Version pinning (4):** Managed through app settings rather than a lock file. Less explicit than `package-lock.json`, but the underlying npm package still supports lock files for CI.
- **Offline (4):** Tauri bundles the engine locally. PWA caches via service worker. Both work offline after first launch.
- **Multi-language (4):** Tauri bundles its own runtime — consumer repo doesn't need Node.js installed. PWA requires a browser (universal).
- **Non-CLI accessibility (5):** The entire point. Visual interface for overlay editing, sync, version management. Team members who never open a terminal can participate in forge configuration.
- **Rollback (5):** Visual version history with one-click rollback and diff preview.

**Why G scores lower than F overall:** The UI adds significant maintenance surface area (cross-platform builds, UI framework, app distribution) and doesn't solve CI integration, which still needs the action. It excels at a different axis: team breadth of adoption.

## Decision

**Adopt Option F+G: npm Package + GitHub Action + PWA/Desktop UI.**

Option F (445) and Option G (430) are not competing — they're complementary layers targeting different users:

| Layer                | Audience   | Problem it solves                                      |
| -------------------- | ---------- | ------------------------------------------------------ |
| **npm package**      | Developers | Local sync, version pinning, offline support           |
| **GitHub Action**    | CI/DevOps  | Drift detection, automated validation                  |
| **PWA / Desktop UI** | Whole team | Visual config editing, discoverability, non-CLI access |

The combined approach scores highest and addresses every pain point identified in the current submodule delivery:

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
# Install
npm install -D agentkit-forge

# Initialize (first time)
npx agentkit-forge init --repoName my-project

# Sync after overlay changes
npx agentkit-forge sync

# Update to new version
npm update agentkit-forge
npx agentkit-forge sync

# CI (GitHub Actions)
# .github/workflows/agentkit.yml
# - uses: org/agentkit-forge-action@v3
#   with:
#     overlay: my-project
```

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

- **82% faster onboarding** — from ~15 min (submodule + install + init + sync) to ~3 min (npm install + init + sync), or ~1 min via the UI wizard.
- **Zero-friction updates** — Dependabot/Renovate creates a PR, CI validates, developer merges. UI users get one-click update with changelog preview.
- **Smaller repo footprint** — overlay directory (~10 KB) instead of full forge repo (~2 MB).
- **CI drift detection** — the GitHub Action catches stale generated outputs before they reach production.
- **Semantic versioning** — consumers get clear breaking-change signals via semver.
- **Private registry support** — npm, GitHub Packages, and Artifactory all supported out of the box.
- **Whole-team adoption** — the UI lets non-developers (PMs, designers, team leads) configure overlays, toggle tools, and review sync diffs without touching a terminal. This shifts forge configuration from "developer chore" to "team capability."

### Negative

- **Node.js required** — consumers must have Node.js installed (already a prerequisite today). Non-Node repos (Rust, Python, .NET) need Node.js as a dev dependency. The Tauri app partially mitigates this by bundling its own runtime.
- **Publishing overhead** — requires npm publishing infrastructure, CI for the package itself, and version management discipline.
- **Three artifacts to maintain** — the npm package, GitHub Action, and UI app must stay in sync. Mitigated by having the UI be a thin shell over the same engine.
- **UI maintenance cost** — cross-platform testing, accessibility compliance, UI framework updates. PWA-first approach minimizes this (no native builds until Tauri phase).
- **Feature parity risk** — new CLI features may lag behind in the UI. Mitigated by building the UI against the same JSON-RPC API the CLI uses internally, not a separate interface.

### Risks and Mitigations

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

- [ADR-01: Adopt AgentKit Forge](01-adopt-agentkit-forge.md)
- [ADR-03: Tooling Strategy](03-tooling-strategy.md)
- [Architecture Overview](../01_overview.md)
- [CLI Installation Guide](../../../.agentkit/docs/CLI_INSTALLATION.md)
- [Quick Start Guide](../../../.agentkit/docs/QUICK_START.md)
