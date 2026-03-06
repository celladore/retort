# Planning Index

Central planning registry for agentkit-forge. Each entry tracks a discrete work item with status, priority, remaining actions, and dependencies. Organized by domain.

> **Last updated**: 2026-03-06
> **Source**: Consolidated from `docs/reference/issues/` analysis files (now archived to `archive/`)

---

## Status Legend

| Status        | Meaning                                              |
| ------------- | ---------------------------------------------------- |
| `not-started` | Work defined but not begun                           |
| `partial`     | Some deliverables completed                          |
| `completed`   | All deliverables done                                |
| `blocked`     | Cannot proceed without prerequisite                  |
| `deferred`    | Intentionally postponed (trigger conditions not met) |
| `duplicate`   | Covered by another item                              |

---

## Agents & Teams

Work items related to agent/team structure, mapping gaps, and new team proposals.

| ID     | Title                                                                  | Priority | Status      | Plan File                                                                        | Blockers                            |
| ------ | ---------------------------------------------------------------------- | -------- | ----------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| AT-001 | Add dedicated agents for Documentation and Quality teams               | P2       | not-started | [agents-teams/docs-quality-agents.md](agents-teams/docs-quality-agents.md)       | None                                |
| AT-002 | Create Design team for brand-guardian and ui-designer agents           | P3       | not-started | [agents-teams/design-team.md](agents-teams/design-team.md)                       | None                                |
| AT-003 | Create Marketing/Growth team for content-strategist and growth-analyst | P3       | not-started | [agents-teams/marketing-team.md](agents-teams/marketing-team.md)                 | None                                |
| AT-004 | Address team/agent mapping gaps (umbrella)                             | P3       | not-started | [agents-teams/restructuring-gaps.md](agents-teams/restructuring-gaps.md)         | AT-001, AT-002, AT-003              |
| AT-005 | Evaluate need for dedicated Architect agent                            | P2       | not-started | [agents-teams/architect-agent.md](agents-teams/architect-agent.md)               | Requires data-driven analysis       |
| AT-006 | Separate cost analytics from Data Engineer agent                       | P3       | deferred    | [agents-teams/data-agent-refactoring.md](agents-teams/data-agent-refactoring.md) | FO-001 triggers; cost centre growth |

## FinOps & Cost Management

Multi-repo cost governance spanning agentkit-forge, ai-gateway, and pvc-costops-analytics.

| ID     | Title                                      | Priority | Status      | Plan File                                                                      | Blockers                             |
| ------ | ------------------------------------------ | -------- | ----------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| FO-001 | Wave 3: AI Gateway Budget Controls         | P0       | not-started | [finops/wave3-gateway-budget.md](finops/wave3-gateway-budget.md)               | External repo (phoenixvc/ai-gateway) |
| FO-002 | Wave 4: Cost Centre Analytics              | P1       | not-started | [finops/wave4-cost-centre-analytics.md](finops/wave4-cost-centre-analytics.md) | External repo; FO-001                |
| FO-003 | Wave 5: End-to-End Integration & Hardening | P2       | not-started | [finops/wave5-integration.md](finops/wave5-integration.md)                     | FO-001, FO-002                       |
| FO-004 | FinOps Specialist agent consideration      | P3       | deferred    | [agents-teams/finops-specialist.md](agents-teams/finops-specialist.md)         | FO-001 through FO-003                |

## Cost Governance (Local)

Items scoped to agentkit-forge cost tooling.

| ID     | Title                                          | Priority | Status      | Plan File                                                                                  | Blockers                                    |
| ------ | ---------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| CG-001 | Budget Guard Remediation (security)            | P1       | blocked     | [cost-governance/budget-guard-remediation.md](cost-governance/budget-guard-remediation.md) | Template protection (human maintainer edit) |
| CG-002 | Expose --budget flag in /cost command template | P2       | partial     | [cost-governance/cost-budget-flag.md](cost-governance/cost-budget-flag.md)                 | Template protection (human maintainer edit) |
| CG-003 | Add cost review gate to handoff chains         | P2       | not-started | [cost-governance/cost-review-handoff.md](cost-governance/cost-review-handoff.md)           | Interim: use data team; long-term: FO-004   |

## Framework & Templates

Items related to AgentKit Forge framework structure, template organization, and tooling.

| ID     | Title                                                        | Priority | Status      | Plan File                                                                                  | Blockers                             |
| ------ | ------------------------------------------------------------ | -------- | ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| FW-001 | Template directory organization & restructuring              | P3       | not-started | [framework/template-organization.md](framework/template-organization.md)                   | Requires engine changes (maintainer) |
| FW-002 | Audit and refactor all scripts and configuration files       | P2       | not-started | [framework/scripts-config-refactor.md](framework/scripts-config-refactor.md)               | None                                 |
| FW-003 | Documentation site generation — wiki & static site options   | P2       | not-started | [framework/docs-wiki-generation.md](framework/docs-wiki-generation.md)                     | None                                 |
| FW-004 | Planning agent & automated planning workflow                 | P2       | not-started | [framework/planning-agent-automation.md](framework/planning-agent-automation.md)           | None                                 |
| FW-005 | Dependency graph integration with orchestrator & agent teams | P2       | not-started | [framework/dependency-graph-orchestration.md](framework/dependency-graph-orchestration.md) | FW-004 (optional)                    |

## Completed / Archived

| ID     | Title                              | Status               | Archive Location                                                               |
| ------ | ---------------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| AR-001 | Verify finops.md generated content | completed            | [archive/finops-md-verification.md](archive/finops-md-verification.md)         |
| AR-002 | Cost budget flag template update   | duplicate (= CG-002) | [archive/cost-budget-flag-duplicate.md](archive/cost-budget-flag-duplicate.md) |

---

## Dependency Graph

```
CG-001 (P1, SECURITY) ──────────────────────── standalone (human maintainer)
CG-002 (P2) ────────────────────────────────── standalone (human maintainer)
CG-003 (P2) ────────────────────────────────── optional: FO-004
AT-001 (P2) ────────────────────────────────── standalone
AT-002 (P3) ────────────────────────────────── standalone
AT-003 (P3) ────────────────────────────────── standalone
AT-004 (P3) ──── depends on ──── AT-001, AT-002, AT-003
AT-005 (P2) ────────────────────────────────── requires analysis
AT-006 (P3) ──── depends on ──── FO-001 triggers
FO-001 (P0) ────────────────────────────────── external repo
FO-002 (P1) ──── depends on ──── FO-001
FO-003 (P2) ──── depends on ──── FO-001, FO-002
FO-004 (P3) ──── depends on ──── FO-001, FO-002, FO-003
FW-001 (P3) ────────────────────────────────── requires engine changes (maintainer)
FW-002 (P2) ────────────────────────────────── standalone
FW-003 (P2) ────────────────────────────────── standalone
FW-004 (P2) ────────────────────────────────── standalone
FW-005 (P2) ──── optional dep on ──── FW-004
```

## Integration Notes

This planning index is designed to be:

- **Machine-readable**: Status, priority, and dependency fields use consistent enum values
- **UI-integrable**: Each item has a unique ID, status, priority, and file reference
- **Backlog-compatible**: Items can be imported to AGENT_BACKLOG.md via `/sync-backlog`
- **Independent**: Does not duplicate backlog entries; references plan files for detail
