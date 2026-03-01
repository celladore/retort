# Quirks Scoring Implementation Guide

**Last Updated:** 2026-02-26
**Purpose:** Implement numerical scoring for model quirks in the AgentKit decision engine
**Scope:** Integration with PRD-001 weighted decision matrix

## Overview

This document provides a concrete implementation plan for adding numerical quirk scoring to the decision engine. The current "quirks" dimension uses weight=1 but lacks specific scoring methodology.

## Scoring Framework

### Base Quirk Score Calculation

```text
Base Quirk Score = sum(all quirk scores)
```

Individual quirk values are defined per-model in the tables below (e.g., Claude: Native MCP Support = +0.3, Consistent Output Quality = +0.2, Verbose Near High Context = -0.2). Weights are not uniform; each quirk has its own assigned value. Possible score range is approximately -0.3 to +0.3 per model.

### Final Score Integration

```text
Final Score = Weighted Score - lock_in_penalty - quirks_penalty + quirks_bonus
```

Where:

- `quirks_penalty = max(0, -Base Quirk Score)` (only negative base scores become penalties)
- `quirks_bonus = max(0, Base Quirk Score)` (positive base scores become bonuses)

> **Note:** The original formula `Final Score = Weighted Score - lock_in_penalty - quirks_penalty` is incomplete — it omits the bonus component. Positive quirk scores must be added back as bonuses to reward models with net-positive quirks.

## Model-Specific Quirk Scores

### Anthropic Claude

| Quirk Category | Specific Quirks              | Score     | Rationale                           |
| -------------- | ---------------------------- | --------- | ----------------------------------- |
| Positive       | Native MCP Support           | +0.3      | Unique competitive advantage        |
| Positive       | Consistent Output Quality    | +0.2      | Reduces need for retries/validation |
| Positive       | Strong Agentic Performance   | +0.2      | Better for multi-step workflows     |
| Negative       | Verbose Near High Context    | -0.2      | Increases token costs               |
| Negative       | Premium Pricing              | -0.1      | Budget impact                       |
| Negative       | Rate Limiting                | -0.2      | Can block workflows                 |
| Operational    | Context Window Inconsistency | -0.05     | Beta vs production confusion        |
| **Net Score**  |                              | **+0.15** | Slight positive overall             |

### OpenAI GPT/Codex

| Quirk Category | Specific Quirks            | Score    | Rationale                 |
| -------------- | -------------------------- | -------- | ------------------------- |
| Positive       | Token Efficiency (Codex)   | +0.2     | Cost savings              |
| Positive       | Strong Tool Integration    | +0.2     | Mature ecosystem          |
| Positive       | Extensive Profile Variants | +0.1     | Flexibility               |
| Negative       | Rate Limit Spikes          | -0.3     | Major workflow disruption |
| Negative       | Profile Complexity         | -0.1     | Decision paralysis        |
| Negative       | Cost Volatility            | -0.2     | Budget unpredictability   |
| Operational    | API Inconsistencies        | -0.1     | Integration complexity    |
| **Net Score**  |                            | **-0.2** | Moderate negative overall |

### Google Gemini

| Quirk Category | Specific Quirks            | Score    | Rationale                 |
| -------------- | -------------------------- | -------- | ------------------------- |
| Positive       | Massive Context (1M+)      | +0.3     | Unique capability         |
| Positive       | Native Multimodal          | +0.2     | Future-proofing           |
| Positive       | Speed Advantage (Flash)    | +0.2     | Performance               |
| Negative       | Performance Inversion      | -0.2     | Counterintuitive behavior |
| Negative       | Preview Model Availability | -0.1     | Reliability concerns      |
| Negative       | Regional Variability       | -0.1     | Inconsistent performance  |
| Operational    | API Evolution              | -0.1     | Integration maintenance   |
| **Net Score**  |                            | **+0.2** | Slight positive overall   |

### DeepSeek

