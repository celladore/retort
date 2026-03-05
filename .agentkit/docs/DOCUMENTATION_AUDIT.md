# Documentation Audit — AgentKit Forge

**Audit date:** 2026-03-04
**Version audited:** v3.1.0 (runtime) / v0.2.1 (framework)
**Auditor:** Automated documentation audit

---

## Executive Summary

AgentKit Forge has a comprehensive documentation set across 20+ files in `.agentkit/docs/`, an extensive README, and 110+ files in the `docs/` scaffold directory. The documentation is generally high quality for core workflows (setup, commands, teams, customization) but has significant gaps in **command completeness**, **agent documentation**, and **cross-document consistency**.

### Key Findings

| Category          | Status     | Details                                                                           |
| ----------------- | ---------- | --------------------------------------------------------------------------------- |
| README            | Good       | Clear purpose, adoption guides, navigation. One broken link.                      |
| Command Reference | Incomplete | 5 commands completely undocumented; several missing flags from CLI source         |
| Agent Reference   | Missing    | No dedicated reference for 19 agent personas; scattered across AGENTS_VS_TEAMS.md |
| Team Guide        | Good       | Decision matrix, handoff patterns, edge cases covered                             |
| Architecture      | Good       | Sync engine, template rendering, directory structure documented                   |
| Security Model    | Good       | Threat model, hooks, permissions documented                                       |
| Cross-linking     | Fair       | Some broken links, inconsistent command counts between docs                       |
| PRD Library       | Broken     | README link in main README points to nonexistent `docs/prd/README.md`             |

---

## Gap Inventory

### 1. Missing Documentation

#### 1.1 Missing Commands in COMMAND_REFERENCE.md

| Command      | Type                  | Status                  | Priority |
| ------------ | --------------------- | ----------------------- | -------- |
| `/tasks`     | Workflow              | Completely undocumented | High     |
| `/delegate`  | Workflow              | Completely undocumented | High     |
| `/doctor`    | Diagnostic            | Completely undocumented | High     |
| `/scaffold`  | Workflow (slash-only) | Completely undocumented | Medium   |
| `/preflight` | Workflow (slash-only) | Completely undocumented | Medium   |

**Why it matters:** Developers using `/tasks` and `/delegate` for task management have no reference for flags, expected behavior, or examples. `/doctor` is the primary diagnostic tool but has zero documentation.

#### 1.2 Missing Agent Reference Document

**What's missing:** A dedicated `AGENTS_REFERENCE.md` documenting all 19 agent personas with their:

- Role and responsibilities
- File scope (glob patterns)
- Dependency chain (depends-on, notifies)
- Accepted work types
- Conventions and anti-patterns
- Preferred tools

**Current state:** Agent information is split between:

- `AGENTS_VS_TEAMS.md` (brief list of 16 agents — undercounts actual 30)
- `agents.yaml` spec file (complete but YAML, not human-readable docs)
- `TEAM_GUIDE.md` (team-level only, no agent detail)

**Why it matters:** Agents are a core concept. Without a reference, developers cannot understand which agent handles their domain, what conventions it enforces, or how it interacts with other agents.

#### 1.3 Missing `docs/prd/README.md`

**What's missing:** The README links to `docs/prd/README.md` as "PRD Library" but the file does not exist and no `docs/prd/` directory is present.

**Why it matters:** Broken link in the main README is the first thing new developers encounter.

### 2. Under-Documented Commands

#### 2.1 Commands Missing Flags from CLI Source

The following commands have flags defined in the CLI source (`cli.mjs`) that are not documented in COMMAND_REFERENCE.md:

| Command         | Missing Flags                                    | In CLI Source |
| --------------- | ------------------------------------------------ | ------------- |
| `/discover`     | `--depth`, `--include-deps`                      | Yes           |
| `/plan`         | `--issue`, `--output`, `--depth`                 | Yes           |
| `/orchestrate`  | `--scope`                                        | Yes           |
| `/sync-backlog` | `--direction`, `--labels`, `--team`              | Yes           |
| `/build`        | `--stack`, `--package`, `--production`           | Yes           |
| `/test`         | `--stack`, `--filter`, `--package`               | Yes           |
| `/format`       | `--stack`, `--path`                              | Yes           |
| `/deploy`       | `--environment`, `--skip-checks`, `--stack`      | Yes           |
| `/security`     | `--scan-type`, `--severity`, `--fix`, `--output` | Yes           |

