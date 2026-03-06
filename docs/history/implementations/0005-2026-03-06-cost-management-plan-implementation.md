# Cost Management Infrastructure — Comprehensive Plan

> **Context**: Recent incident where agent usage spiraled out of control.
> **Scope**: Three repos — `agentkit-forge` (spec/templates), `ai-gateway` (runtime), `pvc-costops-analytics` (FinOps analytics).
> **Goal**: Unified cost governance spanning AI agent usage, Azure infrastructure, and resource group budgeting.

---

## Part 1: Current State Analysis

### 1.1 What Exists Today

| Capability                                               | Repo                  | Status                       | Gap                                                         |
| -------------------------------------------------------- | --------------------- | ---------------------------- | ----------------------------------------------------------- |
| Session cost tracking (duration, commands, files)        | agentkit-forge        | Implemented                  | Observation-only — no enforcement                           |
| Budget-guard module (circuit breaker)                    | agentkit-forge        | **Just added** (this branch) | Not wired to hooks, no tests, no CLI integration            |
| `/cost` CLI command                                      | agentkit-forge        | Implemented                  | Reports only — no limits                                    |
| `/infra-eval` with cost dimension (16% weight)           | agentkit-forge        | Implemented                  | Evaluation-only — no remediation                            |
| `infra` agent with cost-optimization responsibility      | agentkit-forge        | Defined                      | Generic — not specialized for cost governance               |
| FinOps integration spec (FINOPS_AGENTKIT_INTEGRATION.md) | agentkit-forge        | Documented                   | Phase 1 spec exists but not implemented in templates        |
| AI Gateway with rate limiting                            | ai-gateway            | Deployed                     | No budget caps, no usage telemetry export, no chargeback    |
| Azure Container Apps (scale-to-zero)                     | ai-gateway            | Deployed                     | No Azure Budget resources in Terraform                      |
| ADX cost analytics (KQL, Grafana)                        | pvc-costops-analytics | Partial                      | Private repo; Phase 1 spec defined but checklist incomplete |
| pvc-costops-analytics overlay                            | agentkit-forge        | Scaffolded                   | Empty — no rules, commands, or cost config                  |

### 1.2 What Caused the Spiral

The incident exposed **three missing layers**:

1. **No circuit breaker** — `cost-tracker.mjs` records usage but never blocks
2. **No gateway-level spend cap** — `ai-gateway` has rate limiting but no budget ceiling
3. **No cross-system visibility** — agent session costs and Azure infra costs are disconnected silos

---

## Part 2: Repository Responsibility Model (Extended)

Building on the existing model from `FINOPS_AGENTKIT_INTEGRATION.md`:

| Concern                                        | Primary Repo            | What It Owns                                                      |
| ---------------------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| **Budget policy schema & enforcement engine**  | `agentkit-forge`        | `budget-guard.mjs`, policy config in `settings.yaml`, hook wiring |
| **Agent session cost tracking**                | `agentkit-forge`        | `cost-tracker.mjs`, `/cost` command, session JSONL logs           |
| **FinOps methodology & templates**             | `agentkit-forge`        | Rules, Phase 1 spec template, overlay config for FinOps repos     |
| **Cost centre / resource group management UX** | `pvc-costops-analytics` | ADX tables, KQL functions, Grafana dashboards, cost centre CRUD   |
| **Azure Budget resources (IaC)**               | `ai-gateway`            | Terraform `azurerm_consumption_budget_*` in infra/modules         |
| **Gateway usage metering & telemetry**         | `ai-gateway`            | Request logging, token counting, usage export to ADX              |
| **Chargeback / cost attribution**              | `pvc-costops-analytics` | Product mapping, resource group → cost centre, trend analytics    |
| **Alert routing (Slack/webhook)**              | `pvc-costops-analytics` | Action groups, alert rules, webhook dispatch                      |

---

## Part 3: Agent Analysis — Who Handles Cost Today

### 3.1 Current Agent Landscape

