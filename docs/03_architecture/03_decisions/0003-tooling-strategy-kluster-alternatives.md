# ADR-0003: Tooling Strategy — kluster vs Alternatives

## Status

Accepted

## Date

2026-02-28

## Context

The team wants to reduce mandatory workflow friction from kluster while preserving strong quality and security coverage.

Current needs span multiple facets:

1. Code quality and maintainability feedback
2. Security/static analysis feedback
3. Dependency and supply-chain safety checks
4. CI predictability and developer ergonomics
5. Cost and vendor lock-in risk

The desired operating mode is:

- kluster should not run in normal coding flow
- keep dependency safety checks before installs/changes
- retain strong CI quality gates

## Decision

Adopt a **hybrid toolchain** with:

- **Primary default stack (always-on via CI/local checks)**
  - ESLint + Prettier
  - Vitest (or project test suites)
  - Type checking
  - GitHub-native scanning (CodeQL) + Renovate for dependency lifecycle management
- **Targeted optional scanning**
  - Semgrep (security-focused rules) on PR/CI where useful
- **kluster usage policy**
  - Keep `kluster_code_review_manual` only when explicitly requested
  - Keep `kluster_dependency_check` only for dependency file changes before installation
  - Do not run kluster by default for routine edits

## Facets and Evaluation Criteria

We evaluate tools across these facets:

1. Static security analysis depth
2. Dependency and supply-chain detection
3. Code quality and maintainability signal
4. CI integration and automation fit
5. Developer experience and noise level
6. Cost and lock-in profile

## Alternatives Considered

### A) kluster-first everywhere

Run kluster on all changes and keep manual/dependency checks.

### B) Hybrid (selected)

Use standard CI/lint/test/security stack by default, keep kluster manual + dependency-only.

### C) No kluster

Rely entirely on OSS + GitHub-native tooling.

### D) Commercial suite replacement (e.g., SonarQube Cloud/Codacy/Snyk-heavy)

Replace most checks with a consolidated commercial platform.

## Tool Facet Support Matrix

Legend: ✅ strong native support, ◐ partial/depends on configuration, ❌ not primary.

| Tool               | Security SAST | Dependency Risk | Code Quality | CI/PR Integration | Local DX | Cost/Lock-in |
| ------------------ | ------------- | --------------- | ------------ | ----------------- | -------- | ------------ |
| kluster            | ◐             | ✅               | ✅            | ◐                 | ◐        | ◐            |
| GitHub CodeQL      | ✅             | ❌               | ◐            | ✅                 | ◐        | ◐            |
| Renovate           | ❌             | ✅               | ❌            | ✅                 | ✅        | ✅            |
| Semgrep (optional) | ✅             | ◐               | ◐            | ✅                 | ✅        | ✅            |
| SonarQube Cloud    | ◐             | ◐               | ✅            | ✅                 | ◐        | ◐            |
| Codacy             | ◐             | ◐               | ✅            | ✅                 | ✅        | ◐            |
| Snyk               | ✅             | ✅               | ◐            | ✅                 | ✅        | ◐            |

## Tool Ratings (1-5)

| Tool               | Security | Dependency | Quality | CI Fit |   DX | Cost/Lock-in |
| ------------------ | -------: | ---------: | ------: | -----: | ---: | -----------: |
| kluster            |        3 |          5 |       4 |      3 |    3 |            3 |
| GitHub CodeQL      |        5 |          1 |       3 |      5 |    3 |            3 |
| Renovate           |        1 |          5 |       1 |      5 |    4 |            5 |
| Semgrep (optional) |        4 |          2 |       3 |      5 |    4 |            5 |
| SonarQube Cloud    |        3 |          3 |       5 |      4 |    3 |            2 |
| Codacy             |        3 |          3 |       5 |      4 |    4 |            2 |
| Snyk               |        5 |          5 |       3 |      4 |    4 |            2 |

## Weighted Decision Matrix — Engineering Workflow

Scoring scale: 1 (worst) to 5 (best). Weighted score = Score × Weight.

| Criterion                                    |  Weight | A: kluster-first | B: Hybrid (selected) | C: No kluster | D: Commercial suite |
| -------------------------------------------- | ------: | ---------------: | -------------------: | ------------: | ------------------: |
| Coverage breadth (quality + security + deps) |      25 |          4 (100) |              5 (125) |        3 (75) |             5 (125) |
| Developer velocity / low friction            |      20 |           2 (40) |              5 (100) |       5 (100) |              3 (60) |
| CI predictability / reproducibility          |      15 |           3 (45) |               5 (75) |        4 (60) |              4 (60) |
| Cost efficiency                              |      10 |           3 (30) |               4 (40) |        5 (50) |              2 (20) |
| Lock-in risk (higher is lower lock-in)       |      10 |           2 (20) |               4 (40) |        5 (50) |              2 (20) |
| Operational simplicity                       |      10 |           3 (30) |               4 (40) |        4 (40) |              3 (30) |
| Custom policy flexibility                    |      10 |           4 (40) |               5 (50) |        4 (40) |              3 (30) |
| **Total**                                    | **100** |          **305** |              **470** |       **415** |             **345** |

## Weighted Decision Matrix — Tooling Bundle Choice

Scoring scale: 1 (worst) to 5 (best). Weighted score = Score × Weight.

Candidate bundles:

