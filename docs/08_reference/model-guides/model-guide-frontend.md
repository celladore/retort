# Model Guide: FRONTEND Team

## Team Profile

| Attribute     | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Focus         | UI, components, PWA                                                  |
| Scope         | `apps/web/**`, `apps/marketing/**`, `src/client/**`, `components/**` |
| Handoff Chain | testing, docs                                                        |

## Weighting Profile

| Metric        | Weight | Rationale                              |
| ------------- | ------ | -------------------------------------- |
| Code Quality  | 15%    | Maintainable component logic           |
| Reasoning     | 15%    | UI architecture and state choices      |
| Cost          | 20%    | Frontend tasks are often high volume   |
| Context       | 15%    | Component libraries need context depth |
| Speed         | 25%    | Fast iteration is critical             |
| Compatibility | 10%    | Browser and tooling compatibility      |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Base formula:

`Weighted Score = (Code*15 + Reasoning*15 + Cost*20 + Context*15 + Speed*25 + Compatibility*10) / 100`

- Optional policy penalties:
  - `lock_in_penalty`: `0.00-0.20`
  - `quirks_penalty`: `0.00-0.15`
- Final score:

`Final Score = max(0, Weighted Score - lock_in_penalty - quirks_penalty)`

## Cost Evidence Method

- **Baseline definition:** `baseline_tokens_per_problem` and `baseline_effective_cost` come from the reference (baseline) model; `baseline_effective_cost` = baseline cost_multiplier × normalized baseline tokens. **Baseline model:** GPT-4 Turbo (or the model named in the scorecard/config). These values are maintained in the scorecard or config.
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

### Tier 1: Recommended (Score >= 8.35, inclusive)

| Model                        | Score | Key Strengths                     | Notes                              |
| ---------------------------- | ----- | --------------------------------- | ---------------------------------- |
| Gemini 2.5 Pro               | 8.45  | 1M context and strong TS handling | Best for large component libraries |
| GPT-5.3 Codex High           | 8.40  | Strong code generation            | Premium option                     |
| GPT-5.2 Medium Thinking Fast | 8.35  | Good speed and reasoning          | Balanced feature delivery          |
| GLM-5                        | 8.35  | Multilingual and fast             | Good for i18n frontends            |

### Tier 2: Strong Alternatives (Score >= 8.10 and < 8.35)

| Model             | Score | Key Strengths                      | Notes                     |
| ----------------- | ----- | ---------------------------------- | ------------------------- |
| Claude Sonnet 4.6 | 8.30  | Stable frontend output             | Reliable general option   |
| SWE-Llama         | 8.30  | Code specialization                | Good for complex UI logic |
| Minimax M2.5      | 8.20  | APAC availability and cost profile | Regional option           |
| GPT-5.1 Fast      | 8.10  | Fast iteration                     | Rapid prototyping         |

### Tier 3: Cost-Aware (Score >= 8.00 and < 8.10)

| Model                        | Score | Key Strengths               | Notes                   |
| ---------------------------- | ----- | --------------------------- | ----------------------- |
| GPT-5.1 Medium Thinking Fast | 8.05  | Speed and reasoning balance | Cost-aware feature work |
| Kimi K2.5                    | 8.05  | Budget option               | Simple UI tasks         |
| o3                           | 8.05  | Low cost and stable output  | Budget default          |

### Tier 4: Specialized or Experimental (Score < 8.00, exclusive)

| Model              | Score | Key Strengths         | Notes                                |
| ------------------ | ----- | --------------------- | ------------------------------------ |
| Claude Opus 4.6    | 7.75  | Deep reasoning        | Use for complex architecture reviews |
| xAI Grok-3         | 7.40  | Fast iteration        | Experimental usage                   |
| GPT-5.1-Codex-Mini | 7.30  | Low-cost Codex family | Boilerplate-heavy work               |

## Decision Policy

- Primary default: `Gemini 2.5 Pro`
- Fast iteration alternate: `GPT-5.2 Medium Thinking Fast`
- Cost-aware alternate: `o3`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest compatible model.
- 7-day spend overrun above 15%: move routine UI tasks to cost-aware model.
- P95 latency regression above 25%: switch to faster model in same score band.
- Deprecation notice: migrate during next release window with audit note.

## Model Identifier Mapping

| Display Name | Config ID |
| ------------ | --------- |
| Gemini 2.5 Pro | gemini-2-5-pro |
| GPT-5.2 Medium Thinking Fast | gpt-5.2-medium-thinking-fast |
| SWE-Llama | swe-llama |
| Claude Sonnet 4.6 | claude-sonnet-4-6 |
| Claude Opus 4.6 | claude-opus-4-6 |
| Minimax M2.5 | minimax-m2-5 |
| GPT-5.1 Fast | gpt-5-1-fast |
| GPT-5.1 Medium Thinking Fast | gpt-5-1-medium-thinking-fast |
| Kimi K2.5 | kimi-k2-5 |
| o3 | o3 |
| xAI Grok-3 | xai-grok-3 |
| GPT-5.1-Codex-Mini | gpt-5-1-codex-mini |
| GPT-5.3 Codex High | gpt-5-3-codex-high |
| GLM-5 | glm-5 |

YAML fields `team_defaults.frontend.default_model`, `team_defaults.frontend.fallback_model`, and `agents.<agent>.model_override` must use **Config ID** values. Models referenced by Decision Policy must have a corresponding Config ID entry; documentation-only models may be omitted.

## Override and Audit Example

```yaml
team_defaults:
  frontend:
    default_model: gemini-2-5-pro
    fallback_model: gpt-5.2-medium-thinking-fast
    weights:
      code_quality: 15
      reasoning: 15
      cost: 20
      context: 15
      speed: 25
      compatibility: 10
agents:
  component-builder:
    team: frontend
    model_override: swe-llama
    reason: "Complex component behavior and test coupling"
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
| Owner                      | Frontend + Platform leads                           |

Note: PRD-003 is an illustrative matrix. Runtime config and scorecard data
are the source of truth.

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
