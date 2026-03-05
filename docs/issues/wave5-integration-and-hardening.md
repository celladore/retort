# Wave 5: End-to-End Integration & Hardening

> **Target repos**: `agentkit-forge` (orchestration), `phoenixvc/ai-gateway` (runtime), `phoenixvc/pvc-costops-analytics` (analytics)
> **Labels**: `finops`, `integration`, `cost-management`
> **Priority**: P2

## Summary

Wire together the three enforcement layers (session budget guard → gateway spend cap → Azure budgets) into a unified cost governance pipeline with end-to-end telemetry, automated alerts, and operational workflows.

## Decision Context

| # | Decision | Chosen | Rationale |
|---|---|---|---|
| 7 | Budget approval workflow | GitHub Issues | Keeps everything in-repo, uses existing PR/issue infrastructure |

## Deliverables

### 5.1 End-to-End Telemetry Pipeline

**Data flow**:
```
Agent session (agentkit-forge)
  → cost-tracker.mjs logs to JSONL
  → session metrics: duration, commands, files

Gateway requests (ai-gateway)
  → usage_tracker.py callback
  → token/cost metrics per request
  → writes to ADX or Log Analytics

Cost analytics (pvc-costops-analytics)
  → ingests both session and gateway telemetry
  → joins with Azure Cost Management data
  → produces unified cost view per cost centre
```

**Integration points**:
- Define a shared telemetry schema version contract between repos
- Align event families: `session_*`, `gateway_*`, `azure_cost_*`
- Ensure timestamp alignment (all UTC, RFC3339)

### 5.2 Budget Alert Webhooks → Slack/Teams

**Repo**: `pvc-costops-analytics`

Set up Azure Monitor Action Groups that:
1. Fire on budget threshold breach (80%, 100%, 120%)
2. Send webhook to a lightweight relay (Azure Function or Logic App)
3. Relay formats and posts to Slack channel / Teams webhook
4. Include: cost centre name, budget amount, current spend, % utilization, top cost drivers

### 5.3 Monthly Automated Review Workflow

**Repo**: `pvc-costops-analytics`

GitHub Actions cron job (monthly, 1st of month):
1. Query cost data for previous month via Azure Cost Management API
2. Generate budget utilization report per cost centre
3. Flag anomalies and budget overages
4. Create a GitHub Issue with the report and `finops-review` label
5. Tag cost centre owners for review

### 5.4 Budget Approval Workflow (GitHub Issues)

**Repo**: `pvc-costops-analytics` (or `agentkit-forge` for template)

Flesh out the budget approval process:

**Issue template** (`.github/ISSUE_TEMPLATE/budget-change.md`):
```yaml
name: Budget Change Request
about: Request a new cost centre or budget increase
labels: ['finops-approval']
assignees: []
body:
  - type: dropdown
    id: change-type
    label: Change Type
    options:
      - New cost centre
      - Budget increase
      - Budget decrease
      - Cost centre merge
      - Cost centre decommission
  - type: input
    id: cost-centre
    label: Cost Centre ID (if existing)
  - type: input
    id: proposed-budget
    label: Proposed Monthly Budget (USD)
  - type: textarea
    id: justification
    label: Justification
    description: Why is this change needed? Include current vs proposed budget.
  - type: input
    id: duration
    label: Expected Duration
    description: Permanent, or temporary with end date?
  - type: checkboxes
    id: approval-checklist
    label: Approval Checklist
    options:
      - label: I have verified current spend against proposed budget
      - label: I have notified the cost centre owner
      - label: This change has been discussed with the team
```

**Approval process**:
1. Issue created with `finops-approval` label
2. Auto-assign to designated budget approver (CODEOWNERS-like)
3. Approver reviews justification and spend data
4. Approved → apply Terraform changes via PR
5. Rejected → close with rationale
6. Emergency increases: bypass approval, create post-incident review issue within 5 business days

### 5.5 Cost Governance Documentation

**Repo**: `pvc-costops-analytics`

Create `docs/cost-governance-runbook.md`:
- How to create a new cost centre (step-by-step)
- How to request a budget increase
- How to respond to budget alerts
- How to investigate cost anomalies
- How to decommission a cost centre
- Monthly review process and cadence
- Escalation paths for budget overages
- Emergency budget increase procedure

### 5.6 Cross-System Visibility Dashboard

**Repo**: `pvc-costops-analytics`

Unified Grafana dashboard combining:
- Agent session metrics (from agentkit JSONL logs)
- Gateway usage metrics (from usage_tracker telemetry)
- Azure infrastructure costs (from Cost Management API)
- Budget utilization per cost centre
- Cost attribution: which agent sessions drove which gateway costs

## Acceptance Criteria

- [ ] End-to-end data flow: agent session → gateway telemetry → ADX/Log Analytics → Grafana
- [ ] Budget alert webhooks fire and deliver to Slack/Teams
- [ ] Monthly review GitHub Action runs and creates issue with report
- [ ] Budget change issue template works end-to-end
- [ ] Cost governance runbook covers all key scenarios
- [ ] Unified dashboard shows cross-system cost visibility

## References

- Plan: `plan.cost-management.md` Parts 5-8
- Upstream migration spec: `.agentkit/docs/router_specialist/UPSTREAM_MIGRATION_SPEC.md` §6
- FinOps integration: `.agentkit/docs/router_specialist/FINOPS_AGENTKIT_INTEGRATION.md`