- **Bundle A (kluster-heavy):** kluster manual+dependency+broader usage
- **Bundle B (selected hybrid):** CI stack + GitHub CodeQL + Renovate + optional Semgrep + minimal kluster
- **Bundle C (GitHub-native only):** CI stack + CodeQL + Renovate (no Semgrep, no kluster)
- **Bundle D (commercial-heavy):** Sonar/Codacy/Snyk centered stack

| Criterion                        |  Weight |       A | B (selected) |       C |       D |
| -------------------------------- | ------: | ------: | -----------: | ------: | ------: |
| Security detection depth         |      20 |  3 (60) |      5 (100) |  4 (80) | 5 (100) |
| Dependency protection            |      20 | 5 (100) |      5 (100) |  4 (80) | 5 (100) |
| Quality + maintainability signal |      15 |  4 (60) |       4 (60) |  3 (45) |  5 (75) |
| CI/automation compatibility      |      15 |  3 (45) |       5 (75) |  5 (75) |  4 (60) |
| Developer velocity / low noise   |      15 |  2 (30) |       4 (60) |  5 (75) |  3 (45) |
| Cost + lock-in posture           |      15 |  3 (45) |       4 (60) |  5 (75) |  2 (30) |
| **Total**                        | **100** | **340** |      **455** | **430** | **410** |

## Facet-by-Facet Mapping (kluster vs Alternatives)

| kluster facet                 | Primary alternative(s)                                    | Recommendation                                                                             |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Manual code review signal     | PR reviews + focused Semgrep + CodeQL                     | Use alternatives by default; invoke `kluster_code_review_manual` only on explicit request  |
| Dependency safety check       | Renovate + `pnpm audit`/ecosystem audit + lockfile review | Keep `kluster_dependency_check` pre-install as an extra guardrail                          |
| Security issue surfacing      | CodeQL + optional Semgrep                                 | Prefer CI-native scanners for routine coverage; enable Semgrep for higher-risk repos/paths |
| Workflow policy orchestration | Repo instruction files + CI required checks               | Keep policy in repo docs; minimize extra mandatory steps                                   |

## Why This Decision

- Preserves strong coverage while removing daily workflow overhead.
- Aligns with team preference to keep kluster out of normal flow.
- Keeps one high-value kluster use case (`kluster_dependency_check`) where timing matters most.
- Maintains flexibility to call manual kluster review for high-risk changes.

## Consequences

### Positive

- Faster normal development loop.
- Better developer experience with fewer mandatory external checks.
- Security and dependency posture remains strong with layered controls.

### Negative

- Less frequent kluster feedback may miss issues uniquely detected by kluster in routine changes.
- Requires discipline to invoke manual kluster review for sensitive changes.

### Neutral

- Existing CI quality gates remain the primary source of truth.

## Guardrails and Rollback Triggers

If any of the following occur for two consecutive sprints, revisit this ADR:

- Increase in escaped security defects tied to static/dependency analysis gaps
- Increase in dependency-related incidents not caught by current checks
- Significant PR quality regressions attributable to reduced review signal

Potential rollback options:

1. Expand Semgrep rule coverage
2. Reintroduce mandatory kluster for selected paths (security-critical only)
3. Restore broader kluster usage policy

## Implementation Notes

- Update kluster instruction policy to manual-only + dependency-only.
- Keep dependency-check enforcement before package installation.
- Keep CI required checks for lint, tests, and security scanning.
- Add **optional Semgrep** profile:
  - Run on PR for changed files in security-sensitive paths first.
  - Start with a low-noise baseline ruleset and tighten over time.
  - Treat findings as advisory initially, then promote key rules to required once stable.

## Adoption Plan (30/60/90 Days)

### Day 0-30

- Finalize minimal kluster policy (manual + dependency-only) and communicate workflow expectations.
- Keep required CI checks: lint, typecheck, tests, CodeQL, Renovate update workflow.
- Introduce optional Semgrep in advisory mode on PRs for security-sensitive paths.
- Baseline key metrics (current PR cycle time, false-positive rate, escaped defect count).

### Day 31-60

- Tune Semgrep rules to reduce noise (suppress low-value patterns, keep high-signal findings).
- Add dependency-check runbook guidance for package update workflows.
- Review top recurring findings from CodeQL/Semgrep and codify fixes into team guidance.
- Decide whether selected Semgrep rules should move from advisory to required for protected branches.

### Day 61-90

- Promote proven Semgrep rules to required checks (only if false-positive rate is acceptable).
- Recalculate weighted matrix scores using observed operational data.
- Review guardrails and rollback triggers; adjust if incident trend diverges from target.
- Confirm whether kluster usage remains minimal or needs targeted expansion for specific repositories.

## Success Metrics

### Security and Quality

- Escaped security defects per sprint (target: non-increasing trend).
- Dependency incidents linked to vulnerable packages (target: zero critical incidents).
- Mean time to remediation for high-severity findings (target: improving trend).

### Developer Experience

- PR cycle time (target: no regression vs baseline).
- False-positive rate for automated scanners (target: <15% for required checks).
- Re-run rate caused by flaky or noisy checks (target: decreasing trend).

### Governance

- Coverage of required checks on protected branches (target: 100%).
- % dependency changes gated by pre-install dependency validation (target: 100%).
- Manual kluster review usage only on explicit request or high-risk changes (target: policy conformance).

## References

- [ADR-0001: Adopt AgentKit Forge](0001-adopt-agentkit-forge.md)
- [Architecture Overview](../01_overview.md)
