# Model Family Dossier: GLM

## Snapshot

- Last updated: 2026-02-26
- Scope: benchmark signals for GLM-4.7 and GLM-5 in coding contexts
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| **Provider**       | Zhipu AI /智谱AI (Beijing, China)                            |
| **Founded**        | 2019                                                         |
| **Architecture**   | Dense transformer                                            |
| **Latest model**   | GLM-5, GLM-4.7                                               |
| **Context window** | 128K-1M tokens                                               |
| **License**        | Open weights + proprietary API                               |
| **Notable**        | #1 OSS on tokens/problem (SWE-rebench), cheapest API pricing |

## Hugging Face Resources

| Resource    | Model ID              | Notes               |
| ----------- | --------------------- | ------------------- |
| GLM-4       | `THUDM/glm-4-9b-chat` | GLM-4 9B chat model |
| GLM-4V      | `THUDM/glm-4v-9b`     | Vision variant      |
| GLM-4V Plus | `THUDM/glm-4v-plus`   | Enhanced vision     |
| GLM-4 Flash | `THUDM/glm-4-flash`   | Fast variant        |
| ChatGLM3    | `THUDM/chatglm3-6b`   | ChatGLM3 6B         |

> **Note:** GLM models are from Zhipu AI (Chinese startup). Access via API at open.bigmodel.cn or through third-party providers. Open-weight variants available on Hugging Face.

## Latest benchmark signals

| Signal                         | Value                                                   | Source                                                                          | Quality                        |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| Open-source leaderboard status | GLM-5 listed as minimum tokens/problem in current month (tokens per benchmark problem; distinct from aggregated tokens/task) | [SWE-rebench](https://swe-rebench.com/)                                         | Fetched, independent benchmark |
| Open-source ranking note       | GLM-4.7 described as strongest OSS model on leaderboard | [SWE-rebench](https://swe-rebench.com/)                                         | Fetched, independent benchmark |
| Throughput/latency snapshot    | GLM-5 summary cites 61.2 t/s and 1.37s TTFT             | [Artificial Analysis model summary](https://artificialanalysis.ai/models/glm-5) | Search snippet only            |

## Models tracked from PRD-002 (base + profiles)

| Base model | Environment     | Profile variants covered | Cost tier | Cost multiplier range | Tokens/task (aggregated)        | SWE-bench / Verified | HLE           | SWE-rebench                                                           | Aider         | Coding ability summary                                                      | Decision Readiness | When to use                                                       | Source quality                    | Last verified |
| ---------- | --------------- | ------------------------ | --------- | --------------------: | ------------------------------: | -------------------- | ------------- | --------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- | --------------------------------- | ------------- |
| GLM-5      | Windsurf        | GLM-5                    | Paid      |                  0.75 | 3.52M tokens/task (SWE-rebench, aggregated per task) | Not evaluated        | Not evaluated | Leaderboard token-efficiency + rank notes                             | Not evaluated | High token-efficiency open-family candidate for coding                      | Medium             | Cost-sensitive and multilingual coding workloads                  | Independent leaderboard + PRD-002 | 2026-02-26    |
| GLM-5      | Windsurf/Intake | GLM-5 (base)             | Paid      |                   1.5 |                   Not evaluated | Not evaluated        | Not evaluated | Best-in-class among open-source on reasoning/coding/agentic (HF card) | Not evaluated | Scales to 744B parameters (40B active) with DSA (Dynamic Sparse Attention); strong agentic performance | Medium             | Cost-aware open-weight SOTA for complex systems and agentic tasks | PRD-002 + HuggingFace card        | 2026-02-26    |
| GLM-4.7    | Windsurf        | GLM-4.7 (Beta)           | Paid      |                  0.25 |                   Not evaluated | Not evaluated        | Not evaluated | Family-level carryover from GLM leaderboard notes                     | Not evaluated | Lower-cost GLM intake row pending full benchmark coverage                   | Low                | Intake evaluation where very low multiplier is desired            | PRD-002 matrix + family signals   | 2026-02-26    |

**Maintenance:** Review cadence: monthly. Owner: Platform/QA Leads. Action: update benchmarks and Last verified. See Pending Benchmark Annex for automated reminder/issue template reference.

## Operational notes

- GLM appears strong on efficiency-oriented coding benchmarks in independent
  leaderboard commentary.

## Guidance for model guides

1. Keep GLM models in cost-aware and multilingual candidate tiers.
2. Prefer GLM for scenarios where token efficiency is a top objective.
3. Do not raise GLM to top tier without direct benchmark table ingestion.

## Data gaps to close

- Direct pull of GLM model cards and benchmark tables.
- Independent replication of GLM-5 coding pass rates in our harness.
- Regional provider quality and reliability comparison (APAC vs global).
