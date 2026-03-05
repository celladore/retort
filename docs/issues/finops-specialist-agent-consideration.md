# feat(agents): Consider splitting a FinOps Specialist agent from Data Engineer

> **Target repo**: `agentkit-forge`
> **Labels**: `enhancement`, `finops`, `agents`, `cost-management`
> **Priority**: P3 (future consideration)

## Summary

As FinOps scope grows, evaluate whether the Data Engineer agent's cost analytics responsibilities should be split into a dedicated **FinOps Specialist** agent. Currently the Data Engineer owns both traditional data engineering (schemas, migrations, ORM, query performance) and cost analytics (dashboards, cost-centre reporting, anomaly monitoring). This dual focus may become untenable as cost governance matures.

## Context

### Current State

The Data Engineer agent was augmented during Wave 2 of the cost management plan with three new responsibilities:

```yaml
# .agentkit/spec/agents.yaml — data agent (lines 165-167)
- Build and maintain cost attribution dashboards and analytics (ADX/KQL for Azure, or provider-equivalent)
- Implement cost-centre reporting functions (cost_by_product, cost_trend_by_product, untagged_resources)
- Monitor cost anomalies and generate alerts for spend exceeding budget thresholds
```

The Infrastructure Engineer agent also has cost-related responsibilities:

```yaml
# .agentkit/spec/agents.yaml — infra agent (lines 256-260)
- Provision consumption budget resources (e.g. azurerm_consumption_budget_resource_group)
- Enforce cost-center tag on all resources; reject plans missing cost attribution
- Run cost impact assessment before provisioning resources exceeding $100/month estimated
- When cloudProvider is azure, ensure resource groups have associated consumption budgets
```

### Why Not `data-analyst`?

A generic "data-analyst" agent was evaluated and rejected because:
- **High overlap** with Data Engineer (cost analytics) and Growth Analyst (product analytics)
- **No clear boundary** — what would it own that these two don't?
- **Analytics is already distributed**: Data Engineer = infrastructure/cost, Growth Analyst = product/user, Coverage Tracker = test quality

### Why `finops-specialist` Is a Better Fit

A **FinOps Specialist** has a cohesive, well-defined scope that aligns with existing infrastructure:
- The `finops` rule domain already exists with 7 conventions
- The `/cost-centres` command already provides a dedicated workflow
- The `pvc-costops-analytics` overlay enables FinOps capabilities per-repo
- FinOps is a recognized discipline with clear boundaries (cost visibility, optimization, governance)

## Proposed Agent Definition

Only create this agent when cost analytics becomes a significant workload (e.g., when Waves 3-5 are implemented and operational):

```yaml
operations:
  - id: finops-specialist
    category: operations
    name: FinOps Specialist
    role: >
      Cloud cost governance and financial analytics specialist responsible for
      cost centre management, budget allocation, cost attribution dashboards,
      and spend anomaly detection. Ensures cost-effective infrastructure use
      across all environments and cloud providers.
    accepts:
      - investigate
      - review
      - plan
    depends-on:
      - data
      - infra
    notifies:
      - infra
      - devops
    focus:
      - 'adx/**'
      - 'grafana/**'
      - 'scripts/*cost*'
      - 'scripts/*budget*'
      - 'scripts/*tag*'
      - 'infra/**/budget*'
      - 'infra/**/policy*'
      - 'docs/cost/**'
    responsibilities:
      - Design cost attribution models and cost centre hierarchies
      - Build and maintain cost dashboards (ADX/KQL, Log Analytics, or provider-equivalent)
      - Implement cost-centre reporting functions and budget utilization views
      - Monitor spend anomalies and alert on budget threshold breaches
      - Audit resource tagging compliance for cost allocation
      - Recommend cost optimization opportunities across environments
      - Manage budget approval workflows (GitHub Issue-based governance)
      - Maintain cost governance runbooks and escalation procedures
```

### Migration Steps (when triggered)

1. Create `finops-specialist` agent in `.agentkit/spec/agents.yaml` under `operations` category
2. **Remove** cost-specific responsibilities from Data Engineer (lines 165-167):
   - Move cost attribution dashboards to FinOps Specialist
   - Move cost-centre reporting functions to FinOps Specialist
   - Move cost anomaly monitoring to FinOps Specialist
3. **Keep** Infrastructure Engineer cost responsibilities (budget provisioning, tag enforcement) — these are IaC concerns
4. Consider adding a `finops` team to `.agentkit/spec/teams.yaml` or routing via the `infra` team
5. Update handoff chains: `infra → [finops, devops, security]` and `data → [backend, testing]`
6. Run `agentkit:sync` and verify all platform outputs

## Trigger Criteria

Create this agent when **two or more** of these conditions are met:

- [ ] Waves 3-5 are implemented and operational across repos
- [ ] Cost centre count exceeds 5 active centres
- [ ] Monthly cost governance tasks consume >20% of Data Engineer's bandwidth
- [ ] Budget approval workflow is active with regular issue flow
- [ ] Multiple cloud providers are in use (Azure + AWS/GCP), requiring cross-cloud cost views

## Acceptance Criteria

- [ ] FinOps Specialist agent has clear, non-overlapping scope with Data Engineer and Infra Engineer
- [ ] Data Engineer retains database/schema/migration focus without cost analytics burden
- [ ] Handoff chains updated to include FinOps review gate
- [ ] `/cost-centres` command routes correctly to FinOps Specialist context
- [ ] All platform outputs regenerated via `agentkit:sync`
- [ ] Existing finops rule domain and overlay continue to function

## References

- Agent overlap analysis: session context (March 2026)
- Current Data Engineer definition: `.agentkit/spec/agents.yaml` (data agent)
- FinOps rule domain: `.agentkit/spec/rules.yaml` (finops domain, 7 conventions)
- Cost-centres command: `.agentkit/spec/commands.yaml` (cost-centres)
- Overlay: `.agentkit/overlays/pvc-costops-analytics/`
- Plan: `plan.cost-management.md` §3 (Agent Analysis)
