# Planning Index

Central planning registry for agentkit-forge. Each entry tracks a discrete work item with status, priority, remaining actions, and dependencies. Organized by domain.

> **Last updated**: 2026-03-10
> **Source**: Consolidated from `plan.md`, `docs/reference/issues/`, `.agentkit/docs/`, and GitHub Issues

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

| ID     | Title                                                                  | Priority | Status      | Plan File                                                                        | Blockers                            | GH Issue |
| ------ | ---------------------------------------------------------------------- | -------- | ----------- | -------------------------------------------------------------------------------- | ----------------------------------- | -------- |
| AT-001 | Add dedicated agents for Documentation and Quality teams               | P2       | not-started | [agents-teams/docs-quality-agents.md](agents-teams/docs-quality-agents.md)       | None                                | —        |
| AT-002 | Create Design team for brand-guardian and ui-designer agents           | P3       | not-started | [agents-teams/design-team.md](agents-teams/design-team.md)                       | None                                | —        |
| AT-003 | Create Marketing/Growth team for content-strategist and growth-analyst | P3       | not-started | [agents-teams/marketing-team.md](agents-teams/marketing-team.md)                 | None                                | —        |
| AT-004 | Address team/agent mapping gaps (umbrella)                             | P3       | not-started | [agents-teams/restructuring-gaps.md](agents-teams/restructuring-gaps.md)         | AT-001, AT-002, AT-003              | —        |
| AT-005 | Evaluate need for dedicated Architect agent                            | P2       | not-started | [agents-teams/architect-agent.md](agents-teams/architect-agent.md)               | Requires data-driven analysis       | —        |
| AT-006 | Separate cost analytics from Data Engineer agent                       | P3       | deferred    | [agents-teams/data-agent-refactoring.md](agents-teams/data-agent-refactoring.md) | FO-001 triggers; cost centre growth | —        |
| AT-007 | Multi-disciplinary suggestion-crafting agent                           | P2       | not-started | —                                                                                | None                                | #345     |

## CLI & Packaging

New team and agent for CLI entry points, npm packaging, and distribution pipelines.

| ID      | Title                                             | Priority | Status      | Plan File                                                                          | Blockers | GH Issue |
| ------- | ------------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------- | -------- | -------- |
| CLI-001 | CLI & Packaging Team (T11) + cli-engineer agent   | P1       | not-started | [cli-packaging/cli-team-proposal.md](cli-packaging/cli-team-proposal.md)           | None     | —        |
| CLI-002 | Implement `agentkit update` command (check-only)  | P1       | not-started | —                                                                                  | CLI-001  | #318     |
| CLI-003 | Implement `agentkit update --apply`               | P1       | not-started | —                                                                                  | CLI-002  | #319     |
| CLI-004 | Implement `agentkit update --rollback`            | P2       | not-started | —                                                                                  | CLI-003  | #320     |
| CLI-005 | Implement `agentkit update --version X`           | P2       | not-started | —                                                                                  | CLI-002  | #321     |
| CLI-006 | Auto-update GitHub Action template                | P2       | not-started | —                                                                                  | CLI-003  | #322     |
| CLI-007 | Update preflight + toolchain availability checks  | P2       | not-started | —                                                                                  | CLI-002  | #323     |
| CLI-008 | Update triggers sync for pre-PR enforcement       | P2       | not-started | —                                                                                  | CLI-003  | #324     |
| CLI-009 | Changelog summary in update output and PR body    | P3       | not-started | —                                                                                  | CLI-003  | #325     |
| CLI-010 | Emit telemetry event on forge update              | P3       | not-started | —                                                                                  | CLI-002  | #326     |
| CLI-011 | Standalone `agentkit:drift-check` command         | P2       | not-started | —                                                                                  | None     | #288     |
| CLI-012 | Autoupdate functionality for adopter repos        | P1       | not-started | —                                                                                  | CLI-003  | #258     |

## Intake & Automation

Document-to-backlog intake pipeline and spec processing.

| ID      | Title                                    | Priority | Status      | Plan File                                                            | Blockers | GH Issue |
| ------- | ---------------------------------------- | -------- | ----------- | -------------------------------------------------------------------- | -------- | -------- |
| INT-001 | Intake Agent + /intake command           | P2       | not-started | [intake/intake-agent-proposal.md](intake/intake-agent-proposal.md)   | BUG-001  | —        |

## Bugs

Known bugs requiring fixes.

