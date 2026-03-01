# Model Quirks Analysis

**Last Updated:** 2026-02-26  
**Scope:** Systematic exploration of model-specific quirks for the AgentKit decision engine  
**Purpose:** Enhance the "quirks" scoring dimension with specific, actionable model behaviors

## Overview

The current "quirks" scoring dimension in PRD-001 uses generic descriptions like "Rate-limit spikes" or "Strong coding, cost-effective". This analysis provides detailed, model-specific quirks that can inform better scoring and team decision-making.

## Model Family Quirks

### Anthropic Claude

#### Strengths — Anthropic Claude

- **Native MCP Support**: First model family with built-in Model Context Protocol support
- **1M Context Leadership**: Opus 4.6 beta supports 1M context (vs 200K standard)
- **Consistent Output Quality**: Less variability in code generation quality compared to some competitors
- **Strong Agentic Performance**: Excels in multi-step reasoning and tool coordination

#### Known Issues — Anthropic Claude

- **Verbose Near High Context**: Becomes unusually verbose when approaching context limits
- **Cost Sensitivity**: Premium pricing makes it expensive for high-volume tasks
- **Rate Limiting**: Can hit API rate limits during intensive coding sessions
- **Context Window Inconsistency**: 1M context is beta-only, production deployments often limited to 200K

#### Operational Quirks — Anthropic Claude

- **Effort Mode Sensitivity**: Performance varies significantly between "high" vs "max" effort settings
- **Context Compaction**: Behavior changes when context compaction is enabled in long sessions
- **Tool Call Latency**: Slightly higher latency on complex tool chains vs some competitors

### OpenAI GPT/Codex

#### Strengths — OpenAI GPT/Codex

- **Extensive Profile Variants**: Wide range of thinking/fast/low/medium/high configurations
- **Token Efficiency**: GPT-5.2 Codex specifically called out as token-efficient on SWE-rebench
- **Strong Tool Integration**: Mature ecosystem for function calling and tool use
- **Codex Legacy**: Benefits from years of GitHub Copilot training data and optimizations

#### Known Issues — OpenAI GPT/Codex

- **Rate Limit Spikes**: Prone to sudden rate limiting during intensive usage
- **Profile Complexity**: So many variants make it difficult to choose optimal configuration
- **Cost Volatility**: High-effort variants can become very expensive quickly
- **Documentation Access**: Some official benchmark pages blocked/restricted in certain environments

#### Operational Quirks — OpenAI GPT/Codex

- **Family-Level Carryover**: Performance characteristics often carry over across GPT-5.x variants
- **Codex vs GPT Split**: Separate coding-optimized vs general-purpose models can cause confusion
- **API Inconsistencies**: Different behavior between OpenAI API vs platform-specific deployments (Azure, etc.)

### Google Gemini

#### Strengths — Google Gemini

- **Massive Context**: Up to 2M experimental context (1M production)
- **Native Multimodal**: Built from ground up with multimodal capabilities
- **Speed Advantage**: Flash variants often outperform Pro on coding-agent metrics despite smaller size
- **Upgradeable Context**: Context window capabilities continue to expand

#### Known Issues — Google Gemini

- **Performance Inversion**: Sometimes Flash outperforms Pro on coding tasks (counterintuitive)
- **Page Timeouts**: Official documentation pages can timeout in certain network environments
- **Preview Model Availability**: Gemini 3/3.1 references often preview-only with limited availability
- **Regional Variability**: Performance can vary significantly by region

#### Operational Quirks — Google Gemini

- **Reasoning Mode Variants**: Multiple "High Thinking" variants with unclear differentiation
- **API Evolution**: Rapid model releases can break existing integrations
- **WebDev Arena Focus**: Strong performance on web development tasks but less general coding data

### DeepSeek

#### Strengths — DeepSeek

- **Open-Weight Breakthrough**: Strong performance with open weights (MIT/Apache licensing)
- **Cost-Effective Training**: Notable ~$6M training cost suggests efficient architecture
- **Dual Mode Operation**: Separate chat (non-thinking) and reasoner modes for different use cases
- **High Token Efficiency**: Ranked highest in tokens/problem on SWE-rebench

#### Known Issues — DeepSeek

