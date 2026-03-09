# Weighted LLM decision for agent assignment

## Summary

Add weighted decision matrix to select optimal LLM models for specific agents/teams during assignment, recognizing that different agents perform better with different LLMs based on task type, domain, and model capabilities.

## Current state

- Agent assignment considers area routing and capabilities
- LLM selection is typically global or per-tool configuration
- No systematic matching of LLM models to agent strengths
- No consideration of LLM specialties (coding vs reasoning vs analysis)

## Problem

- Different agents have different optimal LLM matches
- Backend agents may prefer models with strong system design capabilities
- Frontend agents may benefit from models with better UI/UX reasoning
- Security agents need models with strong vulnerability detection
- No framework to evaluate and select LLMs per agent/team

## Proposed change

### LLM capability matrix

Define LLM strengths across dimensions:

```yaml
llm-capabilities:
  gpt-4:
    reasoning: 0.9
    code-quality: 0.85
    system-design: 0.8
    security-analysis: 0.75
    ui-ux-reasoning: 0.7
    documentation: 0.8
  claude-3.5-sonnet:
    reasoning: 0.85
    code-quality: 0.9
    system-design: 0.85
    security-analysis: 0.8
    ui-ux-reasoning: 0.8
    documentation: 0.95
  deepseek-coder:
    reasoning: 0.7
    code-quality: 0.95
    system-design: 0.75
    security-analysis: 0.6
    ui-ux-reasoning: 0.5
    documentation: 0.7
```

### Agent LLM preferences

Add LLM affinity scoring to agents:

```yaml
agents:
  backend:
    llm-preferences:
      gpt-4: 0.85
      claude-3.5-sonnet: 0.9
      deepseek-coder: 0.8
    required-capabilities:
      - system-design
      - code-quality
      - reasoning
  frontend:
    llm-preferences:
      gpt-4: 0.8
      claude-3.5-sonnet: 0.95
      deepseek-coder: 0.6
    required-capabilities:
      - ui-ux-reasoning
      - code-quality
      - documentation
  security:
    llm-preferences:
      gpt-4: 0.9
      claude-3.5-sonnet: 0.85
      deepseek-coder: 0.5
    required-capabilities:
      - security-analysis
      - reasoning
      - code-quality
```

### LLM assignment algorithm

Calculate optimal LLM per agent:

```
llm_score = Σ(agent_capability_weight * llm_capability_score) * agent_preference_weight
```

### Dynamic LLM selection

Add runtime LLM selection based on task characteristics:

```yaml
task-llm-mapping:
  bug-fix:
    prioritize-capabilities: [code-quality, reasoning]
    fallback-llm: claude-3.5-sonnet
  feature-implementation:
    prioritize-capabilities: [system-design, code-quality]
    fallback-llm: gpt-4
  security-audit:
    prioritize-capabilities: [security-analysis, reasoning]
    fallback-llm: gpt-4
  ui-design:
    prioritize-capabilities: [ui-ux-reasoning, documentation]
    fallback-llm: claude-3.5-sonnet
```

## LLM selection strategies considered

### 1. Static per-agent LLM assignment

- **Pros**: Simple, predictable
- **Cons**: Doesn't adapt to task type
- **Weight**: 0.5

### 2. Task-based LLM routing

- **Pros**: Optimizes for task requirements
- **Cons**: Complex to maintain routing rules
- **Weight**: 0.7

### 3. Capability-based scoring (recommended)

- **Pros**: Flexible, data-driven, considers multiple factors
- **Cons**: Requires capability matrix maintenance
- **Weight**: 0.9

### 4. Performance-based learning

- **Pros**: Adapts based on actual outcomes
- **Cons**: Requires extensive tracking, complex
- **Weight**: 0.8

## Decision factors

| Factor                | Weight | Description                           | Data source       |
| --------------------- | ------ | ------------------------------------- | ----------------- |
| Agent-LLM affinity    | 0.35   | Historical agent performance with LLM | Event tracking    |
| Task capability match | 0.30   | LLM strengths vs task requirements    | Capability matrix |
| Cost efficiency       | 0.20   | Token cost vs performance ratio       | Pricing data      |
| Availability/latency  | 0.15   | Model uptime and response times       | Health checks     |

## Acceptance criteria

- [ ] Add LLM capability matrix to spec
- [ ] Add LLM preference scoring to agents
- [ ] Implement LLM selection algorithm
- [ ] Add task-LLM mapping framework
- [ ] Update orchestrator to use selected LLM per agent
- [ ] Add CLI to test LLM assignments
- [ ] Track LLM performance per agent

## Additional context

This enables:

- Optimal agent-LLM pairings for different task types
- Cost-effective LLM selection based on task complexity
- Performance tracking to refine assignments over time
- Fallback LLM chains for reliability
- A/B testing of LLM effectiveness per agent

## Files to modify

- `.agentkit/spec/llm-capabilities.yaml` — new spec for LLM capabilities
- `.agentkit/spec/agents.yaml` — add llm-preferences field
- `.agentkit/engines/node/src/llm-selector.mjs` — selection algorithm
- `.agentkit/engines/node/src/orchestrator.mjs` — integrate LLM selection
- `.agentkit/engines/node/src/llm-tracker.mjs` — performance tracking
- `.agentkit/engines/node/src/spec-validator.mjs` — validate new fields

## Related issues

- #041: Agent missions with weighted decision matrix
- #042: Intelligent agent/team assignment suggestions
