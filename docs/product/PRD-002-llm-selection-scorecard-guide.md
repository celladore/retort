# PRD-002: AgentKit Forge LLM Selection and Scorecard Guide

## Status

Active — PRD process active; appendix data incomplete.

This document is a living draft. The appendix contains TBD markers and data that is not yet production-ready. See the appendix for intended authority and completion status.

## Module / Feature Name

AgentKit Forge LLM Model Selection and Scorecard System

## Marketing Name

AgentKit Forge Model Scorecard and Recommender

## Platform / Mesh Layers

- AgentKit Forge orchestration layer
- Agent execution layer
- Model selection engine
- Reporting and telemetry layer

## Primary Personas

- AI and ML engineers integrating coding agents
- Developer platform product managers
- CTOs and engineering managers optimizing cost and performance
- Power users orchestrating custom agent stacks

## Core Value Proposition

Provide a transparent and data-driven system for selecting and configuring
optimal LLMs per coding agent workflow, maximizing quality, speed, and
cost-efficiency.

## Priority

P0 (Critical)

## License Tier

Pro and Enterprise

## Business Outcomes and Success Metrics

- Coding-agent latency reduction of at least 20%
- Code acceptance rate increase of 15%
- Lower API cost per build minute
- Model-mapping feature adoption above 70% among active teams

## Integration Points

- AgentKit Forge model mapping config (YAML and JSON)
- Agent execution APIs
- Reporting and analytics dashboards
- Third-party LLM endpoints

## TL;DR

The scorecard and recommender system gives teams practical model comparisons,
weighted decision logic, and configurable mappings so they can select the
right model per coding agent and continuously adapt as providers change.

## Problem Statement

LLM offerings evolve rapidly and vary widely in coding capability, pricing,
latency, and reliability. Teams struggle to maintain optimal mappings over
time. Suboptimal choices reduce velocity and increase spend.

## Core Challenge

Map each agent type and team context to the best model while balancing:

- code quality,
- reasoning quality,
- context capacity,
- latency,
- cost,
- vendor and integration risk.

## Current State

- Teams rely on defaults or outdated benchmarks.
- Model switching is manual and weakly documented.
- Scorecard data is often fragmented across tools.
- Reliability and quality vary between repos and teams.

## Why Now

Major model families are updated frequently. Teams need stable governance and
faster adaptation loops to stay competitive on delivery speed and cost.

## Goals and Objectives

### Business Goals

- Make Forge the leading mesh-native platform for coding-agent orchestration.
- Reduce customer model-operation cost by 20% in 12 months.
- Increase enterprise adoption through transparent model comparisons.

### User Goals

- Understand practical model trade-offs for coding use cases.
- Reassign agents to better models with low effort.
- Improve predictability in agent-driven pipelines.

### Non-Goals

- Non-coding LLM recommendation coverage in v1.
- Full support for private non-API models.
- Fine-tuned model recommendation outside supported families.

## Measurable Objectives

| Metric                   | Baseline | Target | Timeline |
| ------------------------ | -------- | ------ | -------- |
| Agent latency reduction  | N/A      | -20%   | 3 months |
| Code acceptance rate     | 65%      | 80%    | 6 months |
| Model reassignment usage | <10%     | >70%   | 6 months |
| API cost per build       | $0.13    | <$0.10 | 6 months |

## Stakeholders

- Product Manager, AI Platform
- Lead ML Engineer
- Forge Integrations Lead
- Solutions Architect
- Support Lead

## User Personas and Stories

### ML Infra Engineer

Needs reliable recommendations and fast update cycles to optimize performance
and cost.

User story:

As an ML infra engineer, I want a dynamic scorecard so I can compare models
quickly for my coding workflows.

### Developer Team Lead

Needs to improve velocity and quality without manual model testing overhead.

User story:

As a team lead, I want to map bug-fixing agents to best-fit models so merge
throughput improves.

### Platform Admin

Needs policy control and visibility across many teams and projects.

User story:

As a platform admin, I want configurable global model preferences and team
overrides via YAML and JSON.

## Use Cases and Core Flows

### Primary Use Cases

- Compare scorecards across supported model families.
- Assign models by team and agent type.
- Tune metric weights and refresh recommendations.
- Audit mappings and detect drift.

### Primary User Flow

1. User opens scorecard dashboard or config file.
2. User reviews model recommendations by agent context.
3. User edits weights or accepts defaults.
4. Forge applies mapping to runtime orchestration.
5. Telemetry updates quality and cost trends.