| Agent                  | Category    | Cost-Related Responsibilities                                                                                                    | Assessment                                                       |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **infra**              | engineering | "Optimize cloud costs and resource utilization", "Enforce mandatory resource tagging (environment, project, owner, cost-center)" | Broad mandate. Cost is 2 of 8 responsibilities. Not specialized. |
| **devops**             | engineering | "Configure monitoring, alerting"                                                                                                 | Tangential — monitors, doesn't govern cost                       |
| **observability-lead** | specialized | "Monitoring, alerting, tracing setup"                                                                                            | Monitors metrics but not cost-specific                           |
| **data-analyst**       | specialized | "Data pipelines, analytics, reporting"                                                                                           | Could do cost reporting but not defined to                       |
| **architect**          | governance  | "System design decisions, ADRs"                                                                                                  | Makes cost-impacting decisions but doesn't track them            |

### 3.2 Recommendation: Do NOT Create a Dedicated "Cost Agent"

**Rationale**:

- Cost governance is a **cross-cutting concern**, not a domain silo
- The `infra` agent already owns IaC and tagging — adding Azure Budgets is natural
- The `data-analyst` agent already handles analytics — cost dashboards fit
- A dedicated cost agent would create handoff friction with `infra` (who provisions) and `data-analyst` (who reports)

**Instead**: Augment existing agents with cost-specific instructions:

| Agent            | Augmentation                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **infra**        | Add: "Provision Azure Budget resources for every resource group. Enforce cost centre tags. Run budget impact assessment before provisioning new resources." |
| **data-analyst** | Add: "Build and maintain cost attribution dashboards. Implement cost centre reporting via ADX/KQL."                                                         |
| **devops**       | Add: "Wire budget alert webhooks to notification channels. Ensure CI includes cost policy checks."                                                          |
| **architect**    | Add: "Include cost impact assessment in ADRs. Evaluate cost centre boundaries during system design."                                                        |

### 3.3 Platform-Specific Agent Configuration

**Current state**: Deployment platform is configured in `project.yaml` (`cloudProvider`, `iacTool`). The `/deploy` command auto-detects platform from file markers (Dockerfile, vercel.json, etc.). The `infra` agent's IaC toolchain defaults are set in `agents.yaml`.

**Is an Azure-specific agent needed?** No.

The existing pattern is correct — platform configuration lives in `project.yaml` and agent instructions are templated via Handlebars:

```yaml
# project.yaml
deployment:
  cloudProvider: azure
  iacTool: terraform
```

The `infra` agent instructions should be **conditionally extended** based on `cloudProvider`:

- If `azure`: Add Azure Budget, Cost Management API, resource group governance instructions
- If `aws`: Add AWS Budgets, Cost Explorer instructions
- If `gcp`: Add GCP Billing Budgets instructions

This is handled by the existing template rendering pipeline — no new agent needed.

---

## Part 4: Implementation Plan — agentkit-forge

### 4.1 Complete Budget-Guard Module (budget-guard.mjs)

The module created on this branch needs:

**A. Fix technical issues in current implementation:**

- Remove `await import()` inside non-async `logBudgetEvent()` — use `appendFileSync` directly (already imported at top)
- Remove `await import()` inside `parseYamlBudgetPolicy()` — make it sync-only with regex fallback
- Add proper ESM-compatible sync YAML loading or commit to regex-only

**B. Wire to PreToolUse hook:**

Create `.agentkit/templates/claude/hooks/budget-guard-check.sh`:

```bash
#!/usr/bin/env bash
# Hook: PreToolUse (Bash, Write, Edit)
# Checks budget before allowing tool execution
set -euo pipefail
INPUT=$(cat)
AGENTKIT_ROOT="${CWD:-.}/.agentkit"
if [[ -d "$AGENTKIT_ROOT" ]] && command -v node &>/dev/null; then
  RESULT=$(node -e "
    import('${AGENTKIT_ROOT}/engines/node/src/budget-guard.mjs')
      .then(m => console.log(JSON.stringify(m.evaluateForHook('${AGENTKIT_ROOT}'))))
      .catch(() => console.log('{\"decision\":\"allow\"}'))
  " 2>/dev/null || echo '{"decision":"allow"}')
  echo "$RESULT"
else
  echo '{"decision":"allow"}'
fi
```

**C. Register hook in settings.yaml:**

```yaml
hooks:
  preToolUse:
    - match: 'Bash|Write|Edit'
      hook: budget-guard-check
```

**D. Add budget policy section to settings.yaml:**

