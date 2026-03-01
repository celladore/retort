# Model Family Dossier: Kimi (Moonshot AI)

## Snapshot

- Last updated: 2026-02-26
- Scope: benchmark signals for Kimi coding and reasoning variants
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| **Provider**       | Moonshot AI (Beijing, China)                                          |
| **Founded**        | 2023                                                                  |
| **Architecture**   | Dense transformer with thinking modes                                 |
| **Latest model**   | Kimi K2.5                                                             |
| **Context window** | 256K tokens                                                           |
| **License**        | Proprietary (API) + open weights on HF                                |
| **Notable**        | Kimi K2 (Thinking mode) mode — #1 on SWE-rebench pass@1 (43.8%); K2.5: 37.9% |

## Hugging Face Resources

| Resource         | Model ID                      | Notes                                              |
| ---------------- | ----------------------------- | -------------------------------------------------- |
| Base model       | `moonshotai/Kimi-K2.5`        | Main instruction-tuned model, transformers ≥4.57.1 |
| Instruct variant | `moonshotai/Kimi-K2-Instruct` | API available at platform.moonshot.ai              |
| Quantized (GGUF) | `unsloth/Kimi-K2.5-GGUF`      | Unsloth Dynamic 2.0 quantization                   |
| Fine-tuned       | `unsloth/Kimi-K2.5`           | Unsloth fine-tuned version                         |

## Latest benchmark signals

| Signal                             | Value                                                        | Source                                  | Quality                        |
| ---------------------------------- | ------------------------------------------------------------ | --------------------------------------- | ------------------------------ |
| Open-source pass@1 leadership note | Kimi K2 (Thinking mode) reported as best pass@1 this month          | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |
| K2 Thinking vs K2.5                | 43.8% vs 37.9% on SWE-rebench metric                         | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |
| Deployment tradeoff note           | Better quality may come with different token/latency profile | [SWE-rebench](https://swe-rebench.com/) | Fetched, independent benchmark |

**SWE-bench columns:** "SWE-bench / Verified" refers to the original official SWE-Bench evaluation with verified runs and protocol. "SWE-rebench" are family-level or re-evaluation runs (possibly different prompt sets, metrics, or incomplete verification) that may yield different scores. Kimi K2 (Thinking mode) 65.8% is SWE-Bench Verified; Kimi K2 (Thinking mode) 43.8% and Kimi K2.5 37.9% are SWE-rebench results.

## Models tracked from PRD-002 (base + profiles)

| Base model | Environment     | Profile variants covered | Cost tier | Cost multiplier range | Tokens/problem | SWE-bench / Verified       | HLE           | SWE-rebench                                   | Aider         | Coding ability summary                                         | Decision Readiness | When to use                                                   | Source quality                      | Last verified |
| ---------- | --------------- | ------------------------ | --------- | --------------------: | -------------: | -------------------------- | ------------- | --------------------------------------------- | ------------- | -------------------------------------------------------------- | ------------------ | ------------------------------------------------------------- | ----------------------------------- | ------------- |
| Kimi K2    | Windsurf        | Kimi K2                  | Paid      |                   0.5 |  Not evaluated | Not evaluated              | Not evaluated | Family-level carryover from K2 Thinking notes | Not evaluated | Lower-cost Kimi branch for routine coding and multilingual use | Medium             | Cost-sensitive coding workloads with good baseline quality    | PRD-002 + independent family signal | 2026-02-26    |
| Kimi K2    | Windsurf        | Kimi K2 (Thinking mode)   | Paid      |                   1.0 |  Not evaluated | 65.8% (SWE-Bench Verified) | Not evaluated | 43.8% (SWE-rebench)                           | Not evaluated | Strong agentic coding; outperforms GPT-4.1; rivals Claude Opus | Medium             | Agentic workflows requiring multi-step reasoning and tool use | PRD-002 + Fireworks blog            | 2026-02-26    |
| Kimi K2.5  | Windsurf        | Kimi K2.5 (New)          | Paid      |                   1.0 |  Not evaluated | Not evaluated              | Not evaluated | 37.9% (family benchmark note)                 | Not evaluated | Newer Kimi branch with stronger general coding reliability     | Medium             | Balanced quality/cost coding where Kimi integration is stable | PRD-002 + independent family signal | 2026-02-26    |

## Operational notes

- Kimi currently shows a strong split between thinking and non-thinking modes.
- "Thinking" is a runtime mode/parameter of Kimi K2, not a separate model variant.
- Variant choice should be tied to time-to-solution and token budget limits.

## Guidance for model guides

1. Keep Kimi Thinking mode for quality-first budget tiers.
2. Keep base Kimi (non-Thinking) for lower-cost fallback tiers.
3. Track latency and token-use deltas before role-wide promotions.

## Data gaps to close

- Independent side-by-side Kimi runs on Aider polyglot and SWE-bench.
- Provider-level reliability and malformed output rates.
- Price-normalized quality comparisons against Minimax and GLM.
