# Model Family Dossier: MiniMax

## Snapshot

- Last updated: 2026-02-26
- Scope: coding and agentic workflow benchmark signals
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                               |
| ------------------ | ------------------------------------------------------------------- |
| **Provider**       | MiniMax (Shenzhen, China)                                           |
| **Founded**        | 2021                                                                |
| **Architecture**   | Dense transformer                                                   |
| **Latest model**   | MiniMax M2.5                                                        |
| **Context window** | 128K-200K tokens                                                    |
| **License**        | Proprietary (API) + open weights                                    |
| **Notable**        | ~$0.09/problem on SWE-rebench (cheapest), competitive with Opus 4.6 |

## Hugging Face Resources

| Resource | Model ID                 | Notes                |
| -------- | ------------------------ | -------------------- |
| M2.5     | `MiniMaxAI/MiniMax-M2.5` | Latest MiniMax model |
| M2.1     | `MiniMaxAI/MiniMax-M2.1` | Previous version     |
| M2       | `MiniMaxAI/MiniMax-M2`   | M2 base              |
| M1       | `MiniMaxAI/MiniMax-M1`   | M1 base              |

> **Note:** MiniMax is a Chinese AI company with strong coding benchmarks. Access via API (platform.minimax.io) or through third-party providers. The M2.5 model shows competitive coding performance at lower cost.

## Latest benchmark signals

| Signal                       | Value                                       | Source                                                                   | Quality                        |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| Droid harness comparison     | M2.5: 79.7 vs Opus 4.6: 78.9                | [MiniMax M2.5 model card](https://huggingface.co/MiniMaxAI/MiniMax-M2.5) | Fetched, vendor claim          |
| OpenCode harness comparison  | M2.5: 76.1 vs Opus 4.6: 75.9                | [MiniMax M2.5 model card](https://huggingface.co/MiniMaxAI/MiniMax-M2.5) | Fetched, vendor claim          |
| SWE-Bench runtime efficiency | 22.8 min vs 31.3 min (M2.1), ~37% faster    | [MiniMax M2.5 model card](https://huggingface.co/MiniMaxAI/MiniMax-M2.5) | Fetched, vendor claim          |
| SWE-Bench token usage        | 3.52M tokens/task vs 3.72M (M2.1)           | [MiniMax M2.5 model card](https://huggingface.co/MiniMaxAI/MiniMax-M2.5) | Fetched, vendor claim          |
| SWE-rebench note             | MiniMax M2.5 reported at ~$0.09 per problem | [SWE-rebench](https://swe-rebench.com/)                                  | Fetched, independent benchmark |

## Models tracked from PRD-002 (base + profiles)

| Base model   | Environment     | Profile variants covered | Cost tier | Cost multiplier range |    Tokens/problem | SWE-bench / Verified                                          | HLE           | SWE-rebench        | Aider         | Coding ability summary                 | Decision Readiness | When to use             | Source quality         | Last verified |
| ------------ | --------------- | ------------------------ | --------- | --------------------: | ----------------: | ------------------------------------------------------------- | ------------- | ------------------ | ------------- | -------------------------------------- | ------------------ | ----------------------- | ---------------------- | ------------- |
| MiniMax M2.5 | Windsurf/Intake | MiniMax M2.5             | Paid      |                   0.5 | 3.52M tokens/task | Not SWE-bench verified (Droid: 79.7; OpenCode: 76.1 external) | Not evaluated | Not evaluated      | Not evaluated | Droid: 79.7; OpenCode: 76.1 (external) | Medium             | Real-world productivity | PRD-002 + MiniMax blog | 2026-02-26    |
| MiniMax M2.5 | Windsurf        | MiniMax M2.5 (New)       | Paid      |                  0.25 | 3.52M tokens/task | Vendor signals                                                | Not evaluated | Cost note (~$0.09) | Not evaluated | Strong cost-performance                | Medium             | High-volume coding      | Vendor + independent   | 2026-02-26    |

## Operational notes

- MiniMax claims strong coding performance with much lower operating cost than
  top-tier proprietary models.
- Most detailed numbers available today are vendor-reported, so ranking changes
  should wait for independent replication in our harness.

## Guidance for model guides

1. Keep MiniMax in cost-aware tiers for high-volume coding agents.
2. Validate quality deltas in our repos before promoting to top tiers.
3. Track latency and token-per-task, not just pass rates.

## Data gaps to close

- Independent SWE-bench and Aider runs with published harness config.
- Error mode analysis (malformed edits, timeout rates) by provider.
- Stability checks across long, multi-turn agent sessions.
