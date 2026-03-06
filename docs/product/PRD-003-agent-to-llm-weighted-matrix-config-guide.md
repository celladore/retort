# PRD-003: Agent-to-LLM Weighted Matrix and Config Guide (Polyglot Example)

## Status

In Review

> [!WARNING]
> This document is an illustrative example only.
> It is intentionally not factually correct or comprehensive.

## Module / Feature Name

AgentKit Forge: Agent-to-LLM Weighted Selection and Configuration Layer

## Marketing Name

AgentKit Forge - Polyglot LLM Decision Matrix Configurator

## Platform / Mesh Layers

- Node.js (backend)
- React (frontend)
- CosmosDB (database)
- Azure (cloud and infrastructure)
- Redis (cache and queue)
- Next.js (SSR framework)
- C#, Rust, Python (polyglot agent coverage)

## Primary Personas

- Backend Engineers
- Frontend Developers
- Data Scientists and Engineers
- Infrastructure and Cloud Architects
- DevOps and SRE
- QA and Test Engineers
- Security Engineers
- Technical Writers and Docs Contributors
- Product Managers
- Quality Leads

## Core Value Proposition

A mesh-native selection and configuration system that helps teams map agents
to optimal LLMs while balancing reasoning, cost, context, and codebase
compatibility across a heterogeneous stack.

## Priority

P0 - Critical

## License Tier

Enterprise

## Business Outcomes / Success Metrics (Example)

- 90% agent query satisfaction (internal survey)
- 60% reduction in LLM-related support tickets
- Less than 3% monthly cost overage from suboptimal model use
- 70% faster onboarding and configuration time

## Integration Points

- AgentKit orchestration layer
- Team and agent assignment modules
- Model APIs (OpenAI, Anthropic, Google, Kimi, etc.)
- Audit and logging services
- Polyglot agent SDKs (.NET, Node, Python, Rust)

## TL;DR

AgentKit Forge enables declarative, team-aware agent-to-LLM mapping through
YAML and JSON overlays so organizations can optimize quality and spend as model
capabilities, pricing, and constraints evolve.

## Introduction

This guide demonstrates a weighted agent-to-LLM selection matrix for a
polyglot codebase. It provides sample weights, scorecards, decision matrices,
and overlay configuration examples.

## Metric Weights by Team / Agent (out of 100)

| Team / Agent | Code Quality | Reasoning | Cost | Context | Speed | Compatibility |
| ------------ | -----------: | --------: | ---: | ------: | ----: | ------------: |
| Backend      |           30 |        25 |   10 |      25 |     5 |             5 |
| Frontend     |           15 |        15 |   20 |      15 |    25 |            10 |
| Data         |           15 |        30 |   10 |      35 |     5 |             5 |
| Infra        |           10 |        20 |   25 |      20 |    15 |            10 |
| DevOps       |           10 |        20 |   30 |      10 |    20 |            10 |
| Testing      |           25 |        20 |   15 |      20 |    10 |            10 |
| Security     |           20 |        30 |   10 |      10 |    10 |            20 |
| Docs         |            5 |        20 |   10 |      45 |     5 |            15 |
| Product      |           10 |        30 |   10 |      25 |     5 |            20 |
| Quality      |           30 |        25 |   10 |      15 |    10 |            10 |

## LLM Scorecards by Team / Agent (Example Baseline)

| Model         | Code | Reasoning | Cost | Context | Speed | Compatibility | Notes                          |
| ------------- | ---: | --------: | ---: | ------: | ----: | ------------: | ------------------------------ |
| Claude 3 Opus |    9 |        10 |    5 |      10 |    10 |             8 | Top context, strong code       |
| GPT-5.x       |   10 |         9 |    7 |       9 |     9 |             9 | Strong NL to code, expensive   |
| Gemini Ultra  |    8 |         8 |    8 |       8 |     9 |             9 | Good cloud/dev support         |
| Kimi          |    7 |         7 |    9 |       6 |     7 |             8 | Budget option                  |
| Minimax       |    7 |         7 |    9 |       7 |     8 |             8 | Reliable in selected regions   |
| GLM-4         |    7 |         8 |    8 |       8 |     7 |             9 | Multi-language friendly        |
| xAI Grok      |    6 |         6 |    7 |       7 |     8 |             7 | Infra-oriented experimentation |
| SWE-Llama     |    9 |         8 |    8 |       8 |     8 |             8 | Code/test specialist           |
| o3            |    7 |         7 |    9 |       7 |     7 |             8 | Low cost, fast deploy          |

## Full Weighted Decision Matrix (All Teams)

Formula:

Weighted Score = (Code x Code_Weight + Reasoning x Reasoning_Weight + Cost x Cost_Weight + Context x Context_Weight + Speed x Speed_Weight + Compatibility x Compatibility_Weight) / 100

Cost evidence method used by team model guides:

- `effective_cost = cost_multiplier * normalized_tokens_per_problem`
- `normalized_tokens_per_problem = model_tokens_per_problem / baseline_tokens_per_problem`
- `cost_score = min(10, 10 * baseline_effective_cost / model_effective_cost)`
- If `tokens/problem` is missing, keep existing Cost scores unchanged and mark
  cost evidence as `Not evaluated`.

Sample backend calculation (Claude 3 Opus):

(30 x 9 + 25 x 10 + 10 x 5 + 25 x 10 + 5 x 10 + 5 x 8) / 100 = 9.10

