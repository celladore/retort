# Cognitive Mesh Integration Skill

> **Status:** Planned — blocked on cognitive-mesh Phase 5 (HTTP API not yet live)
> **API URL:** https://cognitive-mesh-api.blackmoss-00f95c9e.southafricanorth.azurecontainerapps.io
> **Tracked in:** org-meta/.roadmap.yaml → cognitive-mesh-http-api

## Overview

Integrate cognitive-mesh as a reasoning backend for retort quality gates and agent routing. Instead of static rule-based gates, retort agents can invoke cognitive-mesh to reason about output quality using chain-of-thought, debate, or strategic reasoning modes.

## Endpoints to Integrate

### 1. Health Check (implement first)
```
GET /api/v1/cognitive/health
```
No auth. Retort should check this before invoking any cognitive-mesh skill — fail gracefully if down.

### 2. Core Reasoning (primary integration)
```
POST /api/v1/cognitive/reason
```
Used by quality gates to reason about agent output. Replace static pass/fail rules with dynamic reasoning.

**Proposed request shape:**
```json
{
  "mode": "chain-of-thought" | "debate" | "strategic",
  "context": "string",
  "input": "string",
  "criteria": ["string"]
}
```

**Proposed response shape:**
```json
{
  "conclusion": "string",
  "confidence": 0.0-1.0,
  "reasoning": ["string"],
  "pass": true | false
}
```

### 3. Agency Routing (future — after reason is stable)
```
POST /api/v1/cognitive/agency/route
```
Replace retort's static team assignment with cognitive-mesh routing. Pass task description, get back recommended agent team.

## Retort Integration Points

### Quality Gate Skill
Create `skills/cognitive-mesh-gate.ts`:
- Invoke `/health` on init
- Call `/reason` with gate criteria + agent output
- Map `pass: false` + `confidence < threshold` to gate failure
- Surface `reasoning[]` in gate failure message (actionable feedback)

### Orchestrator Hook
In `AGENT_TEAMS.md` or orchestrator config:
- Before dispatching to a team, optionally call `/agency/route`
- Use as a hint, not hard override (cognitive-mesh down = fall back to static routing)

## Auth
TBD — cognitive-mesh API auth not yet designed. Likely Azure Managed Identity or API key via Key Vault (`cog-shared-kv-san`).

## Dependencies
- cognitive-mesh Phase 5 complete (CognitiveMeshController.cs implemented)
- cognitive-mesh Phase 6 complete (deployed to CAE)
- retort skill scaffolding in place

## Notes
- cognitive-mesh ACR: `myssharedacr.azurecr.io` (shared org registry)
- cognitive-mesh dev RG: `cog-dev-rg-san` (SAF North)
- Do not add cognitive-mesh as a hard dependency — degrade gracefully when unavailable