| Quirk Category | Specific Quirks              | Score    | Rationale                |
| -------------- | ---------------------------- | -------- | ------------------------ |
| Positive       | Open-Weight Breakthrough     | +0.2     | No vendor lock-in        |
| Positive       | Cost-Effective Training      | +0.1     | Efficient architecture   |
| Positive       | High Token Efficiency        | +0.3     | Significant cost savings |
| Positive       | Dual Mode Operation          | +0.1     | Flexibility              |
| Negative       | Limited Transformers Support | -0.2     | Integration overhead     |
| Negative       | Vendor Documentation Only    | -0.2     | Validation needed        |
| Operational    | API Model Mapping            | -0.1     | Confusing endpoints      |
| **Net Score**  |                              | **+0.2** | Slight positive overall  |

### xAI Grok

| Quirk Category | Specific Quirks        | Score   | Rationale                               |
| -------------- | ---------------------- | ------- | --------------------------------------- |
| Positive       | "Max Fun" Mode         | +0.1    | Unique personality                      |
| Positive       | Open Weights Available | +0.2    | No vendor lock-in                       |
| Positive       | Tool-Use Training      | +0.2    | Workflow optimization                   |
| Negative       | Vendor-Reported Only   | -0.3    | Validation needed                       |
| Negative       | Limited Model Range    | -0.1    | Fewer options                           |
| Operational    | API Maturity           | -0.1    | Stability concerns                      |
| **Net Score**  |                        | **0.0** | Neutral overall (0.5 - 0.4 - 0.1 = 0.0) |

### Zhipu AI GLM

| Quirk Category | Specific Quirks               | Score     | Rationale                |
| -------------- | ----------------------------- | --------- | ------------------------ |
| Positive       | Token Efficiency Leader       | +0.3      | Best in class            |
| Positive       | Cheapest API Pricing          | +0.3      | Significant cost savings |
| Positive       | Strong Multilingual           | +0.2      | APAC advantage           |
| Positive       | Massive Scale                 | +0.1      | Capability               |
| Negative       | Limited Western Documentation | -0.1      | Integration barrier      |
| Negative       | APAC Region Focus             | -0.1      | Latency elsewhere        |
| Operational    | Multiple Cost Tiers           | -0.05     | Confusing pricing        |
| **Net Score**  |                               | **+0.65** | Strong positive overall  |

### Mistral (Codestral)

| Quirk Category | Specific Quirks          | Score     | Rationale                  |
| -------------- | ------------------------ | --------- | -------------------------- |
| Positive       | European AI Champion     | +0.1      | GDPR compliance            |
| Positive       | Strong FIM Support       | +0.3      | Code completion excellence |
| Positive       | Low-Latency Focus        | +0.2      | Performance                |
| Positive       | Open Weights Available   | +0.1      | No vendor lock-in          |
| Negative       | Limited Independent Data | -0.2      | Validation needed          |
| Operational    | Mamba Architecture       | -0.05     | Integration complexity     |
| **Net Score**  |                          | **+0.45** | Moderate positive overall  |

### Cohere Command

| Quirk Category | Specific Quirks           | Score     | Rationale                 |
| -------------- | ------------------------- | --------- | ------------------------- |
| Positive       | Enterprise RAG Specialist | +0.3      | Domain excellence         |
| Positive       | Platform Coverage         | +0.2      | Deployment flexibility    |
| Positive       | Strong Embeddings         | +0.2      | Ecosystem strength        |
| Positive       | Tool-Using Agents         | +0.1      | Workflow optimization     |
| Negative       | Limited Coding Data       | -0.2      | Unknown performance       |
| Negative       | Enterprise Focus          | -0.1      | Over-engineering risk     |
| Operational    | Platform Dependencies     | -0.05     | Vendor lock-in            |
| **Net Score**  |                           | **+0.45** | Moderate positive overall |

## Implementation Steps

### Step 1: Update Data Model

Add to `.agentkit.yaml` schema:

