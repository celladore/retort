# Model Family Dossier: Meta Llama (3.x / 4)

## Snapshot

- Last updated: 2026-02-26
- Scope: Llama 4 open-weight baseline signals for self-hosted decisions
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| **Provider**       | Meta AI (Menlo Park, USA)                                |
| **Founded**        | 2023 (Llama), 2013 (Meta AI)                             |
| **Architecture**   | Dense transformer + MoE (Llama 4)                        |
| **Latest model**   | Llama 4 Scout                                            |
| **Context window** | 128K tokens                                              |
| **License**        | Llama Community License (commercial ok)                  |
| **Notable**        | One of the most downloaded models; contributed to growth of open-source adoption |

## Hugging Face Resources

| Resource               | Model ID                                      | Notes                                    |
| ---------------------- | --------------------------------------------- | ---------------------------------------- |
| Llama 4 Scout          | `meta-llama/Llama-4-Scout-17B-16E`            | MoE architecture, 17B active, 16 experts |
| Llama 4 Scout Instruct | `meta-llama/Llama-4-Scout-17B-16E-Instruct`   | Instruction-tuned variant                |
| Llama 4 Scout FP8      | `nvidia/Llama-4-Scout-17B-16E-Instruct-FP8`   | NVIDIA quantized version                 |
| Llama 4 Scout GGUF     | `unsloth/Llama-4-Scout-17B-16E-Instruct-GGUF` | Unsloth quantized version                |
| Llama 4 collection     | `meta-llama/llama-4`                          | Official collection hub                  |

## Latest benchmark signals

| Signal                 | Value                                                                               | Source                                                                              | Quality               |
| ---------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| Open model stance      | Llama 4 is positioned for commercial and research use under Llama Community License | [Llama 4 Scout model card](https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E) | Fetched, vendor claim |
| Multimodal positioning | Instruction-tuned Llama 4 is described for assistant chat and visual reasoning      | [Llama 4 Scout model card](https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E) | Fetched, vendor claim |
| Training scale signal  | Llama 4 Scout pretraining reported at ~40T tokens with Aug 2024 data cutoff         | [Llama 4 Scout model card](https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E) | Fetched, vendor claim |

## Models tracked from PRD-002 (base + profiles)

| Base model    | Environment     | Profile variants covered | Cost tier | Cost multiplier range | Tokens/problem | SWE-bench / Verified | HLE           | SWE-rebench   | Aider         | Coding ability summary                                                                                                                                                    | Decision Readiness | When to use                                                   | Source quality                | Last verified |
| ------------- | --------------- | ------------------------ | --------- | --------------------: | -------------: | -------------------- | ------------- | ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------- | ----------------------------- | ------------- |
| Llama 4 Scout | Windsurf/Intake | Llama 4 Scout            | Paid      |                   1.0 |  Not evaluated | Not evaluated        | Not evaluated | Not evaluated | Not evaluated | Above-average intelligence; fast; very verbose; multimodal support. | Medium (vendor-claimed; not benchmarked) | Multimodal tasks requiring fast processing with large context | PRD-002 + Artificial Analysis | 2026-02-26    |

## Operational notes

- This family is key for open-weight, self-hosted, and on-prem planning.
- Public benchmark tables are present in model cards, but this pass did not
  retrieve robust metric values for direct ranking use.

## Guidance for model guides

1. Add Llama as intake baseline for self-hosted/on-prem comparisons.
2. Keep default ranking unchanged until independent coding benchmark runs exist.
3. Validate tool use and long-context behavior in local harnesses.

## Data gaps to close

- Independent coding benchmark runs for Llama 3.x and Llama 4 variants.
- Cost-per-success metrics on your target inference stack.
- Stability and latency under long agent trajectories.