```yaml
budgetPolicy:
  enforcement: warn # warn | enforce | off
  session:
    maxDurationMinutes: 120
    maxCommands: 200
    maxFilesModified: 100
    warnAtPercent: 80
  daily:
    maxSessions: 50
    maxTotalDurationMinutes: 480
    maxTotalCommands: 1000
    warnAtPercent: 80
```text

**E. Add `/budget` CLI command** (or extend `/cost`):

```text
cost --budget          # Show budget status (session + daily)
cost --budget --set enforcement=enforce
cost --budget --policy # Show active policy
```

### 4.2 Update Agent Definitions (agents.yaml)

**Infra agent — add to responsibilities:**

```yaml
- Provision Azure Budget resources (azurerm_consumption_budget_resource_group) for every resource group
- Enforce cost-center tag on all resources; reject plans missing cost attribution
- Run cost impact assessment before provisioning resources exceeding $100/month estimated
- When cloudProvider is azure, ensure resource groups have associated consumption budgets
```

**Data-analyst agent — add to responsibilities:**

```yaml
- Build and maintain cost attribution dashboards (ADX/KQL for Azure, or provider-equivalent)
- Implement cost-centre reporting: cost_by_product, cost_trend_by_product, untagged_resources
- Monitor cost anomalies and generate alerts for spend exceeding budget thresholds
```

**Architect agent — add to responsibilities:**

```yaml
- Include cost impact assessment section in all ADRs for infrastructure changes
- Evaluate cost centre boundaries during system design reviews
- Review resource group organization for cost governance alignment
```

### 4.3 Templates & Rules Changes

**A. New rule domain — `finops` (`.agentkit/spec/rules.yaml`):**

```yaml
finops:
  - id: finops-phased-delivery
    description: Use phased delivery for cost visibility features; confirm before advancing phases
    scope: ['adx/**', 'grafana/**', 'scripts/*cost*', 'scripts/*tag*']
  - id: finops-reference-tables
    description: Cost attribution uses reference tables (products, resource_group_project); never hardcode mappings
    scope: ['adx/**', '**/*.kql']
  - id: finops-tag-safety
    description: Tag modification scripts must be output-only; no execution without IaC check
    scope: ['scripts/**']
  - id: finops-audit-reversibility
    description: Any action modifying resource state must support audit logging and reversibility
    scope: ['infra/**', 'scripts/**']
```

**B. New template — cost centre management (`templates/claude/commands/cost-centres.md`):**
A slash command for `/cost-centres` that guides agents through:

- Listing cost centres and their resource groups
- Creating/updating budget allocations per resource group
- Enabling/disabling resource groups
- Adding/removing resources within groups
- Viewing spend vs budget across centres

**C. Populate pvc-costops-analytics overlay:**

```yaml
# .agentkit/overlays/pvc-costops-analytics/rules.yaml
domains:
  - finops
  - azure-cost-ops

# .agentkit/overlays/pvc-costops-analytics/commands.yaml
commands:
  cost-centres:
    enabled: true
  infra-eval:
    enabled: true
    focus: cost
```

### 4.4 Infra-Eval Enhancement

Add a **cost sub-evaluation** to `/infra-eval` that specifically checks:

- Do all resource groups have Azure Budget resources? (Hard gate candidate)
- Are cost-center tags present on all resources?
- Is there a cost attribution pipeline (ADX/equivalent)?
- Are budget alert action groups configured?
- Scale-to-zero enabled where applicable?

---

## Part 5: Implementation Plan — ai-gateway

### 5.1 Add Azure Budget Terraform Resources

In `infra/modules/aigateway_aca/`:

```hcl
# budget.tf
resource "azurerm_consumption_budget_resource_group" "gateway" {
  name              = "${var.naming_prefix}-budget"
  resource_group_id = azurerm_resource_group.main.id
  amount            = var.monthly_budget_amount
  time_grain        = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00Z", timestamp())
  }

  notification {
    enabled        = true
    threshold      = 80
    operator       = "GreaterThan"
    contact_emails = var.budget_alert_emails
    threshold_type = "Actual"
  }

  notification {
    enabled        = true
    threshold      = 100
    operator       = "GreaterThan"
    contact_emails = var.budget_alert_emails
    threshold_type = "Actual"
  }

  notification {
    enabled        = true
    threshold      = 120
    operator       = "GreaterThan"
    contact_emails = var.budget_alert_emails
    threshold_type = "Forecasted"
  }
}
```

