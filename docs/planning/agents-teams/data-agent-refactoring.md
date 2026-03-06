# refactor(agents): Separate cost analytics concerns from Data Engineer agent

> **Labels**: `refactor`, `agents`, `finops`, `cost-management`
> **Priority**: P3

## Summary

The Data Engineer agent currently owns two distinct domains: traditional data engineering (schemas, migrations, query optimisation) and cost analytics (dashboards, cost-centre reporting, anomaly monitoring). These were added during Wave 2 of the cost management plan but create a growing scope problem. This issue proposes refactoring to cleanly separate these concerns.

## Current State

### Data Engineer Agent (`agents.yaml` lines 133-192)

**Core data responsibilities (original):**

- Design and maintain database schemas and data models
- Write and review migration scripts for safety and reversibility
- Optimise queries and indexing strategies
- Implement data validation at the model layer
- Manage seed data and test fixtures
- Ensure data integrity constraints and referential integrity
- Plan and execute data migration strategies for breaking changes

**Cost analytics responsibilities (added Wave 2, lines 165-167):**

- Build and maintain cost attribution dashboards and analytics (ADX/KQL for Azure, or provider-equivalent)
- Implement cost-centre reporting functions (cost_by_product, cost_trend_by_product, untagged_resources)
- Monitor cost anomalies and generate alerts for spend exceeding budget thresholds

**Cost-related focus paths (also added Wave 2, lines 155-156):**

- `adx/**`
- `grafana/**`

### Infrastructure Engineer Agent (`agents.yaml` lines 237-312)

Also has cost-adjacent responsibilities:

- Provision consumption budget resources (line 279)
- Enforce cost-center tag on all resources (line 280)
- Run cost impact assessment before provisioning (line 281)
- Ensure resource groups have consumption budgets (line 282)

### Overlap Analysis

| Concern                      | Data Engineer    | Infra Engineer | Proposed Owner    |
| ---------------------------- | ---------------- | -------------- | ----------------- |
| Database schema design       | Primary          | -              | Data Engineer     |
| Migration scripts            | Primary          | -              | Data Engineer     |
| Query optimisation           | Primary          | -              | Data Engineer     |
| Cost attribution dashboards  | Primary (Wave 2) | -              | FinOps Specialist |
| Cost-centre reporting        | Primary (Wave 2) | -              | FinOps Specialist |
| Cost anomaly monitoring      | Primary (Wave 2) | -              | FinOps Specialist |
| Budget resource provisioning | -                | Primary        | Infra Engineer    |
| Cost-center tag enforcement  | -                | Primary        | Infra Engineer    |
| Cost impact assessment       | -                | Primary        | Infra Engineer    |

## Problem Statement

1. **Scope creep**: Data Engineer owns 10 responsibilities spanning two unrelated domains
2. **Cognitive load**: Cost analytics requires FinOps domain knowledge (Azure Cost Management API, consumption budgets, KQL for ADX) distinct from data engineering (schema design, Prisma, migrations)
3. **Focus path pollution**: `adx/**` and `grafana/**` are cost analytics paths, not data engineering paths — they pollute routing
4. **No single cost owner**: Cost governance is split between Data Engineer (analytics) and Infra Engineer (provisioning) with no coordination point
5. **Scaling concern**: As Waves 3-5 are implemented, cost analytics workload will grow significantly

## Proposed Refactoring

### Option A: Extract to new FinOps Specialist agent (recommended)

See `docs/issues/finops-specialist-agent-consideration.md` for the full agent definition.

**Changes to Data Engineer:**

1. Remove lines 165-167 (cost analytics responsibilities)
2. Remove `adx/**` and `grafana/**` from focus paths (lines 155-156)
3. Data Engineer returns to its core 7 responsibilities

**Changes to agents.yaml:**

1. Add `finops-specialist` agent under `operations` category
2. Set `depends-on: [data, infra]` for the new agent
3. Set `notifies: [infra, devops]`

### Option B: Move cost analytics to Infrastructure Engineer

**Pros:**

- No new agent needed
- Infra already owns budget provisioning and tag enforcement
- Consolidates all cost concerns in one agent

**Cons:**

- Infra Engineer already has 14 responsibilities — adding 3 more worsens scope creep
- Cost analytics (KQL dashboards) is conceptually different from IaC (Terraform modules)
- Infra's focus paths don't include `adx/**` or `grafana/**`

### Option C: Keep current state, add coordination rule

**Pros:**

- No structural change needed
- Minimal disruption

**Cons:**

- Scope creep persists
- No clear cost governance owner
- Handoff between Data and Infra for cost concerns remains implicit

## Trigger Criteria

Implement Option A when **any** of these conditions are met:

- [ ] Waves 3-5 are being implemented (cost analytics workload grows)
- [ ] Cost centre count exceeds 5 active centres
- [ ] Data Engineer's cost analytics work exceeds 30% of its task volume
- [ ] A second cloud provider is added (cross-cloud cost views required)

## Implementation Steps

1. Create `finops-specialist` agent in `agents.yaml` (see companion issue)
2. Remove lines 165-167 from Data Engineer responsibilities
3. Remove `adx/**` and `grafana/**` from Data Engineer focus paths
4. Add `finops-specialist` to intake routing in `teams.yaml`
5. Run `pnpm -C .agentkit agentkit:sync`
6. Update `UNIFIED_AGENT_TEAMS.md`
7. Verify all existing tests pass

## Acceptance Criteria

- [ ] Data Engineer has ≤7 responsibilities, all data-focused
- [ ] Cost analytics responsibilities have a clear, single owner
- [ ] Focus paths accurately reflect each agent's domain
- [ ] No overlap in cost-related responsibilities between agents
- [ ] Handoff chain includes cost review gate (see companion issue)
- [ ] All generated outputs in sync

## References

- Data Engineer: `.agentkit/spec/agents.yaml` lines 133-192
- Infrastructure Engineer: `.agentkit/spec/agents.yaml` lines 237-312
- FinOps Specialist proposal: `docs/issues/finops-specialist-agent-consideration.md`
- Cost management plan: `plan.cost-management.md`
- FinOps rules: `.agentkit/spec/rules.yaml` (finops domain)
