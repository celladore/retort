# Model Guide: QUALITY Team (PRD-003)

## Team Profile

| Attribute     | Value                                       |
| ------------- | ------------------------------------------- |
| Focus         | Code review, refactoring, bugs, reliability |
| Scope         | `**/*`                                      |
| Handoff Chain | (none)                                      |

## Weighting Profile

| Metric        | Weight | Rationale                            |
| ------------- | ------ | ------------------------------------ |
| Code Quality  | 30%    | Primary driver for review outcomes   |
| Reasoning     | 25%    | Root-cause and refactoring decisions |
| Cost          | 10%    | Budget awareness remains required    |
| Context       | 15%    | Cross-file understanding             |
| Speed         | 10%    | Review turnaround needs consistency  |
| Compatibility | 10%    | Mixed-language and tool support      |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Base formula:

`Weighted Score = (Code*30 + Reasoning*25 + Cost*10 + Context*15 + Speed*10 + Compatibility*10) / 100`

- Optional policy penalties:
  - `lock_in_penalty`: `0.00-0.20`
  - `quirks_penalty`: `0.00-0.15`
- Final score:

`Final Score = max(0, Weighted Score - lock_in_penalty - quirks_penalty)`

## Cost Evidence Method

- Cost scores use evidence from `cost multiplier` and `tokens/problem` when both
  inputs are available.
- **Definitions:** `model_effective_cost` = cost_multiplier × normalized_tokens_per_problem; `baseline_effective_cost` = baseline_cost_multiplier × baseline_normalized_tokens_per_problem (baseline_normalized_tokens_per_problem = 1 for the baseline model, so baseline_effective_cost = baseline_cost_multiplier).
- **Edge case handling (evaluate before computing normalized_tokens_per_problem):**
  - If `baseline_tokens_per_problem == 0`: if `cost_multiplier == 0`, set `cost_score = 10`; else set `cost_score = clamp(10 * (1 / cost_multiplier), 0, 10)`. Do not compute `normalized_tokens_per_problem` when baseline is zero.
  - If `model_effective_cost == 0`: cost_score = 10 (best possible).
  - If `normalized_tokens_per_problem == 0`: cost_score = 10 (best possible, zero token usage).
- Cost normalization formulas (only when `baseline_tokens_per_problem != 0`):

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

### Tier 1: Recommended (Score >= 8.60)

| Model              | Score | Key Strengths                 | Notes                         |
| ------------------ | ----- | ----------------------------- | ----------------------------- |
| Claude Opus 4.6    | 8.80  | High code quality and context | Best default for deep reviews |
| GPT-5.3 Codex High | 8.80  | Strong reasoning and analysis | Strong bug triage option      |
| SWE-Llama          | 8.60  | Code specialization           | Good for refactoring flows    |

### Tier 2: Strong Alternatives (Score 8.00-8.59)

| Model                 | Score | Key Strengths             | Notes                                    |
| --------------------- | ----- | ------------------------- | ---------------------------------------- |
| Claude Sonnet 4.6     | 8.45  | Lower-cost Claude profile | Routine review workflows                 |
| Gemini 2.5 Pro        | 8.40  | Large context support     | Good for wide monorepo audits            |
| GLM-5 (prior version) | 8.20  | Multilingual support      | Deprecated; use prior until GLM-5 (New) completes scoring. Fallback: GLM-5 (prior) remains active during interim. |

### Tier 3: Cost-Aware (Score 7.00-7.99)

| Model     | Score | Key Strengths | Notes                       |
| --------- | ----- | ------------- | --------------------------- |
| Kimi K2.5 | 7.55  | Budget option | Non-critical review batches |
| o3        | 7.45  | Low cost      | High-volume routine checks  |

### Tier 4: Experimental (Score < 7.00)

No models currently assigned. Add entries here when validated scores drop below 7.00.

## Decision Policy

- Primary default: `Claude Opus 4.6`
- Analysis alternate: `GPT-5.3 Codex High`
- Cost-aware alternate: `o3`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest compatible model.
- 7-day spend overrun above 15%: shift routine checks to cost-aware model.
- P95 latency regression above 25%: move to faster model in same score band.
- Deprecation notice: migrate during next release cycle with audit note.

## Override and Audit Example

```yaml
team_defaults:
  quality:
    default_model: claude-opus-4-6
    fallback_model: gpt-5.3-codex-high
    weights:
      code_quality: 30
      reasoning: 25
      cost: 10
      context: 15
      speed: 10
      compatibility: 10
agents:
  code-reviewer:
    team: quality
    model_override: swe-llama
    reason: "Refactor-heavy PR analysis"
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
| Owner                      | Quality + Platform leads                            |

Note: PRD-003 refers to the Product Requirements Document for the Agent-to-LLM Weighted Matrix and Config Guide. The matrix is illustrative; runtime config and scorecard data remain the source of truth.

## Newly Tracked Models (Pending Full Benchmark Scoring)

These models are now included in intake analysis but are excluded from weighted
ranking tables until benchmark metrics are validated.

| Model                        | Cost Multiplier | Status                                                                |
| ---------------------------- | --------------- | --------------------------------------------------------------------- |
| Gemini 3 Flash High          | 1.75x           | Added to intake, pending scorecard metrics                            |
| Gemini 3 Pro High Thinking   | 2x              | Added to intake, pending scorecard metrics                            |
| Gemini 3.1 Pro High Thinking | 1x              | Added to intake, pending scorecard metrics                            |
| GLM 4.7 (Beta)               | 0.25x           | Added to intake, beta reliability watch                               |
| GLM-5 (New)                  | 1.5x            | Replacement for GLM-5 (prior version); pending full benchmark scoring |

## Related Documentation

- PRD-001: LLM Decision Engine
- PRD-002: LLM Selection Scorecard Guide
- Model Family Benchmark Dossiers: `docs/08_reference/model-families/README.md`