**Variables to add:**

```hcl
variable "monthly_budget_amount" {
  type    = number
  default = 500
}
variable "budget_alert_emails" {
  type    = list(string)
  default = []
}
```

### 5.2 Add Usage Telemetry Export

The LiteLLM proxy already logs requests. Add a sidecar or callback that:

1. Counts tokens per request (input/output/cache)
2. Tags with user, model, and session ID
3. Exports to ADX (or Log Analytics) for cost attribution

**Implementation**: LiteLLM supports `success_callback` and `failure_callback`. Add a custom callback that writes to Azure Monitor or directly to ADX ingestion endpoint.

### 5.3 Add Spend Cap Middleware

Add a middleware to the gateway that:

1. Checks cumulative daily/monthly spend against configurable cap
2. Returns 429 with `X-Budget-Exceeded: true` when cap is hit
3. Allows exempt API keys (for critical paths)

This is the **runtime circuit breaker** that would have prevented the spiral incident.

### 5.4 Dashboard Enhancements

Extend the existing `dashboard/` to show:

- Real-time token consumption
- Spend rate (tokens/minute, $/hour)
- Budget utilization gauge
- Top consumers by API key

---

## Part 6: Implementation Plan — pvc-costops-analytics

### 6.1 Cost Centre Management (Core Feature)

**ADX Reference Tables:**

```kql
// 15_reference_tables.kql (extend existing)
.create-merge table cost_centres (
    cost_centre_id: string,
    name: string,
    owner: string,
    monthly_budget: real,
    is_active: bool,
    created_at: datetime,
    updated_at: datetime
)

.create-merge table cost_centre_resource_groups (
    cost_centre_id: string,
    resource_group_name: string,
    subscription_id: string,
    is_enabled: bool,
    added_at: datetime
)
```

**KQL Functions:**

```text
cost_by_centre(_since)         — Aggregate cost per cost centre
budget_utilization(_since)     — Spend vs budget per centre
disabled_groups()              — List disabled resource groups
unbudgeted_resources(_since)   — Resources not in any cost centre
```

**Grafana Dashboards:**

- Cost Centre Overview (budget vs actual per centre)
- Resource Group Drill-down (spend breakdown within a centre)
- Budget Alerts Timeline (when thresholds were crossed)
- Unmanaged Resources (resources not assigned to any cost centre)

### 6.2 Production-Ready Capabilities Beyond Basic CRUD

| Capability                               | Why It's Needed                                                       | Azure Integration Point                         |
| ---------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| **Budget rollover / carry-forward**      | Unused budget shouldn't disappear                                     | Custom logic on `azurerm_consumption_budget`    |
| **Anomaly detection**                    | Detect cost spikes before budget is hit                               | Azure Cost Management Anomaly API or custom KQL |
| **Forecast projection**                  | "At current rate, budget will be exceeded by X date"                  | Azure Cost Management Forecast API              |
| **Tag compliance scoring**               | % of resources properly tagged per group                              | `az tag list` + ADX inventory                   |
| **Cost allocation rules**                | Shared resources (networking, Key Vault) split across centres         | ADX materialized views with allocation logic    |
| **Approval workflow for budget changes** | Prevent ad-hoc budget increases                                       | GitHub Issue template + webhook                 |
| **Scheduled budget reviews**             | Monthly review cadence                                                | GitHub Actions cron + report generation         |
| **Resource group lifecycle**             | Create/archive/delete groups with safety checks                       | `azurerm_resource_group` + state validation     |
| **Policy enforcement**                   | Prevent resource creation in unbudgeted groups                        | Azure Policy + `azurerm_policy_assignment`      |
| **Multi-subscription support**           | Enterprise environments span subscriptions                            | Azure Management Group scoping                  |
| **Cost showback reports**                | Per-team / per-product cost visibility for non-technical stakeholders | Grafana dashboard + PDF export                  |
| **Reservation / savings plan tracking**  | Track RI/SP coverage and savings                                      | Azure Cost Management RI API                    |