#### 2.2 Team Commands Missing Detail

Team commands in COMMAND_REFERENCE.md have a quick-reference table but lack:

- The `--task` flag (present in all team commands per `commands.yaml`)
- Expected output format
- How backlog items are selected and prioritized
- What happens when no backlog items exist

### 3. Cross-Document Inconsistencies

| Issue                      | Location                                                                                                                                                                                                                                                         | Details                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Command count mismatch     | QUICK_START.md says "24 commands"; `VALID_COMMANDS` in `cli.mjs` contains 21 CLI-routable commands; `commands.yaml` defines 30 total commands (including 10 team commands and 3 slash-only commands not in the CLI router). The prior "48" figure was erroneous. | Reconciled to 29 in QUICK_START.md (see remediation item 10)       |
| Agent count mismatch       | AGENTS_VS_TEAMS.md lists "16 agents"; agents.yaml defines 19                                                                                                                                                                                                     | agents.yaml is authoritative                                       |
| Team count                 | Consistent at 10 across all docs                                                                                                                                                                                                                                 | No issue                                                           |
| `/sync` vs `agentkit sync` | Some docs use slash-command syntax, others use CLI                                                                                                                                                                                                               | Should clarify that `/sync` is not a slash command — it's CLI-only |
| `--overwrite` flag         | Referenced in CUSTOMIZATION.md but not in COMMAND_REFERENCE.md under any command                                                                                                                                                                                 | Should be documented under sync                                    |

### 4. Structural/Navigation Issues

| Issue                                   | Details                                                                                   | Recommendation                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Platform Reference is a stub            | `PLATFORM_REFERENCE.md` is a redirect to `platform_reference/` subdirectory with 48 files | Already addressed; no action needed               |
| No index for `.agentkit/docs/`          | No README or index file in the docs directory itself                                      | Low priority — README serves as index             |
| COST_TRACKING.md partial implementation | Header says "PARTIALLY IMPLEMENTED" but body describes features as implemented            | Clarify which features are implemented vs roadmap |

### 5. Documentation Quality Issues

| File                  | Issue                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| WORKFLOWS.md          | Time estimates (10-20 min for feature, 5-10 min for bugfix) are optimistic and should be qualified |
| STATE_AND_SESSIONS.md | No concrete examples of `orchestrator.json` or `events.log` contents                               |
| MCP_A2A_GUIDE.md      | No examples of actual A2A messages or MCP server usage                                             |
| ONBOARDING.md         | CI integration examples only cover GitHub Actions; no other CI systems                             |
| TROUBLESHOOTING.md    | No troubleshooting for spec validation errors or team command failures                             |

---

## Remediation Actions Taken

The following gaps were filled as part of this audit:

1. **Created `docs/prd/README.md`** — PRD library index, fixing the broken README link
2. **Updated `COMMAND_REFERENCE.md`** — Added documentation for `/tasks`, `/delegate`, `/doctor`, `/scaffold`, `/preflight` with full flags, examples, and expected output
3. **Updated `COMMAND_REFERENCE.md`** — Added missing flags for existing commands (`/discover`, `/plan`, `/orchestrate`, `/sync-backlog`, `/build`, `/test`, `/format`, `/deploy`, `/security`, team commands)
4. **Created `AGENTS_REFERENCE.md`** — Complete reference for all 19 agent personas with roles, scopes, dependencies, and conventions
5. **Updated `CLI_INSTALLATION.md`** — Added missing commands (`tasks`, `delegate`, `doctor`) and corrected command inventory
6. **Fixed README.md** — No changes needed; link to `docs/prd/README.md` will resolve once file is created

---

## Additional Remediation Actions (Second Pass)

The following items from the initial audit's "remaining recommendations" have also been addressed:

7. **Updated `STATE_AND_SESSIONS.md`** — Added concrete `orchestrator.json` example (full JSON with all fields) and expanded `events.log` with 14 example entries covering all event action types, plus an event action types reference table
8. **Updated `MCP_A2A_GUIDE.md`** — Added full JSON payload examples for all 4 A2A message types (`delegate`, `report`, `query`, `broadcast`)
9. **Updated `ONBOARDING.md`** — Added GitLab CI and Azure Pipelines configuration examples alongside the existing GitHub Actions example
10. **Updated `QUICK_START.md`** — Reconciled command count from "24" to "29" (added task management and diagnostic commands), updated team command table to match `teams.yaml` (replaced outdated team names)
11. **Updated `COST_TRACKING.md`** — Added implementation status callouts to Token Usage Logging and Budget Alerts sections, split log format examples into implemented vs roadmap fields
12. **Updated `WORKFLOWS.md`** — Added 3 new workflow scenarios: Code Refactoring (Scenario 5), Security Hardening (Scenario 6), and Dependency Upgrade (Scenario 7)

