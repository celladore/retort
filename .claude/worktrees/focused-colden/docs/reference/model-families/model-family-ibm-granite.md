# Model Family Dossier: IBM Granite

## Snapshot

- Last updated: 2026-02-26
- Scope: Granite 4.0 language model signals for enterprise/governance contexts
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                               |
| ------------------ | ------------------------------------------------------------------- |
| **Provider**       | IBM (Armonk, USA)                                                   |
| **Founded**        | 1911 (IBM), 2023 (Granite)                                          |
| **Architecture**   | Hybrid Mamba/transformer (Mamba-2/transformer)                      |
| **Latest model**   | Granite 4.0                                                         |
| **Context window** | 128K tokens                                                         |
| **License**        | Apache 2.0 (open weights)                                           |
| **Notable**        | Enterprise GRC focus, IBM watsonx platform, US government compliant |

## Hugging Face Resources

| Resource          | Model ID                              | Notes                     |
| ----------------- | ------------------------------------- | ------------------------- |
| Granite 4.0 base  | `ibm-granite/granite-4.0-h-350m`      | 350M parameter base model |
| Granite 4.0 micro | `ibm-granite/granite-4.0-micro`       | Lightweight variant       |
| Granite 4.0 GGUF  | `ibm-granite/granite-4.0-h-350m-GGUF` | Quantized versions        |
| Organization      | `ibm-granite`                         | Official IBM Granite org  |

## Latest benchmark signals

| Signal                 | Value                                                                                                                  | Source                                                                               | Quality               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------- |
| Capability scope       | Granite 4.0 is described as multilingual with coding, FIM (Fill-In-the-Middle), RAG, tool use, and JSON output support | [Granite 4.0 repository](https://github.com/ibm-granite/granite-4.0-language-models) | Fetched, vendor claim |
| Enterprise alignment   | IBM describes GRC (Governance, Risk, and Compliance)-oriented data curation and enterprise deployment focus            | [Granite 4.0 repository](https://github.com/ibm-granite/granite-4.0-language-models) | Fetched, vendor claim |
| Licensing posture      | Granite 4.0 models are documented under Apache 2.0 license                                                             | [Granite 4.0 repository](https://github.com/ibm-granite/granite-4.0-language-models) | Fetched, vendor claim |
| Agent readiness signal | Repository includes tool-calling examples for AI agents                                                                | [Granite 4.0 repository](https://github.com/ibm-granite/granite-4.0-language-models) | Fetched, vendor claim |

## Models tracked from PRD-002 (base + profiles)

| Base model   | Environment     | Profile variants covered                               | Cost tier | Cost multiplier range | Tokens/problem | SWE-bench / Verified | HLE           | SWE-rebench   | Aider         | Coding ability summary                                    | Decision Readiness | When to use                                                | Source quality       | Last verified |
| ------------ | --------------- | ------------------------------------------------------ | --------- | --------------------: | -------------: | -------------------- | ------------- | ------------- | ------------- | --------------------------------------------------------- | ------------------ | ---------------------------------------------------------- | -------------------- | ------------- |
| Granite Code | Windsurf/Intake | Granite Code (code-specialized variant of Granite 4.0) | Paid      |                   0.5 |  Not evaluated | Not evaluated        | Not evaluated | Not evaluated | Not evaluated | Enterprise-grade open code LLM; 116 languages; Apache 2.0 | Medium             | Enterprise code tasks requiring license-permissible models | PRD-002 + IBM GitHub | 2026-02-26    |

## Operational notes

- Granite Code is a code-specialized variant of Granite 4.0; model IDs: `ibm-granite/granite-code-*` in Hugging Face. See IBM Granite model cards for HF IDs.
- Granite is a relevant family for regulated and on-prem enterprise scenarios.
- This pass collected feature evidence, but not independent benchmark values.

## Guidance for model guides

1. Add Granite as intake rows for compliance-sensitive and on-prem pathways.
2. Keep ranked tiers unchanged until independent coding benchmark replication.
3. Validate tool-calling behavior and JSON/FIM quality in your harness.

## Data gaps to close

- Independent coding benchmark results for Granite instruct variants.
- Normalized latency and cost across hosting providers.
- Reliability in long-context, tool-heavy agent workloads.
