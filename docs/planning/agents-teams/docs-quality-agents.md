# feat(agents): Add dedicated agents for Documentation and Quality teams

> **Labels**: `enhancement`, `agents`, `teams`
> **Priority**: P2

## Summary

Two of the 10 defined teams have **no dedicated agents**, making them unable to meaningfully execute delegated work through the orchestrator:

| Team          | ID              | Scope                              | Handoff Source                                            | Current Agents |
| ------------- | --------------- | ---------------------------------- | --------------------------------------------------------- | -------------- |
| Documentation | T8 (`docs`)     | `docs/**`, ADRs, guides, CHANGELOG | `backend → [testing, docs]`, `frontend → [testing, docs]` | **None**       |
| Quality       | T10 (`quality`) | `**/*` (universal)                 | `testing → [quality]`                                     | **None**       |

When the orchestrator delegates to these teams, there is no agent definition to guide behavior — the AI falls back to generic instructions, losing team-specific expertise and quality criteria.

## Gap 1: Documentation Team (T8)

### Current Definition

```yaml
# teams.yaml line 57-70
- id: docs
  name: DOCUMENTATION
  focus: 'Docs, ADRs, guides'
  scope:
    [
      'docs/**',
      'docs/architecture/decisions/**',
      '.github/**',
      'README.md',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
    ]
  accepts: [implement, review, document]
  handoff-chain: []
```

### Impact of Missing Agent

- Backend and frontend teams hand off to `docs` — but docs has no agent to receive
- ADR creation has no agent-guided quality criteria
- CHANGELOG updates have no structured convention enforcement
- API documentation (`docs/api/`) has no review agent
- The `document` accept type is unique to this team but has no agent implementing it

### Proposed Agent: `docs-writer`

```yaml
operations:
  - id: docs-writer
    category: operations
    name: Technical Writer
    role: >
      Technical documentation specialist responsible for maintaining project
      documentation, Architecture Decision Records, API references, runbooks,
      and developer guides. Ensures documentation stays in sync with
      implementation and follows the 8-category structure defined in
      the documentation rule domain.
    accepts:
      - implement
      - review
      - document
    depends-on: []
    notifies:
      - product-manager
    focus:
      - 'docs/**'
      - '**/*.md'
      - 'CHANGELOG.md'
      - 'CONTRIBUTING.md'
      - 'README.md'
    responsibilities:
      - Write and maintain technical documentation following the 8-category structure
      - Create and update Architecture Decision Records (ADRs) in docs/architecture/decisions/
      - Maintain API documentation in docs/api/ in sync with implementation
      - Update CHANGELOG.md following Keep a Changelog format for every user-facing change
      - Review documentation for accuracy, completeness, and clarity
      - Generate history documents for significant work using docs/history/ templates
      - Maintain developer setup guides in docs/engineering/
      - Ensure generated file headers are not manually edited
    domain-rules:
      - 'Follow documentation domain rules [doc-8-category-structure, doc-adr-format, doc-changelog, doc-api-spec]'
      - 'Follow git-workflow domain rules [gw-conventional-commits, gw-sync-before-pr]'
      - 'Follow agent-conduct domain rules [ac-verify-before-change, ac-respect-generated-headers]'
    conventions:
      - ADRs must follow the format: title, status, context, decision, consequences
      - Changelog entries categorised as Added, Changed, Deprecated, Removed, Fixed, Security
      - All public APIs documented with method, path, request/response schema, auth requirements
    anti-patterns:
      - Documentation that duplicates code comments instead of explaining why
      - Stale API docs that don't match current implementation
      - ADRs without a clear decision or with missing consequences section
```

## Gap 2: Quality Team (T10)

### Current Definition

```yaml
# teams.yaml line 79-84
- id: quality
  name: QUALITY
  focus: 'Code review, refactoring, bugs, reliability, session retrospectives'
  scope: ['**/*']
  accepts: [review, investigate]
  handoff-chain: []
```

### Impact of Missing Agent

