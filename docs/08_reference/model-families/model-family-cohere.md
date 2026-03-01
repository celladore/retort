# Model Family Dossier: Cohere (Command)

## Snapshot

- Last updated: 2026-02-26
- Scope: Cohere Command family for enterprise and RAG-heavy workloads
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Provider**       | Cohere (Toronto, Canada)                                        |
| **Founded**        | 2019                                                            |
| **Architecture**   | Dense transformer                                               |
| **Latest model**   | Command A (March 2025 release)                                  |
| **Context window** | 128K tokens                                                     |
| **License**        | Proprietary (API) + open weights                                |
| **Notable**        | Enterprise RAG specialist, strong embeddings (embed-english-v3) |

## Hugging Face Resources

| Resource     | Model ID                              | Notes                      |
| ------------ | ------------------------------------- | -------------------------- |
| Command R    | `CohereLabs/c4ai-command-r`           | 35B parameter model        |
| Command R+   | `CohereLabs/c4ai-command-r-plus`      | Enhanced reasoning variant |
| Command R7B  | `CohereLabs/c4ai-command-r7b-12-2024` | December 2024 release      |
| Embed models | `CohereLabs/embed-english-v3`         | Text embedding models      |

> **Note:** Cohere provides both API access and select open-weight models on Hugging Face. Enterprise features require API access.

## Latest benchmark signals

| Signal             | Value                                                                                                         | Source                                                        | Quality               |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------- |
| Family composition | Command family includes Command A, Command R7B, Command A Reasoning, Command A Vision, and Command R variants | [Cohere models overview](https://docs.cohere.com/docs/models) | Fetched, vendor claim |
| Primary use cases  | Cohere positions Command models for tool-using agents, RAG, and translation                                   | [Cohere models overview](https://docs.cohere.com/docs/models) | Fetched, vendor claim |
| API entry point    | Command models are served through Cohere Chat endpoint                                                        | [Cohere models overview](https://docs.cohere.com/docs/models) | Fetched, vendor claim |
| Platform coverage  | Docs include platform mapping for Bedrock/SageMaker naming and usage                                          | [Cohere models overview](https://docs.cohere.com/docs/models) | Fetched, vendor claim |

## Models tracked from PRD-002 (base + profiles)

| Base model | Environment     | Profile variants covered | Cost tier | Cost multiplier range | Tokens/problem | SWE-bench / Verified | HLE           | SWE-rebench   | Aider         | Coding ability summary                                  | Decision Readiness | When to use                                        | Source quality            | Last verified |
| ---------- | --------------- | ------------------------ | --------- | --------------------: | -------------: | -------------------- | ------------- | ------------- | ------------- | ------------------------------------------------------- | ------------------ | -------------------------------------------------- | ------------------------- | ------------- |
| Command A  | Windsurf/Intake | Command A                | Paid      |                   1.0 |  Not evaluated | Not evaluated        | Not evaluated | Not evaluated | Not evaluated | Enterprise-ready LLM with RAG and tool use capabilities | Medium             | Enterprise applications requiring RAG and tool use | PRD-002 + Cohere research | 2026-02-26    |

## Operational notes

- Cohere has strong enterprise-oriented positioning for RAG and agent workflows.
- Independent benchmark measurements are needed before weighted ranking updates.

## Guidance for model guides

1. Add Cohere Command as intake for enterprise-RAG and compatibility analysis.
2. Keep scored tiers unchanged pending independent coding benchmark evidence.
3. Validate provider-specific behavior when deployed through Bedrock/SageMaker.

## Data gaps to close

- Independent coding benchmark scores for current Command releases.
- Cross-platform latency and cost normalization.
- Reliability and tool-call correctness in long agent sessions.
