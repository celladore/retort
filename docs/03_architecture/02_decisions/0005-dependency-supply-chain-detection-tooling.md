# ADR-0005: Dependency and Supply-Chain Detection — Tool Selection

## Status

Accepted

## Date

2026-02-28

## Context

This ADR evaluates dependency and supply-chain detection for package update workflows.

Decision scope:

- Vulnerability visibility and remediation flow
- Update orchestration quality (batching, scheduling, constraints)
- CI integration and governance
- Cost and lock-in

## Alternatives Considered

- A) Renovate + `pnpm audit` + lockfile review (selected)
- B) Dependabot + audit tooling
- C) Snyk (open source + dependency monitor)
- D) Manual updates + ad hoc auditing

## Tool Facet Ratings (1-5)

| Option                  | Detection Coverage | Update Automation | CI/Governance Fit | Developer Experience | Cost/Lock-in |
| ----------------------- | -----------------: | ----------------: | ----------------: | -------------------: | -----------: |
| Renovate + `pnpm audit` |                  5 |                 5 |                 5 |                    4 |            4 |
| Dependabot + audit      |                  4 |                 4 |                 5 |                    4 |            5 |
| Snyk dependency monitor |                  5 |                 3 |                 4 |                    4 |            2 |
| Manual only             |                  2 |                 1 |                 2 |                    2 |            5 |

## Weighted Decision Matrix

Scoring scale: 1 (worst) to 5 (best). Weighted score = Score × Weight.

| Criterion                        |  Weight | A: Renovate + audit | B: Dependabot + audit | C: Snyk monitor | D: Manual only |
| -------------------------------- | ------: | ------------------: | --------------------: | --------------: | -------------: |
| Vulnerability detection coverage |      30 |             5 (150) |               4 (120) |         5 (150) |         2 (60) |
| Update automation quality        |      30 |             5 (150) |               4 (120) |          3 (90) |         1 (30) |
| CI/governance fit                |      20 |             5 (100) |               5 (100) |          4 (80) |         2 (40) |
| Developer experience             |      10 |              4 (40) |                4 (40) |          4 (40) |         2 (20) |
| Cost + lock-in                   |      10 |              4 (40) |                5 (50) |          2 (20) |         5 (50) |
| **Total**                        | **100** |             **480** |               **430** |         **380** |        **200** |

## Decision

Adopt **Renovate + `pnpm audit` + lockfile review** as the default dependency/supply-chain detection strategy.

Complementary policy:

- Keep pre-install `kluster_dependency_check` for dependency file changes.

## Consequences

### Positive

- Strong automation and configurable PR policy for dependency hygiene.
- Clear, repeatable remediation flow integrated with existing CI.

### Negative

- Requires configuration tuning to avoid excessive update PR volume.

## References

- [ADR-0003: Tooling Strategy — kluster vs Alternatives](0003-tooling-strategy-kluster-alternatives.md)
