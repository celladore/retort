# refactor(agents): Address team/agent mapping gaps and missing dedicated agents

> **Target repo**: `agentkit-forge`
> **Labels**: `enhancement`, `agents`, `teams`, `tech-debt`
> **Priority**: P3

## Summary

Analysis of the agent and team definitions reveals structural gaps: two teams have no dedicated agents, three agent categories have no corresponding teams, and several handoff chains lack review gates. This issue tracks the gaps and proposes a restructuring plan.

## Current State

### Teams (10 defined in `teams.yaml`)

| Team | ID | Dedicated Agent(s) | Status |
|---|---|---|---|
| Backend | T1 | backend | OK |
| Frontend | T2 | frontend | OK |
| Data | T3 | data | OK |
| Infrastructure | T4 | infra | OK |
| DevOps | T5 | devops | OK |
| Testing | T6 | test-lead, coverage-tracker, integration-tester | Strong (3 agents) |
| Security | T7 | security-auditor | OK |
| Documentation | T8 | **None** | **GAP** |
| Product | T9 | product-manager, roadmap-tracker | OK |
| Quality | T10 | **None** | **GAP** |

### Agents Without Teams (3 categories)

| Agent Category | Agents | Matching Team | Status |
|---|---|---|---|
| Design | brand-guardian, ui-designer | **No team** | **GAP** — agents exist but can't be routed via team delegation |
| Marketing | content-strategist, growth-analyst | **No team** | **GAP** — partially covered by docs/product but no direct routing |
| Operations | dependency-watcher, environment-manager, retrospective-analyst | **No team** | **GAP** — security-auditor routes via Security team, but other ops agents are orphaned |

### Handoff Chain Gaps

Current chains from `teams.yaml`:

```
backend      → [testing, docs]
frontend     → [testing, docs]
data         → [backend, testing]
infra        → [devops, security]
devops       → [testing, security]
testing      → [quality]
security     → []
docs         → []
product      → [backend, frontend]
quality      → []
```

**Missing gates:**
- No **cost/FinOps review** in any chain (see `finops-specialist-agent-consideration.md`)
- No **design review** gate for frontend work
- No **architecture review** gate for cross-cutting changes
- `quality → []` is a terminal with no agents — quality team can't execute

## Gap 1: Documentation Team Has No Agents

### Problem

The Documentation team (T8) is responsible for `docs/**`, ADRs, guides, and API docs. It appears in handoff chains (`backend → [testing, docs]`, `frontend → [testing, docs]`). When work is delegated to this team, there is no agent definition to guide the AI's behavior — it falls back to generic instructions.

### Proposed Solution

Create a `docs-writer` agent in the `operations` or new `documentation` category:

```yaml
- id: docs-writer
  category: operations  # or new 'documentation' category
  name: Documentation Writer
  role: >
    Technical documentation specialist responsible for maintaining project docs,
    ADRs, API references, runbooks, and developer guides. Ensures documentation
    stays in sync with implementation and follows the 8-category structure.
  accepts:
    - implement
    - review
    - investigate
  focus:
    - 'docs/**'
    - '**/*.md'
    - 'CHANGELOG.md'
    - 'CONTRIBUTING.md'
  responsibilities:
    - Write and maintain technical documentation following the 8-category structure
    - Create and update Architecture Decision Records (ADRs) in docs/03_architecture/02_decisions/
    - Maintain API documentation in docs/04_api/
    - Update CHANGELOG.md following Keep a Changelog format
    - Review documentation accuracy after code changes
    - Ensure documentation builds without warnings
```

### Impact

- Documentation team can accept delegated work with clear agent guidance
- ADR creation and maintenance becomes a structured workflow
- Handoff from backend/frontend to docs becomes meaningful

## Gap 2: Quality Team Has No Agents

### Problem

The Quality team (T10) has universal scope (`**/*`) and sits at the end of the testing handoff chain (`testing → [quality]`). It handles code review, refactoring, and reliability concerns. Without a dedicated agent, quality reviews lack structured guidance and consistent criteria.

### Proposed Solution

Create a `quality-reviewer` agent:

```yaml
- id: quality-reviewer
  category: operations  # or new 'quality' category
  name: Quality Reviewer
  role: >
    Code quality and architecture review specialist responsible for cross-cutting
    quality concerns, architectural consistency, refactoring recommendations,
    and technical debt management. Reviews work from all teams against project
    quality standards.
  accepts:
    - review
    - investigate
  focus:
    - '**/*'
  responsibilities:
    - Review code for quality, maintainability, and adherence to project conventions
    - Identify refactoring opportunities and technical debt
    - Validate architectural decisions against project ADRs and patterns
    - Assess cross-service integration points for consistency
    - Review error handling, logging, and observability patterns
    - Flag code complexity and suggest simplification
    - Verify Definition of Done criteria from QUALITY_GATES.md
```

