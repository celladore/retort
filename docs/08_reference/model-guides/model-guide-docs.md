# Model Guide: DOCUMENTATION Team

## Team Profile

| Attribute     | Value                       |
| ------------- | --------------------------- |
| Focus         | Docs, ADRs, guides          |
| Scope         | `docs/**`, `*.md`, `ADR/**` |
| Handoff Chain | (none)                      |

## Weighting Profile

| Metric        | Weight | Rationale                              |
| ------------- | ------ | -------------------------------------- |
| Code Quality  | 5%     | Code quality matters for snippets only |
| Reasoning     | 20%    | Structure and argument clarity         |
| Cost          | 10%    | Standard budget sensitivity            |
| Context       | 45%    | Large document context is critical     |
| Speed         | 5%     | Turnaround is secondary                |
| Compatibility | 15%    | Multi-format output and portability    |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Base formula (short names map to Weighting Profile: Code = Code Quality / `code_quality`, Reasoning = `reasoning`, Cost = `cost`, Context = `context`, Speed = `speed`, Compatibility = `compatibility`):

`Weighted Score = (Code*5 + Reasoning*20 + Cost*10 + Context*45 + Speed*5 + Compatibility*15) / 100`

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

- Fallback policy (approved): if `tokens/problem` is missing, keep current Cost
  scores unchanged and mark cost evidence as `Not evaluated`.

## Cost Evidence Status and Recalculation

- Current status: tokens/problem evidence remains `Not evaluated` for the ranked
  set in this guide.
- Recalculation result: per approved fallback policy, Cost scores and final
  weighted scores remain unchanged in this revision.

## Model Rankings (Final Scores)

### Tier 1: Recommended (Score >= 8.40)

| Model              | Model ID           | Score | Key Strengths                | Notes                        |
| ------------------ | ------------------ | ----- | ---------------------------- | ---------------------------- |
| Claude Opus 4.6    | claude-opus-4-6    | 8.45  | High context and consistency | Best for large docs and ADRs |
| GPT-5.3 Codex High | gpt-5.3-codex-high | 8.40  | Strong reasoning             | Good for strategy-heavy docs |

### Tier 2: Strong Alternatives (Score 8.10-8.39)

| Model             | Model ID          | Score | Key Strengths             | Notes                            |
| ----------------- | ----------------- | ----- | ------------------------- | -------------------------------- |
| SWE-Llama         | swe-llama         | 8.25  | Code example quality      | Good for docs with code snippets |
| GLM-5             | glm-5             | 8.15  | Multilingual support      | Useful for localization work     |
| Gemini 2.5 Pro    | gemini-2-5-pro    | 8.15  | 1M context window         | Good for very large doc sets     |
| Claude Sonnet 4.6 | claude-sonnet-4-6 | 8.10  | Lower-cost Claude profile | Routine documentation updates    |

### Tier 3: Cost-Aware (Score 7.50-8.09)

| Model        | Model ID     | Score | Key Strengths         | Notes                         |
| ------------ | ------------ | ----- | --------------------- | ----------------------------- |
| o3           | o3           | 7.75  | Low cost              | Fast, lightweight docs edits  |
| Minimax M2.5 | minimax-m2-5 | 7.55  | Regional availability | APAC-oriented fallback option |

### Tier 4: Not Recommended (Score < 7.50)

| Model | Model ID | Score | Key Strengths | Notes |
| ----- | -------- | ----- | ------------- | ----- |
| (placeholder) | — | — | — | Models scoring below 7.50 are not recommended for production or primary documentation tasks |

### Display Name and Config ID Note

Ranking tables show both display names and runtime IDs. YAML fields
`team_defaults.default_model`, `team_defaults.fallback_model`, and
`agents.<agent>.model_override` must use **Model ID** values.

## Decision Policy

- Primary default: `Claude Opus 4.6`
- Cost-aware alternate: `o3`
- APAC alternate: `Minimax M2.5`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest compatible model.
- 7-day spend overrun above 15%: use cost-aware model for routine updates.
- P95 latency regression above 25%: prefer faster model in same tier.
- Model deprecation notice: migrate in next release cycle with audit note.

## Override and Audit Example

```yaml
team_defaults:
  docs:
    default_model: claude-opus-4-6
    fallback_model: gpt-5.3-codex-high
    cost_aware_model: o3
    # fallback_model: quality during provider outages; cost_aware_model: cost-optimization alternate
    weights:
      code_quality: 5
      reasoning: 20
      cost: 10
      context: 45
      speed: 5
      compatibility: 15
agents:
  adr-writer:
    team: docs
    model_override: gemini-2.5-pro
    reason: "Large context ADR synthesis"
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
| Owner                      | Docs + Platform leads                               |

Note: PRD-003 provides an illustrative weighted matrix example; for actual implementation, runtime config and scorecard data remain the source of truth.

## Newly Tracked Models (Pending Full Benchmark Scoring)

These models are now included in intake analysis but are excluded from weighted
ranking tables until benchmark metrics are validated.

**Cost Multiplier:** 1x = baseline model cost (reference model or average). Multipliers are relative to this baseline.

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