- **Limited Transformers Support**: Custom inference requirements, limited direct Transformers integration
- **Vendor Documentation Only**: Currently limited to vendor documentation without independent verification
- **API Model Mapping**: Confusing mapping between model names and API endpoints
- **Regional Availability**: May have limited availability outside certain regions

#### Operational Quirks — DeepSeek

- **Thinking Mode Behavior**: Significant behavior differences between chat and reasoner modes
- **Tool Use in Both Modes**: Supports tool use in both thinking and non-thinking modes (unusual)
- **Version Naming**: Complex versioning (V3.2 vs V3-0324) can cause confusion

### xAI Grok

#### Strengths — xAI Grok

- **"Max Fun" Mode**: Unique personality/behavior mode not found in other models
- **Strong SWE-bench Performance**: 70.8% on full subset (vendor-reported)
- **Open Weights Available**: Grok-1 available as 314B MoE open weights
- **Tool-Use Training**: Specifically trained for grep/terminal/file editing workflows

#### Known Issues — xAI Grok

- **Vendor-Reported Only**: Strongest benchmarks are vendor-reported, not independently verified
- **Limited Model Range**: Smaller family compared to established providers
- **Elon Musk Association**: Brand association may affect enterprise adoption decisions
- **API Maturity**: Newer API may have stability/reliability concerns

#### Operational Quirks — xAI Grok

- **Speed vs Quality Trade-off**: "Code Fast 1" variant specifically optimized for speed
- **Test-Time Compute**: Emphasizes test-time compute for complex reasoning tasks
- **End-User Focus**: Positioned more for end-user workflows than enterprise integration

### Zhipu AI GLM

#### Strengths — Zhipu AI GLM

- **Token Efficiency Leader**: #1 on tokens/problem in SWE-rebench
- **Cheapest API Pricing**: Most cost-effective option among tracked models
- **Strong Multilingual**: Chinese origin gives advantages for APAC/multilingual workloads
- **Massive Scale**: GLM-5 scales to 744B parameters (40B active) with DSA

#### Known Issues — Zhipu AI GLM

- **Limited Western Documentation**: Most documentation in Chinese, limited English coverage
- **APAC Region Focus**: May have performance advantages in APAC but potential latency elsewhere
- **Search-Only Data**: Some performance data only available via search snippets
- **Beta Model Status**: GLM-4.7 marked as beta with limited stability guarantees

#### Operational Quirks — Zhipu AI GLM

- **Multiple Cost Tiers**: Same model available at different cost multipliers (0.75x vs 1.5x)
- **Open/Proprietary Mix**: Combination of open weights and proprietary API access
- **Throughput Variability**: Reported 61.2 t/s but may vary by region and load

### Mistral (Codestral)

#### Strengths — Mistral (Codestral)

- **European AI Champion**: GDPR-friendly, European-based provider
- **Strong FIM Support**: Excellent Fill-in-the-Middle code completion
- **Low-Latency Focus**: Optimized for high-frequency, low-latency coding tasks
- **Open Weights Available**: Apache 2.0 licensing for some models

#### Known Issues — Mistral (Codestral)

- **Limited Independent Data**: Most current data from vendor documentation only
- **Mamba Architecture Complexity**: Mamba variant may have integration challenges
- **Documentation Gaps**: Less comprehensive documentation compared to major providers
- **Community Reliance**: Heavy reliance on community checkpoints for some variants

#### Operational Quirks — Mistral (Codestral)

- **Code Completion Focus**: Specifically optimized for code completion vs general coding
- **European Data Residency**: Advantage for GDPR compliance but potential latency for global users
- **Function Calling Support**: Lists agent/tool support but implementation details unclear

### Cohere Command

#### Strengths — Cohere Command

- **Enterprise RAG Specialist**: Strong positioning for RAG-heavy workloads
- **Platform Coverage**: Good support for Bedrock/SageMaker deployments
- **Strong Embeddings**: Excellent embedding models (embed-english-v3)
- **Tool-Using Agents**: Specifically positioned for tool-using agent workflows

#### Known Issues — Cohere Command

- **Limited Coding Data**: Less independent coding benchmark data available
- **Enterprise Focus**: May be over-engineered for simple coding tasks
- **Platform Dependencies**: Some features require specific platform deployments
- **Documentation Access**: Vendor documentation may require authentication for full access

#### Operational Quirks — Cohere Command

