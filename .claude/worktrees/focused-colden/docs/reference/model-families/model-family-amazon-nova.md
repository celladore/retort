# Model Family Dossier: Amazon Nova

## Snapshot

- Last updated: 2026-02-26
- Scope: Nova family signals relevant to AWS-first deployments
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                  |
| ------------------ | ------------------------------------------------------ |
| **Provider**       | Amazon Web Services (Seattle, USA)                     |
| **Founded**        | 2006 (AWS), 2024 (Nova)                                |
| **Architecture**   | Dense transformer                                      |
| **Latest model**   | Nova Premier, Pro, Lite, Micro                         |
| **Context window** | 1M tokens (Nova Premier); 300K tokens (Nova Lite, Pro) |
| **License**        | Proprietary (AWS Bedrock only)                         |
| **Notable**        | AWS-native, GovCloud support, cheapest Bedrock pricing |

## Hugging Face Resources

| Resource          | Model ID                                  | Notes                    |
| ----------------- | ----------------------------------------- | ------------------------ |
| Organization      | `amazon`                                  | Official AWS Amazon org  |
| AGI research      | `amazon-agi`                              | Amazon AGI research team |
| Nova Canvas evals | `amazon-agi/Amazon-Nova-1.0-Canvas-evals` | Evaluation datasets      |

> **Note:** Amazon Nova models are primarily accessed via AWS Bedrock, not direct Hugging Face inference. The org pages provide research context and eval data.

## Latest benchmark signals

| Signal                   | Value                                                                                     | Source                                                                                      | Quality               |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------- |
| Family categories        | Nova is grouped into understanding, creative, and speech model categories                 | [Amazon Nova overview](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html) | Fetched, vendor claim |
| Understanding lineup     | Nova Premier, Pro, Lite, and Micro are documented for multimodal/text understanding tasks | [Amazon Nova overview](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html) | Fetched, vendor claim |
| Use-case positioning     | AWS lists RAG systems and agentic applications across Nova understanding models           | [Amazon Nova overview](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html) | Fetched, vendor claim |
| Region/governance signal | Regional availability and GovCloud support are explicitly documented                      | [Amazon Nova overview](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html) | Fetched, vendor claim |

## Models tracked from PRD-002 (base + profiles)

| Base model | Environment     | Profile variants covered | Cost tier | Cost multiplier range | Tokens/problem | SWE-bench / Verified | HLE           | SWE-rebench   | Aider         | Coding ability summary                                                                                                | Decision Readiness | When to use                                              | Source quality                | Last verified |
| ---------- | --------------- | ------------------------ | --------- | --------------------: | -------------: | -------------------- | ------------- | ------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------- | ----------------------------- | ------------- |
| Nova Pro   | Windsurf/Intake | Nova Pro                 | Paid      |                   1.0 |  Not evaluated | Not evaluated        | Not evaluated | Not evaluated | Not evaluated | Lower-end intelligence (AA Index: 13 — measures coding ability on 0–100 scale); well-priced; multimodal; 300K context | Medium             | Cost-conscious apps needing large context and multimodal | PRD-002 + Artificial Analysis | 2026-02-26    |

## Operational notes

- Nova should be assessed as a strategic option in AWS-heavy environments.
- Independent coding benchmark evidence is not yet captured in this repo.

## Guidance for model guides

1. Add Nova as intake rows where AWS governance and regional controls matter.
2. Hold weighted ranking changes until independent coding evals are available.
3. Validate cost/latency in target Bedrock regions and quotas.

## Data gaps to close

- Independent coding benchmark runs for Nova understanding models.
- Cost-per-success comparisons against OpenAI/Claude/Gemini in AWS contexts.
- Reliability and throughput in long-running agent pipelines.