### Impact

- Quality team becomes actionable in handoff chains
- Architecture review gap is partially addressed (cross-cutting quality reviews)
- Technical debt identification becomes systematic

## Gap 3: Design and Marketing Agents Have No Teams

### Problem

Five agents exist without team routing:
- **brand-guardian**: Brand consistency, design tokens, visual identity
- **ui-designer**: UI/UX design, component design, accessibility
- **content-strategist**: Messaging, copy, documentation voice
- **growth-analyst**: User acquisition, KPIs, A/B testing, analytics
- **retrospective-analyst**: Session reviews, lessons learned

These agents can be invoked directly but cannot receive delegated work through the orchestrator's team routing.

### Proposed Solution

Add 2-3 new teams to `teams.yaml`:

```yaml
# Option A: Three new teams (granular)
- id: design
  name: Design
  agents: [brand-guardian, ui-designer]
  focus: ['**/*.css', '**/*.scss', 'src/components/**', 'public/**']
  handoffTo: [frontend, docs]

- id: marketing
  name: Marketing
  agents: [content-strategist, growth-analyst]
  focus: ['docs/**', 'src/pages/marketing/**']
  handoffTo: [frontend, docs]

- id: operations
  name: Operations
  agents: [dependency-watcher, environment-manager, retrospective-analyst]
  focus: ['package.json', '.github/**', 'infra/**']
  handoffTo: [devops, security]
```

```yaml
# Option B: Two new teams (consolidated)
- id: design
  name: Design
  agents: [brand-guardian, ui-designer, content-strategist]
  focus: ['**/*.css', '**/*.scss', 'src/components/**', 'public/**']
  handoffTo: [frontend, docs]

- id: operations
  name: Operations
  agents: [growth-analyst, dependency-watcher, environment-manager, retrospective-analyst]
  focus: ['package.json', '.github/**']
  handoffTo: [devops, docs]
```

### Impact

- All agents become routable via team delegation
- Orchestrator can auto-route design and marketing work
- Handoff chains become complete

## Gap 4: Handoff Chain Updates

After addressing Gaps 1-3, update handoff chains:

```yaml
# Updated chains
backend      → [testing, docs]           # unchanged
frontend     → [design, testing, docs]   # ADD design review gate
data         → [backend, testing]        # unchanged
infra        → [devops, security]        # unchanged (add finops later per separate issue)
devops       → [testing, security]       # unchanged
testing      → [quality]                 # unchanged (quality now has agents)
security     → []                        # unchanged
docs         → []                        # unchanged
product      → [backend, frontend]       # unchanged
quality      → []                        # unchanged (terminal reviewer)
design       → [frontend, docs]          # NEW
marketing    → [frontend, docs]          # NEW (or consolidated into design)
operations   → [devops, security]        # NEW
```

## Implementation Order

| Step | Change | Priority | Dependencies |
|---|---|---|---|
| 1 | Create `quality-reviewer` agent | P2 | None — highest impact gap |
| 2 | Create `docs-writer` agent | P2 | None |
| 3 | Add `design` team definition | P3 | None |
| 4 | Add `operations` team definition | P3 | Decide on marketing consolidation |
| 5 | Update handoff chains | P3 | Steps 1-4 |
| 6 | Run `agentkit:sync` and verify | P2 | Steps 1-5 |

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Agent sprawl — too many agents creates routing confusion | Only add agents where teams exist without them; consolidate where possible |
| Handoff chain complexity — more teams = more handoff paths | Keep chains short (max 2-3 downstream); use parallel review gates |
| Scope overlap — new agents conflict with existing ones | Define clear `accepts` types; quality-reviewer = review only, not implement |
| Sync output bloat — more agents = more generated files | Acceptable tradeoff; sync pipeline handles this well |

## Acceptance Criteria

- [ ] Documentation team (T8) has at least one dedicated agent
- [ ] Quality team (T10) has at least one dedicated agent
- [ ] All agents in `agents.yaml` are routable via at least one team
- [ ] No orphaned agents exist (agents without team routing)
- [ ] Handoff chains updated to reflect new teams
- [ ] `agentkit:sync` regenerates all platform outputs without errors
- [ ] All 603+ existing tests continue to pass

## References

- Agent overlap analysis: session context (March 2026)
- Current agents: `.agentkit/spec/agents.yaml` (24 agents across 6 categories)
- Current teams: `.agentkit/spec/teams.yaml` (10 teams)
- Handoff protocol: `UNIFIED_AGENT_TEAMS.md`
- Quality gates: `QUALITY_GATES.md`