```yaml
agents:
  backend:
    default_model: claude-3-5-sonnet
    quirks:
      positive: ["native_mcp", "consistent_quality", "strong_agentic"]
      negative: ["verbose_high_context", "premium_pricing", "rate_limiting"]
      operational: ["context_inconsistency"]
```

Scores are computed at runtime by `calculateQuirksScore`; do not store `scores.base`, `scores.penalty`, `scores.bonus` in config. Optionally add `validateQuirksScores` to warn when stored scores drift from computed values.

**Quirk Key Reference:** Human-readable names map to snake_case config keys used in `.agentkit.yaml` and by `calculateQuirksScore`/`validateQuirksScores`:

| Human-readable name      | Config key              |
| ------------------------ | ----------------------- |
| Native MCP Support        | `native_mcp`            |
| Consistent Quality       | `consistent_quality`    |
| Strong Agentic           | `strong_agentic`        |
| Token Efficiency         | `token_efficiency`      |
| Massive Context          | `massive_context`       |
| Open Weights Available   | `open_weights_available`|
| Platform Coverage        | `platform_coverage`      |
| Strong Embeddings        | `strong_embeddings`     |
| Tool-Using Agents        | `tool_using_agents`     |
| Tool-Use Training       | `tool_use_training`     |
| Limited Coding Data      | `limited_coding_data`   |
| Enterprise Focus        | `enterprise_focus`      |
| Platform Dependencies   | `platform_dependencies` |

This table is a partial example. See the canonical `QUIRK_SCORES` object for the full key list.

### Step 2: Update Decision Engine

Modify scoring logic in `llm-decision-engine`:

```javascript
// Quirk score lookup table (values match model-family tables)
const QUIRK_SCORES = {
  // Positive quirks
  native_mcp: 0.3,
  consistent_quality: 0.2,
  strong_agentic: 0.2,
  token_efficiency: 0.2,
  massive_context: 0.3,
  open_weight_breakthrough: 0.2,
  cost_effective_training: 0.1,
  high_token_efficiency: 0.3,
  dual_mode_operation: 0.1,
  max_fun_mode: 0.1,
  open_weights_available: 0.2,
  tool_use_training: 0.2,
  european_ai_champion: 0.1,
  strong_fim_support: 0.3,
  low_latency_focus: 0.2,
  enterprise_rag_specialist: 0.3,
  platform_coverage: 0.2,
  strong_embeddings: 0.2,
  tool_using_agents: 0.1,

  // Negative quirks
  verbose_high_context: -0.2,
  premium_pricing: -0.1,
  rate_limiting: -0.2,
  rate_limit_spikes: -0.3,
  profile_complexity: -0.1,
  cost_volatility: -0.2,
  limited_transformers_support: -0.2,
  vendor_documentation_only: -0.2,
  vendor_reported_only: -0.3,
  limited_model_range: -0.1,
  limited_independent_data: -0.2,
  limited_coding_data: -0.2,
  enterprise_focus: -0.1,

  // Operational quirks (-0.05 each)
  context_inconsistency: -0.05,
  api_inconsistencies: -0.1,
  api_evolution: -0.1,
  api_maturity: -0.1,
  api_model_mapping: -0.1,
  multiple_cost_tiers: -0.05,
  mamba_architecture: -0.05,
  platform_dependencies: -0.05,

  strong_tool_integration: 0.2,
  extensive_profile_variants: 0.1,
  native_multimodal: 0.2,
  speed_advantage: 0.2,
  performance_inversion: -0.2,
  preview_model_availability: -0.1,
  regional_variability: -0.1,
  token_efficiency_leader: 0.3,
  cheapest_api_pricing: 0.3,
  strong_multilingual: 0.2,
  massive_scale: 0.1,
  limited_western_documentation: -0.1,
  apac_region_focus: -0.1,
};

function calculateQuirksScore(agentConfig) {
  const quirks = agentConfig?.quirks ?? {};
  const positive = Array.isArray(quirks.positive) ? quirks.positive : [];
  const negative = Array.isArray(quirks.negative) ? quirks.negative : [];
  const operational = Array.isArray(quirks.operational) ? quirks.operational : [];
  let baseScore = 0;

  positive.forEach(quirk => {
    baseScore += QUIRK_SCORES[quirk] || 0;
  });
  negative.forEach(quirk => {
    baseScore += QUIRK_SCORES[quirk] || 0;
  });
  operational.forEach(quirk => {
    baseScore += QUIRK_SCORES[quirk] || 0;
  });

  return {
    base: baseScore,
    penalty: Math.max(0, -baseScore),
    bonus: Math.max(0, baseScore)
  };
}
```

