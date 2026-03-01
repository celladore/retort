# Model Family Dossier: Windsurf SWE

## Snapshot

- Last updated: 2026-02-26
- Scope: Windsurf-native SWE model family for in-IDE software engineering
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| **Provider**       | Cognition / Windsurf                                         |
| **Architecture**   | Frontier-size proprietary model (base model not disclosed)   |
| **Latest model**   | SWE-1.5                                                      |
| **Context window** | Not evaluated                                                |
| **License**        | Proprietary (in-product model family)                        |
| **Notable**        | Near Claude 4.5-level performance claim at much higher speed |

## Latest benchmark signals

| Signal                            | Value                                                           | Source                                                            | Quality               |
| --------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------- |
| In-house model family positioning | SWE-1.5 listed as Windsurf's best released agentic coding model | [Windsurf models docs](https://docs.windsurf.com/windsurf/models) | Fetched, vendor claim |
| Speed/performance positioning     | Near Claude 4.5-level performance and about 13x faster claim    | [Windsurf models docs](https://docs.windsurf.com/windsurf/models) | Fetched, vendor claim |
| Inference throughput              | Up to 950 tokens/second with Cerebras serving path              | [Cognition SWE-1.5](https://cognition.ai/blog/swe-1-5)            | Fetched, vendor claim |
| Public benchmark framing          | Near-frontier performance statement using SWE-Bench Pro         | [Cognition SWE-1.5](https://cognition.ai/blog/swe-1-5)            | Fetched, vendor claim |

## Models tracked from PRD-002 (base + profiles)

| Base model | Environment | Profile variants covered | Cost tier | Cost multiplier range | Tokens/problem | SWE-bench / Verified | HLE           | SWE-rebench   | Aider         | Coding ability summary                                                                        | Decision Readiness | When to use                                                     | Source quality               | Last verified |
| ---------- | ----------- | ------------------------ | --------- | --------------------: | -------------: | -------------------- | ------------- | ------------- | ------------- | --------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------- | ---------------------------- | ------------- |
| SWE-1.5    | Windsurf    | SWE-1.5, SWE-1.5 Fast    | Free/Paid | 0 (free) - 0.5*       |  Not evaluated | Not evaluated        | Not evaluated | Not evaluated | Not evaluated | Native Windsurf coding-agent fine-tuned for fast in-IDE workflows; 13x faster than Claude 4.5 (vendor-reported, not independently evaluated) | Medium             | Fast IDE-first coding loops, high-volume agentic edit workflows | PRD-002 matrix + vendor docs | 2026-02-26    |

\* 0 indicates no usage cost for the free tier; paid tier multipliers range up to 0.5.

## Operational notes

- PRD-002 includes SWE-1.5 pricing multipliers but not independent benchmark
  reproduction values in this repository.
- Public values available today are mostly vendor-reported performance and
  speed positioning.

## Guidance for model guides

1. Keep SWE-1.5 in tracked cost-aware routing paths for Windsurf-native usage.
2. Keep benchmark-weighted rankings conservative until independent values are
   captured in this repo.
3. Keep Cost evidence as `Not evaluated` where tokens/problem is unavailable.

## Data gaps to close

- Independent SWE-bench/Aider replication with published harness details.
- Tokens/problem evidence for cost-score normalization.
- Reliability metrics for long, multi-turn, tool-heavy sessions.
