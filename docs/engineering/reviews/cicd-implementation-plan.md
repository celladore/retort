# CI/CD Infrastructure Implementation Plan

**Date:** 2026-03-04
**Ref:** [cicd-infrastructure-review-2026-03-04.md](./cicd-infrastructure-review-2026-03-04.md)
**Status:** Draft — awaiting approval

---

## Phase 0: Workflow Naming Convention

### Naming Standard

Adopt the `[Category] Description` pattern for all workflow `name:` fields. This gives:

- **Scannable grouping** in the GitHub Actions UI (all `[CI]` workflows cluster together)
- **Clear category at a glance** even in status check badges and PR checks lists
- **Consistent style** across hand-authored and generated workflows

**Best practices applied:**

- Prefix with bracketed category: `[CI]`, `[Security]`, `[Governance]`, `[Docs]`, `[Framework]`
- Description uses Title Case, is concise, and starts with a noun or verb-noun
- Job names use kebab-case and are verb-first where possible
- File names use kebab-case matching the workflow purpose

### Naming Map

| File                             | Current `name:`            | New `name:`                         | Category   |
| -------------------------------- | -------------------------- | ----------------------------------- | ---------- |
| `ci.yml`                         | `CI`                       | `[CI] Test & Validate`              | CI         |
| `branch-protection.yml`          | `Branch Protection`        | `[Governance] Branch Rules`         | Governance |
| `block-agentkit-changes.yml`     | `block-agentkit-changes`   | `[Governance] Block Retort Changes` | Governance |
| `template-protection.yml`        | `Template Protection`      | `[Framework] Template Protection`   | Framework  |
| `codeql.yml`                     | `CodeQL`                   | `[Security] CodeQL Analysis`        | Security   |
| `semgrep.yml`                    | `Semgrep (Advisory)`       | `[Security] Semgrep Scan`           | Security   |
| `documentation-quality.yml`      | `Documentation Quality`    | `[Docs] Quality Check`              | Docs       |
| `documentation-validation.yml`   | `Documentation Validation` | `[Docs] PR Validation`              | Docs       |
| `ai-framework-ci.yml` (template) | `AI Framework Validation`  | `[Framework] AI Config Validation`  | Framework  |

### Cascading Updates Required

Renaming workflows changes the status check names used by branch protection. All these must update in lockstep:

1. **`scripts/setup-agentkit-branch-governance.sh`** — update `contexts` array:
   - `"CI / test (ubuntu-latest, 24)"` → `"[CI] Test & Validate / test (ubuntu-latest, 24)"`
   - `"CI / validate"` → `"[CI] Test & Validate / validate"`
   - `"Branch Protection / branch-rules"` → `"[Governance] Branch Rules / branch-rules"`
   - `"block-agentkit-changes / check_agentkit_changes"` → `"[Governance] Block Retort Changes / check-agentkit-changes"`

2. **`.agentkit/templates/github/scripts/setup-branch-protection.sh`** — update the generated template's `contexts` array similarly

3. **`.github/workflows/ci.yml`** — also rename job `check_agentkit_changes` to `check-agentkit-changes` for kebab-case consistency

4. **GitHub repo settings** — after deploy, re-run the branch governance script to update required checks

### Job Name Standardization

| Workflow                     | Current Job                                      | New Job                  | Rationale    |
| ---------------------------- | ------------------------------------------------ | ------------------------ | ------------ |
| `block-agentkit-changes.yml` | `check_agentkit_changes`                         | `check-agentkit-changes` | kebab-case   |
| `codeql.yml`                 | `analyze` (with `name: analyze-javascript`)      | `analyze` (keep)         | already good |
| `semgrep.yml`                | `semgrep` (with `name: semgrep-advisory`)        | `semgrep` (keep)         | already good |
| `template-protection.yml`    | `label-and-gate`, `validate-templates`           | keep                     | already good |
| `ci.yml`                     | `test`, `validate`, `yaml-lint`, `markdown-lint` | keep                     | already good |

---

## Phase 1 — Wave 1: Quick Wins

**Effort:** 1-2 days
**Theme:** Naming, pinning, permissions, trigger fixes

### 1.1 Apply Naming Convention (all workflows)

- Rename all 8 workflow `name:` fields per the naming map above
- Standardize job names to kebab-case
- Update both branch protection scripts with new status check names
- Update generated template for branch protection

### 1.2 Pin All Actions to SHA

