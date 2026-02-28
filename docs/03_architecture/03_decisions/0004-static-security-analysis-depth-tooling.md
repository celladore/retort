# ADR-0004: Static Security Analysis Depth — Tool Selection

## Status

Accepted

## Date

2026-02-28

## Context

This ADR evaluates alternatives for static security analysis depth in this repository.

Decision scope:

- Depth and quality of security findings (code/data-flow, framework awareness)
- CI integration and actionability
- False-positive profile and developer ergonomics
- Cost and lock-in

## Alternatives Considered

- A) GitHub CodeQL (default)
- B) Semgrep only
- C) SonarQube Cloud security-focused profile
- D) Snyk Code
- E) Hybrid: CodeQL + optional Semgrep (selected)

## Tool Facet Ratings (1-5)

| Tool                      | Detection Depth | Precision | CI Fit | Developer Experience | Cost/Lock-in |
| ------------------------- | --------------: | --------: | -----: | -------------------: | -----------: |
| CodeQL                    |               5 |         4 |      5 |                    3 |            3 |
| Semgrep                   |               4 |         3 |      5 |                    4 |            5 |
| SonarQube Cloud           |               3 |         3 |      4 |                    3 |            2 |
| Snyk Code                 |               4 |         4 |      4 |                    4 |            2 |
| CodeQL + optional Semgrep |               5 |         4 |      5 |                    4 |            4 |

## Weighted Decision Matrix

Scoring scale: 1 (worst) to 5 (best). Weighted score = Score × Weight.

| Criterion                  |  Weight | A: CodeQL | B: Semgrep | C: SonarQube | D: Snyk Code | E: CodeQL + optional Semgrep |
| -------------------------- | ------: | --------: | ---------: | -----------: | -----------: | ---------------------------: |
| Detection depth            |      35 |   5 (175) |    4 (140) |      3 (105) |      4 (140) |                      5 (175) |
| Precision / signal quality |      20 |    4 (80) |     3 (60) |       3 (60) |       4 (80) |                       4 (80) |
| CI/automation fit          |      20 |   5 (100) |    5 (100) |       4 (80) |       4 (80) |                      5 (100) |
| Developer experience       |      15 |    3 (45) |     4 (60) |       3 (45) |       4 (60) |                       4 (60) |
| Cost + lock-in             |      10 |    3 (30) |     5 (50) |       2 (20) |       2 (20) |                       4 (40) |
| **Total**                  | **100** |   **430** |    **410** |      **310** |      **380** |                      **455** |

## Decision

Adopt **CodeQL + optional Semgrep**:

- CodeQL is the baseline, required security SAST check.
- Semgrep is optional initially and targeted to security-sensitive paths, with phased promotion of stable high-signal rules.

## Consequences

### Positive

- Strong depth from CodeQL with practical rule agility from Semgrep.
- Balanced detection coverage without forcing all Semgrep noise into required checks immediately.

### Negative

- Two tools require rule governance to avoid duplicate or conflicting findings.

## References

- [ADR-0003: Tooling Strategy — kluster vs Alternatives](0003-tooling-strategy-kluster-alternatives.md)