### Edge Cases

- Endpoint unavailable: use fallback model from policy.
- New model release mid-sprint: prompt review, avoid forced switch.
- Model EOL: show warning and migration recommendation.

## Functional Requirements

- Keep scorecards updated for supported model families.
- Allow mapping override by agent and by team.
- Weighted scoring with configurable priorities.
- Runtime fallback for outages and deprecations.
- Read and write mapping APIs.
- Integration with reporting and telemetry.

## Non-Functional Requirements

- Scorecard freshness target: updates within 24 hours of major changes.
- Availability target: >99.9% for orchestration path.
- Secure access controls for mapping edits.
- Scale target: 500+ teams.

## Mesh Layer Mapping

| Layer         | Responsibility                                     |
| ------------- | -------------------------------------------------- |
| Orchestration | Scorecard refresh, assignment, fallback automation |
| Execution     | Runtime model invocation and call tracking         |
| Reporting     | Cost, quality, and drift analytics                 |

## APIs and Integrations

### Required APIs

- `/api/forge/models/list`
- `/api/forge/agents/assign`
- `/api/forge/scorecards/get`

### External Dependencies

- Hosted LLM vendors
- Usage and cost telemetry APIs
- Internal quality and reporting plugins

## Data Models

- ModelScorecard: metrics and traits per model
- AgentAssignment: model mapping plus weights per agent and team
- PerformanceSnapshot: historical outcomes per mapping

## UX and Entry Points

### Onboarding Flow

1. Prompt user to review scorecards during agent setup.
2. Provide guided mapping wizard with sample configs.
3. Offer auto-update mode or manual override mode.

### Primary UX Flows

- Dashboard for side-by-side model comparison.
- YAML and JSON editor with inline validation.
- Clear error messaging for deprecated or unreachable models.

## Accessibility

- WCAG 2.1 AA targets
- Keyboard navigation support
- Screen reader compatibility
- Sufficient color contrast for scorecard visuals

## Success Metrics

### Leading Indicators

- Custom mapping adoption rate
- Scorecard page views and dwell time
- Fallback events resolved successfully
- Post-release mapping update frequency

### Lagging Indicators

- Long-term velocity improvements
- Sustained API cost reduction
- Increased PR acceptance rates from agent contributions

## Measurement Plan

- Track telemetry in Forge analytics storage.
- Publish monthly KPI summaries.
- Alert weekly on drift and fallback spikes.

## Timeline and Milestones

| Phase             | Status      | Dates   | Scope                               | Dependencies                |
| ----------------- | ----------- | ------- | ----------------------------------- | --------------------------- |
| Scorecard launch  | Complete    | Q2 2024 | Model families, dashboard, config   | Model and telemetry data    |
| Mapping API       | Complete    | Q3 2024 | Read and write APIs, fallback logic | Backend and security review |
| Analytics rollout | Complete    | Q4 2024 | KPI tracking and alerting           | BI integration              |
| Ongoing updates   | In Progress | Monthly | Continuous scorecard refresh        | Vendor feeds                |

## Constraints and Dependencies

### Technical Constraints

- Token and context differences across models
- Provider-specific rate limits
- Region restrictions for selected models

### Business Constraints

- Vendor SLA variability
- Budget controls for premium model usage
- Limited support for unsupported private model stacks

## Risks and Mitigations

| Risk                        | Impact | Probability | Mitigation                          |
| --------------------------- | ------ | ----------- | ----------------------------------- |
| Hallucination on code tasks | High   | Medium      | Re-score models and gate beta usage |
| Version drift               | Medium | High        | Alerting and rapid refresh cycles   |
| Rate limit or cost spikes   | Medium | Low         | Fallback and budget guardrails      |
| Plugin incompatibility      | Low    | Medium      | Compatibility matrix and docs       |

## Open Questions

| Question                                        | Owner           | Target Date | Resolution | Impact if Unresolved       |
| ----------------------------------------------- | --------------- | ----------- | ---------- | -------------------------- |
| Can custom fine-tuned models be plug-and-play?  | Product Manager | TBD         | Open       | Lower extensibility        |
| Will vendors provide early deprecation signals? | ML Engineer     | TBD         | Open       | Unexpected fallback events |
| What telemetry granularity is sufficient?       | BI Analyst      | TBD         | Open       | Lower metric confidence    |

