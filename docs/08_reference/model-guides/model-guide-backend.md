# Model Guide: BACKEND Team

## Team Profile

| Attribute     | Value                                                           |
| ------------- | --------------------------------------------------------------- |
| Focus         | API, services, core logic                                       |
| Scope         | `apps/api/**`, `services/**`, `src/server/**`, `controllers/**` |
| Handoff Chain | testing, docs                                                   |

## Weighting Profile

These are the operational backend weights used by the decision engine.

| Metric        | Weight | Rationale                                  |
| ------------- | ------ | ------------------------------------------ |
| code_quality  | 30%    | Backend correctness and maintainability    |
| reasoning     | 25%    | Business logic and architecture trade-offs |
| cost          | 10%    | Cost matters but is not primary            |
| context       | 25%    | Large services require broad context       |
| speed         | 5%     | Throughput is secondary to correctness     |
| compatibility | 5%     | Standard tooling and provider fit          |

## Scoring Contract

- Metric scale: `0-10` where `10` is best.
- Weight sum must equal `100`.
- Formula:

`Weighted Score = (code_quality*30 + reasoning*25 + cost*10 + context*25 + speed*5 + compatibility*5) / 100`

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

`cost_score = min(10, 10 * baseline_effective_cost / model_effective_cost)` — require `model_effective_cost > 0`; if zero or missing, mark cost_score as "unavailable" or use the same fallback policy used elsewhere for missing data.

- **Baseline definitions:**
  - `baseline_tokens_per_problem`: 3,500,000 (derived from median tokens/problem across Tier 1 models as of 2026-02)
  - `baseline_effective_cost`: 1.0 (normalized to cost_multiplier=1.0 at baseline_tokens_per_problem)
- Fallback policy (approved): if `tokens/problem` is missing, keep current Cost
  scores unchanged and mark cost evidence as `Not evaluated`.

## Cost Evidence Status and Recalculation

- Current status: tokens/problem evidence remains `Not evaluated` for the ranked
  set in this guide.
- Recalculation result: per approved fallback policy, Cost scores and final
  weighted scores remain unchanged in this revision.

## Model Rankings (Final Scores)

### Tier 1: Recommended (Score >= 9.00)

| Model                 | Score | Key Strengths                       | Notes                                  |
| --------------------- | ----- | ----------------------------------- | -------------------------------------- |
| Claude Opus 4.6       | 9.10  | Top context, strong code generation | Best default for complex backend logic |
| GPT-5.3 Codex High    | 9.10  | High code quality, strong reasoning | Premium option; monitor rate limits    |
| GPT-5.2 High Thinking | 9.05  | Deep architecture reasoning         | Good capability/cost balance           |
| GPT-5.1 High Thinking | 9.00  | Reliable code generation            | Stable alternative                     |

### Tier 2: Strong Alternatives (Score 8.00-8.99)

| Model             | Score | Key Strengths                | Notes                          |
| ----------------- | ----- | ---------------------------- | ------------------------------ |
| Claude Sonnet 4.6 | 8.95  | Lower-cost Opus profile      | Good for routine backend work  |
| SWE-Llama         | 8.35  | Code and test specialization | Strong for test-heavy services |
| Gemini 2.5 Pro    | 8.05  | 1M context support           | Useful for large monorepos     |
| GLM-5             | 8.00  | Multilingual support         | Regional fallback option       |

### Tier 3: Cost-Aware (Score 7.00-7.99)

| Model              | Score | Key Strengths              | Notes                      |
| ------------------ | ----- | -------------------------- | -------------------------- |
| Minimax M2.5       | 7.25  | Lower cost profile         | APAC-friendly option       |
| o3                 | 7.20  | Low cost and stable output | Good for simple CRUD flows |
| Kimi K2.5          | 7.15  | Budget option              | Use for non-critical tasks |
| GPT-5.1-Codex-Mini | 7.10  | Low-cost Codex family      | Boilerplate-heavy work     |

### Tier 4: Experimental (Score < 7.00)

| Model      | Score | Key Strengths  | Notes                          |
| ---------- | ----- | -------------- | ------------------------------ |
| xAI Grok-3 | 6.60  | Fast iteration | Use behind explicit guardrails |

### Unscored / Pending Evaluation

| Model        | Score | Key Strengths   | Notes                        |
| ------------ | ----- | --------------- | ---------------------------- |
| GPT-OSS 120B | N/A   | OSS portability | Pending benchmark validation |

## Decision Policy

- Primary default: `Claude Opus 4.6`
- Cost-aware alternate: `o3`
- Large-context alternate: `Gemini 2.5 Pro`

Fallback triggers:

- Provider outage or repeated 5xx: route to next highest tier model that meets
  this compatibility checklist:
  1. Same provider **or** compatible API contract and response schema.
  2. Equal or greater context window for the target workflow.
  3. Supports required tool-calling/JSON behavior for backend agents.
  4. Compatible billing/project policy constraints.
- 7-day spend exceeds budget by 15%: switch eligible tasks to cost-aware
  alternate.
- P95 latency regression above 25%: prefer a faster model in same tier.
- Model deprecation notice: migrate at next release window with audit entry.

## Override and Audit Example

```yaml
team_defaults:
  backend:
    default_model: claude-opus-4-6
    fallback_model: gpt-5.3-codex-high
    weights:
      code_quality: 30
      reasoning: 25
      cost: 10
      context: 25
      speed: 5
      compatibility: 5
agents:
  api-refactor:
    team: backend
    model_override: gpt-5.2-high-thinking
    reason: "Complex architecture redesign"
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
| Owner                      | Backend + Platform leads                            |

Note: PRD-003 contains an illustrative matrix. Runtime config and scorecard
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