| Team     | Claude 3 Opus | GPT-5.x | Gemini | Kimi | Minimax | GLM-4 | xAI Grok | SWE-Llama |   o3 | Top Choices                | Cost-Aware Alt     |
| -------- | ------------: | ------: | -----: | ---: | ------: | ----: | -------: | --------: | ---: | -------------------------- | ------------------ |
| Backend  |          9.10 |    9.10 |   8.10 | 7.00 |    7.30 |  7.70 |     6.50 |      8.30 | 7.25 | Claude, GPT-5.x, SWE-Llama | Kimi, o3           |
| Frontend |          8.65 |    8.75 |   8.35 | 7.35 |    7.75 |  7.70 |     6.95 |      8.15 | 7.50 | GPT-5.x, Claude, Gemini    | o3, Kimi           |
| Data     |          9.25 |    8.95 |   8.10 | 6.90 |    7.30 |  7.85 |     6.60 |      8.15 | 7.25 | Claude, GPT-5.x, SWE-Llama | o3, Kimi           |
| Infra    |          8.45 |    8.60 |   8.25 | 7.40 |    7.75 |  7.85 |     6.85 |      8.10 | 7.60 | GPT-5.x, Claude, Gemini    | o3, Kimi           |
| DevOps   |          8.20 |    8.50 |   8.30 | 7.60 |    7.90 |  7.80 |     6.90 |      8.10 | 7.70 | GPT-5.x, Gemini, Claude    | o3, Kimi           |
| Testing  |          8.80 |    8.95 |   8.20 | 7.20 |    7.50 |  7.75 |     6.65 |      8.25 | 7.40 | GPT-5.x, Claude, SWE-Llama | o3, Kimi           |
| Security |          8.90 |    9.00 |   8.30 | 7.30 |    7.50 |  7.90 |     6.60 |      8.20 | 7.40 | GPT-5.x, Claude, Gemini    | o3, Kimi           |
| Docs     |          9.15 |    8.85 |   8.20 | 6.90 |    7.40 |  8.05 |     6.80 |      8.05 | 7.35 | Claude, GPT-5.x, Gemini    | o3, Minimax (APAC) |
| Product  |          9.00 |    8.90 |   8.25 | 7.15 |    7.45 |  8.05 |     6.65 |      8.10 | 7.40 | Claude, GPT-5.x, Gemini    | o3, Kimi           |
| Quality  |          9.00 |    9.10 |   8.20 | 7.15 |    7.40 |  7.70 |     6.55 |      8.30 | 7.30 | GPT-5.x, Claude, SWE-Llama | o3, Kimi           |

Note: Cost-Aware Alt is provided for all teams to keep fallback policy explicit and operational.

## Edge Cases and Commentary

- Backend/Testing: SWE-Llama can outperform on Python/Rust-heavy repos.
- DevOps/Infra: xAI Grok and GLM-4 may be favored for specific infra or region
  constraints.
- Cost spikes: On threshold breach (for example, more than 15% over allocated
  monthly budget), teams switch to cost-aware alternates.
- Frontend quirks: Custom transpilers may favor Gemini for TS AST behavior.
- API compatibility: Some providers may lack advanced explainability features;
  route reviews back to Claude or GPT families.
- Internationalization: GLM and Minimax can be prioritized for APAC workloads.

## Overlay Config Example

The scorecard tables list model families (e.g., Claude 3 Opus, GPT-5.x, Kimi); the config uses concrete variant IDs (e.g., `claude-3-5-sonnet`, `gpt-4o`, `kimi-k2`). Map family recommendations to the specific variant available in your environment.

```yaml
# .agentkit.yaml
agents:
  backend:
    default_model: claude-3-5-sonnet
    alternate_model: kimi-k2
    weights: [30, 25, 10, 25, 5, 5]
    rationale: Claude 3.5 Sonnet for code/context, Kimi K2 for cost fallback
  frontend:
    default_model: gpt-4o
    alternate_model: claude-3-5-sonnet
    weights: [15, 15, 20, 15, 25, 10]
    rationale: GPT-4o for TypeScript nuance, Claude 3.5 Sonnet for fallback when OpenAI unavailable
  testing:
    default_model: claude-3-5-sonnet
    alternate_model: gpt-4o
    weights: [25, 20, 15, 20, 10, 10]
    rationale: Claude 3.5 Sonnet for multi-language tests, GPT-4o for CI-heavy flows
```

## Quick Override Rules

- Budget breach: switch to alternate model.
- Provider downtime: fail over to alternate model.
- New language stack: raise compatibility weight and re-score.
- Compliance scope: apply regional constraints and document exceptions.
- Performance mode changes: rebalance reasoning vs speed.

## FAQ

### Can weights be changed per agent?

Yes, team defaults can be inherited and overridden per agent.

### How are cost overruns handled?

Usage is monitored against thresholds and can trigger alternate routing with
audit logs.

### Can new models be introduced quickly?

Yes, add scorecard rows and re-run weighted scoring.

### What if the stack is mostly C# or Rust?

Increase code quality and compatibility weights and validate with
language-specific benchmarks.

### Is manual override supported?

Yes. Team leads and admins can override and roll back through config.

## Appendix

### Research and Data

- Internal benchmark set (illustrative): 130K mixed coding and reasoning tasks
- Team interviews across backend, DevOps, QA, docs, and product functions

### Technical Feasibility

- Polyglot SDK tests demonstrated on Node, .NET, Python, and Rust
- Tradeoff remains between high-context premium models and cost-focused models

### Competitive Positioning

Many orchestration products provide static defaults only. This example
illustrates dynamic, per-team weighted mapping and override paths.
