# Model Guide: TESTING Team

## Team Profile

| Attribute     | Value                                                               |
| ------------- | ------------------------------------------------------------------- |
| Focus         | Unit, E2E, integration tests                                        |
| Scope         | `**/*.test.*`, `**/*.spec.*`, `tests/**`, `e2e/**`, `playwright/**` |
| Handoff Chain | quality                                                             |

## Weighting Profile

| Metric        | Weight | Rationale                          |
| ------------- | ------ | ---------------------------------- |
| Code Quality  | 25%    | Test correctness and reliability   |
| Reasoning     | 20%    | Test strategy and edge-case design |
| Cost          | 15%    | Moderate budget sensitivity        |
| Context       | 20%    | Large suites require context depth |
| Speed         | 10%    | CI runtime and iteration speed     |
| Compatibility | 10%    | Framework and stack support        |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Base formula:

`Weighted Score = (Code*25 + Reasoning*20 + Cost*15 + Context*20 + Speed*10 + Compatibility*10) / 100`

- Optional policy penalties:
  - `lock_in_penalty`: `0.00-0.20`
  - `quirks_penalty`: `0.00-0.15`
- Final score:

`Final Score = max(0, Weighted Score - lock_in_penalty - quirks_penalty)`

## Cost Evidence Method

- Cost scores use evidence from `cost multiplier` and `tokens/problem` when both
  inputs are available.
- Cost normalization formulas:

`effective_cost = cost_multiplier * normalized_tokens_per_problem`

`normalized_tokens_per_problem = model_tokens_per_problem / baseline_tokens_per_problem`

`cost_score = min(10, 10 * baseline_effective_cost / model_effective_cost)`

- **model_effective_cost == 0:** Set `cost_score = 10` (capped maximum). Do not divide by zero; use this branch before computing the ratio. Rationale: free models should score highest for cost.
- Fallback policy (approved): if `tokens/problem` is missing, keep current Cost
  scores unchanged and mark cost evidence as `Not evaluated`.

## Cost Evidence Status and Recalculation

- Current status: tokens/problem evidence remains `Not evaluated` for the ranked
  set in this guide.
- Recalculation result: per approved fallback policy, Cost scores and final
  weighted scores remain unchanged in this revision.

## Model Rankings (Final Scores)

### Tier 1: Recommended (Score >= 8.60)

| Model              | Score | Key Strengths                   | Notes                            |
| ------------------ | ----- | ------------------------------- | -------------------------------- |
| Claude Opus 4.6    | 8.80  | Strong code quality and context | Best default for test generation |
| GPT-5.3 Codex High | 8.75  | Strong coding and reasoning     | Premium option                   |
| SWE-Llama          | 8.65  | Code and test specialization    | Excellent for test-heavy work    |

### Tier 2: Strong Alternatives (Score 8.20-8.59)

| Model             | Score | Key Strengths             | Notes                     |
| ----------------- | ----- | ------------------------- | ------------------------- |
| GLM-5             | 8.35  | Multilingual support      | Useful for mixed stacks   |
| Claude Sonnet 4.6 | 8.25  | Lower-cost Claude profile | Routine testing flows     |
| Gemini 2.5 Pro    | 8.20  | Large context support     | Very large suite analysis |

### Tier 3: Cost-Aware (Score 7.00-7.99)

| Model     | Score | Key Strengths | Notes                     |
| --------- | ----- | ------------- | ------------------------- |
| Kimi K2.5 | 7.90  | Budget option | Non-critical test tasks   |
| o3        | 7.65  | Low cost      | High-volume routine tests |

## Decision Policy

- Primary default: `Claude Opus 4.6`
- Test-specialist alternate: `SWE-Llama`
- Cost-aware alternate: `o3`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest compatible model.
- 7-day spend overrun above 15%: route routine suites to cost-aware model.
- P95 latency regression above 25%: switch to faster model in same score band.
- Deprecation notice: migrate in next release cycle with audit note.

## Override and Audit Example

```yaml
team_defaults:
  testing:
    default_model: claude-opus-4-6
    fallback_model: swe-llama
    weights:
      code_quality: 25
      reasoning: 20
      cost: 15
      context: 20
      speed: 10
      compatibility: 10
agents:
  e2e-generator:
    team: testing
    model_override: gpt-5.3-codex-high
    reason: "Complex scenario expansion"
audit:
  changed_by: "<owner>"
  changed_at_utc: "2026-02-25T00:00:00Z"
  ticket: "AKF-000"
```

## Data Provenance and Refresh

| Field                      | Value                                               |
| -------------------------- | --------------------------------------------------- |
| Scorecard baseline version | 2026.02                                             |
| Last refreshed             | 2026-02-25                                          |
| Refresh SLA                | Within 24h of major model change                    |
| Data sources               | Provider docs, internal eval runs, cost multipliers |
| Confidence                 | Medium                                              |
| Owner                      | Testing + Platform leads                            |

Note: PRD-003 is an illustrative matrix. Runtime config and scorecard data
remain the source of truth.

## Newly Tracked Models (Pending Full Benchmark Scoring)

These models are now included in intake analysis but are excluded from weighted
ranking tables until benchmark metrics are validated.

| Model                        | Cost Multiplier | Status                                     |
| ---------------------------- | --------------- | ------------------------------------------ |
| Gemini 3 Flash High          | 1.75x           | Added to intake, pending scorecard metrics |
| Gemini 3 Pro High Thinking   | 2x              | Added to intake, pending scorecard metrics |
| Gemini 3.1 Pro High Thinking | 1x              | Added to intake, pending scorecard metrics |
| GLM 4.7 (Beta)               | 0.25x           | Added to intake, beta reliability watch    |

## Related Documentation

- PRD-001: LLM Decision Engine
- PRD-002: LLM Selection Scorecard Guide
- PRD-003: Weighted Matrix example
- Model Family Benchmark Dossiers: `docs/08_reference/model-families/README.md`
