# Model Family Dossier: Gemini (Google)

## Snapshot

- Last updated: 2026-02-26
- Scope: coding, agentic, and speed-relevant benchmark signals
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                               |
| ------------------ | --------------------------------------------------- |
| **Provider**       | Google DeepMind (London/Mountain View)              |
| **Founded**        | 2010 (DeepMind), 2023 (Gemini)                      |
| **Architecture**   | Dense transformer + MoE                             |
| **Latest announced** | Gemini 3 Pro/Flash (preview-only)                  |
| **Latest production** | Gemini 2.0 Flash, Gemini 1.5 Pro (see table below) |
| **Context window** | 1M tokens (2M experimental)                         |
| **License**        | Proprietary (API) + limited open weights            |
| **Notable**        | Native multimodal from ground up, 2M context leader |

## Google API Model Identifiers

These are Google API/Studio/Vertex model identifiers (access via Google AI Studio, Vertex AI, or Gemini API). They are not Hugging Face repository paths.

| Model            | API identifier                | Notes                      |
| ---------------- | ----------------------------- | -------------------------- |
| Gemini 1.5 Pro   | `google/gemini-1.5-pro`      | 1M context, API access     |
| Gemini 1.5 Flash | `google/gemini-1.5-flash`     | Fast variant, 1M context   |
| Gemini 2.0 Flash | `google/gemini-2.0-flash-exp` | Experimental Flash variant |
| Gemini 2.0 Flash | `google/gemini-2.0-flash`     | Production Flash           |

> **Note:** Google publishes most Gemini models via Google AI Studio and Vertex AI, not Hugging Face. Gemini 3/3.1 are preview/announcement-only and not yet available.

## Latest benchmark signals

| Signal                        | Value                                                      | Source                                                           | Quality                        |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| SWE-rebench pass@1 comparison | Gemini 3 Flash Preview: 57.6%; Gemini 3 Pro Preview: 56.5% | [SWE-rebench](https://swe-rebench.com/)                          | Fetched, independent benchmark |
| Google launch claim           | Gemini 3 Flash reported at 54.2% on Terminal-Bench 2.0     | [Google Gemini 3](https://blog.google/products/gemini/gemini-3/) | Search snippet (page timeout)  |
| Google launch claim           | Gemini 3 Pro reported at 1487 Elo on WebDev Arena          | [Google Gemini 3](https://blog.google/products/gemini/gemini-3/) | Search snippet (page timeout)  |

## Models tracked from PRD-002 (base + profiles)

*Cost multiplier range relative to GPT-4 baseline pricing.

| Base model     | Environment     | Profile variants covered     | Cost tier | Cost multiplier range* | Tokens/problem | SWE-bench / Verified | HLE           | SWE-rebench                                                                 | Aider         | Coding ability summary                                       | Decision Readiness | When to use                                                  | Source quality                | Last verified |
| -------------- | --------------- | ---------------------------- | --------- | --------------------: | -------------: | -------------------- | ------------- | --------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------ | ------------------ | ------------------------------------------------------------ | ----------------------------- | ------------- |
| Gemini 3 Flash | Windsurf        | Gemini 3 Flash (Preview, High profile) | Paid      |                  1.75 |  Not evaluated | Not evaluated        | Not evaluated | 57.6% (Gemini 3 Flash Preview, High profile)                                                       | Not evaluated | Strong speed-oriented coding/agent profile in family signals | Medium             | Fast coding loops where turnaround time is priority          | Independent + vendor snippet  | 2026-02-26    |
| Gemini 3 Pro   | Windsurf        | Gemini 3 Pro High Thinking   | Paid      |                   2.0 |  Not evaluated | Not evaluated        | Not evaluated | 56.5% (Pro preview)                                                         | Not evaluated | Higher-reasoning Gemini branch with strong context potential | Medium             | High-context coding and reasoning-heavy multi-file workflows | Independent + vendor snippet  | 2026-02-26    |
| Gemini 3.1 Pro | Windsurf/Intake | Gemini 3.1 Pro High Thinking | Paid      |                   2.0 |  Not evaluated | Not evaluated        | Not evaluated | Improved performance on reasoning benchmarks (model card); independent verification pending | Not evaluated | Enhanced reasoning and multimodal capabilities over 3 Pro    | Medium             | Complex reasoning tasks requiring enhanced capabilities      | PRD-002 + DeepMind model card | 2026-02-26    |

## Operational notes

- In currently accessible benchmark data, Gemini Flash can outperform Gemini
  Pro on some coding-agent metrics despite lower model size.
- Official Google pages timed out in this environment, so those data points are
  recorded as search-snippet quality until fetched directly.

## Guidance for model guides

1. Keep Gemini Flash as a serious candidate for speed-sensitive coding flows.
2. Keep Gemini Pro for large-context and complex reasoning tasks.
3. Validate Flash vs Pro in our own harness before changing team defaults.

## Data gaps to close

- Direct fetch of Google benchmark tables (Terminal-Bench, WebDev Arena).
- Independent cost/performance runs for Gemini 3 and Gemini 3.1 variants.
- Regional latency and reliability comparisons vs GPT/Claude.