| ID      | Title                                     | Priority | Status      | Plan File                                                    | Blockers | GH Issue |
| ------- | ----------------------------------------- | -------- | ----------- | ------------------------------------------------------------ | -------- | -------- |
| BUG-001 | PRD detector path bug (discover.mjs)      | P0       | not-started | [bugs/prd-detector-path.md](bugs/prd-detector-path.md)       | None     | —        |
| BUG-002 | Budget-guard workflow logic verification  | P1       | not-started | —                                                            | None     | #328     |

## Brand & Design Tokens

Enhancements to the `/brand` feature and design token generation.

| ID     | Title                                           | Priority | Status      | Plan File                                                              | Blockers | GH Issue |
| ------ | ----------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------- | -------- | -------- |
| BR-001 | Brand guide static HTML page from brand.yaml    | P2       | not-started | [brand/brand-enhancements.md](brand/brand-enhancements.md)             | None     | —        |
| BR-002 | CSS custom properties / design tokens           | P2       | not-started | [brand/brand-enhancements.md](brand/brand-enhancements.md)             | None     | —        |
| BR-003 | Brand inheritance / extends for multi-repo orgs | P3       | not-started | [brand/brand-enhancements.md](brand/brand-enhancements.md)             | None     | —        |
| BR-004 | Theme preview command (agentkit theme:preview)  | P3       | not-started | [brand/brand-enhancements.md](brand/brand-enhancements.md)             | None     | —        |
| BR-005 | WCAG contrast ratio validation in brand.yaml    | P2       | not-started | [brand/brand-enhancements.md](brand/brand-enhancements.md)             | None     | —        |

## FinOps & Cost Management

Multi-repo cost governance spanning agentkit-forge, ai-gateway, and pvc-costops-analytics.

| ID     | Title                                      | Priority | Status      | Plan File                                                                      | Blockers                             | GH Issue |
| ------ | ------------------------------------------ | -------- | ----------- | ------------------------------------------------------------------------------ | ------------------------------------ | -------- |
| FO-001 | Wave 3: AI Gateway Budget Controls         | P0       | not-started | [finops/wave3-gateway-budget.md](finops/wave3-gateway-budget.md)               | External repo (phoenixvc/ai-gateway) | —        |
| FO-002 | Wave 4: Cost Centre Analytics              | P1       | not-started | [finops/wave4-cost-centre-analytics.md](finops/wave4-cost-centre-analytics.md) | External repo; FO-001                | —        |
| FO-003 | Wave 5: End-to-End Integration & Hardening | P2       | not-started | [finops/wave5-integration.md](finops/wave5-integration.md)                     | FO-001, FO-002                       | —        |
| FO-004 | FinOps Specialist agent consideration      | P3       | deferred    | [agents-teams/finops-specialist.md](agents-teams/finops-specialist.md)         | FO-001 through FO-003                | —        |

## Cost Governance (Local)

Items scoped to agentkit-forge cost tooling.

| ID     | Title                                          | Priority | Status      | Plan File                                                                                  | Blockers                                    | GH Issue |
| ------ | ---------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- | -------- |
| CG-001 | Budget Guard Remediation (security)            | P1       | blocked     | [cost-governance/budget-guard-remediation.md](cost-governance/budget-guard-remediation.md) | Template protection (human maintainer edit) | —        |
| CG-002 | Expose --budget flag in /cost command template | P2       | partial     | [cost-governance/cost-budget-flag.md](cost-governance/cost-budget-flag.md)                 | Template protection (human maintainer edit) | —        |
| CG-003 | Add cost review gate to handoff chains         | P2       | not-started | [cost-governance/cost-review-handoff.md](cost-governance/cost-review-handoff.md)           | Interim: use data team; long-term: FO-004   | —        |

## Framework & Templates

Items related to AgentKit Forge framework structure, template organization, and tooling.

