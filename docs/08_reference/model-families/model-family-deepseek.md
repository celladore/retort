# Model Family Dossier: DeepSeek

## Snapshot

- Last updated: 2026-02-26
- Scope: DeepSeek API model modes and coding-agent capability signals
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                               |
| ------------------ | ------------------------------------------------------------------- |
| **Provider**       | DeepSeek AI (Hangzhou, China)                                       |
| **Founded**        | 2023                                                                |
| **Architecture**   | MoE (Mixture of Experts)                                            |
| **Latest model**   | DeepSeek V3.2                                                       |
| **Context window** | 64K-128K tokens                                                     |
| **License**        | Open weights (MIT/Apache) + API                                     |
| **Notable**        | Open-source breakthrough, ~$6M training cost, strong reasoning capabilities |

R1 corresponds to the tracked model ID `deepseek-reasoner` (DeepSeek reasoning-family). It is not a separate external project and is tracked as part of the broader DeepSeek model line.

**Versioning Note:** "DeepSeek V3.2" represents the semantic release version for production use, while "DeepSeek-V3-0324" is a dated snapshot tag for reproducibility. V3.2 is the canonical current release.

## Hugging Face Resources

| Resource        | Model ID                             | Notes                               |
| --------------- | ------------------------------------ | ----------------------------------- |
| Base model      | `deepseek-ai/DeepSeek-V3`            | Original V3 release, 2024-12-27     |
| Updated base    | `deepseek-ai/DeepSeek-V3.1`          | Improved tool calling and reasoning |
| Latest snapshot | `deepseek-ai/DeepSeek-V3-0324`       | Function calling, JSON output, FIM  |
| Speciale        | `deepseek-ai/DeepSeek-V3.2-Speciale` | Enhanced reasoning variant          |

> **Note:** Transformers direct support is limited. Use inference folder with custom requirements.

## Latest benchmark signals

| Signal            | Value                                                          | Source                                                                 | Quality               |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| API model mapping | `deepseek-chat` = non-thinking mode of DeepSeek-V3.2           | [DeepSeek API quick start](https://api-docs.deepseek.com/)             | Fetched, vendor claim |
| API model mapping | `deepseek-reasoner` = thinking mode of DeepSeek-V3.2           | [DeepSeek API quick start](https://api-docs.deepseek.com/)             | Fetched, vendor claim |
| Context limit     | DeepSeek-V3.2 API modes listed with 128K context limit         | [DeepSeek API quick start](https://api-docs.deepseek.com/)             | Fetched, vendor claim |
| Tool-use behavior | Standard V3.2: supports tool use in thinking and non-thinking modes; DeepSeek-V3.2-Speciale: does not support tool-calling | [DeepSeek V3.2 release](https://api-docs.deepseek.com/news/news251201) | Fetched, vendor claim |
| Release coverage  | V3.2 and V3.2-Speciale documented as current release line      | [DeepSeek V3.2 release](https://api-docs.deepseek.com/news/news251201) | Fetched, vendor claim |

## Models tracked from PRD-002 (base + profiles)

| Base model    | Environment     | Profile variants covered             | Cost tier     | Cost multiplier range |                                                       Tokens/problem | SWE-bench / Verified | HLE           | SWE-rebench                                         | Aider         | Coding ability summary                                                | Decision Readiness | When to use                                                    | Source quality                 | Last verified |
| ------------- | --------------- | ------------------------------------ | ------------- | --------------------: | -------------------------------------------------------------------: | -------------------- | ------------- | --------------------------------------------------- | ------------- | --------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------- | ------------------------------ | ------------- |
| DeepSeek V3.2 | Windsurf/Intake | `deepseek-chat`, `deepseek-reasoner` | Not evaluated |         Not evaluated | Highest tokens/problem across evaluated models (leaderboard insight) | Not evaluated        | Not evaluated | SOTA among open-weight models (leaderboard insight) | Not evaluated | Tracked as chat/reasoner split with strong open-weight coding signals | Medium             | Cost/quality experiments where open-weight SOTA signal matters | PRD-002 + vendor + SWE-rebench | 2026-02-26    |

## Operational notes

- Current evidence in this dossier is vendor documentation.
- We do not yet have independent Aider or SWE-bench replication data in this
  repo for DeepSeek entries.

## Guidance for model guides

1. Add DeepSeek as intake rows only until independent benchmark coverage is
   captured.
2. Use `deepseek-chat` for non-thinking cost/speed paths and
   `deepseek-reasoner` for reasoning-heavy tasks.
3. Keep pricing, latency, and reliability assumptions as TBD until validated.

## Data gaps to close

- Independent coding benchmark results (Aider polyglot and SWE-bench harness).
- Verified API pricing snapshots and normalized cost multipliers.
- Internal pass/fail and latency telemetry across representative repos.
