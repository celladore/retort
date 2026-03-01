# Model Guide: INFRA Team

## Team Profile

| Attribute     | Value                                               |
| ------------- | --------------------------------------------------- |
| Focus         | IaC, cloud, Terraform/Bicep                         |
| Scope         | `infra/**`, `terraform/**`, `bicep/**`, `pulumi/**` |
| Handoff Chain | devops, security                                    |

## Weighting Profile

| Metric        | Weight | Rationale                              |
| ------------- | ------ | -------------------------------------- |
| Code Quality  | 10%    | IaC quality and readability            |
| Reasoning     | 20%    | Architecture and reliability decisions |
| Cost          | 25%    | Cloud spend is a primary concern       |
| Context       | 20%    | Large infra configuration context      |
| Speed         | 15%    | Provisioning and release throughput    |
| Compatibility | 10%    | Multi-cloud and toolchain fit          |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Base formula:

`Weighted Score = (Code*10 + Reasoning*20 + Cost*25 + Context*20 + Speed*15 + Compatibility*10) / 100`

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

- Fallback policy (approved by platform leads on 2026-02-26; see [AKF-INFRA-001](../../03_architecture/02_decisions/0002-fallback-policy-tokens-problem.md)): if `tokens/problem` is missing, keep current Cost scores unchanged and mark cost evidence as `Not evaluated`.

## Cost Evidence Status and Recalculation

- Current status: tokens/problem evidence remains `Not evaluated` for the ranked
  set in this guide.
- **Timeline:** Cost evidence evaluation scheduled for Q2 2026 (target: 2026-04-15).
- **Confidence indicator:** Current Cost scores marked as `Provisional — pending tokens/problem validation` until evidence is available.
- Recalculation result: per approved fallback policy, Cost scores and final
  weighted scores remain unchanged in this revision.

## Model Rankings (Final Scores)

### Tier 1: Recommended (Score >= 8.30)

| Model              | Score | Key Strengths                | Notes                         |
| ------------------ | ----- | ---------------------------- | ----------------------------- |
| Claude Opus 4.6    | 8.55  | Strong reasoning and context | Best for complex IaC programs |
| GPT-5.3 Codex High | 8.35  | Strong code generation       | Premium option                |

### Tier 2: Strong Alternatives (Score 8.10-8.29)

| Model             | Score | Key Strengths                  | Notes                        |
| ----------------- | ----- | ------------------------------ | ---------------------------- |
| Gemini 2.5 Pro    | 8.20  | Large context and cost profile | Useful for large configs     |
| SWE-Llama         | 8.20  | Code specialization            | Good for template-heavy work |
| GLM-5             | 8.15  | Multilingual support           | Good for multi-region teams  |
| Claude Sonnet 4.6 | 8.10  | Lower-cost Claude profile      | Routine infra updates        |

### Tier 3: Cost-Aware (Score 8.00-8.09)

| Model      | Score | Key Strengths              | Notes                       |
| ---------- | ----- | -------------------------- | --------------------------- |
| o3         | 8.05  | Low-cost and stable output | Cost-aware default fallback |
| Kimi K2.5  | 8.05  | Budget option              | Non-critical infra tasks    |
| xAI Grok-3 | 8.00  | Fast iteration             | Infra experimentation only  |

## Decision Policy

- Primary default: `Claude Opus 4.6`
- Cost-aware alternate: `o3`
- Large-context alternate: `Gemini 2.5 Pro`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest compatible model.
- 7-day spend overrun above 15%: route routine infra tasks to cost-aware model.
- P95 latency regression above 25%: switch to faster model in same score band.
- Deprecation notice: migrate in next release cycle with audit note.

## Override and Audit Example

```yaml
team_defaults:
  infra:
    default_model: claude-opus-4-6
    fallback_model: o3
    weights:
      code_quality: 10
      reasoning: 20
      cost: 25
      context: 20
      speed: 15
      compatibility: 10
agents:
  iac-planner:
    team: infra
    model_override: gemini-2.5-pro
    reason: "Large Terraform graph analysis"
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
| Owner                      | Infra + Platform leads                              |

Note: PRD-003 is an illustrative matrix. Runtime config and scorecard data
remain the source of truth.

## Newly Tracked Models (Pending Full Benchmark Scoring)

These models are now included in intake analysis but are excluded from weighted
ranking tables until benchmark metrics are validated.

*1x = baseline reference cost per token (e.g., Gemini 3.1 Pro High Thinking or config-specified reference).

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
