# CI/CD Infrastructure & Infrastructure Generation Review

**Date:** 2026-03-04
**Scope:** All GitHub Actions workflows, branch governance, infrastructure generation pipeline, and alignment with the agentic workforce defined in `agents.yaml`, `teams.yaml`, and `commands.yaml`.

---

## Executive Summary

AgentKit Forge has a well-structured CI/CD foundation with 8 GitHub Actions workflows, comprehensive branch governance, and a powerful spec-driven generation pipeline. However, there are **meaningful gaps between the CI/CD infrastructure and the agentic workforce it supports**. The workflows validate the _forge itself_ but don't yet generate CI/CD that exercises the full agent team model, and several hardening opportunities exist in the existing pipelines.

This review identifies **28 findings** organized into 4 categories:

1. CI/CD Pipeline Gaps & Hardening (10 findings)
2. Infrastructure Generation Gaps (8 findings)
3. Agent Workforce Alignment Issues (6 findings)
4. Security & Supply Chain (4 findings)

---

## 1. CI/CD Pipeline Gaps & Hardening

### 1.1 CRITICAL: Inconsistent Action Pinning

**Files:** `ci.yml`, `codeql.yml`, `semgrep.yml`, `documentation-quality.yml`, `documentation-validation.yml`

The repository uses a mix of tag-based (`@v4`, `@v3`, `@v5`) and SHA-pinned (`@11bd71901bbe5b1630ceea73d27597364c9af683`) action references:

| Workflow                       | Pinning Style           |
| ------------------------------ | ----------------------- |
| `ci.yml`                       | Tag (`@v4`)             |
| `branch-protection.yml`        | SHA-pinned              |
| `template-protection.yml`      | SHA-pinned              |
| `codeql.yml`                   | Tag (`@v4`, `@v3`)      |
| `semgrep.yml`                  | Tag (`@v4`, `@v5`)      |
| `documentation-quality.yml`    | Tag (`@v4`) — generated |
| `documentation-validation.yml` | Tag (`@v4`) — generated |

**Risk:** Tag-based references are mutable. A compromised upstream action can silently change behavior. This was exploited in the `tj-actions/changed-files` incident.

**Recommendation:** Pin ALL actions to full SHA digests. Add a Renovate or Dependabot config to auto-update action SHAs. The generation templates (`documentation-quality.yml`, `documentation-validation.yml`) should emit SHA-pinned references.

---

### 1.2 HIGH: Redundant Dependency Installation Across Jobs

**File:** `ci.yml`

Four jobs (`test`, `validate`, `yaml-lint`, `markdown-lint`) each independently install pnpm + Node.js + dependencies. This means 4x redundant `pnpm install --frozen-lockfile` runs per CI execution (6x when counting multi-platform test matrix).

**Recommendation:**

- Extract a reusable composite action (`.github/actions/setup-agentkit/action.yml`) that encapsulates pnpm/Node/install.
- Consider using GitHub Actions artifacts to share the `node_modules` between jobs, or use a single "setup + cache" job that downstream jobs depend on.

---

### 1.3 HIGH: No Coverage Reporting or Enforcement

**Files:** `ci.yml`, `project.yaml` (line 140: `coverage: 80`)

`project.yaml` declares an 80% coverage target, and the `test-lead`, `coverage-tracker` agents are responsible for enforcing it. However:

- No `--coverage` flag is passed to vitest in CI
- No coverage artifact is uploaded
- No coverage threshold enforcement in the pipeline
- No coverage diff/delta check on PRs

**Recommendation:**

- Add `pnpm test -- --coverage` to the CI test step
- Upload coverage reports as artifacts
- Add a coverage threshold check step (`vitest` supports `--coverage.thresholds.lines 80`)
- Consider integrating Codecov or a similar service for PR coverage diffs

---

### 1.4 MEDIUM: Semgrep Only Triggers on PRs to `main`

**File:** `semgrep.yml` (line 4)

Semgrep only runs on PRs targeting `main`, but the branch strategy is `dev → main` promotion. Most PRs target `dev`, meaning **Semgrep never runs on normal development PRs**.

**Recommendation:** Add `dev` to the trigger branches:

```yaml
on:
  pull_request:
    branches: [main, dev]
```

---

### 1.5 MEDIUM: CodeQL Only Runs on `main` Push/PR

