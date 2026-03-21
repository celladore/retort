# Strategic Operations Team (T12)

## Summary

Strategic Ops is the cross-project coordination team responsible for framework
governance, portfolio-level planning, adoption strategy, impact assessment, and
release coordination across all repos using Retort.

## Motivation

As Retort scales to manage multiple downstream repos, the need for
portfolio-level visibility and governance becomes critical. Individual teams
(backend, frontend, etc.) operate within a single repo — Strategic Ops operates
_across_ repos, ensuring consistency, managing breaking changes, and coordinating
sync waves.

## Pipeline Architecture

```
PortfolioAnalyst → GovernanceAdvisor → AdoptionStrategist
  → ImpactAssessor → ReleaseCoordinator
```

## Agents (strategic-operations category)

| Agent               | Role                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| portfolio-analyst   | Inventory downstream repos, compare spec versions, detect drift       |
| governance-advisor  | Versioning strategy, breaking change protocols, deprecation timelines |
| adoption-strategist | Onboarding workflows, migration paths, phased rollouts                |
| impact-assessor     | Blast radius analysis for template/spec/engine changes                |
| release-coordinator | Version bumps, changelog, sync waves, release communication           |

## Team Definition

```yaml
- id: strategic-ops
  name: STRATEGIC OPS
  focus: 'Cross-project coordination, framework governance, portfolio-level planning'
  scope: ['docs/planning/**', 'docs/architecture/**', '.agentkit/spec/**', '**/*']
  accepts: [plan, review, investigate, document]
  handoff-chain: [product, quality]
```

## Command

`/team-strategic-ops --task <portfolio-scan|governance-review|adoption-plan|impact-assess|release-plan> --scope <repo|portfolio|upstream>`

## Design Decisions

- **5 agents**: Pipeline follows the natural governance lifecycle — understand,
  govern, adopt, assess, release
- **Broad scope (`**/\*`)\*\*: Strategic ops can touch any file when doing
  portfolio-level analysis, but primary focus dirs are listed first
- **Handoff to product + quality**: Strategic decisions flow to product for
  prioritization and quality for validation
- **`--scope` flag**: Distinguishes between single-repo ops and portfolio-wide
  coordination

## Status

- [x] Team definition in `teams.yaml`
- [x] 5 agents in `agents.yaml` (strategic-operations category)
- [x] `/team-strategic-ops` command in `commands.yaml`
- [x] Intake routing: `strategic-ops: strategic-ops`
- [x] Sync outputs generated for all render targets
