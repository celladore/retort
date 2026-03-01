# Model Guide: DATA Team

## Team Profile

| Attribute     | Value                                              |
| ------------- | -------------------------------------------------- |
| Focus         | Database, models, migrations                       |
| Scope         | `db/**`, `migrations/**`, `models/**`, `prisma/**` |
| Handoff Chain | backend, testing                                   |

## Weighting Profile

| Metric        | Weight | Rationale                          |
| ------------- | ------ | ---------------------------------- |
| Code Quality  | 15%    | Schema and migration quality       |
| Reasoning     | 30%    | Query design and model trade-offs  |
| Cost          | 10%    | Cost sensitivity is moderate       |
| Context       | 35%    | Large schema and migration context |
| Speed         | 5%     | Throughput is secondary            |
| Compatibility | 5%     | Tooling and provider fit           |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Base formula:

`Weighted Score = (Code*15 + Reasoning*30 + Cost*10 + Context*35 + Speed*5 + Compatibility*5) / 100`

- Policy modifiers (from PRD-001 inputs):
  - `lock_in_penalty`: `0.00-0.20`
  - `quirks_penalty`: `0.00-0.15`
- Final score:

`Final Score = max(0, Weighted Score - lock_in_penalty - quirks_penalty)`

## Cost Evidence Method

- Cost scores use evidence from `cost multiplier` and `tokens/problem` when both
  inputs are available.
- **Baseline definition:** `baseline_tokens_per_problem` is the average tokens per problem for the reference (baseline) model; `baseline_effective_cost` = baseline_cost_multiplier (note: normalization factor = 1 for the baseline model, since baseline_normalized_tokens_per_problem = baseline_tokens_per_problem / baseline_tokens_per_problem = 1). These values are maintained in the scorecard or config.
- Cost normalization formulas:

`effective_cost = cost_multiplier * normalized_tokens_per_problem`

`normalized_tokens_per_problem = model_tokens_per_problem / baseline_tokens_per_problem`

`cost_score = min(10, 10 * baseline_effective_cost / model_effective_cost)`

- **model_effective_cost == 0:** Treat as zero/free cost — set cost_score = 10 (capped maximum). This mapping ensures downstream scoring treats free models as highest-scoring for cost. Include this mapping in the scoring rules so downstream code applies it consistently. Any implementation (e.g., computeCostScore) must treat cost == 0 as free and return cost_score = 10.
- Fallback policy (approved): if `tokens/problem` is missing, keep current Cost
  scores unchanged and mark cost evidence as `Not evaluated`.

## Cost Evidence Status and Recalculation

- Current status: tokens/problem evidence remains `Not evaluated` for the ranked
  set in this guide.
- Recalculation result: per approved fallback policy, Cost scores and final
  weighted scores remain unchanged in this revision.

## Model Rankings (Final Scores)

### Tier 1: Recommended (Score >= 8.50)

| Model              | Model ID           | Score | Key Strengths                | Notes                    |
| ------------------ | ------------------ | ----- | ---------------------------- | ------------------------ |
| Claude Opus 4.6    | claude-opus-4-6    | 8.65  | Strong context and reasoning | Best for complex schemas |
| GPT-5.3 Codex High | gpt-5.3-codex-high | 8.60  | Strong code and reasoning    | Premium option           |

### Tier 2: Strong Alternatives (Score 8.00-8.49)

| Model             | Model ID          | Score | Key Strengths             | Notes                         |
| ----------------- | ----------------- | ----- | ------------------------- | ----------------------------- |
| SWE-Llama         | swe-llama         | 8.30  | Code specialization       | Good for migration-heavy work |
| GLM-5             | glm-5             | 8.20  | Multilingual support      | Good for mixed data sources   |
| Gemini 2.5 Pro    | gemini-2-5-pro    | 8.20  | Large context window      | Useful for wide schemas       |
| Claude Sonnet 4.6 | claude-sonnet-4-6 | 8.15  | Lower-cost Claude profile | Good for routine tasks        |

### Tier 3: Cost-Aware (Score 7.00-7.99)

| Model     | Model ID  | Score | Key Strengths | Notes                          |
| --------- | --------- | ----- | ------------- | ------------------------------ |
| o3        | o3        | 7.25  | Low cost      | Suitable for simple migrations |
| Kimi K2.5 | kimi-k2-5 | 7.25  | Budget option | Basic schema operations        |

### Display Name to Config ID Mapping

`team_defaults.*.default_model`, `fallback_model`, and
`agents.*.model_override` expect **Model ID** values (not display names).

| Display name       | Config ID            |
| ------------------ | -------------------- |
| Claude Opus 4.6    | `claude-opus-4-6`    |
| GPT-5.3 Codex High | `gpt-5.3-codex-high` |
| SWE-Llama          | `swe-llama`          |
| GLM-5              | `glm-5`              |
| Gemini 2.5 Pro     | `gemini-2-5-pro`     |
| Claude Sonnet 4.6  | `claude-sonnet-4-6`  |
| o3                 | `o3`                 |
| Kimi K2.5          | `kimi-k2-5`          |

### Penalty Inputs Used in Final Scores

Formula reminder:

`Final Score = max(0, Weighted Score - lock_in_penalty - quirks_penalty)`

| Model ID           | lock_in_penalty | quirks_penalty |
| ------------------ | --------------- | -------------- |
| claude-opus-4-6    | 0.10            | 0.05           |
| gpt-5.3-codex-high | 0.12            | 0.08           |
| swe-llama          | 0.05            | 0.05           |
| glm-5              | 0.06            | 0.04           |
| gemini-2-5-pro     | 0.07            | 0.05           |
| claude-sonnet-4-6  | 0.07            | 0.03           |
| o3                 | 0.03            | 0.02           |
| kimi-k2-5          | 0.04            | 0.03           |

## Decision Policy

- Primary default: `Claude Opus 4.6`
- Reasoning alternate: `GPT-5.3 Codex High`
- Cost-aware alternate: `o3`

Fallback triggers:

- Provider outage or repeated 5xx: route to highest compatible alternate.
- 7-day spend overrun above 15%: route non-critical jobs to cost-aware model.
- P95 latency regression above 25%: route to faster model in same tier.
- Deprecation notice: migrate during next planned release with audit note.

## Override and Audit Example

```yaml
team_defaults:
  data:
    default_model: claude-opus-4-6
    fallback_model: gpt-5.3-codex-high
    weights:
      code_quality: 15
      reasoning: 30
      cost: 10
      context: 35
      speed: 5
      compatibility: 5
agents:
  migration-planner:
    team: data
    model_override: swe-llama
    reason: "High-volume migration script generation"
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
| Owner                      | Data + Platform leads                               |

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
