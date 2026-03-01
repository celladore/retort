# Model Family Dossier: OpenAI (GPT/Codex)

## Snapshot

- Last updated: 2026-02-26
- Scope: coding and agentic benchmark signals for GPT/Codex family
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider**       | OpenAI (San Francisco, USA)                                                                                                            |
| **Founded**        | 2015                                                                                                                                   |
| **Architecture**   | Dense transformer + MoE variants                                                                                                       |
| **Latest model**   | GPT-5.2 Codex                                                                                                                          |
| **Context window** | 128K-200K tokens                                                                                                                       |
| **Output limit**   | 100K tokens                                                                                                                            |
| **License**        | Proprietary (API only)                                                                                                                 |
| **Notable**        | Led development of the GPT series and Codex (transformer architecture introduced by Vaswani et al., 2017); Codex powers GitHub Copilot |

## Hugging Face Resources

| Resource        | Model ID                  | Notes                                   |
| --------------- | ------------------------- | --------------------------------------- |
| Distilled GPT-4 | Various community uploads | Multiple quantized variants             |
| Codex via API   | N/A                       | Access via OpenAI API (`gpt-5.2-codex`) |

> **Note:** OpenAI does not publish official model weights on Hugging Face. Access GPT and Codex models via OpenAI API. Community distilled versions exist but are not official.

## Latest benchmark signals

