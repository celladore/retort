# Model Guide: SECURITY Team

## Team Profile

| Attribute     | Value                                        |
| ------------- | -------------------------------------------- |
| Focus         | Auth, compliance, audit                      |
| Scope         | `auth/**`, `security/**`, `middleware/auth*` |
| Handoff Chain | (none)                                       |

## Weighting Profile

| Metric        | Weight | Rationale                               |
| ------------- | ------ | --------------------------------------- |
| Code Quality  | 20%    | Security code correctness is critical   |
| Reasoning     | 30%    | Threat modeling and abuse-path analysis |
| Cost          | 10%    | Cost matters, but risk dominates        |
| Context       | 10%    | Moderate context requirements           |
| Speed         | 10%    | Throughput is secondary to trust        |
| Compatibility | 20%    | Policy and ecosystem compatibility      |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Base formula:

`Weighted Score = (Code*20 + Reasoning*30 + Cost*10 + Context*10 + Speed*10 + Compatibility*20) / 100`

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

### Tier 1: Recommended (Score >= 9.00)

| Model              | Score | Speed    | Key Strengths                       | Notes                          |
| ------------------ | ----- | -------- | ----------------------------------- | ------------------------------ |
| GPT-5.3 Codex High | 9.15  | Fast     | Top reasoning and security analysis | Best default for audits        |
| Claude Opus 4.6    | 9.10  | Standard | Strong security reasoning           | Strong auth and policy reviews |

### Tier 2: Strong Alternatives (Score 8.30-8.99)

| Model             | Score | Speed    | Key Strengths                | Notes                             |
| ----------------- | ----- | -------- | ---------------------------- | --------------------------------- |
| SWE-Llama         | 8.60  | Standard | Code specialization          | Useful for secure refactoring     |
| Gemini 2.5 Pro    | 8.55  | Standard | Strong reasoning and context | Good for large security codebases |
| Claude Sonnet 4.6 | 8.45  | Standard | Lower-cost Claude profile    | Routine policy checks             |
| GLM-5             | 8.30  | Fast     | Multilingual support         | Regional or mixed-stack usage     |

### Tier 3: Cost-Aware (Score 7.00-7.99)

| Model     | Score | Speed    | Key Strengths | Notes                         |
| --------- | ----- | -------- | ------------- | ----------------------------- |
| Kimi K2.5 | 7.60  | Standard | Budget option | Non-critical validation tasks |
| o3        | 7.45  | Fast     | Low cost      | High-volume routine checks    |

## Decision Policy

- Primary default: `GPT-5.3 Codex High`
- Security-depth alternate: `Claude Opus 4.6`
- Cost-aware alternate: `o3`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest compatible model.
- 7-day spend overrun above 15%: route low-risk checks to cost-aware model.
- P95 latency regression above 25%: switch to the model with lower P95/higher
  throughput from the **Speed** column within the same score band.
- Deprecation notice: migrate in next release cycle with audit note.

## Override and Audit Example

> **Note:** Table display names (e.g., "GPT-5.3 Codex High", "Claude Opus 4.6") map to kebab-case config IDs: `gpt-5.3-codex-high`, `claude-opus-4-6`.

```yaml
team_defaults:
  security:
    default_model: gpt-5.3-codex-high
    fallback_model: claude-opus-4-6
    weights:
      code_quality: 20
      reasoning: 30
      cost: 10
      context: 10
      speed: 10
      compatibility: 20
agents:
  threat-modeler:
    team: security
    model_override: claude-opus-4-6
    reason: "Deeper reasoning for threat analysis"
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
| Owner                      | Security + Platform leads                           |

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
