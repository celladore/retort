# Wave 3: AI Gateway Budget Controls

> **Target repo**: `phoenixvc/ai-gateway`
> **Labels**: `finops`, `infra`, `cost-management`
> **Priority**: P0

## Summary

Add Azure Budget Terraform resources, usage telemetry export, and a spend cap middleware to the AI gateway. This is the runtime enforcement layer that prevents agent usage cost spirals at the gateway level.

## Decision Context

| #   | Decision                | Chosen                                             | Rationale                                                                 |
| --- | ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| 2   | Gateway spend cap scope | Per-API-key                                        | Enables chargeback and per-consumer limits                                |
| 6   | Telemetry transport     | ADX ingestion (primary) + Log Analytics (fallback) | ADX already in place for costops, but cater for Log Analytics alternative |

## Deliverables

### 3.1 Azure Budget Terraform Resources (P0)

**File**: `infra/modules/aigateway_aca/budget.tf`

Add `azurerm_consumption_budget_resource_group` for every environment (dev/uat/prod):

- 80% actual threshold → email notification
- 100% actual threshold → email + webhook notification
- 120% forecasted threshold → email + webhook notification

**Variables** (`variables.tf`):

```hcl
variable "monthly_budget_amount" {
  type    = number
  default = 500  # USD — override per environment
}
variable "budget_alert_emails" {
  type    = list(string)
  default = []
}
variable "budget_alert_webhook_url" {
  type    = string
  default = ""
}
```

**Environment overrides** (`infra/env/{dev,uat,prod}/terraform.tfvars`):

- dev: $100/month
- uat: $200/month
- prod: $500/month

### 3.2 Usage Telemetry Callback (P1)

**File**: `state-service/state_service/usage_tracker.py`

Implement a LiteLLM `success_callback` that:

1. Counts tokens per request (input_tokens, output_tokens, cache_tokens)
2. Tags with: api_key_hash, model, timestamp, session_id (from header)
3. Writes to ADX ingestion endpoint (primary) or Log Analytics workspace (fallback)
4. Handles errors silently — telemetry must never block requests

Schema for telemetry events:

```json
{
  "timestamp": "RFC3339",
  "api_key_hash": "sha256_prefix_8chars",
  "model": "gpt-5.3-codex",
  "input_tokens": 1234,
  "output_tokens": 567,
  "cache_tokens": 0,
  "latency_ms": 450,
  "status": "success|error",
  "session_id": "optional"
}
```

### 3.3 Spend Cap Middleware (P1)

**File**: `state-service/state_service/spend_cap.py`

Middleware that checks cumulative daily/monthly spend against configurable caps:

- **Per-API-key daily cap**: configurable, default $50
- **Per-API-key monthly cap**: configurable, default $500
- **Global daily cap**: configurable, default $1000
- When cap is hit: return HTTP 429 with `X-Budget-Exceeded: true` header and JSON error body
- Allow exempt API keys (configurable list) for critical paths
- Spend calculation: use token-to-cost mapping table (model → $/1K tokens)

### 3.4 Dashboard Enhancements (P2)

**File**: `dashboard/`

Extend the existing dashboard to show:

- Real-time token consumption (last 1h, 24h)
- Spend rate (tokens/minute, $/hour)
- Budget utilization gauge per environment
- Top consumers by API key (hashed)

## Acceptance Criteria

- [ ] `terraform plan` shows budget resources for all 3 environments
- [ ] Budget alert emails fire when spend exceeds 80% in a test scenario
- [ ] Usage telemetry writes to ADX or Log Analytics successfully
- [ ] Spend cap middleware returns 429 when daily cap is exceeded
- [ ] Exempt API keys bypass the spend cap
- [ ] Dashboard shows real-time token consumption

## References

- Plan: `plan.cost-management.md` Part 5
- FinOps integration spec: `.agentkit/docs/router_specialist/FINOPS_AGENTKIT_INTEGRATION.md`
- AI Gateway PRD: `docs/PRD.md` in ai-gateway repo