- **Multiple Deployment Options**: API, Bedrock, SageMaker with different behaviors
- **RAG Optimization**: May be over-optimized for RAG at expense of general coding
- **Translation Focus**: Strong translation capabilities may not translate to coding advantages

## Scoring Implications

**Scoring scale:** 0–1; quirk deltas are typically ±0.05 to ±0.5. Positive and negative quirks use 0.1–0.5; operational quirks use 0.05–0.2.

**Composition:** Quirk values are additive; sum positive, negative, and operational contributions to get a net quirk score per model.

**Integration:** The quirk subtotal is combined with PRD-001 scoring dimensions (e.g., added to weighted score or applied as a penalty/bonus with configurable weights and caps/normalization).

**Detailed Scoring Rules:** Default quirk weight 0.2; team-specific 0.1–0.4. Caps: quirk subtotal +0.5 / -0.5; apply cap before weighting. Normalization: sum quirk contributions → apply cap → multiply by quirk_weight. Formula: Final score = PRD-001_base_score + (quirk_weight × capped_quirk_subtotal).

**Rationale / Examples:** Native MCP Support = +0.3; Token Efficiency = +0.2; Rate Limit Spikes = -0.3. Caps and normalization rules apply to the subtotal before integration.

### Positive Quirk Scoring (0.1-0.5 bonus)

- **Native MCP Support** (Claude): +0.3
- **Token Efficiency** (DeepSeek, GLM): +0.2
- **Massive Context** (Gemini): +0.2
- **Open Weights** (DeepSeek, Grok, Mistral): +0.1
- **Low Latency** (Mistral, Gemini Flash): +0.2

### Negative Quirk Scoring (0.1-0.5 penalty)

- **Verbose Near Context Limit** (Claude): -0.2
- **Rate Limit Spikes** (OpenAI): -0.3
- **Vendor-Reported Only** (DeepSeek, Grok): -0.2
- **Documentation Gaps** (Mistral, GLM): -0.1
- **Regional Variability** (Gemini, GLM): -0.1

### Operational Quirk Scoring (0.05-0.2)

- **Profile Complexity** (OpenAI): -0.1
- **API Evolution** (Gemini): -0.1
- **Platform Dependencies** (Cohere): -0.05
- **Integration Complexity** (DeepSeek): -0.1

## Recommendations

1. **Update PRD-001 Quirks Column**: Replace generic descriptions with specific model behaviors
2. **Add Quirk Scoring Matrix**: Create numerical scoring for positive/negative quirks
3. **Team-Specific Quirk Weighting**: Different teams may value different quirks
4. **Continuous Monitoring**: Quirks evolve with model updates and API changes
5. **User Feedback Loop**: Collect real-world quirk observations from development teams

## Implementation Plan

### Phase 1: Documentation Updates

- Update PRD-001 table with specific quirks — Owner: Docs team — Target: Q2 2026 — Success: All model-family dossiers updated — Depends: None
- Add detailed quirk descriptions to model family dossiers — Owner: Docs team — Target: Q2 2026 — Success: Quirk column populated — Depends: None
- Create quirk scoring rubric — Owner: Platform leads — Target: Q2 2026 — Success: Rubric approved — Depends: None

### Phase 2: Scoring Integration

- Implement quirk scoring in decision engine — Owner: Platform team — Target: Q3 2026 — Success: calculateQuirksScore integrated — Depends: Phase 1 quirk scoring rubric
- Add team-specific quirk weighting — Owner: Platform team — Target: Q3 2026 — Success: Config schema supports quirks_weighting — Depends: Phase 2 scoring
- Update agent configuration templates — Owner: Platform team — Target: Q3 2026 — Success: Templates include quirks section — Depends: Phase 2 scoring

### Phase 3: Monitoring & Feedback

- Implement quirk performance monitoring — Owner: Platform team — Target: Q4 2026 — Success: Metrics dashboard live — Depends: Phase 2
- Add feedback mechanisms for quirk observations — Owner: Product — Target: Q4 2026 — Success: Feedback flow documented — Depends: Phase 2
- Regular quirk review and update cycle — Owner: Platform leads — Target: Ongoing — Success: Quarterly review cadence — Depends: Phase 3 monitoring

---

**Next Steps:** Review this analysis with the team and prioritize which quirks to implement first in the scoring system.
