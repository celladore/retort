# Model Family Dossier: Claude (Anthropic)

## Snapshot

- Last updated: 2026-02-26
- Scope: benchmark signals relevant to coding and agentic workflows
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                            |
| ------------------ | ------------------------------------------------ |
| **Provider**       | Anthropic (San Francisco, USA)                   |
| **Founded**        | 2021                                             |
| **Architecture**   | Dense transformer (not MoE)                      |
| **Latest model**   | Claude Opus 4.6                                  |
| **Context window** | 200K tokens (1M beta for Opus)                   |
| **Output limit**   | 128K tokens                                      |
| **License**        | Proprietary (API only)                           |
| **Notable**        | First with native MCP support, 1M context leader |

## Hugging Face Resources

| Resource            | Model ID                                                     | Notes                         |
| ------------------- | ------------------------------------------------------------ | ----------------------------- |
| Distilled (Opus)    | `TeichAI/claude-45-opus` collection                          | Distilled models and datasets |
| Distilled (Sonnet)  | `TeichAI/claude-45-sonnet` collection                        | Distilled models and datasets |
| Distilled reasoning | `TeichAI/Qwen3-14B-Claude-Sonnet-4.5-Reasoning-Distill-GGUF` | Qwen-based distillation       |

> **Note:** Anthropic does not publish official Claude models on Hugging Face. The above are community-distilled variants. For production use, access via Anthropic API.

## Latest benchmark signals

| Signal                 | Value                                                                        | Source                                                               | Quality                        |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| MRCR v2 (8-needle, 1M) | Opus 4.6: 76%; Claude Sonnet v4.5: 18.5%                                    | [Anthropic Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) | Fetched, vendor claim          |
| SWE-bench Verified     | Averaged over 25 trials; 81.42% with prompt modification                     | [Anthropic Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) | Fetched, vendor claim          |
| MCP Atlas              | 62.7% at high effort                                                         | [Anthropic Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) | Fetched, vendor claim          |
| BrowseComp             | 86.8% with multi-agent harness                                               | [Anthropic Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6) | Fetched, vendor claim          |
| SWE-rebench status     | Claude Opus 4.6 reported at #1; Claude Sonnet v4.5 (code-specialized) best pass@5 | [SWE-rebench](https://swe-rebench.com/)                              | Fetched, independent benchmark |

> **Note:** Anthropic uses "Claude Sonnet v4.5" / "Sonnet 4.5" for the same model; internal naming may differ from vendor marketing.

## Models tracked from PRD-002 (base + profiles)

| Base model        | Environment      | Profile variants covered | Cost tier            | Cost multiplier range | Tokens/problem | SWE-bench / Verified                       | HLE           | SWE-rebench                            | Aider         | Coding ability summary                                       | Decision Readiness | When to use                                                  | Source quality               | Last verified |
| ----------------- | ---------------- | ------------------------ | -------------------- | --------------------: | -------------: | ------------------------------------------ | ------------- | -------------------------------------- | ------------- | ------------------------------------------------------------ | ------------------ | ------------------------------------------------------------ | ---------------------------- | ------------- |
| Claude Opus 4.6   | Cursor, Windsurf | Opus 4.6                 | Paid (cost not evaluated) |         Not evaluated |  Not evaluated | 81.42% (25-trial average, prompt-modified) | Not evaluated | #1 reported on SWE-rebench news stream | Not evaluated | Highest-confidence Claude line for deep coding reasoning     | Medium             | Complex refactoring, architecture, deep reasoning            | Vendor + independent mix     | 2026-02-26    |
| Claude 3.5 Sonnet | Windsurf/Intake  | Claude 3.5 Sonnet        | Paid                 |                   2.0 |  Not evaluated | 49.0% (SWE-bench Verified)                 | Not evaluated | Not evaluated                          | Not evaluated | State-of-the-art coding; beats previous SOTA; strong agentic | High               | Production coding where quality and reliability are critical | PRD-002 + Anthropic research | 2026-02-26    |

## Operational notes

- Anthropic also states Opus 4.6 supports 1M context (beta), up to 128k output,
  and pricing uplift beyond 200k prompt tokens.
- Most hard numbers above are vendor-reported and should be cross-checked
  against independent leaderboards before changing default routing.

## Guidance for model guides

1. Keep Claude in top tiers for high-context, high-reliability tasks.
2. For cost-sensitive flows, prefer Sonnet or alternate families until
   independent cost/performance checks are refreshed.
3. Track effort mode assumptions (high vs max) because benchmark outcomes can
   shift meaningfully with effort settings.

## Data gaps to close

- Independent MRCR-like long-context replication in our harness.
- Side-by-side cost-per-success vs GPT, Gemini, and Minimax in our repos.
- Stability under long agent runs with context compaction enabled.