### Step 3: Update Team Guides

Add quirks section to each `model-guide-*.md`:

```markdown
### Quirks Assessment

| Model             | Base Score | Penalty | Bonus | Net Impact      |
| ----------------- | ---------- | ------- | ----- | --------------- |
| Claude 3.5 Sonnet | +0.15      | 0.0     | +0.15 | Positive        |
| GPT-4o            | -0.20      | 0.20    | 0.0   | Negative        |
| GLM-5             | +0.65      | 0.0     | +0.65 | Strong Positive |
```

### Step 4: Validation Process

1. **Team Feedback**: Collect real-world quirk observations
2. **Performance Monitoring**: Track quirk impact on workflows
3. **Regular Updates**: Quarterly quirk score reviews
4. **A/B Testing**: Compare quirk-adjusted vs baseline selections

## Configuration Examples

### Backend Team Configuration

```yaml
backend:
  model_preferences:
    primary: claude-3-5-sonnet
    fallback: deepseek-v3.2
  quirks_weighting:
    # Override default quirk weights for team-specific priorities
    # Keys reference QUIRK_SCORES entries; values are multipliers (default: 1.0)
    native_mcp: 0.4      # Multiply MCP impact by 0.4 (reduces from +0.3 to +0.12)
    token_efficiency: 0.3 # Multiply token efficiency impact by 0.3
    rate_limiting: 0.4    # Scale penalty: 0.4 means 40% of original (-0.2 × 0.4 = -0.08)
```

> **Note:** The `quirks_weighting` config multiplies the base QUIRK_SCORES values as plain scalars. Negative base × positive multiplier remains negative. A value of 1.0 keeps the default weight. Use positive magnitude (e.g., 0.4 for 40% of original) to scale penalties. This allows teams to tune quirk importance without redefining the base scores.

### Frontend Team Configuration

```yaml
frontend:
  model_preferences:
    primary: gemini-3-flash
    fallback: gpt-4o
  quirks_weighting:
    native_multimodal: 0.3   # UI/UX advantage (maps to QUIRK_SCORES.native_multimodal)
    speed_advantage: 0.4     # Fast iteration (maps to QUIRK_SCORES.speed_advantage)
    api_evolution: 0.2      # Scale down penalty (positive multiplier reduces negative base)
```

## Monitoring Metrics

### Quirk Impact Tracking

1. **Workflow Success Rate**: By model and quirk profile
2. **Cost Variance**: Actual vs expected by quirk adjustments
3. **User Satisfaction**: Quirk-related feedback scores
4. **Integration Issues**: Quirk-related technical problems

### Review Cadence

- **Weekly**: Monitor quirk impact metrics
- **Monthly**: Review quirk score adjustments
- **Quarterly**: Comprehensive quirk reassessment
- **As Needed**: Emergency quirk updates for major model changes

## Next Steps

1. **Validate Quirk Scores**: Review with each team for accuracy
2. **Prototype Implementation**: Test with one team first
3. **Refine Scoring**: Adjust based on real-world feedback
4. **Full Rollout**: Implement across all teams
5. **Continuous Improvement**: Establish monitoring and update process

---

**Owner**: Product Lead
**Review Date**: 2026-03-31
**Next Review**: 2026-06-30
