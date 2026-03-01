# Model Guide: DEVOPS Team

## Team Profile

| Attribute     | Value                                                            |
| ------------- | ---------------------------------------------------------------- |
| Focus         | CI/CD, pipelines, automation                                     |
| Scope         | `.github/workflows/**`, `scripts/**`, `docker/**`, `Dockerfile*` |
| Handoff Chain | testing, security                                                |

## Weighting Profile

Weights in the formula and YAML use whole-number units (e.g., Code 10 = 10%). The table below shows percentages for readability.

| Metric        | Weight | Rationale                                |
| ------------- | ------ | ---------------------------------------- |
| Code Quality  | 10%    | Pipeline correctness and maintainability |
| Reasoning     | 20%    | Deployment and failure trade-offs        |
| Cost          | 30%    | Cloud and runtime spend is critical      |
| Context       | 10%    | Config surfaces are moderate             |
| Speed         | 20%    | Fast feedback and deployment loops       |
| Compatibility | 10%    | Toolchain and platform portability       |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Base formula:

`Weighted Score = (Code*10 + Reasoning*20 + Cost*30 + Context*10 + Speed*20 + Compatibility*10) / 100`

- Optional policy penalties:
  - `lock_in_penalty`: `0.00-0.20`
  - `quirks_penalty`: `0.00-0.15`
- Final score:

`Final Score = max(0, Weighted Score - lock_in_penalty - quirks_penalty)`

## Cost Evidence Method

- Cost scores use evidence from `cost multiplier` and `tokens/problem` when both
  inputs are available.
- **Baseline definition:** Baseline model and configuration (e.g., GPT-4 or config-specified reference). `baseline_tokens_per_problem` and `baseline_effective_cost` are computed or configured; see scorecard or config. Baseline may be fixed or updated over time (update cadence and recording location documented in scorecard).
- Cost normalization formulas:

`effective_cost = cost_multiplier * normalized_tokens_per_problem`

`normalized_tokens_per_problem = model_tokens_per_problem / baseline_tokens_per_problem`

`cost_score = min(10, 10 * baseline_effective_cost / model_effective_cost)`

- **Division-by-zero guard:** If `model_effective_cost <= 0`, treat as zero/free cost and set `cost_score = 10` before computing the ratio.
- Fallback policy (approved): if `tokens/problem` is missing, keep current Cost
  scores unchanged and mark cost evidence as `Not evaluated`.

## Cost Evidence Status and Recalculation

- Current status: tokens/problem evidence remains `Not evaluated` for the ranked
  set in this guide.
- Recalculation result: per approved fallback policy, Cost scores and final
  weighted scores remain unchanged in this revision.

## Model Rankings (Final Scores)

### Tier 1: Recommended (Score >= 8.40)

| Model           | Score | Key Strengths                | Notes                      |
| --------------- | ----- | ---------------------------- | -------------------------- |
| Claude Opus 4.6 | 8.50  | Strong reasoning and quality | Best for complex pipelines |

### Tier 2: Strong Alternatives (Score >= 8.10 and < 8.40)

| Model             | Score | Key Strengths             | Notes                        |
| ----------------- | ----- | ------------------------- | ---------------------------- |
| Gemini 2.5 Pro    | 8.15  | Broad context and speed   | Good for large config repos  |
| Claude Sonnet 4.6 | 8.10  | Lower-cost Claude profile | Strong routine CI/CD work    |
| GLM-5             | 8.10  | Multilingual support      | Regional and mixed-stack use |
| Kimi K2.5         | 8.10  | Budget-friendly           | Good non-critical automation |

### Tier 3: Cost-Aware (Score >= 8.00 and < 8.10)

| Model      | Score | Key Strengths              | Notes                        |
| ---------- | ----- | -------------------------- | ---------------------------- |
| o3         | 8.05  | Low cost and stable output | Good default budget fallback |
| xAI Grok-3 | 8.05  | Fast iteration             | Use with guardrails          |

## Decision Policy

- Primary default: `Claude Opus 4.6`
- Cost-aware alternate: `o3`
- Regional alternate: `GLM-5`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest compatible model.
- 7-day spend overrun above 15%: shift routine CI jobs to cost-aware model.
- P95 latency regression above 25%: prefer faster model in same score band.
- Deprecation notice: migrate during next release window with audit note.

## Override and Audit Example

Config fields use hyphenated lowercase model IDs; UI/ranking tables display human-readable names. Example mappings: `claude-opus-4-6` → "Claude Opus 4.6", `gemini-2-5-pro` → "Gemini 2.5 Pro". Use the hyphenated form in `team_defaults` and `agents.model_override`.

```yaml
team_defaults:
  devops:
    default_model: claude-opus-4-6
    fallback_model: o3
    weights:
      code_quality: 10
      reasoning: 20
      cost: 30
      context: 10
      speed: 20
      compatibility: 10
agents:
  ci-failure-triage:
    team: devops
    model_override: gemini-2-5-pro
    reason: "Need faster iterative diagnostics"
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
| Owner                      | DevOps + Platform leads                             |

Note: PRD-003 remains an illustrative matrix. Runtime config and scorecard
data are the source of truth.

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
