# feat(agent): Add `maintenance-coordinator` agent and consolidate review/CI integration points

**Type:** Feature Proposal + Gap Audit
**Priority:** High
**Labels:** `enhancement`, `agent`, `ci`, `dx`, `tech-debt`

---

## Summary

Introduce a **`maintenance-coordinator`** agent to consolidate scattered maintenance concerns (rules governance, script ownership, tech debt tracking, merge driver health, CLI completeness). This issue also catalogs **6 gaps, 3 contradictions, and 4 integration opportunities** discovered during a comprehensive audit of the agent/hooks/CLI/CI landscape.

---

## Motivation

The system has 19 agents covering engineering, design, marketing, operations, product, testing, and project management — but **no agent owns the maintenance lifecycle**. When the project transitions from `phase: active` to `phase: maintenance` (as declared in `project.yaml`), there is no designated coordinator to:

- Govern domain rules (`rules.yaml`)
- Own maintenance scripts (`scripts/resolve-merge.sh`, `update-changelog.sh`, etc.)
- Track and prioritize technical debt
- Coordinate cross-team maintenance windows
- Ensure CLI completeness matches spec promises

---

## Proposed Agent Definition

```yaml
# In .agentkit/spec/agents.yaml, under operations category
- id: maintenance-coordinator
  category: operations
  name: Maintenance Coordinator
  role: >
    System maintenance specialist responsible for framework health, rule
    governance, technical debt tracking, script ownership, and coordination
    of maintenance-phase operations. Acts as the steward of Retort
    internals and ensures CLI, hooks, CI, and generated outputs remain
    consistent with specifications.
  accepts:
    - implement
    - review
    - investigate
  depends-on: []
  notifies:
    - devops
    - test-lead
    - dependency-watcher
  preferred-tools:
    - Read
    - Write
    - Edit
    - Glob
    - Grep
    - Bash
  focus:
    - '.agentkit/spec/rules.yaml'
    - '.agentkit/engines/node/src/**'
    - 'scripts/**'
    - '.github/workflows/**'
    - '.gitattributes'
    - 'CHANGELOG.md'
    - 'CONTRIBUTING.md'
  responsibilities:
    - Own and evolve .agentkit/spec/rules.yaml with quarterly review cadence
    - Maintain scripts/ directory (resolve-merge.sh, update-changelog.sh, etc.)
    - Track technical debt inventory and prioritize remediation
    - Ensure CLI commands match spec definitions (no phantom commands)
    - Validate hook completeness and lifecycle correctness
    - Monitor merge driver health via doctor.mjs diagnostics
    - Coordinate dependency update strategy with dependency-watcher
    - Lead maintenance-phase transition when project.yaml phase changes
```

---

## Gap Audit: What the Maintainer Would Own

### GAP 1 — CRITICAL: 6 Commands in Spec Without CLI Handlers

Commands fully defined in `commands.yaml` but **not routable via CLI** (`cli.mjs` has no `case` statement):

| Command        | Type     | Spec Lines | Issue                                                                    |
| -------------- | -------- | ---------- | ------------------------------------------------------------------------ |
| `build`        | utility  | 433-459    | Has flags (stack, package, production, verbose) but no handler           |
| `test`         | utility  | 460-491    | Has flags (stack, filter, coverage, watch) but no handler                |
| `format`       | utility  | 492-515    | Has flags (stack, check, path) but no handler                            |
| `deploy`       | utility  | 516-544    | Has flags (environment, dry-run, skip-checks) — completely unimplemented |
| `security`     | utility  | 545-573    | Has flags (scan-type, severity, fix, output) — completely unimplemented  |
| `sync-backlog` | workflow | 157-177    | Has flags (direction, labels, team) — completely unimplemented           |

**Impact:** Users running `agentkit build` get `Unknown command: "build"` even though the spec and CLAUDE.md docs promise it exists.

**Proposed resolution:**

- `build`, `test`, `format`: Extract from `check.mjs` into standalone handlers. `check` becomes a composition: `check = format ∘ lint ∘ typecheck ∘ test ∘ build`
- `deploy`: Implement as pre-deployment gate (validate → build → test → deploy artifact)
- `security`: Extend `review-runner.mjs` with dependency audit + OWASP patterns
- `sync-backlog`: New handler for GitHub Issues ↔ local tracking sync