| Signal                                           | Value                                                                   | Source                                                                                    | Quality                             |
| ------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| Aider polyglot (GPT-5.2 Codex, high config)      | Pass rate 1: 52.0; Pass rate 2: 88.0 on 225 cases                       | [Aider leaderboard](https://aider.chat/docs/leaderboards/)                                | Fetched, independent benchmark      |
| Aider run cost/time (GPT-5.2 Codex, high config) | Total cost: 29.0829; seconds per case: 194.0                            | [Aider leaderboard](https://aider.chat/docs/leaderboards/)                                | Fetched, independent benchmark      |
| SWE-rebench efficiency note                      | GPT-5.2 Codex called out as very token-efficient                        | [SWE-rebench](https://swe-rebench.com/)                                                   | Fetched, independent benchmark      |
| OpenAI launch claim (GPT-5 family)               | GPT-5 reported at 74.9% on SWE-bench Verified and 88% on Aider polyglot | [OpenAI GPT-5 for developers](https://openai.com/index/introducing-gpt-5-for-developers/) | Search snippet (page fetch blocked) |

## Models tracked from PRD-002 (base + profiles)

| Base model    | Environment      | Profile variants covered                                                                                                                               | Cost tier            | Cost multiplier range |                      Tokens/problem | SWE-bench / Verified              | HLE           | SWE-rebench                                              | Aider                                  | Coding ability summary                                          | Decision Readiness | When to use                                                               | Source quality                  | Last verified |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | --------------------: | ----------------------------------: | --------------------------------- | ------------- | -------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- | ------------------------------- | ------------- |
| GPT-5.1       | Windsurf         | GPT-5.1; Fast; High Thinking; High Thinking Fast; Low Thinking; Low Thinking Fast; Medium Thinking Fast                                                | Free/Paid            |               0.0-4.0 |                       Not evaluated | Not evaluated                     | Not evaluated | Not evaluated                                            | Not evaluated                          | Broad configurable profile line for coding and reasoning modes  | Medium             | Day-to-day coding where profile tuning (speed vs reasoning) is important  | PRD-002 matrix + family signals | 2026-02-26    |
| GPT-5.1 Codex | Windsurf         | GPT-5.1-Codex; Low; Max High; Max Medium; Max Low; Codex-Mini; Codex-Mini Low                                                                          | Free/Paid            |               0.0-1.0 |                       Not evaluated | Not evaluated                     | Not evaluated | Not evaluated                                            | Not evaluated                          | Lower-cost Codex-aligned coding branch                          | Medium             | Codex-style coding tasks with tighter budget constraints                  | PRD-002 matrix                  | 2026-02-26    |
| GPT-5.2       | Cursor, Windsurf | GPT-5.2 (Cursor); GPT-5.2; Fast; Low/Medium/High/XHigh Thinking; Low/Medium/High/XHigh Thinking Fast; Codex Low/Medium/High/XHigh; Codex Fast profiles | Paid / Not evaluated |              1.0-16.0 | ~23.6k/case (Aider high-config run) | Family claim: 74.9%* | Not evaluated | Token-efficiency callout for `gpt-5.2-codex`             | Pass@2 = 88.0 (high config run)        | Strong coding + reasoning branch with extensive profile options | Medium             | Agentic coding, tool use, long-running terminal/file workflows            | Mixed (vendor + independent)    | 2026-02-26    |
| GPT-5.3 Codex | Cursor, Windsurf | GPT-5.3 Codex (Cursor); Extra High; Spark; Spark Extra High; Windsurf Codex Low/Medium/High/X-High and Fast variants                                   | Paid / Not evaluated |               1.5-8.0 |                       Not evaluated | Family claim: 74.9%* | Not evaluated | Family-level carryover from GPT-5.2/5.3 Codex line       | Family-level carryover from Codex line | Premium/newer Codex line optimized for agentic coding workflows | Medium             | High-performance coding tasks where premium Codex profiles are acceptable | Mixed (vendor + independent)    | 2026-02-26    |
| GPT-5 Codex   | Windsurf         | GPT-5-Codex                                                                                                                                            | Paid                 |                   0.5 |                       Not evaluated | Not evaluated                     | Not evaluated | Not evaluated                                            | Not evaluated                          | Entry Codex profile in Windsurf model list                      | Low                | Budget-favoring Codex usage in Windsurf                                   | PRD-002 matrix                  | 2026-02-26    |
| o3            | Windsurf         | o3; o3 High Reasoning                                                                                                                                  | Paid                 |                   1.0 |     ~23.1k/case (Aider o3 high run) | Not evaluated                     | Not evaluated | Not evaluated                                            | Pass@2 = 81.3 (o3 high run)            | Reasoning-focused low-cost branch in current Windsurf matrix    | Medium             | Cost-aware reasoning tasks and routine debugging                          | Aider + PRD-002                 | 2026-02-26    |
| GPT-OSS 120B  | Windsurf         | GPT-OSS 120B Medium Thinking                                                                                                                           | Paid                 |                  0.25 |                       Not evaluated | Not evaluated                     | Not evaluated | High-effort mode reported to nearly double resolved rate | Not evaluated                          | Open-weight-style GPT branch in Windsurf intake rows            | Medium             | Controlled OSS-oriented evaluation where low multiplier is prioritized    | SWE-rebench insight + PRD-002   | 2026-02-26    |

## Operational notes

- OpenAI pages were not directly retrievable from this environment (HTTP
  forbidden), so official numbers from OpenAI are currently from search
  snippets only.
- The 74.9% GPT-5 family figure (*) is not model-specific, is from a blocked vendor page, and may not reflect individual variant performance. Prioritize independent, model-specific benchmarks when available.
- Independent Aider metrics are available and should be weighted higher than
  unverified vendor launch claims.
- Naming in this dossier: `GPT-5.2 Codex` refers to the coding-optimized GPT-5
  variant. `GPT-5 family` refers to broader vendor launch benchmarks.

## Guidance for model guides

1. Keep GPT/Codex in high tiers for coding-heavy teams where pass@2 and
   tool-usage quality matter most.
2. Use cost controls for high-effort variants due to the potentially large run cost.
3. Prefer Codex variants when agentic tool calls dominate the workflow.

## Data gaps to close

- Pull official OpenAI benchmark tables directly when access permits.
- Add SWE-bench Verified values from an independently replicated harness.
- Build cost-per-accepted-change metric from internal CI telemetry.