**Files:** `ci.yml`, `codeql.yml`, `semgrep.yml`, `documentation-quality.yml`, `documentation-validation.yml`

Pin every action reference to a full commit SHA. Current SHAs for latest stable:

| Action                   | Tag    | SHA to pin                                 |
| ------------------------ | ------ | ------------------------------------------ |
| `actions/checkout`       | v4.2.2 | `11bd71901bbe5b1630ceea73d27597364c9af683` |
| `actions/setup-node`     | v4.4.0 | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `pnpm/action-setup`      | v4.2.0 | `41ff72655975bd51cab0327fa583b6e92b6d3061` |
| `actions/setup-python`   | v5.6.0 | (look up current SHA)                      |
| `github/codeql-action/*` | v3     | (look up current SHA)                      |
| `actions/github-script`  | v7.1.0 | `f28e40c7f34bde8b3046d885e986cb6290c5673b` |

Also pin in the generated documentation workflow templates.

### 1.3 Add `dev` to Security Scanning Triggers

**Files:** `semgrep.yml`, `codeql.yml`

```yaml
# semgrep.yml
on:
  pull_request:
    branches: [main, dev]  # was: [main]

# codeql.yml
on:
  push:
    branches: [main, dev]  # was: [main]
  pull_request:
    branches: [main, dev]  # was: [main]
```

### 1.4 Add Timeout to All Jobs

**Files:** All 8 workflows

Add `timeout-minutes` to every job:

| Job type                 | Timeout |
| ------------------------ | ------- |
| Test (multi-platform)    | 15 min  |
| Validate / lint          | 10 min  |
| Security scan (CodeQL)   | 20 min  |
| Security scan (Semgrep)  | 10 min  |
| Documentation checks     | 5 min   |
| Branch protection checks | 5 min   |

### 1.5 Add Explicit `permissions` Blocks

**Files:** `ci.yml`, `semgrep.yml`, `block-agentkit-changes.yml`

Add minimal permissions to every workflow that doesn't already have them:

```yaml
# ci.yml
permissions:
  contents: read

# block-agentkit-changes.yml
permissions:
  contents: read
```

### 1.6 Sync A2A Config from `teams.yaml`

**File:** `.mcp/a2a-config.json` (or sync engine)

Update the sync engine to generate `a2a-config.json` agent capabilities from `teams.yaml` `accepts` fields instead of hardcoding `["implement", "test", "review"]` for all.

**Before:**

```json
{ "id": "team-security", "capabilities": ["implement", "test", "review"] }
```

**After (from teams.yaml):**

```json
{ "id": "team-security", "capabilities": ["review", "investigate"] }
```

---

## Phase 1 — Wave 2: CI Hardening

**Effort:** 3-5 days
**Theme:** Coverage, auditing, security scanning depth

### 2.1 Create Composite Setup Action

**New file:** `.github/actions/setup-agentkit/action.yml`

Extract the repeated pnpm + Node + install pattern into a reusable composite action:

```yaml
name: Setup Retort
description: Install pnpm, Node.js, and agentkit dependencies
inputs:
  node-version:
    default: '24'
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@<SHA>
      with:
        package_json_file: package.json
    - uses: actions/setup-node@<SHA>
      with:
        node-version: ${{ inputs.node-version }}
        cache: pnpm
        cache-dependency-path: .agentkit/pnpm-lock.yaml
    - run: pnpm install --frozen-lockfile
      working-directory: .agentkit
      shell: bash
```

Then replace 6+ occurrences across `ci.yml`, `documentation-quality.yml`, `template-protection.yml`.

### 2.2 Add Coverage Reporting & Enforcement

**File:** `ci.yml` — `test` job

```yaml
- name: Run tests with coverage
  run: pnpm test -- --coverage --coverage.thresholds.lines=80
  working-directory: .agentkit

- name: Upload coverage artifact
  if: matrix.os == 'ubuntu-latest'
  uses: actions/upload-artifact@<SHA>
  with:
    name: coverage-report
    path: .agentkit/coverage/
```

Also add a coverage summary step that posts to PR comments (optional — can use a coverage action).

### 2.3 Add Dependency Audit Job

**File:** `ci.yml` — new job

```yaml
dependency-audit:
  runs-on: ubuntu-latest
  timeout-minutes: 5
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@<SHA>
    - uses: ./.github/actions/setup-agentkit
    - name: Audit dependencies
      run: pnpm audit --audit-level=high
      working-directory: .agentkit
      continue-on-error: true # advisory in wave 2, blocking in wave 3
```

