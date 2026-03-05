# feat(teams): Create Design team for brand-guardian and ui-designer agents

> **Labels**: `enhancement`, `teams`, `agents`
> **Priority**: P3

## Summary

The **Design** agent category contains two agents — `brand-guardian` and `ui-designer` — that have no corresponding team in `teams.yaml`. These agents can be invoked directly but cannot receive delegated work through the orchestrator's team routing, breaking the delegation protocol.

## Current State

### Design Agents (agents.yaml lines 317-445)

**brand-guardian** (line 318):

- Role: Brand consistency, design system integrity, visual identity enforcement
- Focus: `brand.yaml`, `*.css`, `*.scss`, `theme/**`, `design-tokens/**`, `public/brand/**`
- Accepts: `review`, `investigate`
- Notifies: `ui-designer`, `frontend`

**ui-designer** (line 407):

- Role: UI/UX design, component design, accessibility review, interaction patterns
- Focus: `components/**`, `*.tsx`, `*.jsx`, `*.css`, `*.scss`
- Accepts: `review`, `plan`
- Notifies: `frontend`, `brand-guardian`

### Team Mapping Gap

```
Teams:     [backend, frontend, data, infra, devops, testing, security, docs, product, quality]
Agents:    [... design: brand-guardian, ui-designer ...]
                       ↑ NO TEAM MAPPING ↑
```

### Impact

- Frontend team hands off to `[testing, docs]` — **no design review gate**
- Brand consistency changes (e.g., after `/brand` command runs) have no team routing
- Orchestrator cannot auto-delegate design work via team routing
- The `brand-guardian` agent's `notifies: [ui-designer, frontend]` works agent-to-agent but not team-to-team

## Proposed Team Definition

```yaml
# Add to teams.yaml after existing teams
- id: design
  name: DESIGN
  focus: 'Brand, design system, UI/UX review'
  scope:
    - 'components/**'
    - 'src/components/**'
    - '**/*.css'
    - '**/*.scss'
    - 'theme/**'
    - 'design-tokens/**'
    - 'public/brand/**'
    - '.agentkit/spec/brand.yaml'
  accepts: [review, plan, investigate]
  handoff-chain: [frontend, docs]
```

### Routing Update

```yaml
# Add to teams.yaml → intake.routing
routing:
  # ... existing routes ...
  design: design
```

### Handoff Chain Update

Add design review gate to frontend's chain:

```yaml
# Current
- id: frontend
  handoff-chain: [testing, docs]

# Proposed
- id: frontend
  handoff-chain: [design, testing, docs]
```

This ensures UI changes get brand/design review before testing.

## Alternative: Merge into Frontend Team

**Pros:**

- No new team; simpler routing
- Design agents work closely with frontend anyway

**Cons:**

- Frontend team scope expands significantly
- Brand consistency is not just a frontend concern (docs, marketing materials, API responses)
- Loses the ability to delegate design-only reviews

**Recommendation**: Create a separate Design team. Brand and design concerns are cross-cutting — not frontend-only.

## Implementation Steps

1. Add `design` team to `.agentkit/spec/teams.yaml`
2. Add `design` to intake routing
3. Update `frontend` handoff chain to include `design`
4. Run `pnpm -C .agentkit agentkit:sync`
5. Update `UNIFIED_AGENT_TEAMS.md` team-agent mapping table
6. Verify all generated outputs

## Acceptance Criteria

- [ ] `brand-guardian` and `ui-designer` are routable via Design team
- [ ] Frontend handoff chain includes design review gate
- [ ] Orchestrator can auto-delegate design work
- [ ] `agentkit:sync` regenerates all platform outputs without errors
- [ ] All existing tests pass

## References

- Design agents: `.agentkit/spec/agents.yaml` lines 317-445
- Teams: `.agentkit/spec/teams.yaml`
- Brand command: `.claude/commands/brand.md`
- Brand spec: `.agentkit/spec/brand.yaml`
