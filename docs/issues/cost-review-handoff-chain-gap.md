# fix(teams): Add cost review gate to handoff chains

> **Labels**: `bug`, `teams`, `finops`, `cost-management`
> **Priority**: P2

## Summary

**No handoff chain includes a cost review gate.** Infrastructure changes that affect cloud spend are not routed through any cost governance checkpoint before deployment. This means:

- New resources can be provisioned without cost impact assessment
- Tag compliance issues are caught only by the Infra Engineer's own review (no second-party check)
- Budget-exceeding changes are not flagged in the handoff process
- Cost governance is not gated — it relies entirely on individual agent diligence

## Current Handoff Chains

```yaml
backend      → [testing, docs]           # No cost review
frontend     → [testing, docs]           # No cost review
data         → [backend, testing]        # No cost review (even though data owns cost dashboards)
infra        → [devops, security]        # No cost review (this is the critical gap)
devops       → [testing, security]       # No cost review
testing      → [quality]                 # N/A
security     → []                        # Terminal
docs         → []                        # Terminal
product      → [backend, frontend]       # No cost review
quality      → []                        # Terminal
```

### Critical Gap: `infra → [devops, security]`

The Infrastructure team provisions cloud resources. Its handoff goes to DevOps (for CI/CD pipeline) and Security (for compliance). **Cost governance is not in this chain.**

When the Infra Engineer provisions a new resource group, consumption budget, or expensive service, the handoff skips cost review entirely. The `finops` rule domain has 7 conventions for cost governance, but none are enforced through the handoff protocol.

## Proposed Fix

### Immediate: Add cost review to infra handoff chain

```yaml
# Current
- id: infra
  handoff-chain: [devops, security]

# Proposed
- id: infra
  handoff-chain: [devops, security, data] # data owns cost analytics (until finops-specialist exists)
```

**Rationale**: The Data Engineer currently owns cost attribution dashboards and cost-centre reporting (agents.yaml lines 165-167). Adding `data` to infra's handoff ensures cost impact is reviewed.

### Future: When FinOps Specialist agent is created

```yaml
# Future state (after finops-specialist is created)
- id: infra
  handoff-chain: [devops, security, finops] # dedicated cost review
```

### Additional chain updates

```yaml
# Data team should also route through cost review for schema changes that affect data costs
- id: data
  handoff-chain: [backend, testing] # No change needed — data IS the cost reviewer for now

# DevOps should consider cost impact of CI/CD infrastructure
- id: devops
  handoff-chain: [testing, security] # Consider adding data/finops in future
```

## Implementation

### Step 1: Update `teams.yaml` (spec file — requires human edit)

In `.agentkit/spec/teams.yaml`, update the infra team's handoff chain:

```yaml
- id: infra
  name: INFRA
  focus: 'IaC, cloud, Terraform/Bicep'
  scope: ['infra/**', 'terraform/**', 'bicep/**', 'pulumi/**']
  accepts: [implement, review, plan, investigate]
  handoff-chain: [devops, security, data] # ADD data for cost review
```

### Step 2: Add cost review convention to infra agent

Add to Infrastructure Engineer's domain-rules in `agents.yaml`:

```yaml
domain-rules:
  # ... existing rules ...
  - 'Follow finops domain rules [finops-cost-centre-governance, finops-tag-safety] — ensure cost attribution and budget compliance'
```

### Step 3: Re-sync

```bash
pnpm -C .agentkit agentkit:sync
```

### Step 4: Verify handoff routing

Confirm the orchestrator processes the updated chain correctly when delegating infra tasks.

## Risk Assessment

| Risk                                                   | Mitigation                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Data team overloaded with cost reviews                 | Data only reviews cost-impacting infra changes, not all infra work                     |
| Handoff chain becomes too long (3 downstream)          | Parallel handoff — devops, security, data can review concurrently                      |
| Data team may not have context for IaC cost assessment | Document which cost conventions data should check (tag compliance, budget association) |

## Acceptance Criteria

- [ ] Infra team's handoff chain includes a cost review gate
- [ ] Cost-impacting infrastructure changes are reviewed before deployment
- [ ] `agentkit:sync` regenerates all platform outputs
- [ ] Handoff protocol documentation updated in `UNIFIED_AGENT_TEAMS.md`
- [ ] All existing tests pass

## References

- Teams: `.agentkit/spec/teams.yaml` (handoff chains)
- Infra agent: `.agentkit/spec/agents.yaml` lines 237-312
- Data agent cost responsibilities: `.agentkit/spec/agents.yaml` lines 165-167
- FinOps rules: `.agentkit/spec/rules.yaml` (finops domain)
- FinOps specialist proposal: `docs/issues/finops-specialist-agent-consideration.md`
