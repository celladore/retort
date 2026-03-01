# Model Family Dossier: Grok (xAI)

## Snapshot

- Last updated: 2026-02-26
- Scope: coding and agentic benchmark signals for Grok coding models
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| **Provider**       | xAI (Austin, USA)                                       |
| **Founded**        | 2023                                                    |
| **Architecture**   | Grok-1: MoE 314B params; Grok-3, Grok Code Fast 1: architecture unspecified |
| **Latest model**   | Grok-3, Grok Code Fast 1                                |
| **Context window** | Grok-3: 128K tokens; Grok Code Fast 1: 256K tokens     |
| **License**        | Proprietary (API) + open weights                        |
| **Notable**        | Elon Musk's AI company, "max fun" mode, 70.8% SWE-bench |

## Hugging Face Resources

| Resource      | Model ID                     | Notes                        |
| ------------- | ---------------------------- | ---------------------------- |
| Grok-1        | `xai-org/grok-1`             | 314B MoE model, open weights |
| Grok-1 Vision | N/A | API-only; model ID `xai-org/grok-1-vision-beta` exists but weights/artifacts are not hosted on Hugging Face |
| Grok-2        | `xai-org/grok-2`             | Latest Grok-2 release        |

> **Note:** xAI publishes Grok models via API (x.ai API) and has released open-weight versions on Hugging Face. The open-weight Grok-1 is notable as a 314B parameter MoE model.

## Latest benchmark signals

| Signal                              | Value                                                    | Source                                                     | Quality                        |
| ----------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------ |
| SWE-Bench Verified (full subset)    | 70.8% for grok-code-fast-1                               | [xAI Grok Code Fast 1](https://x.ai/news/grok-code-fast-1) | Fetched, vendor claim          |
| Pricing (input/output/cached input) | $0.20 / $1.50 / $0.02 per 1M tokens                      | [xAI Grok Code Fast 1](https://x.ai/news/grok-code-fast-1) | Fetched, vendor claim          |
| Tool-use positioning                | Trained for grep/terminal/file editing workflows         | [xAI Grok Code Fast 1](https://x.ai/news/grok-code-fast-1) | Fetched, vendor claim          |
| Ecosystem trend note                | Grok models added to SWE-rebench leaderboard news stream | [SWE-rebench](https://swe-rebench.com/)                    | Fetched, independent benchmark |

## Models tracked from PRD-002 (base + profiles)

| Base model       | Environment     | Profile variants covered | Cost tier | Cost multiplier range | Tokens/problem | SWE-bench / Verified                 | HLE           | SWE-rebench   | Aider         | Coding ability summary                                           | Decision Readiness | When to use                                           | Source quality                     | Last verified |
| ---------------- | --------------- | ------------------------ | --------- | --------------------: | -------------: | ------------------------------------ | ------------- | ------------- | ------------- | ---------------------------------------------------------------- | ------------------ | ----------------------------------------------------- | ---------------------------------- | ------------- |
| Grok 3           | Windsurf/Intake | Grok 3                   | Paid      |                   1.0 |  Not evaluated | Not evaluated                        | Not evaluated | Not evaluated | Not evaluated | Reasoning agent with strong math and coding capabilities         | Medium             | Complex reasoning tasks requiring test-time compute   | PRD-002 + xAI blog                 | 2026-02-26    |
| Grok Code Fast 1 | Windsurf        | Grok Code Fast 1         | Paid      |                  0.25 |  Not evaluated | 70.8% (vendor-reported, full subset) | Not evaluated | Not evaluated | Not evaluated | Speed/cost-tuned coding profile with strong tool-use positioning | Medium             | Quick code generation and cost-conscious coding tasks | Vendor claim + independent mention | 2026-02-26    |

## Operational notes

- xAI emphasizes end-user coding workflow speed and cost rather than only
  benchmark rank.
- The strongest numeric benchmark currently available in this pass is vendor
  reported, not independently verified.

## Guidance for model guides

1. Keep Grok as a candidate in speed/cost-aware tiers.
2. Require independent harness replication before top-tier promotion.
3. Monitor quality on complex multi-file refactors separately from bugfix tasks.

## Data gaps to close

- Independent SWE-bench and Aider benchmark replication.
- Provider-level reliability and timeout benchmarking.
- Comparative pass@2 and cost-per-success against GPT/Claude/Gemini.
