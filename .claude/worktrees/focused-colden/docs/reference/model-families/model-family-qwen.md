# Model Family Dossier: Qwen

## Snapshot

- Last updated: 2026-02-26
- Scope: coding benchmark behavior for Qwen3 variants
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| **Provider**       | Alibaba Cloud (Hangzhou, China)                               |
| **Founded**        | 2023 (Qwen), 2009 (Alibaba Cloud)                             |
| **Architecture**   | Dense transformer + MoE                                       |
| **Latest model**   | Qwen3, Qwen2.5-Coder                                          |
| **Context window** | 128K-1M tokens                                                |
| **License**        | Open weights (Apache 2.0) + API                               |
| **Notable**        | Best open-source on SWE-rebench pass@5, extensive model sizes |

## Hugging Face Resources

| Resource           | Model ID                          | Notes                                                                        |
| ------------------ | --------------------------------- | ---------------------------------------------------------------------------- |
| Qwen3-32B          | `Qwen/Qwen3-32B`                  | 32B parameter model                                                          |
| Qwen3-32B Instruct | `Qwen/Qwen3-32B-Instruct`         | Instruction-tuned                                                            |
| Qwen3-235B-A22B    | `Qwen/Qwen3-235B-A22B`            | MoE, 235B total, 22B active                                                  |
| Qwen3-Coder-Next   | `N/A (leaderboard label)`         | Mentioned in SWE-rebench note; canonical HF ID not confirmed in this dossier |
| Qwen2.5-Coder      | `Qwen/Qwen2.5-Coder-32B-Instruct` | Code-specialized                                                             |
| Qwen2.5            | `Qwen/Qwen2.5-72B-Instruct`       | General purpose                                                              |
| Qwen2.5-VL         | `Qwen/Qwen2.5-VL-72B-Instruct`    | Vision variant                                                               |

> **Note:** Qwen (Alibaba) provides extensive open-weight models on Hugging Face. Qwen2.5-Coder is specifically optimized for code tasks.

## Latest benchmark signals (data date: 2025-05-08 — ~9–10 months old)

> **Note:** Newer benchmark data may not be available due to Aider/SWE-rebench publication cycles and access constraints. Updates are expected as new evaluations are published.

| Signal                                              | Value                                                             | Source                                                             | Quality                        |
| --------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| Qwen3-235B-A22B (VLLM, no_think, whole)             | Pass rate 2: 65.3% (225 tests)                                    | [Aider Qwen3 benchmarks](https://aider.chat/2025/05/08/qwen3.html) | Fetched, independent benchmark |
| Qwen3-235B-A22B (Alibaba API, no_think, whole)      | Pass rate 2: 61.8% (225 tests)                                    | [Aider Qwen3 benchmarks](https://aider.chat/2025/05/08/qwen3.html) | Fetched, independent benchmark |
| Qwen3-235B-A22B (OpenRouter default thinking, diff) | Pass rate 2: 49.8% (225 tests)                                    | [Aider Qwen3 benchmarks](https://aider.chat/2025/05/08/qwen3.html) | Fetched, independent benchmark |
| Qwen3-32B (VLLM, no_think, whole)                   | Pass rate 2: 45.8% (225 tests)                                    | [Aider Qwen3 benchmarks](https://aider.chat/2025/05/08/qwen3.html) | Fetched, independent benchmark |
| SWE-rebench note                                    | Qwen3-Coder-Next reported best pass@5 among OSS and top-2 overall | [SWE-rebench](https://swe-rebench.com/)                            | Fetched, independent benchmark |

## Operational notes

- Qwen results vary heavily by serving path and thinking mode.
- Recommended no_think settings often outperform default thinking routes in
  the published Aider runs.
- Cost and latency can still be attractive even when pass@2 is lower.

## Guidance for model guides

1. Do not treat one Qwen score as universal; pin the serving route and settings.
2. For budget tiers, evaluate Qwen with no_think presets before assigning ranks.
3. Track malformed response rates where diff format is used.

## Data gaps to close

- Add replicated runs for Qwen3.1/Next variants in our own harness.
- Capture provider-level reliability and timeout behavior.
- Add price-normalized pass@2 and pass@5 comparisons vs GLM and Kimi.