### 6.3 Azure Integration Points

| Azure Service                     | Integration | Purpose                                       |
| --------------------------------- | ----------- | --------------------------------------------- |
| **Cost Management + Billing API** | Read        | Current spend, forecasts, budget status       |
| **Consumption Budgets API**       | Read/Write  | Create/update budgets per resource group      |
| **Resource Manager**              | Read        | List resource groups, resources, tags         |
| **Resource Graph**                | Query       | Fast cross-subscription resource queries      |
| **Azure Policy**                  | Write       | Enforce tagging, deny unbudgeted provisioning |
| **Azure Monitor Action Groups**   | Write       | Route budget alerts to Slack/email/webhook    |
| **Azure Advisor**                 | Read        | Cost optimization recommendations             |
| **Azure Tags API**                | Read/Write  | Tag compliance and remediation                |
| **Azure Data Explorer**           | Read/Write  | Cost data storage, KQL analytics              |
| **Azure Managed Grafana**         | Read        | Dashboard hosting                             |

### 6.4 Operational Workflows Enabled

1. **New project onboarding**: Create cost centre → assign resource groups → set budget → configure alerts → enable policy enforcement
2. **Monthly budget review**: Auto-generate spend report → compare to budget → flag anomalies → propose adjustments
3. **Resource group decommission**: Disable group → verify no active workloads → archive cost data → remove budget → delete group
4. **Cost spike response**: Anomaly detected → alert fired → root cause investigation → remediation (scale down, disable group, adjust budget)
5. **Chargeback report generation**: Aggregate by cost centre → apply allocation rules → generate per-team invoice data

### 6.5 Azure Constraints to Design Around

| Constraint                                                     | Impact                                                  | Mitigation                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Cost data has 24-48h lag                                       | Real-time budgeting not possible                        | Use Azure Monitor metrics for near-real-time, cost data for daily reconciliation |
| Consumption budgets are per-subscription or per-resource-group | Can't budget arbitrary resource sets                    | Map cost centres to resource groups (1:N)                                        |
| Tag inheritance isn't automatic                                | Child resources don't inherit parent tags               | Azure Policy for tag inheritance                                                 |
| Azure Policy evaluation can be async                           | Policy effects aren't instant                           | Use `deny` mode for critical policies, `audit` for others                        |
| Rate limits on Management APIs                                 | Bulk operations may be throttled                        | Implement retry with exponential backoff                                         |
| RBAC scoping                                                   | Budget management requires Contributor on billing scope | Document required role assignments per cost centre owner                         |

---

## Part 7: Template & Integration Changes Summary

### 7.1 agentkit-forge Changes (This PR)

| File                                                         | Change                                        | Priority |
| ------------------------------------------------------------ | --------------------------------------------- | -------- |
| `.agentkit/engines/node/src/budget-guard.mjs`                | Fix async issues, complete implementation     | P0       |
| `.agentkit/engines/node/src/__tests__/budget-guard.test.mjs` | Full test coverage                            | P0       |
| `.agentkit/spec/settings.yaml`                               | Add `budgetPolicy` section                    | P0       |
| `.agentkit/templates/claude/hooks/budget-guard-check.sh`     | PreToolUse hook script                        | P0       |
| `.agentkit/spec/agents.yaml`                                 | Augment infra, data-analyst, architect agents | P1       |
| `.agentkit/spec/rules.yaml`                                  | Add `finops` rule domain                      | P1       |
| `.agentkit/templates/claude/commands/cost-centres.md`        | New `/cost-centres` slash command             | P1       |
| `.agentkit/overlays/pvc-costops-analytics/rules.yaml`        | Enable finops rules                           | P1       |
| `.agentkit/overlays/pvc-costops-analytics/commands.yaml`     | Enable cost-centres command                   | P1       |
| `.agentkit/templates/claude/commands/cost.md`                | Add `--budget` flag documentation             | P2       |
| `.agentkit/templates/claude/commands/infra-eval.md`          | Add cost sub-evaluation details               | P2       |
| `.agentkit/docs/architecture/COST_TRACKING.md`                            | Update to reflect enforcement layer           | P2       |

### 7.2 ai-gateway Changes (Separate PR)