**File:** `codeql.yml` (lines 4-6)

Same issue as Semgrep — CodeQL only triggers on `main` events. Since the promotion path is `dev → main`, code hitting `dev` (where most development happens) is not scanned until the promotion PR.

**Recommendation:** Add `dev` to both push and pull_request triggers.

---

### 1.6 MEDIUM: No Dependency Audit Step in CI

**File:** `project.yaml` (line 153: `dependencyAudit: true`)

`project.yaml` declares `dependencyAudit: true` but there is no `npm audit` / `pnpm audit` step in any workflow. The `dependency-watcher` agent lists this as a responsibility, but it has no CI counterpart.

**Recommendation:** Add a dependency audit job to `ci.yml`:

```yaml
dependency-audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@...
    - uses: pnpm/action-setup@...
    - run: pnpm audit --audit-level=high
      working-directory: .agentkit
      continue-on-error: true # advisory initially
```

---

### 1.7 MEDIUM: `yaml-lint` Only Validates Syntax, Not Schema

**File:** `ci.yml` (lines 107-113)

The YAML lint step only checks that spec files are valid YAML (parseable by `js-yaml`). It does **not** validate that the YAML conforms to the expected spec schemas (e.g., that `project.yaml` has required fields, that agent IDs in `teams.yaml` reference valid agents, etc.).

The `validate` job runs `spec-validate` separately, but `yaml-lint` gives a false sense of completeness.

**Recommendation:** Either merge `yaml-lint` into `validate` (since spec-validate already implies syntax validity), or enhance it to do schema validation. The separate job adds ~2 minutes of CI time for minimal value.

---

### 1.8 MEDIUM: No Timeout Configuration on Workflows

**Files:** All workflow files

No workflow or job sets explicit `timeout-minutes`. If a step hangs (e.g., a test deadlock), the default GitHub Actions timeout is 6 hours.

**Recommendation:** Add `timeout-minutes: 15` to all jobs (or an appropriate per-job limit).

---

### 1.9 LOW: `validate` Job Runs `discover` Without Checking Output

**File:** `ci.yml` (line 77)

The `validate` job runs `agentkit discover --output json` but doesn't use or validate the output. It's essentially a smoke test that discover doesn't crash, but it wastes CI time if the output isn't checked.

**Recommendation:** Either remove it from CI (save time) or add output validation (check that discover produces expected team/stack detections).

---

### 1.10 LOW: Generated Workflows Use Different `pnpm/action-setup` Reference

**Files:** `documentation-quality.yml` vs `template-protection.yml`

- Generated workflows: `pnpm/action-setup@v4` (tag)
- Hand-authored: `pnpm/action-setup@41ff72655975bd51cab0327fa583b6e92b6d3061` (SHA)

The templates should emit the same pinning style as hand-authored workflows.

---

## 2. Infrastructure Generation Gaps

### 2.1 HIGH: No Generated CI for Downstream Repos

**File:** `ai-framework-ci.yml` (template)

The `ai-framework-ci.yml` template generates a workflow that validates JSON, checks command files, scans for secrets, and validates structure — but it does **not**:

- Run the downstream repo's test suite
- Run linting for the repo's actual tech stack
- Enforce coverage thresholds
- Run `agentkit validate` or `agentkit spec-validate`

The template is a good start for framework validation but doesn't generate a full CI pipeline aligned with the `ciProfile` setting in `project.yaml`.

**Recommendation:** Generate stack-aware CI workflows based on `project.yaml`:

- `ciProfile: minimal` → lint + test
- `ciProfile: medium` → lint + test + build + coverage + security scan
- `ciProfile: strict` → all of above + mutation testing + performance checks

Use `techStacks` from `teams.yaml` to emit the correct build/test/lint commands.

---

### 2.2 HIGH: No Renovate/Dependabot Config Generation

**File:** `project.yaml` (lines 117-121)

`project.yaml` declares `dependencyManagement: { tool: renovate, schedule: weekly, automerge: patch }` but no Renovate configuration (`renovate.json`) is generated during sync.

There's a `templates/renovate/` directory referenced in the exploration, but it's not producing output.

**Recommendation:** Generate a `renovate.json` (or `.github/dependabot.yml`) from the `dependencyManagement` spec, including:

