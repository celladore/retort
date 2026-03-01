# ADR-0002 (AKF-INFRA-001): Fallback Policy for Missing tokens/problem Evidence

## Status

**Accepted**

## Date

2026-02-26

## Decision ID

AKF-INFRA-001

## Context

The LLM model guide infrastructure scoring uses `tokens/problem` as a cost evidence metric. For many models in the ranked set, this evidence is not yet available or evaluated.

## Decision

When `tokens/problem` is missing for a model:

1. Keep current Cost scores unchanged.
2. Mark cost evidence as `Not evaluated`.
3. Do not recalculate or adjust the final weighted scores based on missing cost evidence.

This fallback policy was approved by platform leads on 2026-02-26.

## Rationale

- Avoids penalising models with incomplete cost data.
- Preserves scoring consistency until cost evidence can be collected.
- Cost evidence evaluation is scheduled for Q2 2026 (target: 2026-04-15).

## Scope

Applies to the model guide infrastructure scoring in `docs/prd/model-guide-infra.md` and related scorecard calculations.
