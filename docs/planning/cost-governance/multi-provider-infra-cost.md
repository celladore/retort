# Multi-Provider Infrastructure Cost Normalisation & Routing

**Team:** T13-Cost-Ops | **Priority:** P1 | **Phase:** Planning | **Status:** Todo

## Problem Statement

The cost-ops team currently references multiple AI and cloud providers but lacks:

1. A **normalised cost model** that enables apples-to-apples comparison across providers
2. A **provider registry** with pricing, capabilities, rate limits, and SLA metadata
3. **Routing rules** that select the cheapest qualifying provider per task type
4. Integration into the **cost agent** (`/cost`, `/cost-centres`) for unified spend visibility

Without this, model selection is ad-hoc, spend attribution is fragmented, and cost arbitrage opportunities are invisible.

## Scope — Providers to Address

### AI — API Providers

| Provider                               | Key Cost Dimensions                                           |
| -------------------------------------- | ------------------------------------------------------------- |
| Anthropic (Claude Opus/Sonnet/Haiku)   | Input/output tokens, prompt caching, batch API (50% discount) |
| OpenAI (GPT-4o, GPT-4o-mini, o-series) | Input/output tokens, cached context, batch API (50% discount) |
| Google (Gemini Pro, Gemini Flash)      | Input/output tokens, context caching, grounding search calls  |
| Mistral (Large, Small, Codestral)      | Input/output tokens, fine-tuning costs                        |
| Cohere (Command R+, Embed)             | Input/output tokens, search units, rerank calls               |

### AI — Self-Hosted

| Provider                            | Key Cost Dimensions                                         |
| ----------------------------------- | ----------------------------------------------------------- |
| Open-source (Llama, DeepSeek, Qwen) | GPU compute ($/hr), VRAM requirements, inference throughput |

### Cloud Providers

| Provider | Key Cost Dimensions                                            |
| -------- | -------------------------------------------------------------- |
| Azure    | VM/AKS compute, storage, networking, managed AI (Azure OpenAI) |
| AWS      | EC2/EKS, S3, Bedrock (Anthropic/Mistral), SageMaker endpoints  |
| GCP      | GKE, Cloud Storage, Vertex AI (Gemini/Claude), TPU pricing     |

## Deliverables

### Phase 1 — Discovery and Planning (this ticket)

- [ ] Design canonical provider schema (`config/pricing/provider-schema.yaml`) with fields: provider ID, model/service name, unit type (tokens/compute-hr/request), input cost, output cost, batch discount, cache discount, rate limits, SLA (uptime, p99 latency), region availability
- [ ] Draft normalised cost unit: **USD per 1M tokens** (AI) and **USD per compute-hour** (infra), with conversion factors for non-token units (search calls, rerank, embeddings)
- [ ] Map current usage patterns to provider capabilities — which commands use which models, estimated monthly volume
- [ ] Produce ADR for multi-provider cost architecture (`docs/architecture/decisions/`)

### Phase 2 — Implementation

- [ ] Create `config/pricing/` directory with per-provider YAML files:
  - `anthropic.yaml`, `openai.yaml`, `google.yaml`, `mistral.yaml`, `cohere.yaml`
  - `azure-compute.yaml`, `aws-compute.yaml`, `gcp-compute.yaml`
  - `self-hosted.yaml` (GPU cost models for open-source inference)

- [ ] Create `config/models/routing.yaml` — task-type to provider mapping with cost/quality weights:

  ```yaml
  routing:
    code-generation: { primary: claude-sonnet, fallback: gpt-4o, budget: claude-haiku }
    code-review: { primary: claude-sonnet, fallback: gpt-4o }
    classification: { primary: claude-haiku, fallback: gpt-4o-mini }
    summarisation: { primary: gemini-flash, fallback: claude-haiku }
    embedding: { primary: cohere-embed, fallback: openai-embed }
  ```

- [ ] Extend `/cost` command to show per-provider spend breakdown (daily/weekly/monthly)
- [ ] Extend `/cost-centres` to attribute AI spend to cost centres via provider tags
- [ ] Add provider health dashboard fields: uptime, p99 latency, rate-limit headroom, credit balance

### Phase 3 — Validation and Optimisation

- [ ] Implement cost comparison report: actual spend vs cheapest-qualifying-provider (savings opportunity)
- [ ] Add budget alerts per provider (80% warn, 100% alert, 120% freeze — per `budget-guard.mjs` policy)
- [ ] Track vendor credits and expiry dates in `config/pricing/credits.yaml`
- [ ] Monthly cost optimisation report with switch-or-stay recommendations

## Integration Points

| System                 | Integration                                              | Owner                        |
| ---------------------- | -------------------------------------------------------- | ---------------------------- |
| `/cost` command        | Add `--by-provider` and `--by-model` flags for breakdown | T13-Cost-Ops                 |
| `/cost-centres`        | Map AI provider spend to cost centres via resource tags  | T13-Cost-Ops                 |
| `budget-guard.mjs`     | Per-provider budget limits and circuit breaker           | T13-Cost-Ops                 |
| `cost-tracker.mjs`     | Emit provider/model metadata in session logs             | T13-Cost-Ops + T4-Infra      |
| `routing.yaml`         | Consumed by orchestrator for model selection             | T13-Cost-Ops + T12-Strategic |
| IaC modules (`infra/`) | Cloud provider cost tags on all resources                | T4-Infra                     |

## Acceptance Criteria

- [ ] All 9 providers (5 AI API + 1 self-hosted + 3 cloud) have pricing YAML files
- [ ] Routing config covers all command categories with primary/fallback/budget tiers
- [ ] `/cost --by-provider` returns accurate per-provider spend for last 30 days
- [ ] Cost comparison report identifies switch candidates with savings >= 10%
- [ ] Vendor credits tracked with expiry alerts at 30-day and 80%-utilisation thresholds
- [ ] ADR documenting multi-provider cost architecture is approved
- [ ] Tests cover pricing normalisation logic (80% coverage threshold)

## Dependencies

- **Upstream:** T4-Infra — cloud resource tagging must be in place for IaC cost attribution
- **Downstream:** T12-Strategic-Ops — portfolio-level cost visibility
- **Downstream:** T9-Product — cost constraints feed into feature prioritisation

## Estimated Effort

| Phase                    | Duration  |
| ------------------------ | --------- |
| Phase 1 (Planning)       | 1 sprint  |
| Phase 2 (Implementation) | 2 sprints |
| Phase 3 (Validation)     | 1 sprint  |