- Schedule from spec
- Automerge policy from spec
- Action SHA update rules (to fix finding 1.1)

---

### 2.3 HIGH: Generated Branch Protection Script Is Detached from Spec

**Files:** `setup-agentkit-branch-governance.sh`, `templates/github/scripts/setup-branch-protection.sh`

There are **two** branch protection scripts:

1. `scripts/setup-agentkit-branch-governance.sh` — hand-authored, comprehensive
2. `.github/scripts/setup-branch-protection.sh` — generated from template

The generated version may drift from the hand-authored version. Required status checks are hardcoded in both rather than derived from `project.yaml` automation settings.

**Recommendation:**

- Derive required status checks from the generated workflow names
- Single-source the protection rules in `project.yaml` or `settings.yaml`
- Generate the script from spec, including check names that match the generated workflow job names

---

### 2.4 MEDIUM: No Docker/Container Generation

**File:** `project.yaml` (line 78: `containerized: false`)

When `containerized: true`, the system should generate:

- A `Dockerfile` following multi-stage build best practices
- A `.dockerignore` aligned with `.gitignore`
- Docker Compose for local development
- Container scanning in CI (e.g., Trivy)

Currently none of this is generated even when the flag changes.

---

### 2.5 MEDIUM: No IaC CI Generation

**File:** `project.yaml` (lines 79-89)

When `iacTool` is set (terraform, bicep, etc.), the system should generate:

- `terraform fmt/validate` CI checks
- `terraform plan` on PR (with plan output as PR comment)
- State drift detection workflows
- Module versioning validation

The `infra` agent and `team-infra` team define these responsibilities, but there's no CI template to back them up.

---

### 2.6 MEDIUM: No Release/Deploy Workflow Generation

**File:** `commands.yaml` — `deploy` command (lines 516-543)

The `deploy` command and `release-manager` agent exist in spec, but no release workflow template is generated. Downstream repos get no:

- Automated versioning (semantic-release)
- Changelog generation from conventional commits
- GitHub Release creation
- Environment-gated deployments

**Recommendation:** Add a `release.yml` workflow template that uses the `deployment.environments` spec.

---

### 2.7 LOW: Documentation Workflow Templates Hardcode `docs/history/**`

**Files:** `templates/github/workflows/documentation-quality.yml`, `documentation-validation.yml`

The generated documentation workflows hardcode the path `docs/history/**`. If a downstream repo uses a different documentation path (configurable in `project.yaml` via `documentation.adrPath`, etc.), the workflows won't trigger.

**Recommendation:** Template the path from `project.yaml` documentation settings.

---

### 2.8 LOW: No MCP Server Health Check in CI

**File:** `.mcp/servers.json`

MCP servers (git, puppeteer, memory, fetch) are configured but never validated in CI. A broken server config would only fail at runtime.

**Recommendation:** Add a validation step that checks MCP server configs are valid JSON and reference available servers.

---

## 3. Agent Workforce Alignment Issues

### 3.1 CRITICAL: CI Doesn't Reflect the Team Handoff Model

**Files:** `teams.yaml`, `ci.yml`

The workforce defines explicit handoff chains:

- `infra → devops → security`
- `backend → testing → quality`
- `data → backend → testing`
- `frontend → testing → docs`

But CI is a flat set of independent jobs. There's no pipeline structure that mirrors the team dependency graph. For example:

- `infra` changes should trigger IaC validation → DevOps pipeline checks → security scan
- `backend` changes should trigger API tests → integration tests → quality review

**Recommendation:** Generate CI jobs that mirror the handoff chains. Use path-based triggers so that changes in `infra/**` flow through the infra → devops → security pipeline, changes in `apps/api/**` flow through backend → testing → quality, etc.

---

### 3.2 HIGH: 24 Agents but Only 2 Semgrep Rules

**Files:** `agents.yaml` (24 agents), `.semgrep/semgrep.yml` (2 rules)

The `security-auditor` agent has extensive responsibilities (OWASP, secret scanning, IAM auditing, encryption validation) but the Semgrep config only checks for `eval()` and `child_process.exec()`.

**Recommendation:** Expand Semgrep rules to cover:

- SQL injection patterns
- Path traversal
- Unsafe deserialization
- Hardcoded credentials (beyond the regex patterns in branch-protection)
- Missing authentication checks
- Consider using `semgrep --config=auto` or `p/owasp-top-ten` rulesets