### 2.4 Expand Semgrep Rules

**File:** `.semgrep/semgrep.yml`

Add rules for the `security-auditor` agent's responsibilities:

```yaml
rules:
  # Existing
  - id: javascript.security.no-eval
  - id: javascript.security.no-child-process-exec

  # New — OWASP Top 10 aligned
  - id: javascript.security.no-unsafe-regex
    pattern: new RegExp($X)
    message: Prefer static regex literals to avoid ReDoS
    severity: WARNING

  - id: javascript.security.no-path-join-user-input
    pattern: path.join(..., $USER_INPUT, ...)
    message: Validate/sanitize user input before path operations
    severity: ERROR

  - id: javascript.security.no-dynamic-require
    pattern: require($VAR)
    message: Dynamic require() can lead to arbitrary code execution
    severity: ERROR

  - id: yaml.security.no-hardcoded-credentials
    patterns:
      - pattern: 'password: $VALUE'
      - pattern: 'secret: $VALUE'
      - pattern: 'api_key: $VALUE'
    message: Do not hardcode credentials in YAML files
    severity: ERROR
```

Also add `--config=p/javascript` or `--config=p/owasp-top-ten` from the Semgrep registry for broader coverage.

### 2.5 Replace Hand-Rolled Secret Detection with gitleaks

**File:** `branch-protection.yml` — replace "Verify no secrets in diff" step

```yaml
- name: Scan for secrets
  uses: gitleaks/gitleaks-action@<SHA>
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This covers all patterns the hand-rolled regex misses (Azure SAS, Slack, DB strings, JWTs, high-entropy strings).

### 2.6 Graduate Semgrep from Advisory to Blocking (ERROR rules only)

**File:** `semgrep.yml`

```yaml
- name: Run Semgrep
  run: |
    semgrep scan \
      --config=.semgrep/semgrep.yml \
      --error \
      --severity=ERROR \
      --include='.agentkit/engines/node/src/**' \
      --include='.github/workflows/**' \
      --sarif --output=semgrep.sarif
  # Remove continue-on-error for ERROR severity
```

Keep the SARIF upload for WARNING-level findings.

### 2.7 Merge `yaml-lint` into `validate` Job

**File:** `ci.yml`

The separate `yaml-lint` job adds ~2 min of CI overhead for a check that `spec-validate` already covers. Merge it into the `validate` job as an early step, or remove it entirely since `spec-validate` validates both syntax and schema.

---

## Phase 2 — Wave 3: Generation Pipeline

**Effort:** 5-10 days
**Theme:** Generate downstream CI, Renovate, IaC, releases from spec

### 3.1 Stack-Aware CI Generation for Downstream Repos

**New template:** `.agentkit/templates/github/workflows/ci-pipeline.yml`

Generate a CI workflow that uses `project.yaml` settings:

```yaml
name: "[CI] Pipeline"