| File                                           | Change                     | Priority |
| ---------------------------------------------- | -------------------------- | -------- |
| `infra/modules/aigateway_aca/budget.tf`        | Azure Budget resource      | P0       |
| `infra/modules/aigateway_aca/variables.tf`     | Budget variables           | P0       |
| `infra/env/{dev,uat,prod}/terraform.tfvars`    | Budget amounts per env     | P0       |
| `state-service/state_service/usage_tracker.py` | Token counting callback    | P1       |
| `state-service/state_service/spend_cap.py`     | Spend cap middleware       | P1       |
| `dashboard/app.js`                             | Budget utilization display | P2       |
| `docs/COST_MANAGEMENT.md`                      | Document budget setup      | P2       |

### 7.3 pvc-costops-analytics Changes (Separate PR on feat/agentkit-scaffold-and-docs)

| File                                           | Change                                                        | Priority |
| ---------------------------------------------- | ------------------------------------------------------------- | -------- |
| `adx/kql/15_reference_tables.kql`              | cost_centres, cost_centre_resource_groups tables              | P0       |
| `adx/kql/40_cost_centres.kql`                  | cost_by_centre, budget_utilization, disabled_groups functions | P0       |
| `grafana/dashboards/cost-centre-overview.json` | Cost centre dashboard                                         | P1       |
| `scripts/manage_cost_centres.py`               | CLI for cost centre CRUD                                      | P1       |
| `advisor/app/cost_centre_advisor.py`           | Advisor integration for budget recommendations                | P2       |
| `docs/cost-centre-guide.md`                    | User guide for cost centre management                         | P2       |
| `infra/modules/azure_policy/`                  | Tag enforcement and budget policies                           | P2       |

---

## Part 8: Execution Sequence

### Wave 1 — Circuit Breaker (This Branch, Now)

1. Fix `budget-guard.mjs` async issues
2. Write tests for budget-guard
3. Add `budgetPolicy` to `settings.yaml`
4. Create PreToolUse hook
5. Update `/cost` command to include budget status
6. Push to `claude/cost-management-infrastructure-qt4PM`

### Wave 2 — Agent & Template Updates (This Branch or Follow-up)

1. Augment `infra`, `data-analyst`, `architect` agents in `agents.yaml`
2. Add `finops` rule domain
3. Create `/cost-centres` command template
4. Populate `pvc-costops-analytics` overlay
5. Run `agentkit:sync` and commit regenerated output

### Wave 3 — Gateway Budget Controls (ai-gateway repo)

1. Add Terraform budget resources
2. Implement usage telemetry callback
3. Add spend cap middleware
4. Update dashboard

### Wave 4 — Cost Centre Analytics (pvc-costops-analytics repo)

1. Create ADX reference tables for cost centres
2. Implement KQL cost centre functions
3. Build Grafana dashboards
4. Create management scripts
5. Wire Azure Policy enforcement

### Wave 5 — Integration & Hardening

1. End-to-end telemetry: agent session → gateway metering → ADX → Grafana
2. Budget alert webhooks → Slack/Teams
3. Anomaly detection pipeline
4. Monthly automated review workflow
5. Documentation and runbook

---

## Part 9: Decision Points Requiring Input

| #   | Decision                                 | Options                                         | Recommendation                                                 |
| --- | ---------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| 1   | Budget enforcement default               | `warn` vs `enforce` vs `off`                    | Start with `warn`, graduate to `enforce` after team validation |
| 2   | Gateway spend cap scope                  | Per-API-key vs global                           | Per-API-key (enables chargeback)                               |
| 3   | Cost centre → resource group cardinality | 1:1 vs 1:N                                      | 1:N (one centre can own multiple groups)                       |
| 4   | Anomaly detection approach               | Azure native vs custom KQL                      | Custom KQL in ADX (more control, already have pipeline)        |
| 5   | Tag enforcement mode                     | `audit` vs `deny`                               | Start `audit`, graduate to `deny` per group                    |
| 6   | Cross-repo telemetry transport           | Direct ADX ingestion vs Log Analytics workspace | ADX ingestion (already in place for costops)                   |
| 7   | Budget approval workflow                 | GitHub Issues vs external tool                  | GitHub Issues (keeps everything in-repo)                       |