---

### 3.3 HIGH: `devops` Agent Responsibilities Not Fully Backed by CI

**File:** `agents.yaml` — devops agent (lines 173-209)

The devops agent claims responsibility for:

- "Optimize build times and caching strategies" — no build time tracking
- "Configure monitoring, alerting, and observability" — no observability in CI
- "Manage environment variables and secrets in CI/CD" — no secret rotation checks

**Recommendation:** Add CI steps that validate what the devops agent is responsible for:

- Build time tracking (store timestamps, compare against budget)
- Workflow execution time alerts
- Secret environment variable audit (ensure no plain-text secrets in workflow files)

---

### 3.4 MEDIUM: A2A Config Doesn't Match Agent Capabilities

**File:** `.mcp/a2a-config.json`

The A2A config gives all team agents the same capabilities: `["implement", "test", "review"]`. But `agents.yaml` and `teams.yaml` define different `accepts` per team:

- `security` team only accepts `[review, investigate]` — but A2A says it can `implement`
- `product` team only accepts `[plan, review]` — but A2A says it can `implement` and `test`
- `docs` team accepts `[implement, review, document]` — but A2A says `test` instead of `document`

**Recommendation:** Generate `a2a-config.json` from `teams.yaml` `accepts` fields during sync, so capabilities stay in sync.

---

### 3.5 MEDIUM: No CI Validation of Agent Focus Path Coverage

**Files:** `agents.yaml`, `teams.yaml`

Agents declare `focus` paths (e.g., `apps/api/**`, `services/**`) and teams declare `scope` paths. Nothing validates that:

- Agent focus paths actually exist in the repo
- Team scopes don't overlap in conflicting ways
- Focus paths cover the entire codebase (no orphan files)

**Recommendation:** Add a validation step to `agentkit validate` that checks focus path coverage and reports gaps or overlaps. Include this in CI.

---

### 3.6 LOW: `test-lead` Agent Has No CI Gate Definition

**File:** `agents.yaml` — test-lead (lines 605-642)

The test-lead agent is responsible for "Define quality gates for CI/CD pipelines" but there's no structured quality gate definition in any spec file. Quality gates are implicitly defined by which CI jobs are required status checks.

**Recommendation:** Add a `qualityGates` section to `project.yaml` or a dedicated `quality-gates.yaml` spec that the test-lead agent can maintain and that CI workflows are generated from.

---

## 4. Security & Supply Chain

### 4.1 HIGH: Secret Pattern Detection Is Incomplete

**File:** `branch-protection.yml` (lines 120-140)

The secret detection regex patterns only check for:

- AWS Access Keys (`AKIA...`)
- Private keys (`-----BEGIN...`)
- GitHub tokens (`ghp_...`)
- OpenAI keys (`sk-...`)

Missing patterns:

- Azure connection strings / SAS tokens
- Google Cloud service account keys
- Slack tokens (`xoxb-`, `xoxp-`)
- Database connection strings with passwords
- JWT secrets
- Generic high-entropy strings

**Recommendation:** Use a dedicated secret scanner (e.g., `truffleHog`, `gitleaks`, `detect-secrets`) instead of hand-rolled regex. Integrate as a CI step.

---

### 4.2 HIGH: No SBOM Generation

The `security-auditor` and `dependency-watcher` agents exist but no Software Bill of Materials is generated in CI. SBOMs are increasingly required for supply chain compliance.

**Recommendation:** Add SBOM generation via `syft` or `cyclonedx-npm` and upload as a release artifact.

---

### 4.3 MEDIUM: Semgrep Runs as Advisory Only

**File:** `semgrep.yml` (line 33: `continue-on-error: true`)

Semgrep is configured with `continue-on-error: true`, meaning security findings never block a merge. Combined with the limited ruleset (finding 3.2), the security scanning is essentially decorative.

**Recommendation:** Once the ruleset is expanded:

1. Keep advisory mode during the expansion period
2. Move to blocking (`continue-on-error: false`) for `ERROR` severity rules
3. Keep `continue-on-error: true` for `WARNING` rules

---

### 4.4 MEDIUM: No Workflow Permission Scoping in Most Workflows

**Files:** `ci.yml`, `semgrep.yml`