on:
  push:
    branches: [{{defaultBranch}}{{#if hasDev}}, dev{{/if}}]
  pull_request:
    branches: [{{defaultBranch}}{{#if hasDev}}, dev{{/if}}]

jobs:
{{#each detectedStacks}}
  {{this.name}}-checks:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@<SHA>
      - name: Build
        run: {{this.buildCommand}}
      - name: Lint
        run: {{this.linter}} .
      - name: Test
        run: {{this.testCommand}}{{#if ../coverageTarget}} -- --coverage --coverage.thresholds.lines={{../coverageTarget}}{{/if}}
{{/each}}
```

Gate complexity on `ciProfile`:

- `minimal` → lint + test
- `medium` → lint + test + build + coverage
- `strict` → all + security scan + mutation testing

### 3.2 Generate Renovate Config from Spec

**New template:** `.agentkit/templates/renovate/renovate.json`

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "schedule": ["every {{dependencyManagement.schedule}}"],
  "automerge": true,
  "automergeType": "pr",
  "packageRules": [
    {
      "matchUpdateTypes": ["{{dependencyManagement.automerge}}"],
      "automerge": true
    },
    {
      "matchManagers": ["github-actions"],
      "automerge": false,
      "pinDigests": true
    }
  ]
}
```

### 3.3 Unify Branch Protection from Spec

**Changes to:** `synchronize.mjs`, `templates/github/scripts/setup-branch-protection.sh`

- Derive required status check names from the generated workflow names + job names
- Store the branch strategy, review requirements, and linear history setting in `project.yaml` process section
- Generate the branch protection script from spec instead of hardcoding context names
- Deprecate the hand-authored `scripts/setup-agentkit-branch-governance.sh` in favor of the generated one

### 3.4 Generate IaC CI When `iacTool` Is Configured

**New template:** `.agentkit/templates/github/workflows/iac-validation.yml`

When `project.yaml` has `deployment.iacTool: terraform` (or similar):

```yaml
name: '[Infra] Terraform Validation'

on:
  pull_request:
    paths: ['infra/**', 'terraform/**', 'modules/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@<SHA>
      - uses: hashicorp/setup-terraform@<SHA>
      - run: terraform fmt -check -recursive
      - run: terraform init -backend=false
      - run: terraform validate
```

For Terragrunt, add `terragrunt validate-inputs` and `terragrunt hclfmt --check`.

### 3.5 Generate Release Workflow

**New template:** `.agentkit/templates/github/workflows/release.yml`

When `deployment.environments` includes more than `[local, ci]`:

```yaml
name: '[Release] Publish'

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@<SHA>
        with:
          fetch-depth: 0
      - name: Generate changelog
        run: |
          git log $(git describe --tags --abbrev=0 HEAD~1)..HEAD --pretty=format:'- %s' > RELEASE_NOTES.md
      - name: Create GitHub Release
        uses: softprops/action-gh-release@<SHA>
        with:
          body_path: RELEASE_NOTES.md
```

### 3.6 Team-Handoff-Aware CI Structure

**Enhancement to:** `templates/github/workflows/ci-pipeline.yml`

Generate path-filtered jobs that mirror team handoff chains:

```yaml
jobs:
  # Triggered by infra/** changes
  infra-validate:
    if: # path filter for infra/**
    steps: [terraform validate]

  # Handoff: infra → devops
  devops-validate:
    needs: [infra-validate]
    if: # path filter for .github/workflows/**, docker/**
    steps: [lint workflows, validate docker]

  # Handoff: devops → security
  security-scan:
    needs: [devops-validate]
    steps: [semgrep, gitleaks, audit]
```

This makes CI structurally match the `handoff-chain` defined in `teams.yaml`.

---

## Phase 2 — Wave 4: Advanced Alignment

**Effort:** 5-10 days
**Theme:** Deep agent/CI alignment, SBOM, containers, quality gates

### 4.1 Container Generation When `containerized: true`

**New templates:**

- `templates/docker/Dockerfile`
- `templates/docker/.dockerignore`
- `templates/docker/docker-compose.yml`
- `templates/github/workflows/container-scan.yml`

Generate from `project.yaml` stack:

```dockerfile
# Multi-stage build for {{stack.frameworks.backend}}
FROM node:{{nodeVersion}}-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:{{nodeVersion}}-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Add Trivy container scanning in CI:

```yaml
- name: Scan container
  uses: aquasecurity/trivy-action@<SHA>
  with:
    image-ref: ${{ env.IMAGE_NAME }}
    severity: HIGH,CRITICAL
```

### 4.2 DevOps Agent CI Backing

**Files:** `ci.yml`, new monitoring workflow

Add metrics that back the devops agent's responsibilities:

- **Build time tracking:** Record start/end timestamps, compare against a budget
- **Workflow timing alerts:** Add a step that warns if total CI time exceeds a threshold
- **Secret environment audit:** Validate that no `env:` blocks contain plain-text values matching secret patterns

### 4.3 Agent Focus Path Coverage Validation

**Enhancement to:** `spec-validator.mjs` + `ci.yml`

Add a new validation:

```javascript
// In spec-validator.mjs
function validateFocusPathCoverage(agents, teams, repoFiles) {
  const allPaths = repoFiles.filter((f) => !f.startsWith('.'));
  const coveredPaths = new Set();
  for (const team of teams) {
    for (const scope of team.scope) {
      // Match scope glob against repo files
      // Add matches to coveredPaths
    }
  }
  const orphans = allPaths.filter((f) => !coveredPaths.has(f));
  if (orphans.length > 0) {
    warn(`${orphans.length} files not covered by any team scope`);
  }
}
```

Add this to the `validate` CI job so team scope gaps are caught.

### 4.4 Structured Quality Gates Spec

**New file:** `.agentkit/spec/quality-gates.yaml`

Define quality gates that the `test-lead` agent maintains and CI enforces:

```yaml
qualityGates:
  phase3-implementation:
    required:
      - name: lint
        command: '{{techStack.linter}}'
        blocking: true
      - name: typecheck
        command: '{{techStack.typecheck}}'
        blocking: true
      - name: unit-tests
        command: '{{techStack.testCommand}}'
        blocking: true
      - name: coverage
        threshold: '{{testing.coverage}}'
        blocking: true
    advisory:
      - name: security-scan
        tool: semgrep
      - name: dependency-audit
        tool: 'pnpm audit'

  phase4-validation:
    required:
      - name: integration-tests
        blocking: true
      - name: code-review
        approvals: 1
    advisory:
      - name: performance-benchmark
      - name: bundle-size
```

Generate CI required checks from `qualityGates.*.required` entries.

### 4.5 SBOM Generation

**New step in** release workflow or CI:

```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@<SHA>
  with:
    format: spdx-json
    output-file: sbom.spdx.json

- name: Upload SBOM
  uses: actions/upload-artifact@<SHA>
  with:
    name: sbom
    path: sbom.spdx.json
```

Attach SBOM to GitHub Releases for supply chain compliance.

---

## Implementation Order & Dependencies

```
Wave 1 (days 1-2)
├── 1.1 Naming convention (all workflows + branch protection scripts)
├── 1.2 Pin all actions to SHA
├── 1.3 Add dev to security triggers
├── 1.4 Add timeouts
├── 1.5 Add permissions blocks
└── 1.6 Sync A2A from teams.yaml

Wave 2 (days 3-7) — depends on Wave 1
├── 2.1 Composite setup action ← depends on 1.2 (SHA pins)
├── 2.2 Coverage enforcement
├── 2.3 Dependency audit job
├── 2.4 Expand Semgrep rules
├── 2.5 gitleaks replaces hand-rolled regex ← depends on 1.1 (naming)
├── 2.6 Graduate Semgrep to blocking
└── 2.7 Merge yaml-lint into validate

Wave 3 (days 8-17) — depends on Wave 2
├── 3.1 Stack-aware CI generation ← depends on 2.1 (composite action)
├── 3.2 Renovate config generation ← depends on 1.2 (SHA pins)
├── 3.3 Unify branch protection from spec ← depends on 1.1 (naming)
├── 3.4 IaC CI generation ← depends on 3.1 (CI template pattern)
├── 3.5 Release workflow generation
└── 3.6 Team-handoff-aware CI ← depends on 3.1 + teams.yaml

Wave 4 (days 18-27) — depends on Wave 3
├── 4.1 Container generation ← depends on 3.1
├── 4.2 DevOps agent CI backing
├── 4.3 Focus path coverage validation
├── 4.4 Structured quality gates spec ← depends on 3.1 + 3.6
└── 4.5 SBOM generation ← depends on 3.5 (release workflow)
```

---

## Success Criteria

| Wave | Metric                                    | Target                         |
| ---- | ----------------------------------------- | ------------------------------ |
| 1    | All actions SHA-pinned                    | 100%                           |
| 1    | Security scans run on `dev` PRs           | Yes                            |
| 1    | Workflow naming consistent                | All `[Category] Description`   |
| 2    | Test coverage enforced in CI              | >= 80% threshold               |
| 2    | Semgrep rule count                        | >= 10 rules                    |
| 2    | Dependency audit in CI                    | Advisory mode                  |
| 3    | Downstream repos get generated CI         | 1 template per ciProfile level |
| 3    | Renovate config generated from spec       | Yes                            |
| 3    | IaC validation generated when iacTool set | Yes                            |
| 4    | A2A capabilities match teams.yaml         | 100%                           |
| 4    | Team scope covers codebase                | >= 95% of files                |
| 4    | SBOM attached to releases                 | Yes                            |

---

## Risk Notes

1. **Workflow rename breaks required checks** — Must update GitHub branch protection rules immediately after deploying Wave 1. Run `setup-agentkit-branch-governance.sh` with updated check names. Consider doing the rename + protection update in a single coordinated deploy.

2. **Downstream repos affected by template changes** — Stack-aware CI generation (Wave 3) changes the generated output. Downstream repos must re-run `agentkit sync` after updating. Version the template changes behind a spec version bump.

3. **Semgrep blocking mode may need tuning** — When graduating from advisory to blocking (Wave 2.6), expect some false positives. Run in advisory mode for 1-2 weeks with expanded rules before blocking.

4. **gitleaks may flag old commits** — When switching to gitleaks (Wave 2.5), configure it to scan only the PR diff, not the full history, to avoid blocking on historical secrets that have been rotated.
