# Wave 4: Cost Centre Analytics

> **Target repo**: `phoenixvc/pvc-costops-analytics`
> **Labels**: `finops`, `data`, `cost-management`
> **Priority**: P1

## Summary

Implement cost centre management in the costops analytics repo: ADX/Log Analytics reference tables, KQL cost centre functions, Grafana dashboards, management scripts, and Azure Policy enforcement.

## Decision Context

| #   | Decision                                 | Chosen                                                 | Rationale                                                                                                  |
| --- | ---------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 3   | Cost centre → resource group cardinality | 1:N                                                    | One centre can own multiple resource groups (natural org structure)                                        |
| 4   | Anomaly detection approach               | Custom KQL in ADX (primary) + Log Analytics (fallback) | More control, already have pipeline; but also implement for non-ADX backend since ADX may be too expensive |
| 5   | Tag enforcement mode                     | Start `audit`, graduate to `deny` per group            | Gradual rollout avoids blocking legitimate work                                                            |

## Important: Dual Backend Support

ADX may be too expensive for some deployments. All cost functions and tables must be implemented for **both** backends:

1. **ADX (Azure Data Explorer)**: Primary, high-performance analytics
2. **Log Analytics workspace**: Cost-effective alternative using the same KQL syntax

The repo's `docs/adx-cost-assessment.md` documents the decision framework. Both implementations must expose the same logical functions so dashboards and scripts work with either backend.

## Deliverables

### 4.1 Cost Centre Reference Tables (P0)

**ADX**: `adx/kql/15_reference_tables.kql` (extend existing)
**Log Analytics**: Equivalent workspace functions or custom log tables

```kql
// Cost centre definitions
.create-merge table cost_centres (
    cost_centre_id: string,
    name: string,
    owner: string,
    monthly_budget: real,
    is_active: bool,
    created_at: datetime,
    updated_at: datetime
)

// Resource group → cost centre mapping (1:N)
.create-merge table cost_centre_resource_groups (
    cost_centre_id: string,
    resource_group_name: string,
    subscription_id: string,
    is_enabled: bool,
    added_at: datetime
)
```

### 4.2 KQL Cost Centre Functions (P0)

**File**: `adx/kql/40_cost_centres.kql`

Functions (implement for both ADX and Log Analytics):

| Function                                     | Purpose                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `cost_by_centre(_since)`                     | Aggregate cost per cost centre via resource group mapping               |
| `budget_utilization(_since)`                 | Spend vs budget per centre, with % utilization                          |
| `disabled_groups()`                          | List resource groups with `is_enabled = false`                          |
| `unbudgeted_resources(_since)`               | Resources in groups not mapped to any cost centre                       |
| `cost_anomaly_detection(_since, _threshold)` | Detect spend spikes exceeding threshold % above rolling average         |
| `cost_trend_by_centre(_since, _grain)`       | Time series of cost per centre at specified grain (hourly/daily/weekly) |

### 4.3 Grafana Dashboards (P1)

**File**: `grafana/dashboards/cost-centre-overview.json`

Panels:

- **Budget vs Actual** (bar chart): Per-centre budget utilization
- **Cost Trend** (time series): Cost per centre over time
- **Unbudgeted Resources** (table): Resources without cost centre mapping
- **Tag Compliance** (gauge): % of resources with mandatory tags
- **Anomaly Timeline** (annotations): When cost anomalies were detected
- **Top 10 Costly Resources** (table): Within selected cost centre

Data source: Must work with both ADX and Log Analytics datasources.

### 4.4 Management Scripts (P1)

**File**: `scripts/manage_cost_centres.py`

CLI for cost centre CRUD:

```bash
python scripts/manage_cost_centres.py list
python scripts/manage_cost_centres.py show --centre-id CC001
python scripts/manage_cost_centres.py create --name "Platform Team" --owner "platform@example.com" --budget 5000
python scripts/manage_cost_centres.py map --centre-id CC001 --rg "pvc-prod-platform-rg-san"
python scripts/manage_cost_centres.py unmap --rg "pvc-prod-platform-rg-san"
python scripts/manage_cost_centres.py status  # budget utilization summary
python scripts/manage_cost_centres.py audit   # tag compliance + budget coverage
```

**Safety**: Per `finops-tag-safety` rule, all tag modification output is `az tag add` commands only — never executed directly.

### 4.5 Azure Policy Enforcement (P2)

**File**: `infra/modules/azure_policy/`

Policies to add:

- **Tag audit**: Audit resources missing mandatory tags (environment, project, owner, cost_center)
- **Tag deny** (graduated): Deny creation of resources without cost_center tag in specified resource groups
- **Tag inheritance**: Auto-inherit tags from resource group to child resources

Start in `audit` mode for all groups. Graduate to `deny` per resource group as teams are onboarded.

### 4.6 Anomaly Detection (P2)

Implement in both backends:

- **Rolling average comparison**: Alert when daily cost exceeds 2x the 7-day rolling average
- **Spike detection**: Alert when hourly cost exceeds 5x the typical hourly cost for that time window
- **New resource detection**: Alert when a resource group's cost appears for the first time (suggests unplanned provisioning)

For ADX: Use materialized views for rolling averages.
For Log Analytics: Use scheduled query rules (`Microsoft.Insights/scheduledQueryRules`).

## Acceptance Criteria

- [ ] Cost centre tables created in both ADX and Log Analytics
- [ ] All 6 KQL functions work against both backends
- [ ] Grafana dashboard displays correctly with ADX datasource
- [ ] Grafana dashboard displays correctly with Log Analytics datasource
- [ ] `manage_cost_centres.py` CRUD operations work end-to-end
- [ ] Tag audit policy deployed and reporting compliance %
- [ ] Anomaly detection fires alerts for simulated cost spikes
- [ ] Schema order maintained (reference tables after base, before cost-analysis)

## References

- Plan: `plan.cost-management.md` Part 6
- FinOps Phase 1 spec: `.agentkit/docs/router_specialist/FINOPS_AGENTKIT_INTEGRATION.md` §4.2
- Existing KQL conventions: `adx/kql/` numbering (10, 15, 35...)
- ADX cost assessment: `docs/adx-cost-assessment.md` in costops repo