Only `codeql.yml` and `template-protection.yml` declare explicit `permissions`. Other workflows inherit the default token permissions, which may be broader than needed.

**Recommendation:** Add minimal `permissions` blocks to every workflow:

```yaml
permissions:
  contents: read
```

And expand only as needed per job.

---

## Summary: Priority Roadmap

### Wave 1 — Quick Wins (1-2 days)

| #   | Finding                                   | Effort  |
| --- | ----------------------------------------- | ------- |
| 1.1 | Pin all actions to SHA                    | Low     |
| 1.4 | Add `dev` to Semgrep triggers             | Trivial |
| 1.5 | Add `dev` to CodeQL triggers              | Trivial |
| 1.8 | Add `timeout-minutes` to all jobs         | Low     |
| 4.4 | Add `permissions` blocks to all workflows | Low     |
| 3.4 | Generate A2A config from `teams.yaml`     | Low     |

### Wave 2 — CI Hardening (3-5 days)

| #   | Finding                                        | Effort |
| --- | ---------------------------------------------- | ------ |
| 1.2 | Composite action for setup                     | Medium |
| 1.3 | Coverage reporting + enforcement               | Medium |
| 1.6 | Dependency audit step                          | Low    |
| 3.2 | Expand Semgrep rules                           | Medium |
| 4.1 | Replace regex secret detection with `gitleaks` | Medium |
| 4.3 | Graduate Semgrep to blocking for ERROR rules   | Low    |

### Wave 3 — Generation Pipeline (5-10 days)

| #   | Finding                                   | Effort |
| --- | ----------------------------------------- | ------ |
| 2.1 | Stack-aware CI generation for downstream  | High   |
| 2.2 | Renovate config generation                | Medium |
| 2.3 | Unify branch protection scripts from spec | Medium |
| 2.5 | IaC CI generation                         | Medium |
| 2.6 | Release workflow generation               | Medium |
| 3.1 | Team-handoff-aware CI structure           | High   |

### Wave 4 — Advanced Alignment (5-10 days)

| #   | Finding                              | Effort |
| --- | ------------------------------------ | ------ |
| 2.4 | Container generation                 | Medium |
| 3.3 | DevOps agent CI backing              | Medium |
| 3.5 | Agent focus path coverage validation | Medium |
| 3.6 | Structured quality gates spec        | Medium |
| 4.2 | SBOM generation                      | Low    |

---

## Appendix: File Inventory

### Hand-Authored Workflows

| File                                           | Purpose                                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| `.github/workflows/ci.yml`                     | Main CI: test, validate, yaml-lint, markdown-lint    |
| `.github/workflows/branch-protection.yml`      | PR rules: conventional commits, secrets, issue links |
| `.github/workflows/template-protection.yml`    | Forge source change gates                            |
| `.github/workflows/block-agentkit-changes.yml` | Block `.agentkit/` changes in non-forge repos        |
| `.github/workflows/codeql.yml`                 | CodeQL SAST scanning                                 |
| `.github/workflows/semgrep.yml`                | Semgrep advisory scanning                            |

### Generated Workflows

| File                                             | Source Template                                           |
| ------------------------------------------------ | --------------------------------------------------------- |
| `.github/workflows/documentation-quality.yml`    | `templates/github/workflows/documentation-quality.yml`    |
| `.github/workflows/documentation-validation.yml` | `templates/github/workflows/documentation-validation.yml` |

### Generation Templates

| File                                                  | Generates                                    |
| ----------------------------------------------------- | -------------------------------------------- |
| `templates/github/ai-framework-ci.yml`                | Framework validation CI for downstream repos |
| `templates/github/scripts/setup-branch-protection.sh` | Branch protection setup                      |
| `templates/github/PULL_REQUEST_TEMPLATE.md`           | PR template                                  |
| `templates/github/ISSUE_TEMPLATE/bug_report.md`       | Issue template                               |

### Governance Scripts

| File                                          | Purpose                      |
| --------------------------------------------- | ---------------------------- |
| `scripts/setup-agentkit-branch-governance.sh` | Full branch governance setup |
| `scripts/validate-documentation.sh`           | History doc validation       |
| `scripts/check-documentation-requirement.sh`  | PR doc requirement check     |
| `scripts/validate-numbering.sh`               | Sequential numbering check   |