| ID     | Title                                                        | Priority | Status      | Plan File                                                                                  | Blockers                             | GH Issue |
| ------ | ------------------------------------------------------------ | -------- | ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------ | -------- |
| FW-001 | Template directory organization & restructuring              | P3       | not-started | [framework/template-organization.md](framework/template-organization.md)                   | Requires engine changes (maintainer) | —        |
| FW-002 | Audit and refactor all scripts and configuration files       | P2       | not-started | [framework/scripts-config-refactor.md](framework/scripts-config-refactor.md)               | None                                 | —        |
| FW-003 | Documentation site generation — wiki & static site options   | P2       | not-started | [framework/docs-wiki-generation.md](framework/docs-wiki-generation.md)                     | None                                 | —        |
| FW-004 | Planning agent & automated planning workflow                 | P2       | not-started | [framework/planning-agent-automation.md](framework/planning-agent-automation.md)           | None                                 | —        |
| FW-005 | Dependency graph integration with orchestrator & agent teams | P2       | not-started | [framework/dependency-graph-orchestration.md](framework/dependency-graph-orchestration.md) | FW-004 (optional)                    | —        |
| FW-006 | Structured sync logging (info/warn/error levels)             | P2       | not-started | [framework/structured-sync-logging.md](framework/structured-sync-logging.md)               | None                                 | —        |
| FW-007 | Adopt stack.json as project metadata descriptor              | P2       | not-started | —                                                                                          | None                                 | #346     |
| FW-008 | Evaluate workflow engines for parallel task execution        | P2       | not-started | —                                                                                          | None                                 | #344     |
| FW-009 | --with-docs-refactor flag for template-driven doc refactor   | P3       | not-started | —                                                                                          | None                                 | #343     |

## Platform Support & Ecosystem

Output targets, platform parity, and ecosystem integrations.

| ID     | Title                                                         | Priority | Status      | Plan File | Blockers | GH Issue |
| ------ | ------------------------------------------------------------- | -------- | ----------- | --------- | -------- | -------- |
| PS-001 | MCP server support — dev config + template output target      | P1       | not-started | —         | None     | #342     |
| PS-002 | .devcontainer generation as output target                     | P2       | not-started | —         | None     | #341     |
| PS-003 | .agent.md output target for VS Code + GitHub.com              | P2       | not-started | —         | None     | #340     |
| PS-004 | Config sync protocol + drift detection (ecosystem)            | P2       | not-started | —         | None     | #339     |
| PS-005 | Maintain list of consuming repositories                       | P3       | not-started | —         | None     | #337     |
| PS-006 | Evaluate scripts from other repos for inclusion               | P3       | not-started | —         | None     | #336     |
| PS-007 | Platform support: Zed, Codex, OpenCode                        | P3       | not-started | —         | None     | #338     |
| PS-008 | Platform support: Droid, Kilo, Kiro                           | P3       | not-started | —         | None     | #339     |
| PS-009 | Platform support: Augment and similar                         | P3       | not-started | —         | None     | #340     |

## Governance & CI

CI/CD improvements, governance pipelines, and adopter repo audits.

| ID     | Title                                                           | Priority | Status      | Plan File | Blockers | GH Issue |
| ------ | --------------------------------------------------------------- | -------- | ----------- | --------- | -------- | -------- |
| GV-001 | Governance pipeline and branch guardrails (epic)                | P1       | not-started | —         | None     | #308     |
| GV-002 | Enforce agentkit sync pre-PR (blocking)                         | P1       | not-started | —         | GV-001   | #194     |
| GV-003 | Migrate branch guardrails into .agentkit source-of-truth        | P2       | not-started | —         | GV-001   | #189     |
| GV-004 | Resolve workflow contradiction for .agentkit change controls    | P2       | not-started | —         | GV-001   | #188     |
| GV-005 | Workflow templating strategy, concurrency, and runner management | P2       | not-started | —         | None     | #327     |
| GV-006 | Audit governance pipeline adoption in downstream repos          | P3       | not-started | —         | GV-001   | #333     |
| GV-007 | Audit hook generation in adopter repos                          | P3       | not-started | —         | None     | #330     |
| GV-008 | Audit branch protection patterns in adopter repos               | P3       | not-started | —         | None     | #331     |
| GV-009 | Test drift detection in adopter repos                           | P3       | not-started | —         | None     | #332     |
| GV-010 | Analyze implemented repos for CI/CD template opportunities      | P3       | not-started | —         | None     | #329     |

## Sync & Drift

Sync engine improvements and drift detection.

| ID     | Title                                                        | Priority | Status      | Plan File | Blockers | GH Issue |
| ------ | ------------------------------------------------------------ | -------- | ----------- | --------- | -------- | -------- |
| SD-001 | Drift detection improvements (epic)                          | P2       | not-started | —         | None     | #307     |
| SD-002 | Per-section drift detection within a file                    | P2       | not-started | —         | None     | #290     |
| SD-003 | Manifest-based drift check (replace git diff)                | P2       | not-started | —         | None     | #289     |
| SD-004 | Automated PR generation for upstream template suggestions    | P3       | not-started | —         | None     | #287     |
| SD-005 | Spec-defaults.yaml for centralised template variable defaults | P2       | not-started | —         | None     | #273     |

