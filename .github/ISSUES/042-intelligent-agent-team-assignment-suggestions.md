# Intelligent agent/team assignment suggestions

## Summary

Add weighted decision matrix logic to suggest the most appropriate agent or team when assigning work, based on task characteristics and agent capabilities.

## Current state

- Agent/team assignment is based on area routing and explicit accepts/depends-on chains
- No consideration of task complexity, agent workload, or capability fit
- Static routing rules don't adapt to project context or agent performance
- No guidance when multiple agents could handle a task

## Problem

- Task assignment doesn't optimize for agent strengths or current workload
- No way to balance work across teams or avoid agent bottlenecks
- Difficult to decide between multiple suitable agents for complex tasks
- No learning from past assignment success/failure patterns

## Proposed change

### Task characterization framework

Add task metadata to classify work:

```yaml
task-types:
  bug-fix:
    complexity-weight: 0.6
    expertise-required: 0.7
    collaboration-needed: 0.3
  feature-implementation:
    complexity-weight: 0.8
    expertise-required: 0.9
    collaboration-needed: 0.6
  architecture-review:
    complexity-weight: 0.9
    expertise-required: 0.95
    collaboration-needed: 0.4
```

### Agent capability scoring

Extend agent scoring with dynamic factors:

```yaml
scoring:
  # Static scores (from mission framework)
  technical-expertise: 0.9
  architectural-fit: 0.85
  code-quality: 0.8
  
  # Dynamic factors
  current-workload: 0.3  # 0.0 = fully booked, 1.0 = available
  recent-success-rate: 0.85  # Based on recent task outcomes
  domain-relevance: 0.9  # How well agent matches task domain
```

### Assignment algorithm

Implement weighted scoring:

```
agent_score = Σ(dimension_weight * agent_score) * availability_factor * domain_relevance
```

### Assignment suggestions API

Add CLI command and API endpoint:

```bash
agentkit suggest-assignment --task-type feature --area backend --complexity high
agentkit suggest-team --task "Add authentication API" --consider-workload
```

## Assignment alternatives considered

### 1. Round-robin with capability filter
- **Pros**: Simple, balances workload
- **Cons**: Ignores task complexity and agent strengths
- **Weight**: 0.4

### 2. Expertise-based routing only
- **Pros**: Maximizes technical fit
- **Cons**: Can overload expert agents, ignores workload
- **Weight**: 0.6

### 3. Machine learning assignment
- **Pros**: Learns from patterns, optimizes over time
- **Cons**: Complex, requires training data, opaque decisions
- **Weight**: 0.7

### 4. Weighted matrix approach (recommended)
- **Pros**: Transparent, balances multiple factors, configurable
- **Cons**: Requires manual weight tuning
- **Weight**: 0.9

## Decision matrix factors

| Factor | Weight | Description | Data source |
|--------|--------|-------------|-------------|
| Technical expertise | 0.30 | Agent's domain knowledge | Agent scoring |
| Current workload | 0.25 | Availability and capacity | State tracking |
| Task complexity fit | 0.20 | Match between task and agent skills | Task classification |
| Recent performance | 0.15 | Success rate on similar tasks | Event history |
| Collaboration needs | 0.10 | Cross-team coordination requirements | Task metadata |

## Acceptance criteria

- [ ] Add task classification framework to spec
- [ ] Implement assignment scoring algorithm
- [ ] Add CLI command for assignment suggestions
- [ ] Integrate suggestions into orchestrator delegation
- [ ] Add assignment tracking and success metrics
- [ ] Update documentation with assignment strategy

## Additional context

This system enables:
- More efficient task distribution across teams
- Better matching of complex work to expert agents
- Workload balancing to prevent bottlenecks
- Data-driven assignment decisions
- Continuous improvement through performance tracking

## Files to modify

- `.agentkit/spec/task-types.yaml` — new spec for task classification
- `.agentkit/engines/node/src/assignment-scorer.mjs` — scoring algorithm
- `.agentkit/engines/node/src/orchestrator.mjs` — integrate suggestions
- `.agentkit/engines/node/src/assignment-cli.mjs` — new CLI commands
- `.agentkit/engines/node/src/spec-validator.mjs` — validate task types
