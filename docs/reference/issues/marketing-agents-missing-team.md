# feat(teams): Create Marketing/Growth team for content-strategist and growth-analyst agents

> **Labels**: `enhancement`, `teams`, `agents`
> **Priority**: P3

## Summary

The **Marketing** agent category contains two agents — `content-strategist` and `growth-analyst` — that have no corresponding team in `teams.yaml`. These agents are orphaned from the orchestrator's delegation protocol and cannot receive team-routed work.

## Current State

### Marketing Agents (agents.yaml lines 449-519)

**content-strategist** (line 450):

- Role: Messaging, content strategy, documentation voice and tone, copywriting
- Focus: `docs/**`, `content/**`, `blog/**`, `marketing/**`, `*.md`
- Accepts: `review`, `plan`
- Notifies: `brand-guardian`

**growth-analyst** (line 486):

- Role: User acquisition, KPIs, A/B testing, analytics instrumentation, conversion optimisation
- Focus: `analytics/**`, `src/tracking/**`, `marketing/**`, `src/pages/landing/**`
- Accepts: `investigate`, `plan`, `review`
- Notifies: `product-manager`, `frontend`

### Team Mapping Gap

```
Teams:     [backend, frontend, data, infra, devops, testing, security, docs, product, quality]
Agents:    [... marketing: content-strategist, growth-analyst ...]
                           ↑ NO TEAM MAPPING ↑
```

### Partial Overlap with Existing Teams

| Agent Concern       | Closest Existing Team | Overlap Level                                                                             |
| ------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| Content/copy review | Documentation (T8)    | Medium — docs covers `docs/**` and `*.md` but focus is technical docs, not marketing copy |
| Growth analytics    | Product (T9)          | Low — product covers PRDs and roadmap, not analytics instrumentation                      |
| A/B testing         | Testing (T6)          | Low — testing covers unit/E2E/integration, not experiment design                          |
| Marketing pages     | Frontend (T2)         | Medium — frontend covers `apps/marketing/**`                                              |

No existing team cleanly owns marketing/growth work.

## Proposed Team Definition

### Option A: Dedicated Marketing team (recommended)

```yaml
- id: marketing
  name: MARKETING
  focus: 'Content strategy, growth analytics, conversion optimisation'
  scope:
    - 'marketing/**'
    - 'content/**'
    - 'blog/**'
    - 'analytics/**'
    - 'src/tracking/**'
    - 'src/pages/landing/**'
  accepts: [review, plan, investigate]
  handoff-chain: [frontend, docs]
```

**Routing update:**

```yaml
routing:
  # ... existing routes ...
  marketing: marketing
```

### Option B: Merge into Product team

```yaml
# Expand product team scope
- id: product
  name: PRODUCT
  focus: 'Features, PRDs, roadmap, content strategy, growth analytics'
  scope: ['docs/01_product/**', 'docs/prd/**', 'marketing/**', 'analytics/**', 'content/**']
  accepts: [plan, review, investigate] # ADD investigate
  handoff-chain: [backend, frontend]
```

**Pros:** No new team; product owns user-facing strategy
**Cons:** Product team scope becomes too broad; growth analytics is operational, not strategic

### Option C: Split across existing teams

- `content-strategist` → Documentation team (T8)
- `growth-analyst` → Product team (T9)

**Pros:** No new teams needed
**Cons:** Agents lose their category cohesion; content strategy and growth analytics are tightly coupled

**Recommendation**: Option A — marketing/growth is a distinct discipline with its own metrics, tools, and workflow. It warrants a dedicated team.

## Implementation Steps

1. Add `marketing` team to `.agentkit/spec/teams.yaml`
2. Add `marketing` to intake routing
3. Run `pnpm -C .agentkit agentkit:sync`
4. Update `UNIFIED_AGENT_TEAMS.md` team-agent mapping table
5. Verify all generated outputs

## Acceptance Criteria

- [ ] `content-strategist` and `growth-analyst` are routable via a team
- [ ] Team scope covers all marketing agent focus paths
- [ ] Handoff chain connects marketing to downstream teams (frontend, docs)
- [ ] Orchestrator can auto-delegate marketing/growth work
- [ ] `agentkit:sync` regenerates all platform outputs without errors

## References

- Marketing agents: `.agentkit/spec/agents.yaml` lines 449-519
- Teams: `.agentkit/spec/teams.yaml`
- Product team: `.agentkit/spec/teams.yaml` lines 72-77
- Documentation team: `.agentkit/spec/teams.yaml` lines 57-70