- Testing team hands off to `quality` as terminal gate — but no agent exists to evaluate
- Quality team has universal scope (`**/*`) but no structured review criteria in agent form
- Session retrospectives (`/review --focus=retrospective`) route here but have no agent guidance
- The Definition of Done from `QUALITY_GATES.md` has no agent enforcing it
- `retrospective-analyst` exists in the `operations` category but is NOT mapped to the Quality team

### Proposed Agent: `quality-reviewer`

```yaml
operations:
  - id: quality-reviewer
    category: operations
    name: Quality Reviewer
    role: >
      Code quality and architectural consistency reviewer responsible for
      cross-cutting quality concerns, technical debt identification,
      refactoring recommendations, and Definition of Done enforcement.
      Reviews work from all teams against project quality standards
      defined in QUALITY_GATES.md.
    accepts:
      - review
      - investigate
    depends-on: []
    notifies: []
    focus:
      - '**/*'
    responsibilities:
      - Review code for quality, maintainability, and adherence to project conventions
      - Enforce Definition of Done criteria from QUALITY_GATES.md on all PRs
      - Identify refactoring opportunities and technical debt
      - Validate architectural decisions against project ADRs and patterns
      - Assess cross-service integration points for consistency
      - Review error handling, logging, and observability patterns
      - Flag excessive code complexity and suggest simplification
      - Verify test quality (no tautologies, no implementation-detail testing)
      - Ensure no dead code, commented-out blocks, or debug statements
      - Conduct session retrospectives when invoked via /review --focus=retrospective
    domain-rules:
      - "Follow quality domain rules — enforce coverage threshold, review checklist, test quality signals"
      - "Follow testing domain rules [qa-coverage-threshold, qa-no-skipped-tests, qa-aaa-pattern]"
      - "Follow agent-conduct domain rules [ac-verify-before-change, ac-explain-trade-offs, ac-run-checks]"
    conventions:
      - Every review must check the quality gate checklist (lint, types, tests, coverage, secrets)
      - Technical debt must be tracked with TODO(issue-number) comments and tech-debt label
      - Flaky tests must be quarantined and tracked within two sprints
    anti-patterns:
      - Approving PRs without verifying test coverage
      - Ignoring technical debt without creating tracking issues
      - Reviewing only happy-path logic without edge case analysis

### Note on `retrospective-analyst`

The existing `retrospective-analyst` agent (operations category, line 651) focuses on session reviews and lessons learned. Consider:

- **Option A**: Map `retrospective-analyst` to Quality team alongside `quality-reviewer`
- **Option B**: Merge retrospective responsibilities into `quality-reviewer` and remove `retrospective-analyst`
- **Recommendation**: Option A — keep them separate. `quality-reviewer` handles code quality; `retrospective-analyst` handles process improvement.
```

## Implementation Steps

1. Add `docs-writer` agent to `agents.yaml` under `operations` category
2. Add `quality-reviewer` agent to `agents.yaml` under `operations` category
3. Optionally map `retrospective-analyst` to Quality team in team routing
4. Run `pnpm --dir .agentkit agentkit:sync`
5. Verify all platform outputs regenerated correctly
6. Update `UNIFIED_AGENT_TEAMS.md` team-agent mapping table

## Acceptance Criteria

- [ ] Documentation team has at least one dedicated agent (`docs-writer`)
- [ ] Quality team has at least one dedicated agent (`quality-reviewer`)
- [ ] Agent accept types match team accept types (docs: `implement, review, document`; quality: `review, investigate`)
- [ ] Handoff chains function end-to-end: `backend → testing → quality` with agents at each step
- [ ] All 603+ existing tests continue to pass
- [ ] Generated outputs across all 15+ platforms are in sync

## References

- Teams: `.agentkit/spec/teams.yaml` lines 57-84
- Existing agents: `.agentkit/spec/agents.yaml` (24 agents across 6 categories)
- Quality gates: `QUALITY_GATES.md`
- Documentation rules: `.claude/rules/documentation.md`
- Retrospective analyst: `.agentkit/spec/agents.yaml` line 651
