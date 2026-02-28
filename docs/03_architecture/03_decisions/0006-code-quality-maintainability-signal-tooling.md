# ADR-0006: Code Quality and Maintainability Signal — Tool Selection

## Status

Accepted

## Date

2026-02-28

## Context

This ADR evaluates tooling for maintainability signal and code quality feedback.

Decision scope:

- Breadth of quality feedback and consistency
- Integration with developer workflow and CI
- False-positive/low-value noise profile
- Cost and lock-in

## Alternatives Considered

- A) ESLint + Prettier + typecheck + tests (selected baseline)
- B) SonarQube Cloud-centered quality gate
- C) Codacy-centered quality gate
- D) Hybrid: baseline + Sonar/Codacy for secondary scoring

## Tool Facet Ratings (1-5)

| Option                                     | Quality Signal Breadth | Precision | CI Fit | Developer Experience | Cost/Lock-in |
| ------------------------------------------ | ---------------------: | --------: | -----: | -------------------: | -----------: |
| Baseline (ESLint/Prettier/typecheck/tests) |                      4 |         4 |      5 |                    5 |            5 |
| SonarQube Cloud-centered                   |                      5 |         3 |      4 |                    3 |            2 |
| Codacy-centered                            |                      5 |         3 |      4 |                    4 |            2 |
| Baseline + secondary scorer                |                      5 |         4 |      4 |                    3 |            3 |

## Weighted Decision Matrix

Scoring scale: 1 (worst) to 5 (best). Weighted score = Score × Weight.

| Criterion                    |  Weight | A: Baseline | B: SonarQube | C: Codacy | D: Baseline + secondary scorer |
| ---------------------------- | ------: | ----------: | -----------: | --------: | -----------------------------: |
| Quality signal breadth       |      30 |     4 (120) |      5 (150) |   5 (150) |                        5 (150) |
| Precision / low-noise signal |      25 |     4 (100) |       3 (75) |    3 (75) |                        4 (100) |
| CI/automation fit            |      20 |     5 (100) |       4 (80) |    4 (80) |                         4 (80) |
| Developer experience         |      15 |      5 (75) |       3 (45) |    4 (60) |                         3 (45) |
| Cost + lock-in               |      10 |      5 (50) |       2 (20) |    2 (20) |                         3 (30) |
| **Total**                    | **100** |     **445** |      **370** |   **385** |                        **405** |

## Decision

Adopt **ESLint + Prettier + typecheck + tests** as the primary quality and maintainability signal.

Optional extension:

- Use SonarQube/Codacy as secondary advisory scoring only when needed by team/reporting requirements.

## Consequences

### Positive

- Fast feedback loop and low-friction local + CI experience.
- Strong maintainability baseline with minimal vendor dependency.

### Negative

- Fewer out-of-the-box managerial dashboards compared to commercial suites.

## References

- [ADR-0003: Tooling Strategy — kluster vs Alternatives](0003-tooling-strategy-kluster-alternatives.md)