## Quality & Code Standards

Code quality framework expansion and multi-language support.

| ID     | Title                                                    | Priority | Status      | Plan File | Blockers | GH Issue |
| ------ | -------------------------------------------------------- | -------- | ----------- | --------- | -------- | -------- |
| QA-001 | Code quality framework expansion — 6 new language domains | P2       | not-started | —         | None     | #232     |
| QA-002 | Evaluate SonarCloud for unified quality dashboard        | P2       | not-started | —         | None     | #231     |
| QA-003 | Add yamllint for YAML spec validation                    | P2       | not-started | —         | None     | #230     |

## DX & Testing

Developer experience improvements and test coverage.

| ID     | Title                                              | Priority | Status      | Plan File                                            | Blockers | GH Issue |
| ------ | -------------------------------------------------- | -------- | ----------- | ---------------------------------------------------- | -------- | -------- |
| DX-001 | Add linter guard for test file imports             | P2       | not-started | [bugs/dx-improvements.md](bugs/dx-improvements.md)   | None     | —        |
| DX-002 | Add parameterized stateDir test for all platforms  | P3       | not-started | [bugs/dx-improvements.md](bugs/dx-improvements.md)   | None     | —        |

## Documentation

Documentation improvements and guidance.

| ID      | Title                                                     | Priority | Status      | Plan File | Blockers | GH Issue |
| ------- | --------------------------------------------------------- | -------- | ----------- | --------- | -------- | -------- |
| DOC-001 | Docs-staging / draft-docs workflow guidance               | P3       | not-started | —         | None     | #335     |
| DOC-002 | Documentation backlog guidance for all repos              | P3       | not-started | —         | None     | #334     |

## Completed / Archived

| ID     | Title                                              | Status               | Archive / Notes                                                                |
| ------ | -------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| AR-001 | Verify finops.md generated content                 | completed            | [archive/finops-md-verification.md](archive/finops-md-verification.md)         |
| AR-002 | Cost budget flag template update                   | duplicate (= CG-002) | [archive/cost-budget-flag-duplicate.md](archive/cost-budget-flag-duplicate.md) |
| AR-003 | plan.md CLI & Intake proposal                      | triaged              | [archive/plan-cli-intake-proposal.md](archive/plan-cli-intake-proposal.md) — split into CLI-001, INT-001, BUG-001 |
| AR-004 | /infra-eval command                                | completed (merged)   | Was "Incoming" in docs; now live as `/infra-eval` skill                        |
| AR-005 | /brand command                                     | completed (merged)   | Was "Incoming" in docs; now live as `/brand` skill                             |
| AR-006 | /feature-configure, /feature-flow, /feature-review | completed (merged)   | Were "Incoming" in docs; now live as skills                                    |
| AR-007 | /review --focus=retrospective                      | completed (merged)   | Was "Incoming" in docs; now live as part of `/review` skill                    |
| AR-008 | retrospective-analyst agent                        | completed (merged)   | Was "Incoming" in AGENTS_REFERENCE; now deployed                               |
| AR-009 | feature-ops agent                                  | completed (merged)   | Was "Incoming" in AGENTS_REFERENCE; now deployed                               |

> **Note**: AR-004 through AR-009 were documented as "Coming Soon" / "Incoming" in `.agentkit/docs/` but the corresponding branches have since been merged. The "Incoming" sections in those docs are now **stale markers** that should be cleaned up (remove them or move to the main sections).

---

## Dependency Graph