---

## Preemptive Documentation for In-Flight Branches (Third Pass)

A comprehensive analysis of 7 active branches identified 6 new commands, 2 new agents, and 3 new systems that will need documentation when merged. Rather than waiting for merge, the following preemptive documentation has been added:

13. **Updated `COMMAND_REFERENCE.md`** — Added "Incoming Commands" section documenting `/infra-eval`, `/brand`, `/feature-configure`, `/feature-flow`, `/feature-review`, and `/review --focus=retrospective` with full flags, descriptions, and integration notes. Also documented the merge conflict resolution system and CI/CD audit.
14. **Updated `AGENTS_REFERENCE.md`** — Added "Incoming Agents" section documenting `retrospective-analyst` (operations) and `feature-ops` (new feature-management category) with roles, scopes, and responsibilities.
15. **Updated `AGENTS_VS_TEAMS.md`** — Added "Incoming Agents" section with merge instructions for updating agent counts and category tables.
16. **Updated `QUICK_START.md`** — Added "Coming Soon" table listing all 6 incoming commands with their source branches.
17. **Updated `WORKFLOWS.md`** — Added 4 new workflow scenarios: Infrastructure Fitness Evaluation (Scenario 8), Feature Management Setup (Scenario 9), Session Retrospective (Scenario 10), Brand & Editor Theme Setup (Scenario 11).

### Branch-by-Branch Impact Summary

| Branch                             | New Commands                                             | New Agents              | Key Documentation Impact                                                                  |
| ---------------------------------- | -------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `agentforge-template-integration`  | `/infra-eval`                                            | —                       | 8-dimension evaluation framework, hard gates, orchestrator Phase 4 integration            |
| `elegant-knuth`                    | `/review` enhancements                                   | `retrospective-analyst` | 4 new review criteria (7-10), retrospective mode, 4 CI workflows, docs/history/ structure |
| `feature-management-strategy`      | `/feature-configure`, `/feature-flow`, `/feature-review` | `feature-ops`           | Feature gating system, presets, 564-line features.yaml spec, feature-aware sync           |
| `repo-specific-editor-theme`       | `/brand`                                                 | —                       | Brand spec system, editor theme generation, brand-resolver engine                         |
| `resolve-merge-conflicts`          | — (system)                                               | —                       | Merge conflict resolution scripts, CI workflow, gitattributes merge driver                |
| `review-cicd-infrastructure`       | — (audit)                                                | —                       | 502-line CI/CD audit with 28 findings and 4-wave remediation roadmap                      |
| `docs/issue-intake-ownership-flow` | — (spec)                                                 | —                       | Issue intake ownership model for GitHub/Linear, enhances `/sync-backlog`                  |

### Merge Checklist

When each branch merges, the following documentation actions are needed:

- [ ] Move command entries from "Incoming Commands" to main COMMAND_REFERENCE sections
- [ ] Move agent entries from "Incoming Agents" to main AGENTS_REFERENCE sections
- [ ] Update agent count in AGENTS_VS_TEAMS.md heading (19 → 21 when both agent branches merge)
- [ ] Update command count in QUICK_START.md (30 → 35 when all command branches merge)
- [ ] Remove "Coming Soon" entries from QUICK_START.md as branches merge
- [ ] Move workflow scenarios from "(Incoming)" suffix to regular numbered scenarios
- [ ] Update this audit document to mark preemptive items as finalized

---

## Remaining Recommendations (Not Addressed)

These items are lower priority and recommended for future work:

1. **Add troubleshooting entries** — Spec validation errors, team command failures, orchestrator mid-phase crashes
2. **Add Docker-based installation** — Document Docker-based setup for CLI_INSTALLATION.md
3. **Add shell completion** — Document bash/zsh/fish completion setup for CLI
4. **Add platform comparison matrix** — Summarize AI tool support differences in PLATFORM_REFERENCE.md