## Appendix

## How to Use This Guide

Use this guide with Forge automated mapping defaults. Keep agent-model config
files updated as team priorities change. Reassess weights quarterly.

## General Model Selection Principles (Coding)

Prioritize:

- code generation quality,
- reasoning depth,
- context support,
- latency,
- cost,
- compatibility.

Quality usually dominates, but high-throughput teams may shift weight toward
cost and latency for selected agents.

## Model Family Highlights

### Claude (Anthropic)

- Strong long-context coding performance
- Safety-oriented behavior
- Tends toward conservative or verbose outputs

### GPT (OpenAI)

- Strong baseline coding and reasoning performance
- Broad plugin and tool compatibility
- Fast family iteration can introduce drift

### Gemini (Google)

- Competitive multilingual coding support
- Good cloud ecosystem integration
- API behavior may shift across versions

### Kimi, Minimax, GLM

- Often cost-efficient in specific regions
- Useful for multilingual or regional deployments
- Watch API, compliance, and rate-limit specifics

### Grok, SWE, o3

- Useful for experimentation and open workflows
- Strong innovation pace
- Maturity and enterprise support vary

## Example Scorecard (Coding Context)

> **Note:** This scorecard provides a baseline reference. Detailed weighted scores for each team are in PRD-003.

| Model            | Code | Reasoning | Context        | Speed    | Cost | Compatibility | Notes                                                |
| ---------------- | ---- | --------- | -------------- | -------- | ---- | ------------- | ---------------------------------------------------- |
| Claude Opus 4.6  | 5.0  | 4.5       | 200K (1M beta) | Standard | $$$  | Native        | Conservative in speculative code                     |
| GPT-4o           | 4.8  | 4.7       | 128K           | Fast     | $$   | Full          | Strong general-purpose coding and tool-use           |
| Gemini 1.5 Pro   | 4.6  | 4.5       | 1M             | Standard | $$   | Full          | Large-context workflows; structured output improving |
| Kimi K2 Thinking | 4.2  | 4.4       | 256K           | Standard | $    | Partial       | Strong pass@1 profile; verify provider integration   |
| Grok Code Fast 1 | 4.0  | 4.2       | 131K           | Fast     | $    | Experimental  | Strong speed/cost profile; evolving ecosystem        |

**Model naming convention:** In configuration files, model names use lowercase with hyphens (e.g., "Claude Opus 4.6" → "claude-opus-4-6").

**Cost notation:**

- $ = Low cost (e.g., < $0.50 per 1M tokens)
- $$ = Medium cost (e.g., $0.50–$5 per 1M tokens)
- $$$ = High cost (e.g., > $5 per 1M tokens)

## Agent Mapping Example

```yaml
agents:
  - name: bug_fixer
    model: claude-opus-4-6
    weights:
      code_quality: 0.5
      reasoning: 0.3
      context: 0.1
      cost: 0.1
  - name: doc_generator
    model: gemini-1.5-pro
    weights:
      code_quality: 0.4
      context: 0.4
      cost: 0.1
      speed: 0.1
team_defaults:
  backend: claude-opus-4-6
  frontend: gpt-4o-mini
fallback_model: gpt-4o-mini
```

## Decision Matrix Mechanics

Forge calculates weighted scores per model and context. Defaults can be
overridden by admins per agent or team. If a model fails health checks or is
deprecated, Forge routes to the next compatible score winner.

## Migration and Switching Guidance

- Plan upgrades with canary or shadow runs.
- Track version drift against invoked runtime models.
- Define fallback policy before major migrations.
- Re-run scorecard comparisons after provider pricing changes.

## Model Lore (Team-Friendly Trivia)

- Claude references Claude Shannon.
- GPT-4o uses -o- for -omni-.
- Grok comes from science fiction and means deep understanding.

Use scorecards as guidance, then tune by team outcome data.

## Appendix: IDE Model/Capability Matrix

> **Warning — Preliminary planning data:** The table below is not production-ready. Many capability fields (context window, max output, tool use, vision, reliability, determinism, JSON support) remain TBD until the benchmark annex validation completes. See the Pending Benchmark Annex and timeline for when capability fields will be populated. Do not use for production routing decisions without independent verification.

### Cursor + Windsurf — Model/Capability Matrix

#### Sources