```
BUG-001 (P0) ────────────────────────────── standalone (engine fix)
BUG-002 (P1) ────────────────────────────── standalone (#328)
CG-001 (P1, SECURITY) ──────────────────── standalone (human maintainer)
CG-002 (P2) ────────────────────────────── standalone (human maintainer)
CG-003 (P2) ────────────────────────────── optional: FO-004
CLI-001 (P1) ────────────────────────────── standalone
CLI-002 (P1) ──── depends on ──── CLI-001
CLI-003 (P1) ──── depends on ──── CLI-002
CLI-004 (P2) ──── depends on ──── CLI-003
CLI-005 (P2) ──── depends on ──── CLI-002
CLI-006 (P2) ──── depends on ──── CLI-003
CLI-007 (P2) ──── depends on ──── CLI-002
CLI-008 (P2) ──── depends on ──── CLI-003
CLI-009 (P3) ──── depends on ──── CLI-003
CLI-010 (P3) ──── depends on ──── CLI-002
CLI-011 (P2) ────────────────────────────── standalone
CLI-012 (P1) ──── depends on ──── CLI-003
INT-001 (P2) ──── depends on ──── BUG-001
AT-001 (P2) ────────────────────────────── standalone
AT-002 (P3) ────────────────────────────── standalone
AT-003 (P3) ────────────────────────────── standalone
AT-004 (P3) ──── depends on ──── AT-001, AT-002, AT-003
AT-005 (P2) ────────────────────────────── requires analysis
AT-006 (P3) ──── depends on ──── FO-001 triggers
AT-007 (P2) ────────────────────────────── standalone (#345)
FO-001 (P0) ────────────────────────────── external repo
FO-002 (P1) ──── depends on ──── FO-001
FO-003 (P2) ──── depends on ──── FO-001, FO-002
FO-004 (P3) ──── depends on ──── FO-001, FO-002, FO-003
FW-001 (P3) ────────────────────────────── requires engine changes (maintainer)
FW-002 (P2) ────────────────────────────── standalone
FW-003 (P2) ────────────────────────────── standalone
FW-004 (P2) ────────────────────────────── standalone
FW-005 (P2) ──── optional dep on ──── FW-004
FW-006 (P2) ────────────────────────────── standalone
FW-007 (P2) ────────────────────────────── standalone (#346)
FW-008 (P2) ────────────────────────────── standalone (#344)
FW-009 (P3) ────────────────────────────── standalone (#343)
GV-001 (P1) ────────────────────────────── epic (#308)
GV-002 (P1) ──── depends on ──── GV-001
GV-003 (P2) ──── depends on ──── GV-001
GV-004 (P2) ──── depends on ──── GV-001
PS-001 (P1) ────────────────────────────── standalone (#342)
SD-001 (P2) ────────────────────────────── epic (#307)
```

## Roadmap Items (Aspirational)

These items from `.agentkit/docs/reference/ROADMAP.md` are not committed work — they represent future directions. Listed here for cross-reference only.

| Horizon       | Item                               | Notes                                    |
| ------------- | ---------------------------------- | ---------------------------------------- |
| Near (v0.2.x) | Plugin system for sync targets     | Dynamic `syncXxx()` discovery            |
| Near (v0.2.x) | ESLint + Prettier for engine source | Engine source has no linter currently    |
| Near (v0.2.x) | Coverage reporting in CI           | Integrate `vitest --coverage`            |
| Near (v0.2.x) | Cursor/Windsurf template expansion | Closer parity with Claude Code output    |
| Mid (v0.3.x)  | Remote state backend               | SQLite/Redis/cloud for multi-machine     |
| Mid (v0.3.x)  | Token-level cost tracking          | Per-command cost attribution             |
| Mid (v0.3.x)  | Visual dashboard                   | Web UI for orchestrator state            |
| Long (v1.0+)  | GitHub App integration             | Auto-create PRs from handoffs            |
| Long (v1.0+)  | Multi-repository orchestration     | Cross-repo shared state and backlog      |
| Long (v1.0+)  | AI model abstraction layer         | Multi-provider support                   |

## Stale Marker Cleanup

The following docs contain "Coming Soon" or "Incoming" markers for features that have **already been merged**. These markers should be cleaned up:

| File                                          | Section to remove/update                       |
| --------------------------------------------- | ---------------------------------------------- |
| `.agentkit/docs/getting-started/QUICK_START.md` | "Coming Soon (In-Flight Branches)" table     |
| `.agentkit/docs/guides/COMMAND_REFERENCE.md`  | "Incoming Commands (In-Flight Branches)"       |
| `.agentkit/docs/guides/AGENTS_REFERENCE.md`   | "Incoming Agents (In-Flight Branches)"         |
| `.agentkit/docs/guides/AGENTS_VS_TEAMS.md`    | "Incoming Agents (In-Flight Branches)"         |
| `.agentkit/docs/guides/WORKFLOWS.md`          | Scenarios 8–11 "(Incoming)" suffix             |

---

## Integration Notes

This planning index is designed to be:

- **Machine-readable**: Status, priority, and dependency fields use consistent enum values
- **UI-integrable**: Each item has a unique ID, status, priority, and file reference
- **Backlog-compatible**: Items can be imported to AGENT_BACKLOG.md via `/sync-backlog`
- **Independent**: Does not duplicate backlog entries; references plan files for detail
- **GH-linked**: Items sourced from GitHub Issues include the issue number for cross-reference
