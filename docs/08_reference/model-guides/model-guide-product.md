# Model Guide: PRODUCT Team

## Team Profile

| Attribute     | Value                               |
| ------------- | ----------------------------------- |
| Focus         | Features, PRDs, roadmap             |
| Scope         | `docs/01_product/**` |
| Handoff Chain | backend, frontend                   |

## Weighting Profile

| Metric        | Weight | Rationale                              |
| ------------- | ------ | -------------------------------------- |
| Code Quality  | 10%    | Matters for executable examples only   |
| Reasoning     | 30%    | Strategic and prioritization decisions |
| Cost          | 10%    | Budget awareness is still required     |
| Context       | 25%    | Cross-doc context is important         |
| Speed         | 5%     | Turnaround is secondary to quality     |
| Compatibility | 20%    | Output reuse across tools and teams    |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Base formula:

`Weighted Score = (Code*10 + Reasoning*30 + Cost*10 + Context*25 + Speed*5 + Compatibility*20) / 100`

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

- **Baseline definitions:**
  - `baseline_tokens_per_problem`: 3,500,000 (derived from median tokens/problem across Tier 1 models as of 2026-02)
  - `baseline_effective_cost`: 1.0 (normalized to cost_multiplier=1.0 at baseline_tokens_per_problem)
- Fallback policy (approved): if `tokens/problem` is missing, keep current Cost
  scores unchanged and mark cost evidence as `Not evaluated`.
- **Edge case handling:**
  - If `baseline_tokens_per_problem == 0`: if `cost_multiplier == 0`, set cost_score = 10; else use cost_multiplier alone (set to 10 * (1 / cost_multiplier), clamped to 0-10).
  - If `model_effective_cost == 0`: cost_score = 10 (best possible).
  - If `normalized_tokens_per_problem == 0`: cost_score = 10 (best possible, zero token usage).

## Cost Evidence Status and Recalculation

- Current status: tokens/problem evidence remains `Not evaluated` for the ranked
  set in this guide.
- Recalculation result: per approved fallback policy, Cost scores and final
  weighted scores remain unchanged in this revision.

## Model Rankings (Final Scores)

### Tier 1: Quality-First (Score 8.50+)

| Model              | Model ID           | Configuration | Score | Key Strengths            | Notes                                 |
| ------------------ | ------------------ | ------------- | ----- | ------------------------ | ------------------------------------- |
| GPT-5.3 Codex High | gpt-5.3-codex-high | Quality-first | 9.10  | Best coding quality      | Primary for complex PRDs/specs        |
| Claude Opus 4.6    | claude-opus-4-6    | Quality-first | 9.05  | Synthesis and reasoning  | Best for high-context documents       |
| Claude Sonnet 4.6  | claude-sonnet-4-6  | Quality-first | 8.90  | Balanced profile         | Default for most product work         |
| Gemini 2.5 Pro     | gemini-2-5-pro     | Quality-first | 8.85  | Large context, reasoning | Good for multi-file analysis          |
| SWE-Llama          | swe-llama          | Quality-first | 8.60  | Strong structured output | Useful when product docs include code |

### Tier 2: Balanced (Score 8.00-8.49)

| Model             | Model ID          | Configuration | Score | Key Strengths             | Notes                             |
| ----------------- | ----------------- | ------------- | ----- | ------------------------- | --------------------------------- |
| Claude Sonnet 4.6 | claude-sonnet-4-6 | Balanced-cost | 8.40  | Lower-cost Claude profile | Routine roadmap and PRD updates   |
| Gemini 2.5 Pro    | gemini-2-5-pro    | Balanced-cost | 8.25  | Large context window      | Useful for wide portfolio context |

### Tier 3: Cost-Aware (Score 7.00-7.99)

| Model     | Model ID  | Score | Key Strengths    | Notes                           |
| --------- | --------- | ----- | ---------------- | ------------------------------- |
| o3        | o3        | 7.45  | Low cost profile | Non-critical docs and summaries |
| Kimi K2.5 | kimi-k2-5 | 7.35  | Budget option    | Lightweight product artifacts   |

## Decision Policy

- Primary default: `GPT-5.3 Codex High`
- Reasoning alternate: `Claude Opus 4.6`
- Cost-aware alternate: `o3`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest compatible model.
- 7-day spend overrun above 15%: route low-risk docs to cost-aware model.
- P95 latency regression above 25%: use faster model in same score band.
- Deprecation notice: migrate during next release cycle with audit note.

## Override and Audit Example

```yaml
team_defaults:
  product:
    default_model: gpt-5.3-codex-high
    fallback_model: claude-opus-4-6
    weights:
      code_quality: 10
      reasoning: 30
      cost: 10
      context: 25
      speed: 5
      compatibility: 20
agents:
  prd-author:
    team: product
    model_override: claude-opus-4-6
    reason: "High-context synthesis required"
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
| Owner                      | Product + Platform leads                            |

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
