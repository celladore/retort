# Model Family Dossier: Mistral (incl. Codestral)

## Snapshot

- Last updated: 2026-02-26
- Scope: Codestral coding capabilities and Mistral API feature surface
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| **Provider**       | Mistral AI (Paris, France)                                                           |
| **Founded**        | 2023                                                                                 |
| **Architecture**   | Codestral 22B / 25.08: Transformer; Mamba-Codestral-7B: Mamba2 (linear-time inference) |
| **Latest model**   | Codestral 25.08 (API/release channel); open-weights: Codestral-22B-v0.1 on Hugging Face |
| **Context window** | 128K tokens ([Codestral 25.08 docs](https://docs.mistral.ai/models/codestral-25-08)) |
| **License**        | Proprietary (API) + open weights (Apache 2.0)                                        |
| **Notable**        | European AI champion, strong FIM support for code completion                         |

## Hugging Face Resources

| Resource            | Model ID                               | Notes                         |
| ------------------- | -------------------------------------- | ----------------------------- |
| Codestral           | `mistralai/Codestral-22B-v0.1`         | Main coding model, 22B params |
| Codestral community | `mistral-community/Codestral-22B-v0.1` | Community checkpoint          |
| Mamba variant       | `mistralai/Mamba-Codestral-7B-v0.1`    | Mamba architecture variant    |
| Base Mistral        | `mistralai/Mistral-7B-v0.1`            | Original Mistral 7B           |

## Latest benchmark signals

| Signal              | Value                                                                                           | Source                                                                   | Quality               |
| ------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------- |
| Coding focus        | Codestral is positioned as a code-completion model for low-latency, high-frequency coding tasks | [Mistral Codestral docs](https://docs.mistral.ai/models/codestral-25-08) | Fetched, vendor claim |
| FIM support         | Codestral supports Fill-in-the-Middle code completion                                           | [Mistral Codestral docs](https://docs.mistral.ai/models/codestral-25-08) | Fetched, vendor claim |
| Agent/tool features | Docs list function calling, agents, and built-in tools support                                  | [Mistral Codestral docs](https://docs.mistral.ai/models/codestral-25-08) | Fetched, vendor claim |

## Models tracked from PRD-002 (base + profiles)

| Base model      | Environment     | Profile variants covered | Cost tier | Cost multiplier | Tokens/problem | SWE-bench / Verified                                                   | HLE           | SWE-rebench   | Aider         | Coding ability summary                        | Decision Readiness | When to use                                          | Source quality         | Last verified |
| --------------- | --------------- | ------------------------ | --------- | --------------------: | -------------: | ---------------------------------------------------------------------- | ------------- | ------------- | ------------- | --------------------------------------------- | ------------------ | ---------------------------------------------------- | ---------------------- | ------------- |
| Codestral 25.08 | Windsurf/Intake | Codestral 25.08          | Paid      |                   1.0 |  Not evaluated | Devstral Small 1.1: 53.6%; Devstral Medium: 61.6% (SWE-bench Verified; Codestral benchmark proxied by Devstral—see note) | Not evaluated | Not evaluated | Not evaluated | Top open-model SWE-bench Verified performance | Medium             | Enterprise coding where open-weight SOTA is required | PRD-002 + Mistral blog | 2026-02-26    |

> **Note:** Devstral metrics are used as proxies for Codestral; Codestral and Devstral are related Mistral coding variants.

## Operational notes

- This dossier currently uses vendor documentation signals only.
- Independent coding benchmark numbers for current Codestral releases are not
  yet captured in this repo.

## Guidance for model guides

1. Add Mistral/Codestral as intake rows for coding-focused, low-latency paths.
2. Keep weighted rankings unchanged until independent benchmark replication.
3. Validate latency and cost assumptions with provider and region-specific tests.

## Data gaps to close

- Independent Aider polyglot and SWE-bench performance runs.
- Normalized price and latency measurements across providers.
- Reliability and malformed-edit rates in multi-file coding tasks.
