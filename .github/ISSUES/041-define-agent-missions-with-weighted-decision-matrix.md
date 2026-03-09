# Define agent missions with weighted decision matrix

## Summary

Add a mission/goal framework that agents must follow, with a weighted decision matrix across key matters to guide agent selection and behavior.

## Current state

- Agents have rich persona definitions (role, responsibilities, domain-rules, conventions)
- No explicit mission statement or goal framework
- Agent selection is based on area routing and explicit accepts/depends-on chains
- No systematic way to evaluate which agent is best suited for a specific type of work

## Problem

- Agents lack explicit mission alignment beyond their area focus
- No quantitative framework to compare agent suitability across dimensions
- Difficult to onboard new agents without clear mission boundaries
- No way to systematically evaluate agent performance against mission objectives

## Proposed change

### Add mission framework to agents.yaml

Add new optional fields to each agent:

```yaml
mission:
  statement: 'Deliver robust, scalable backend APIs with clean architecture and comprehensive error handling'
  objectives:
    - 'Design and implement maintainable service architectures'
    - 'Ensure API contracts are versioned and backwards compatible'
    - 'Optimize for performance, security, and testability'
  success-metrics:
    - 'API availability > 99.9%'
    - 'Test coverage > 80%'
    - 'Zero security vulnerabilities in production'
```

### Weighted decision matrix for agent evaluation

Define key matters (dimensions) for agent evaluation:

```yaml
decision-matrix:
  dimensions:
    - id: technical-expertise
      weight: 0.30
      description: 'Depth of technical knowledge in the domain'
    - id: architectural-fit
      weight: 0.25
      description: 'Alignment with project architecture patterns'
    - id: code-quality
      weight: 0.20
      description: 'Consistency with coding standards and best practices'
    - id: domain-knowledge
      weight: 0.15
      description: 'Understanding of business domain requirements'
    - id: collaboration
      weight: 0.10
      description: 'Ability to work effectively with other teams'
```

### Agent scoring matrix

Add optional scoring for each agent against dimensions:

```yaml
scoring:
  technical-expertise: 0.9
  architectural-fit: 0.85
  code-quality: 0.8
  domain-knowledge: 0.75
  collaboration: 0.7
```

## Framework alternatives considered

### 1. OKR-style objectives

- **Pros**: Familiar framework, measurable outcomes
- **Cons**: Corporate-heavy, may not fit AI agent context
- **Weight**: 0.6

### 2. Mission statement + success metrics

- **Pros**: Clear purpose, quantifiable success criteria
- **Cons**: Requires manual scoring updates
- **Weight**: 0.8

### 3. Capability-based scoring

- **Pros**: Data-driven, can be automated
- **Cons**: Complex to maintain, may miss qualitative aspects
- **Weight**: 0.7

### 4. Hybrid approach (recommended)

- **Pros**: Combines mission clarity with quantitative scoring
- **Cons**: More complex schema
- **Weight**: 0.9

## Acceptance criteria

- [ ] Add `mission` and `scoring` optional fields to agent schema
- [ ] Define standard decision matrix dimensions with weights
- [ ] Update spec-validator to accept new fields
- [ ] Add CLI command to display agent mission and scoring
- [ ] Add scoring visualization to agent catalog docs
- [ ] Regenerate all agent files to confirm compatibility

## Additional context

This framework enables:

- Clearer agent onboarding and definition
- Systematic agent comparison and selection
- Performance tracking against mission objectives
- Better alignment between agent capabilities and project needs

## Files to modify

- `.agentkit/spec/agents.yaml` — add mission and scoring fields
- `.agentkit/engines/node/src/spec-validator.mjs` — validate new fields
- `.agentkit/engines/node/src/agent-catalog.mjs` — generate mission/scoring views
- Documentation updates in `docs/agents/`