- Cursor: screenshot `2026-02-25 19:09:03` (model list only)
- Windsurf:
  - user-provided model/multiplier rows
  - promo banners:
    - Claude Sonnet 4.6 promo pricing:
      - No thinking: 2x
      - With thinking: 3x
    - GLM-5 + Minimax M2.5 promo pricing:
      - GLM-5 (Zhipu AI): 0.75x
      - Minimax M2.5: 0.25x

> **Important:** For Cursor, the screenshot does not expose cost multipliers,
> context windows, max output, tool/vision support, or determinism knobs.
> These fields are marked **TBD**. For Windsurf, multipliers are from the
> user-provided list + promo banners. Capability columns remain **TBD** unless
> independently validated.

| Environment | Provider/Org (as shown / best guess) | Model                             | Reasoning (Y/N) | Cost tier | Cost multiplier (x#) | Notes                                       | Best for (coding/arch/refactor/docs/research/Q&A) | Context window (tokens) | Max output | Tool use support (functions/browsing/repo) | Vision support | Latency class (Fast/Standard) | Reliability | Determinism controls (temp/seed) | JSON/structured output |
| ----------- | ------------------------------------ | --------------------------------- | --------------- | --------- | -------------------: | ------------------------------------------- | ------------------------------------------------- | ----------------------: | ---------: | ------------------------------------------ | -------------- | ----------------------------- | ----------- | -------------------------------- | ---------------------- |
| Cursor      | Cursor/Unknown                       | Composer 1.5                      | TBD             | TBD       |                  TBD | UI item                                     | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Cursor      | Anthropic (likely)                   | Opus 4.6                          | TBD             | TBD       |                  TBD |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Cursor      | Anthropic (likely)                   | Sonnet 4.6                        | TBD             | TBD       |                  TBD |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Cursor      | OpenAI (likely)                      | GPT-5.3 Codex                     | TBD             | TBD       |                  TBD |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Cursor      | OpenAI (likely)                      | GPT-5.3 Codex Extra High          | TBD             | TBD       |                  TBD |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Cursor      | OpenAI (likely)                      | GPT-5.3 Codex Spark               | TBD             | TBD       |                  TBD |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Cursor      | OpenAI (likely)                      | GPT-5.3 Codex Spark Extra High    | TBD             | TBD       |                  TBD | name truncated in OCR; assumed              | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Cursor      | OpenAI (likely)                      | GPT-5.2                           | TBD             | TBD       |                  TBD |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | Anthropic                            | Opus 4.6                          | ?               | Paid      |                  TBD | multiplier not provided                     | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | Anthropic                            | Claude Sonnet 4.6 (No thinking)   | N               | Paid      |                    2 | Promo banner pricing                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | Anthropic                            | Claude Sonnet 4.6 (With thinking) | Y               | Paid      |                    3 | Promo banner pricing                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5-Codex                       | N/?             | Paid      |                  0.5 | Codex                                       | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1                           | N/?             | Paid      |                  0.5 |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1 Fast                      | N/?             | Paid      |                    1 | Fast                                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1 High Thinking             | Y               | Paid      |                    2 | Thinking                                    | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1 High Thinking Fast        | Y               | Paid      |                    4 | Thinking + Fast                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1 Low Thinking              | Y               | Paid      |                  0.5 | Thinking                                    | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1 Low Thinking Fast         | Y               | Paid      |                    1 | Thinking + Fast                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1 Medium Thinking Fast      | Y               | Paid      |                    2 | Thinking + Fast                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1-Codex                     | N/?             | Free      |                    0 | Free                                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1-Codex Low                 | N/?             | Free      |                    0 | Free                                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1-Codex Max High            | N/?             | Paid      |                    1 | Codex, Max                                  | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1-Codex Max Medium          | N/?             | Paid      |                  0.5 | Codex, Max                                  | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1-Codex Max Low             | N/?             | Free      |                    0 | Free, Codex Max                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1-Codex-Mini                | N/?             | Free      |                    0 | Free, Codex Mini                            | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.1-Codex-Mini Low            | N/?             | Free      |                    0 | Free, Codex Mini                            | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2                           | N/?             | Paid      |                    1 |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2 Fast                      | N/?             | Paid      |                    2 | Fast                                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2 Low Thinking              | Y               | Paid      |                    1 | Thinking                                    | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2 Low Thinking Fast         | Y               | Paid      |                    2 | Thinking + Fast                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2 Medium Thinking           | Y               | Paid      |                    2 | Thinking                                    | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2 Medium Thinking Fast      | Y               | Paid      |                    4 | Thinking + Fast                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2 High Thinking             | Y               | Paid      |                    8 | Thinking                                    | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2 High Thinking Fast        | Y               | Paid      |                    6 | Thinking + Fast                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2 XHigh Thinking            | Y               | Paid      |                    8 | Thinking, XHigh                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2 XHigh Thinking Fast       | Y               | Paid      |                   16 | Thinking, XHigh + Fast                      | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2-Codex Low                 | N/?             | Paid      |                    1 | Codex                                       | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2-Codex Low Fast            | N/?             | Paid      |                    2 | Codex + Fast                                | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2-Codex High                | N/?             | Paid      |                    2 | Codex                                       | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2-Codex High Fast           | N/?             | Paid      |                    4 | Codex + Fast                                | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2-Codex Medium              | N/?             | Paid      |                    1 | Codex                                       | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2-Codex Medium Fast         | N/?             | Paid      |                    2 | Codex + Fast                                | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2-Codex XHigh               | N/?             | Paid      |                    3 | Codex, XHigh                                | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.2-Codex XHigh Fast          | N/?             | Paid      |                    6 | Codex, XHigh + Fast                         | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.3-Codex Low                 | N/?             | Paid      |                  1.5 | Codex, New                                  | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.3-Codex Low Fast            | N/?             | Paid      |                    3 | Codex, New + Fast                           | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.3-Codex Medium              | N/?             | Paid      |                    2 | Codex, New                                  | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.3-Codex Medium Fast         | N/?             | Paid      |                    4 | Codex, New + Fast                           | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.3-Codex High                | N/?             | Paid      |                  2.5 | Codex, New                                  | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.3-Codex High Fast           | N/?             | Paid      |                    5 | Codex, New + Fast                           | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.3-Codex XHigh               | N/?             | Paid      |                    8 | Codex, New, XHigh                           | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI                               | GPT-5.3-Codex XHigh Fast          | N/?             | Paid      |                    6 | Codex, New, XHigh + Fast                    | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI?                              | o3                                | Y/?             | Paid      |                    1 | reasoning family; label unclear             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | OpenAI?                              | o3 High Reasoning                 | Y               | Paid      |                    1 | explicit "High Reasoning"                   | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | Unknown                              | SWE-1.5                           | ?               | Free      |                    0 | Free                                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | Unknown                              | SWE-1.5 Fast                      | ?               | Paid      |                  0.5 | Fast                                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | Zhipu AI                             | GLM-5                             | ?               | Paid      |                 0.75 | Promo banner pricing                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | Minimax                              | Minimax M2.1 (Beta)               | ?               | Paid      |                  0.5 | Beta                                        | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | Minimax                              | Minimax M2.5 (New)                | ?               | Paid      |                 0.25 | Promo banner pricing (overrides earlier 1x) | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | xAI                                  | Grok-3                            | ?               | Paid      |                    1 |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | xAI                                  | Grok Code Fast 1                  | ?               | Free      |                    0 | Free, Code + Fast                           | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Fast                          | TBD         | TBD                              | TBD                    |
| Windsurf    | OSS                                  | GPT-OSS 120B Medium Thinking      | Y               | Paid      |                 0.25 | explicit "Thinking"                         | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | Standard                      | TBD         | TBD                              | TBD                    |
| Windsurf    | Kimi                                 | Kimi K2                           | ?               | Paid      |                  0.5 |                                             | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |
| Windsurf    | Kimi                                 | Kimi K2.5 (New)                   | ?               | Paid      |                    1 | New                                         | TBD                                               |                     TBD |        TBD | TBD                                        | TBD            | TBD                           | TBD         | TBD                              | TBD                    |

### Notes

- **Cost multiplier normalization:** Free is stored as 0 in the multiplier column for arithmetic convenience.
- **Claude Sonnet 4.6 promo:** represented as two rows to make the multiplier
  unambiguous (No thinking vs With thinking).
- **Minimax M2.5 promo:** set to 0.25x as per banner (overrides a preliminary 1x setting).
- Capability columns are intentionally **TBD** unless independently validated.
- If preferred, this can be collapsed to one row per base model by introducing a
  dedicated -Thinking modes & multipliers- column.

### Pending Benchmark Annex (Not evaluated models)

| Model family / models                                                | Evidence Status | Owner               | Target ETA | Reason                                                           |
| -------------------------------------------------------------------- | --------------- | ------------------- | ---------- | ---------------------------------------------------------------- |
| Cursor model metadata (all listed Cursor rows)                       | Unverified      | Platform Lead       | 2026-03-31 | Cursor UI source does not expose structured capability metadata  |
| Gemini 3 / SWE-1.5 capability details                                | Preliminary     | ML Engineer         | 2026-03-21 | Awaiting validated provider documentation + internal harness run |
| GLM-5 / GLM 4.7 capability details                                   | Preliminary     | Integrations Lead   | 2026-03-21 | Pending provider normalization + reliability replication         |
| DeepSeek / Codestral / Llama 4 / Cohere / Nova / Granite intake rows | Preliminary     | Platform + QA Leads | 2026-03-28 | Pending independent benchmark replication before non-TBD scoring |
| Minimax M2.1/M2.5 full capability details                            | Preliminary     | Integrations Lead   | 2026-03-21 | Promo pricing known; capability validation pending               |

**Contingency Actions:**

- Use best-available evaluated sibling models for production routing
- Apply conservative safety margins for unvalidated models
- Hold non-critical feature rollouts until validation completes
- Reassign ownership if benchmarks miss ETAs by >2 weeks

### Best For Guidance

| Model Family            | Best For                                          |
| ----------------------- | ------------------------------------------------- |
| Claude Opus 4.6         | Complex refactoring, architecture, deep reasoning |
| Claude Sonnet 4.6       | Balanced coding tasks, general purpose            |
| GPT-5.2/5.3 Codex       | Agentic coding, terminal use, long-running tasks  |
| GPT-5.x Thinking (High) | Complex reasoning, debugging, architecture        |
| GPT-5.x Thinking (Low)  | Quick reasoning tasks, cost-sensitive             |
| SWE-1.5                 | Fast agentic coding, free tier usage              |
| Grok Code Fast          | Quick code generation, free tier                  |
| GLM-5 / Minimax         | Cost-sensitive, multilingual workloads            |

### Coding Benchmark Snapshot (Cursor + Windsurf Priority Models)

| Model / Family                     | HLE           | SWE-bench / SWE-bench Verified             | SWE-rebench / SWE-rebench-like                 | Aider / coding harness          | Source quality               |
| ---------------------------------- | ------------- | ------------------------------------------ | ---------------------------------------------- | ------------------------------- | ---------------------------- |
| Claude Opus 4.6                    | Not evaluated | 81.42% (25-trial average, prompt-modified) | #1 reported on SWE-rebench news stream         | Not evaluated                   | Vendor + independent mix     |
| Claude Sonnet 4.6                  | Not evaluated | Not evaluated                              | Best pass@5 reported on SWE-rebench            | Not evaluated                   | Independent leaderboard note |
| GPT-5.2 Codex / GPT-5.3 Codex line | Not evaluated | 74.9% (GPT-5 family launch claim)          | Token-efficiency callout for `gpt-5.2-codex`   | Pass@2 = 88.0 (high config run) | Mixed (vendor + independent) |
| Gemini 3 (Flash/Pro)               | Not evaluated | Not evaluated                              | 57.6% (Flash preview), 56.5% (Pro preview)     | Not evaluated                   | Independent benchmark        |
| Kimi K2 Thinking / K2.5            | Not evaluated | Not evaluated                              | 43.8% (K2 Thinking) vs 37.9% (K2.5)            | Not evaluated                   | Independent benchmark        |
| Grok Code Fast 1                   | Not evaluated | 70.8% (vendor-reported, full subset)       | Not evaluated                                  | Not evaluated                   | Vendor claim                 |
| GLM-5 / GLM 4.7                    | Not evaluated | Not evaluated                              | Leaderboard rank/tokens-per-problem notes only | Not evaluated                   | Independent leaderboard note |
| Minimax M2.5                       | Not evaluated | Vendor comparative runtime/token signals   | Cost note (~$0.09/problem)                     | Not evaluated                   | Vendor + independent note    |
| DeepSeek V3.2 (chat/reasoner)      | Not evaluated | Not evaluated                              | Not evaluated                                  | Not evaluated                   | Not evaluated                |

Interpretation guidance:

- `Not evaluated` means no reproducible benchmark evidence in this repo yet.
- Prioritize independent benchmark values over vendor launch claims when ranking.
- For Cursor/Windsurf routing, treat this table as **evidence status**, not final
  score inputs, until internal replication is completed.
