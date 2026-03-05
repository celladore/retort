# feat(agents): Analyse and evaluate the need for a dedicated Architect agent

> **Labels**: `enhancement`, `agents`, `architecture`
> **Priority**: P2

## Summary

Evaluate whether a dedicated **Architect** agent should be added to the agent roster. Currently, no single agent is explicitly responsible for cross-cutting architectural concerns — system design, ADR creation, component interaction review, and architectural consistency enforcement. These responsibilities are implicitly spread across Backend Engineer, Infrastructure Engineer, and the Quality team (which itself has no agents).

## Current State: Who Owns Architecture Today?

| Architectural Concern                               | Current Owner                         | Gap?                                   |
| --------------------------------------------------- | ------------------------------------- | -------------------------------------- |
| API design                                          | Backend Engineer                      | Partial — API-only, not system-wide    |
| Database schema design                              | Data Engineer                         | OK for data layer                      |
| IaC module design                                   | Infrastructure Engineer               | OK for infra layer                     |
| Cross-service integration design                    | **Nobody**                            | **GAP**                                |
| ADR creation/maintenance                            | Docs team (no agent)                  | **GAP** — team exists but has no agent |
| Component interaction review                        | **Nobody**                            | **GAP**                                |
| Tech stack decisions                                | **Nobody explicitly**                 | **GAP**                                |
| Non-functional requirements (perf, scale, security) | Split across security-auditor + infra | Fragmented                             |
| Monolith-to-microservice decomposition              | **Nobody**                            | **GAP**                                |
| System boundary definition                          | **Nobody**                            | **GAP**                                |

### Existing Agents That Touch Architecture

1. **Backend Engineer** — API design, service architecture, dependency injection. Scope: `apps/api/**`, `services/**`. Does NOT own cross-cutting system design.
2. **Infrastructure Engineer** — IaC modules, cloud resources. Scope: `infra/**`, `terraform/**`. Owns infrastructure architecture but not application architecture.
3. **Product Manager** — PRDs, user stories. May include high-level architecture in requirements but doesn't validate implementation against architecture.
4. **Quality team** — `scope: ['**/*']`, accepts `review` and `investigate`. Could theoretically review architecture, but has no agents assigned.

## Proposed Architect Agent

```yaml
engineering: # or new 'architecture' category
  - id: architect
    category: engineering
    name: Solution Architect
    role: >
      Senior solution architect responsible for system-wide design decisions,
      cross-cutting architectural concerns, component interaction design,
      and technology selection. Ensures architectural consistency, creates
      and maintains ADRs, and reviews changes for architectural impact.
    accepts:
      - review
      - plan
      - investigate
    depends-on: []
    notifies:
      - backend
      - frontend
      - infra
      - data
    focus:
      - 'docs/03_architecture/**'
      - 'docs/02_specs/**'
      - 'src/**'
      - 'apps/**'
      - 'services/**'
      - 'infra/**'
    responsibilities:
      - Define and maintain system architecture and component boundaries
      - Create and review Architecture Decision Records (ADRs) in docs/03_architecture/02_decisions/
      - Review cross-service integration points for consistency and coupling
      - Evaluate technology stack decisions and document rationale
      - Define non-functional requirements (performance, scalability, reliability targets)
      - Review PRs for architectural impact and enforce design patterns
      - Identify and document system boundaries for monolith decomposition
      - Maintain architecture diagrams (C4, sequence, deployment)
      - Assess technical debt impact on architectural health
      - Participate in design reviews for features spanning multiple teams
    domain-rules:
      - 'Follow documentation domain rules [doc-adr-format] — all significant decisions must have ADRs'
      - 'Follow agent-conduct domain rules [ac-verify-before-change, ac-explain-trade-offs]'
      - 'Follow quality domain rules — review against Definition of Done criteria'
    conventions:
      - Every feature spanning 2+ services requires an architecture review
      - ADRs must be created before implementation begins for cross-cutting changes
      - Document trade-offs explicitly — never silently choose an approach
    anti-patterns:
      - Making architectural decisions in code without documenting them
      - Allowing tight coupling between services without review
      - Skipping design review for "small" changes that affect interfaces
```

## Team Routing

### Option A: Add to existing Quality team

```yaml
# teams.yaml — quality team update
- id: quality
  name: QUALITY
  focus: 'Code review, refactoring, bugs, reliability, architecture review, session retrospectives'
  scope: ['**/*']
  accepts: [review, investigate, plan] # ADD plan
  handoff-chain: []
```

- Pro: No new team needed; quality is already the terminal review gate
- Con: Quality team is generic; architecture review is distinct from code quality

### Option B: Create Architecture team

```yaml
- id: architecture
  name: ARCHITECTURE
  focus: 'System design, ADRs, cross-cutting architecture review'
  scope: ['docs/03_architecture/**', 'docs/02_specs/**', 'src/**', 'apps/**', 'services/**']
  accepts: [review, plan, investigate]
  handoff-chain: [quality]
```

- Pro: Dedicated routing for architecture concerns
- Con: Another team adds routing complexity

### Option C: Add architect agent to Backend team with expanded scope

- Pro: Minimal structural change
- Con: Architecture is not just backend

## Analysis Tasks

Before implementing, the following analysis should be performed:

- [ ] Review the last 20 PRs to identify how many involved cross-cutting architectural decisions
- [ ] Audit ADR directory — are ADRs being created for significant decisions?
- [ ] Map existing inter-service communication patterns in the codebase
- [ ] Identify recent cases where architectural inconsistency caused bugs or rework
- [ ] Survey team handoff chains for missing architecture review gates
- [ ] Compare with industry patterns (e.g., ThoughtWorks tech radar, C4 model adoption)

## Acceptance Criteria

- [ ] Analysis completed with data-driven recommendation (add or don't add)
- [ ] If adding: agent definition with clear, non-overlapping scope
- [ ] If adding: team routing decided (Option A, B, or C)
- [ ] If adding: handoff chains updated to include architecture review gate
- [ ] If not adding: document which existing agents absorb architectural responsibilities
- [ ] ADR created for the decision either way

## References

- Current agents: `.agentkit/spec/agents.yaml` (24 agents, 6 categories)
- Teams: `.agentkit/spec/teams.yaml` (10 teams)
- ADR directory: `docs/03_architecture/02_decisions/`
- Quality gates: `QUALITY_GATES.md`
