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

## Key Metrics

| Metric | Definition | Why It Matters |
| --- | --- | --- |
| **Onboarding time** | Minutes from zero to first successful `sync` for a new consumer repo | First impression determines adoption velocity |
| **Update friction** | Steps required to adopt a new forge version | High friction leads to version drift and stale configs |
| **CI integration effort** | Lines of CI config required to validate/sync | DevOps overhead scales with number of consumer repos |
| **Repo footprint** | MB of forge artifacts committed to consumer repo | Affects clone times, review noise, storage costs |
| **Customization depth** | Can consumers override specs, templates, commands, and rules? | Core value proposition — must not regress |
| **Version pinning** | Can consumers lock to a specific forge version? | Prevents surprise breaking changes |
| **Offline capability** | Can sync run without network access after initial setup? | Required for air-gapped environments and flaky connections |
| **Private registry support** | Works with private npm registries / GitHub Packages / Artifactory? | Enterprise requirement for internal distribution |
| **Multi-language support** | Does it require Node.js in the consumer repo? | Rust, Python, .NET consumers may not have Node.js |
| **Rollback speed** | Time to revert to previous forge version after a bad update | Safety net for breaking changes |

## Weighted Decision Matrix

Scores are 1–5 (1 = poor, 5 = excellent). Weights sum to 100.

| Criterion | Weight | A: Submodule | B: npm pkg | C: Standalone CLI | D: GH Action | E: Template Repo | F: npm + GH Action |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Onboarding time** | 20 | 2 | 4 | 5 | 3 | 3 | 4 |
| **Update friction** | 15 | 1 | 4 | 5 | 4 | 2 | 5 |
| **CI integration effort** | 10 | 2 | 4 | 3 | 5 | 2 | 5 |
| **Repo footprint** | 10 | 1 | 3 | 5 | 5 | 1 | 4 |
| **Customization depth** | 15 | 5 | 5 | 4 | 3 | 5 | 5 |
| **Version pinning** | 10 | 3 | 5 | 4 | 5 | 2 | 5 |
| **Offline capability** | 5 | 5 | 5 | 2 | 1 | 5 | 4 |
| **Private registry support** | 5 | 4 | 5 | 4 | 4 | 3 | 5 |
| **Multi-language support** | 5 | 3 | 2 | 3 | 5 | 4 | 3 |
| **Rollback speed** | 5 | 3 | 5 | 4 | 5 | 2 | 5 |
| **Weighted Total** | **100** | **253** | **410** | **400** | **385** | **278** | **460** |

### Score Breakdown

**Weighted totals** (Weight x Score, summed):

| Option | Calculation | Total |
| --- | --- | ---: |
| **A: Submodule** | 20(2) + 15(1) + 10(2) + 10(1) + 15(5) + 10(3) + 5(5) + 5(4) + 5(3) + 5(3) | **253** |
| **B: npm Package** | 20(4) + 15(4) + 10(4) + 10(3) + 15(5) + 10(5) + 5(5) + 5(5) + 5(2) + 5(5) | **410** |
| **C: Standalone CLI** | 20(5) + 15(5) + 10(3) + 10(5) + 15(4) + 10(4) + 5(2) + 5(4) + 5(3) + 5(4) | **400** |
| **D: GH Action** | 20(3) + 15(4) + 10(5) + 10(5) + 15(3) + 10(5) + 5(1) + 5(4) + 5(5) + 5(5) | **385** |
| **E: Template Repo** | 20(3) + 15(2) + 10(2) + 10(1) + 15(5) + 10(2) + 5(5) + 5(3) + 5(4) + 5(2) | **278** |
| **F: npm + GH Action** | 20(4) + 15(5) + 10(5) + 10(4) + 15(5) + 10(5) + 5(4) + 5(5) + 5(3) + 5(5) | **460** |

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

### Option F: npm Package + GitHub Action — 460 (Winner)

- **Update friction (5):** Dependabot/Renovate auto-creates PRs. CI validates the bump. Merge and done.
- **CI integration (5):** Action handles drift detection, auto-sync, and validation.
- **Customization (5):** Full overlay system preserved for local and CI use.
- **Version pinning (5):** Semantic versioning via npm. Lock file pins exact version.
- **Rollback (5):** `npm install agentkit-forge@previous-version` + sync. One command.

## Decision

**Adopt Option F: Hybrid npm Package + GitHub Action.**

This approach scores highest across all weighted criteria (460/500) and addresses every pain point identified in the current submodule delivery:

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

### Consumer Experience After Migration

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

## Consequences

### Positive

- **82% faster onboarding** — from ~15 min (submodule + install + init + sync) to ~3 min (npm install + init + sync).
- **Zero-friction updates** — Dependabot/Renovate creates a PR, CI validates, developer merges. No manual submodule dance.
- **Smaller repo footprint** — overlay directory (~10 KB) instead of full forge repo (~2 MB).
- **CI drift detection** — the GitHub Action catches stale generated outputs before they reach production.
- **Semantic versioning** — consumers get clear breaking-change signals via semver.
- **Private registry support** — npm, GitHub Packages, and Artifactory all supported out of the box.

### Negative

- **Node.js required** — consumers must have Node.js installed (already a prerequisite today). Non-Node repos (Rust, Python, .NET) need Node.js as a dev dependency.
- **Publishing overhead** — requires npm publishing infrastructure, CI for the package itself, and version management discipline.
- **Two artifacts to maintain** — the npm package and the GitHub Action must stay in sync.

### Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Breaking change in forge breaks all consumers simultaneously | Semantic versioning + lock files. Consumers only upgrade when they choose to. |
| Private registry not available for some orgs | Support `--registry` flag and document GitHub Packages / Artifactory setup. |
| Template resolution path changes break existing overlays | Migration script validates output parity before completing. |
| GitHub Action marketplace approval delays | Ship the npm package first (Phase 1). Action is additive, not blocking. |

## References

- [ADR-01: Adopt AgentKit Forge](01-adopt-agentkit-forge.md)
- [ADR-03: Tooling Strategy](03-tooling-strategy.md)
- [Architecture Overview](../01_overview.md)
- [CLI Installation Guide](../../../.agentkit/docs/CLI_INSTALLATION.md)
- [Quick Start Guide](../../../.agentkit/docs/QUICK_START.md)