### GAP 2 — HIGH: No Agent Owns `rules.yaml`

`.agentkit/spec/rules.yaml` contains critical domain-specific coding standards (TypeScript, .NET, Python, Rust rules) but:

- No agent has `rules.yaml` in their `focus` area
- The file is protected by `protect-templates.sh` hook (cannot be edited at all)
- No governance workflow exists for proposing rule changes
- Rules drift over time without active stewardship

**Proposed resolution:** `maintenance-coordinator` owns `rules.yaml` with quarterly review cadence and a PR-based change proposal process.

### GAP 3 — HIGH: Incomplete Task Delegation System

`task-cli.mjs`, `task-protocol.mjs`, and `task-types.mjs` exist but:

- Task lifecycle state management is minimal (create + list only)
- No automatic handoff transitions when tasks complete
- No task dependency resolution
- No conflict detection when multiple agents work the same task
- CLAUDE.md templates reference sophisticated task protocol that isn't fully implemented

**Proposed resolution:** Flesh out task handlers, implement state transitions (`submitted → working → completed → delivered`), add dependency resolution.

### GAP 4 — MEDIUM: Script Ownership Undefined

11 scripts in `scripts/` have no designated agent owner:

| Script                                         | Natural Owner             |
| ---------------------------------------------- | ------------------------- |
| `resolve-merge.sh` / `.ps1`                    | `maintenance-coordinator` |
| `update-changelog.sh` / `.ps1`                 | `release-manager`         |
| `create-doc.sh` / `.ps1`                       | `content-strategist`      |
| `validate-documentation.sh`                    | `content-strategist`      |
| `validate-numbering.sh`                        | `content-strategist`      |
| `check-documentation-requirement.sh`           | `content-strategist`      |
| `setup-agentkit-branch-governance.sh` / `.ps1` | `maintenance-coordinator` |

### GAP 5 — MEDIUM: CLI Commands Not in Spec (Reverse Mismatch)

8 commands exist in CLI (`VALID_COMMANDS`) but are **not defined in `commands.yaml`**:

`init`, `sync`, `spec-validate`, `add`, `remove`, `list`, `tasks`, `delegate`

These are framework-internal commands and may be intentionally omitted from spec, but the mismatch should be documented or reconciled.

### GAP 6 — LOW: Team Context Routing Undefined

`team-backend`, `team-frontend`, etc. are defined in spec (10 commands) with full flag definitions, but:

- No CLI handler implements team-based routing
- Agent routing uses `notifies`/`depends-on` (explicit agent handoff), not team context
- Unclear if team commands are intended as context-switching or actual routing

---

## Contradictions Found

### CONTRADICTION 1: `build`/`test`/`format` in Two Places

- **Spec** declares them as independent utility commands
- **`check.mjs`** bundles them as workflow steps
- **Users expect** `agentkit build` to work standalone
- **Reality:** Only callable as part of `agentkit check`

### CONTRADICTION 2: Team Commands vs Agent Routing

- **Spec defines** 10 `team-*` commands with scopes and flags
- **Orchestration** routes via agent `notifies`/`depends-on` chains
- **No visible mechanism** connects team commands to agent routing
- Both systems exist but don't interact

### CONTRADICTION 3: `check.mjs` Formatters Allowlist vs Spec

`check.mjs` has a hardcoded security allowlist of formatters/linters (prettier, black, cargo fmt, eslint, etc.) but `commands.yaml` doesn't reference this constraint. A new tech stack adding an unlisted formatter would silently fail.

---

## Integration Opportunities

### 1. Wire `doctor.mjs` Into Pre-Sync Validation

`doctor.mjs` now checks merge driver health (added in `e8bdfa0`), but it's only run manually or in CI. It should also run automatically:

- As a pre-sync hook (before `agentkit sync` renders outputs)
- As part of `healthcheck` (it currently isn't called from healthcheck.mjs)
- On `session-start.sh` (lightweight check that merge drivers are configured)

### 2. Connect `review-runner.mjs` to `security` Command

`review-runner.mjs` already has secret scanning (AWS keys, private keys, JWT, connection strings) and could be the foundation for the missing `security` CLI command. Extend it with:

- Dependency vulnerability scanning (`npm audit`, `cargo audit`, `pip-audit`)
- OWASP pattern detection
- Permission auditing (check `settings.yaml` allow/deny rules)

### 3. Hook Lifecycle Completeness Check

`validate.mjs` checks that hook scripts exist, but doesn't verify:

- Hook scripts are executable (`chmod +x`)
- Hook scripts have correct shebang lines
- Hook event matchers in `settings.json` reference valid tool names
- PowerShell variants match Bash variant behavior

`maintenance-coordinator` should own a periodic hook audit.

### 4. CI Pipeline: Run `doctor` + `review` in Validate Job

The CI pipeline (`ci.yml`) now runs `doctor` in the validate job (added in this branch), but `review` (secret scanning) only runs manually. Consider:

- Adding `agentkit review --range HEAD~1..HEAD` to CI for per-commit secret scanning
- Running `agentkit review` as a PR check (not just manual invocation)

---

## Acceptance Criteria

- [ ] `maintenance-coordinator` agent defined in `agents.yaml` with responsibilities listed above
- [ ] `.github/agents/maintenance-coordinator.agent.md` generated via sync
- [ ] `doctor.mjs` phase-4 merge driver check integrated into `healthcheck.mjs` output
- [ ] Missing CLI handlers triaged: decide implement vs remove vs slash-only for each of the 6 commands
- [ ] `rules.yaml` ownership assigned (to `maintenance-coordinator` or designated agent)
- [ ] Script ownership documented (CODEOWNERS or agent focus areas)
- [ ] CI `validate` job runs `doctor` diagnostics (done: `ci.yml` updated)
- [ ] CI `validate` job checks `.gitattributes` merge driver presence (done: `ci.yml` updated)

---

## Related Work

- Branch `claude/resolve-merge-conflicts-WBEqO` — merge conflict resolution system + doctor/CI integration (this branch)
- Branch `claude/elegant-knuth-iSy89` — `/review` refactoring (potential integration point)
- Branch `claude/feature-management-strategy-1jUSw` — feature gating (merge drivers could be feature-gated)
- `MERGE_RESOLUTION_MATRIX.md` — decision matrix for conflict resolution strategies
- `.github/workflows/merge-conflict-detection.yml` — automated PR conflict detection

---

## Sub-Issues (with implementation plans)

| #   | File                                   | Title                                              | Priority | Status |
| --- | -------------------------------------- | -------------------------------------------------- | -------- | ------ |
| 001 | `001-missing-cli-handlers.md`          | CRITICAL: Implement 6 missing CLI command handlers | P0       | Open   |
| 002 | `002-maintenance-coordinator-agent.md` | Add `maintenance-coordinator` agent                | P1       | Open   |
| 003 | `003-task-delegation-completion.md`    | Complete task delegation lifecycle                 | P1       | Open   |
| 004 | `004-rules-yaml-ownership.md`          | Assign ownership for rules.yaml                    | P2       | Open   |
| 005 | `005-script-ownership.md`              | Assign agent ownership for scripts                 | P2       | Open   |
| 006 | `006-reverse-spec-mismatch.md`         | Document 8 CLI-only commands missing from spec     | P2       | Open   |
| 007 | `007-team-context-routing.md`          | Clarify or implement team command routing          | P3       | Open   |
| 008 | `008-check-allowlist-spec-sync.md`     | Sync check.mjs allowlists with spec                | P3       | Open   |
| 009 | `009-doctor-presync-healthcheck.md`    | Wire doctor into pre-sync and healthcheck          | P2       | Open   |
| 010 | `010-security-command-from-review.md`  | Build security command on review-runner            | P1       | Open   |
| 011 | `011-hook-validation.md`               | Add hook executable and shebang validation         | P2       | Open   |
| 012 | `012-ci-review-secret-scanning.md`     | Add per-commit secret scanning in CI               | P2       | Open   |

All sub-issues are in `.github/ISSUES/` with detailed implementation plans, code samples, and acceptance criteria.
