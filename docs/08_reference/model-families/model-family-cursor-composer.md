# Model Family Dossier: Cursor Composer

## Snapshot

- Last updated: 2026-02-26
- Scope: Cursor-native Composer model line for IDE agentic coding
- Intended use: source data for team model guides

## At a Glance

| Attribute          | Value                                              |
| ------------------ | -------------------------------------------------- |
| **Provider**       | Cursor / Anysphere                                 |
| **Architecture**   | Not evaluated (proprietary)                        |
| **Latest model**   | Composer 1.5                                       |
| **Context window** | Not evaluated                                      |
| **License**        | Proprietary (in-product model)                     |
| **Notable**        | Cursor-native agentic model with adaptive thinking |

## Latest benchmark signals

| Signal                            | Value                                                                       | Source                                                           | Quality               |
| --------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------- |
| RL scaling statement              | Composer 1.5 was trained with 20x more RL scaling than Composer 1           | [Cursor Composer 1.5 blog](https://cursor.com/blog/composer-1-5) | Fetched, vendor claim |
| Thinking and adaptive behavior    | Composer 1.5 is a thinking model with adaptive thinking depth by task       | [Cursor Composer 1.5 blog](https://cursor.com/blog/composer-1-5) | Fetched, vendor claim |
| Long-task behavior                | Composer 1.5 supports self-summarization when context is exhausted          | [Cursor Composer 1.5 blog](https://cursor.com/blog/composer-1-5) | Fetched, vendor claim |
| Terminal-Bench reference in notes | Cursor references Terminal-Bench 2.0 methodology in release benchmark notes | [Cursor Composer 1.5 blog](https://cursor.com/blog/composer-1-5) | Fetched, vendor claim |

## Models tracked from PRD-002 (base + profiles)

| Base model   | Environment | Profile variants covered | Cost tier     | Cost multiplier range | Tokens/problem | SWE-bench / Verified | HLE           | SWE-rebench   | Aider         | Coding ability summary                                        | Decision Readiness | When to use                                                | Source quality               | Last verified |
| ------------ | ----------- | ------------------------ | ------------- | --------------------: | -------------: | -------------------- | ------------- | ------------- | ------------- | ------------------------------------------------------------- | ------------------ | ---------------------------------------------------------- | ---------------------------- | ------------- |
| Composer 1.5 | Cursor      | Composer 1.5             | Not evaluated |         Not evaluated |  Not evaluated | Not evaluated        | Not evaluated | Not evaluated | Not evaluated | Cursor-native coding agent model; adaptive thinking and speed | Low                | Cursor-first IDE agent flows where native behavior matters | PRD-002 matrix + vendor docs | 2026-02-26    |

## Operational notes

- PRD-002 currently includes Composer 1.5 as a Cursor row with capability fields
  not exposed by source UI metadata.
- Public, independently replicated SWE-bench/HLE/Aider values were not captured
  in this repo for Composer-specific routing.

## Guidance for model guides

1. Keep Composer in tracked intake for Cursor-native routing decisions.
2. Do not promote Composer via benchmark-weighted tiers until independent
   benchmark values are available.
3. Keep Cost evidence as `Not evaluated` until tokens/problem and multiplier data
   can be validated.

## Data gaps to close

- Fetch reproducible Composer benchmark values with harness + settings.
- Confirm context window and determinism controls from first-party docs.
- Collect tokens/problem evidence for cost-score normalization.
