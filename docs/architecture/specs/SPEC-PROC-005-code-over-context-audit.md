# SPEC-PROC-005: Code Over Context — Existing Agent Configuration Audit

**Status**: Draft
**Phase**: Cross-phase — applies to all SPEC-PROC-001 through SPEC-PROC-004a/b implementation
**Purpose**: Identify opportunities in the existing agent configuration where instructions currently carried in agent context can be replaced by tooling, scripts, CI checks, or config references.

---

## Executive Summary

`agents.yaml` is **1,037 lines / 50KB**. A significant portion is duplicated process instructions that every agent carries in context but which could be enforced by tooling instead.

### The Numbers

| Metric                                              | Value                                 | % of File       |
| --------------------------------------------------- | ------------------------------------- | --------------- |
| Total agents defined                                | 21                                    | —               |
| `domain-rules` lines (repeated process text)        | 68 lines, ~13.4KB                     | **27% of file** |
| `git-workflow domain rules` — identical string      | Copied 20 times                       | —               |
| `agent-conduct domain rules` — identical string     | Copied 21 times                       | —               |
| `security domain rules` — 8 near-identical variants | Copied 8 times                        | —               |
| `testing domain rules` — 6 near-identical variants  | Copied 6 times                        | —               |
| `preferred-tools` lines (mostly identical lists)    | 111 lines                             | —               |
| `responsibilities` lines                            | 141 lines                             | —               |
| Estimated context tokens wasted on duplication      | ~3,000-4,000 tokens per agent session | —               |

**Bottom line**: Every agent carries ~1,200 words of process instructions that are either (a) identical to every other agent, (b) enforceable by CI/hooks, or (c) better served by a single reference. Across 21 agents, that's **~25,000 words of duplicated text** in the spec file.

---

## Finding 1: Domain-Rules Are Massively Duplicated

### The Problem

Every agent in `agents.yaml` has a `domain-rules:` block containing 3-5 rules. These rules are **text strings** that describe process requirements — not domain expertise. Two rules are copied **identically** to nearly every agent:

| Rule                                                                                                                                                                       | Exact Copies        | Characters Per Copy | Total Waste  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------- | ------------ |
| "Follow git-workflow domain rules [gw-conventional-commits, gw-atomic-commits, gw-branch-naming, gw-no-secrets-in-history] — all commits must use Conventional Commits..." | **20 of 21 agents** | ~195 chars          | ~3,900 chars |
| "Follow agent-conduct domain rules [ac-verify-before-change, ac-minimal-changes, ac-run-checks, ac-no-destructive-without-confirm] — coordinate via orchestrator..."       | **21 of 21 agents** | ~178 chars          | ~3,738 chars |

Additional near-duplicates with minor variations:

| Rule Pattern                                           | Copies   | Variants                                |
| ------------------------------------------------------ | -------- | --------------------------------------- |
| "Follow security domain rules [sec-*]..."              | 8 agents | 8 different combos of the same rule IDs |
| "Follow testing domain rules [qa-*]..."                | 6 agents | 6 different combos of the same rule IDs |
| "Follow documentation domain rules [doc-*]..."         | 6 agents | 6 different combos                      |
| "Follow ci-cd domain rules [ci-*]..."                  | 2 agents | 2 different combos                      |
| "Follow typescript domain rules [ts-*]..."             | 2 agents | 2 different combos                      |
| "Follow dependency-management domain rules [dep-*]..." | 2 agents | 2 different combos                      |

### The Fix

**Replace per-agent text duplication with a reference-based system.**

**Option A — Domain-Rules as IDs Only** (recommended):

```yaml
# BEFORE (current — 4 lines of text per agent, repeated 21 times)
domain-rules:
  - "Follow git-workflow domain rules [gw-conventional-commits, gw-atomic-commits, gw-branch-naming, gw-no-secrets-in-history] — all commits must use Conventional Commits format type(scope): description, all PRs must have conventional titles"
  - "Follow security domain rules [sec-no-secrets, sec-input-validation, sec-least-privilege] — sanitize inputs, guard endpoints, never hardcode secrets"
  - "Follow testing domain rules [qa-coverage-threshold, qa-aaa-pattern, qa-no-skipped-tests] — maintain coverage thresholds, test error paths"
  - "Follow agent-conduct domain rules [ac-verify-before-change, ac-minimal-changes, ac-run-checks, ac-no-destructive-without-confirm] — coordinate via orchestrator, update shared state"

# AFTER (reference IDs — the text lives once in rules.yaml)
domain-rules:
  - git-workflow: [gw-conventional-commits, gw-atomic-commits, gw-branch-naming, gw-no-secrets-in-history]
  - security: [sec-no-secrets, sec-input-validation, sec-least-privilege]
  - testing: [qa-coverage-threshold, qa-aaa-pattern, qa-no-skipped-tests]
  - agent-conduct: [ac-verify-before-change, ac-minimal-changes, ac-run-checks, ac-no-destructive-without-confirm]
```

**Savings**: ~195 chars → ~50 chars per rule. For the 68 rule lines: **~10KB saved** from the spec file. When rendered to agent context, the long descriptive text is never generated — the agent gets a compact reference. If an agent needs the full rule text, it reads `rules.yaml` on demand.

**Option B — Global Rules + Per-Agent Overrides**:

```yaml
# In teams.yaml or a new global-rules.yaml
global-domain-rules:
  all-agents:
    - git-workflow:
        [gw-conventional-commits, gw-atomic-commits, gw-branch-naming, gw-no-secrets-in-history]
    - agent-conduct:
        [
          ac-verify-before-change,
          ac-minimal-changes,
          ac-run-checks,
          ac-no-destructive-without-confirm,
        ]

# In agents.yaml — only agent-SPECIFIC rules
domain-rules:
  - security: [sec-input-validation, sec-no-secrets, sec-deny-by-default] # Frontend-specific combo
```

This eliminates the need to repeat universal rules on every agent.

### Implementation

- **Script**: `scripts/resolve-domain-rules.mjs` — takes agent ID, returns the merged rule set (global + agent-specific) with full rule text from `rules.yaml`. Called by orchestrator when delegating to an agent.
- **Sync engine change**: The sync/render step that generates output from agents.yaml should resolve IDs to text only when needed, not bake text into the YAML.
- **Context savings**: Agent receives "Rules: gw-conventional-commits, sec-no-secrets, qa-coverage-threshold" (one line) instead of 4 paragraphs. If the agent needs to check a specific rule, it reads `rules.yaml`.

---

## Finding 2: Preferred-Tools Lists Are Nearly Identical

### The Problem

21 agents define `preferred-tools:` lists. The vast majority are identical:

```yaml
preferred-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
```

111 total tool-reference lines. Only a few agents differ (some omit Write or Bash for review-only roles).

### The Fix

**Define a default tool set. Per-agent lists only for exceptions.**

```yaml
# In teams.yaml or agents-defaults.yaml
defaults:
  preferred-tools: [Read, Write, Edit, Glob, Grep, Bash]

# In agents.yaml — only when DIFFERENT from default
- id: ui-designer
  preferred-tools-override:
    remove: [Bash]    # UI designer doesn't run shell commands
```

**Savings**: 111 lines → ~10 lines (only the exceptions). Agents that use the default don't need any `preferred-tools` block.

---

## Finding 3: Rules That Should Be CI/Hooks, Not Agent Instructions

### The Problem

`rules.yaml` contains 1,287 lines across 14 domains with 80+ conventions. Many are marked `type: enforcement` with a `tool:` field — meaning a CLI tool can check them. Yet they're also carried as agent instructions.

**16 rules describe CI/tool enforcement that agents shouldn't need to know about:**

| Rule ID                  | Domain        | Tool                              | Why Agent Doesn't Need This                |
| ------------------------ | ------------- | --------------------------------- | ------------------------------------------ |
| `ts-lint`                | typescript    | `eslint --fix`                    | Pre-commit hook or CI runs this            |
| `ts-format`              | typescript    | `prettier --write`                | Pre-commit hook or CI runs this            |
| `py-lint`                | python        | `ruff check --fix`                | Pre-commit hook or CI runs this            |
| `py-format`              | python        | `black`                           | Pre-commit hook or CI runs this            |
| `rs-clippy`              | rust          | `cargo clippy -- -D warnings`     | CI runs this                               |
| `rs-fmt`                 | rust          | `cargo fmt`                       | Pre-commit hook runs this                  |
| `iac-fmt`                | iac           | `terraform fmt`                   | Pre-commit hook runs this                  |
| `iac-validate`           | iac           | `terraform validate`              | CI runs this                               |
| `dn-format`              | dotnet        | `dotnet format`                   | Pre-commit hook runs this                  |
| `qa-coverage-threshold`  | testing       | `vitest run --coverage`           | CI runs this; agents don't decide coverage |
| `ci-quality-gates`       | ci-cd         | —                                 | Describes CI config, not agent behavior    |
| `ci-pin-actions`         | ci-cd         | —                                 | Pre-commit or CI linter for workflows      |
| `ci-reproducible-builds` | ci-cd         | —                                 | CI build config, not agent decision        |
| `dep-lockfile-committed` | dependency    | —                                 | Pre-commit hook                            |
| `gw-sync-before-pr`      | git-workflow  | `pnpm -C .agentkit agentkit:sync` | Should auto-run as pre-push hook           |
| `doc-generated-files`    | documentation | `pnpm -C .agentkit agentkit:sync` | Same as above — auto-run                   |

### The Fix

**Separate rules into two categories in rules.yaml:**

```yaml
rules:
  - domain: typescript
    conventions:
      # ENFORCEMENT rules — enforced by tooling, not agent instructions
      - id: ts-lint
        type: enforcement
        enforced-by: pre-commit-hook # NEW FIELD
        tool: 'eslint --fix'
        agent-visible: false # NEW FIELD — don't render to agent context
        # ...

      # ADVISORY rules — agents need to know these
      - id: ts-explicit-types
        type: advisory
        agent-visible: true # Rendered to agent context
        # ...
```

**New field: `agent-visible`** (default: `true` for advisory, `false` for enforcement with tool).

**Sync engine change**: When generating agent context, skip rules where `agent-visible: false`. These rules exist in CI/hook config only. Agents see: "ts-lint: enforced by CI" (one line) instead of the full rule description.

**Implementation**:

- Add `enforced-by:` field to applicable rules: `pre-commit-hook | ci-pipeline | linter-config`
- Add `agent-visible: false` to rules that tools can fully enforce
- `scripts/rules-enforcement-matrix.mjs` generates a matrix showing which rules are enforced by what tool
- Sync engine filters rules by `agent-visible` when rendering agent instructions

**Savings per agent**: ~16 enforcement rules \* ~40 words each = ~640 words removed from context per agent that references those domains.

---

## Finding 4: Duplicate "Secrets" Rules Across 3 Domains

### The Problem

The same concept — "don't commit secrets" — appears in 3 separate domains:

| Rule ID                      | Domain       | Text                                                |
| ---------------------------- | ------------ | --------------------------------------------------- |
| `sec-no-secrets`             | security     | "Never commit secrets, API keys, or credentials..." |
| `gw-no-secrets-in-history`   | git-workflow | "No secrets or credentials in git history..."       |
| `ci-no-secrets-in-workflows` | ci-cd        | "No secrets exposed in workflow logs..."            |

These are the same rule applied in three contexts. An agent that references all three domains (e.g., devops) carries this text three times.

### The Fix

**Single canonical rule with cross-references:**

```yaml
# Primary rule in security domain
- id: sec-no-secrets
  rule: 'Never commit secrets, API keys, or credentials. Use environment variables and secret managers.'
  severity: critical
  type: enforcement
  enforced-by: [pre-commit-hook, ci-pipeline] # git-secrets or TruffleHog
  agent-visible: false # Tool-enforced

# Cross-references (not full re-statements)
# git-workflow domain
- id: gw-no-secrets-in-history
  extends: sec-no-secrets # NEW: reference, not restatement
  context: 'Applied to git commit history'

# ci-cd domain
- id: ci-no-secrets-in-workflows
  extends: sec-no-secrets
  context: 'Applied to GitHub Actions workflow logs and outputs'
```

**Savings**: 3 full rule descriptions → 1 full + 2 one-liners.

---

## Finding 5: Conventional Commits Rule Stated Twice

### The Problem

Two separate rules say the same thing:

| Rule ID                   | Domain       | What It Says                                                     |
| ------------------------- | ------------ | ---------------------------------------------------------------- |
| `gw-conventional-commits` | git-workflow | "All commit messages must follow Conventional Commits format..." |
| `gw-pr-title-format`      | git-workflow | "All PR titles must follow Conventional Commits format..."       |

These are the same format applied to two contexts. The agent that carries both gets the Conventional Commits spec explained twice.

### The Fix

**Merge into one rule with two contexts:**

```yaml
- id: gw-conventional-format
  rule: 'All commit messages AND PR titles must follow Conventional Commits format: type(scope): description'
  severity: error
  type: enforcement
  enforced-by: [commitlint-hook, github-branch-protection]
  agent-visible: false # commitlint hook and GitHub PR checks enforce this
```

One rule instead of two. And since it's tool-enforced, agents don't need to carry it at all.

---

## Finding 6: Agent-Conduct Rules Are Meta-Process, Not Domain

### The Problem

The `agent-conduct` domain (8 rules) describes HOW agents should work, not WHAT they know about a technical domain:

| Rule                                | What It Actually Is                 |
| ----------------------------------- | ----------------------------------- |
| `ac-verify-before-change`           | Process: read before edit           |
| `ac-minimal-changes`                | Process: don't over-engineer        |
| `ac-run-checks`                     | Process: run CI locally             |
| `ac-no-destructive-without-confirm` | Process: safety gate                |
| `ac-explain-trade-offs`             | Process: communication style        |
| `ac-session-handoff`                | Process: documentation practice     |
| `ac-respect-generated-headers`      | Process: don't edit generated files |
| `ac-cost-awareness`                 | Process: token efficiency           |

These are copied to ALL 21 agents. They're not domain knowledge — they're behavioral instructions that apply universally.

### The Fix

**Move to system-level config, not per-agent rules.**

```yaml
# In teams.yaml process section (or a new agent-conduct.yaml)
process:
  agent-conduct:
    - id: ac-verify-before-change
      rule: 'Read file contents before modifying. Never act on stale information.'
      enforced-by: pre-tool-hook # settings.yaml already has hooks for this
    - id: ac-minimal-changes
      rule: 'Change only what is necessary. No speculative refactoring.'
    - id: ac-run-checks
      rule: 'Run /healthcheck before creating PRs.'
      enforced-by: pre-push-hook
    - id: ac-no-destructive-without-confirm
      rule: 'Never run destructive commands without user confirmation.'
      enforced-by: settings-deny-list # settings.yaml already denies rm -rf, etc.
    # ...
```

**Key insight**: `settings.yaml` already has hooks and deny lists that enforce several of these rules:

- `ac-no-destructive-without-confirm` → `permissions.deny` already blocks `rm -rf`, `git push --force`, etc.
- `ac-respect-generated-headers` → `hooks.preToolUse.protect-templates` already blocks editing generated files
- `ac-run-checks` → Could become a `hooks.stop.pre-push-validate` hook

**Savings**: Remove 21 copies of the agent-conduct block from agents.yaml. The rules live once in process config. Hooks enforce the critical ones automatically.

---

## Finding 7: Responsibilities Lists Contain Enforceable Statements

### The Problem

Agent `responsibilities` lists contain a mix of:

1. **Domain expertise** (good — should stay): "Design and implement RESTful APIs"
2. **Process instructions** (bad — should be tooling): "Maintain coverage thresholds"
3. **Enforcement duties** (bad — should be scripts): "Enforce API versioning"

Examples of responsibilities that are process, not domain:

| Agent    | Responsibility                                       | Should Be                                |
| -------- | ---------------------------------------------------- | ---------------------------------------- |
| backend  | "Enforce API versioning and backwards compatibility" | CI check: semver-diff on API spec        |
| backend  | "Review and approve changes to API contracts"        | PR review requirement (GitHub config)    |
| frontend | "Optimize bundle size"                               | CI check: bundle size budget             |
| infra    | "Enforce mandatory resource tagging"                 | Terraform policy (tfsec/Checkov)         |
| infra    | "Manage Terraform state backend and locking"         | IaC config, not agent instruction        |
| devops   | "Enforce branch protection and merge requirements"   | GitHub repo settings, not agent behavior |
| testing  | "Maintain quality gate configurations"               | CI config, not agent behavior            |
| quality  | "Maintain testing infrastructure health"             | CI monitoring, not agent instruction     |

### The Fix

**Audit each responsibility. Classify as domain-expertise (keep) or process-enforcement (move to tooling).**

```yaml
# BEFORE
responsibilities:
  - Design and implement RESTful and GraphQL APIs          # DOMAIN — keep
  - Enforce API versioning and backwards compatibility     # PROCESS — move to CI
  - Review and approve changes to API contracts            # PROCESS — move to PR config
  - Maintain API documentation (OpenAPI/Swagger)           # DOMAIN — keep

# AFTER
responsibilities:
  - Design and implement RESTful and GraphQL APIs
  - Maintain API documentation (OpenAPI/Swagger)
  # Removed: "Enforce API versioning" — now a CI check
  # Removed: "Review and approve changes to API contracts" — now a PR requirement
```

**Estimated reduction**: ~20-30% of responsibility lines are enforceable by tooling.

---

## Finding 8: Missing Referenced Files Create Dead Context

### The Problem

`AGENTS.md` references files that don't exist:

| Referenced File            | Status  | Impact                                   |
| -------------------------- | ------- | ---------------------------------------- |
| `QUALITY_GATES.md`         | Missing | Agents may look for it and waste context |
| `RUNBOOK_AI.md`            | Missing | Same                                     |
| `UNIFIED_AGENT_TEAMS.md`   | Missing | Same                                     |
| `.claude/state/` directory | Missing | Runtime state infrastructure not created |

Agents reading `AGENTS.md` see references to these files, may attempt to read them, get errors, and waste context on error handling.

### The Fix

1. **Generate the missing files** from existing specs (quality gates from rules.yaml, agent teams from teams.yaml)
2. **Or remove the references** until the files exist
3. **Create `.claude/state/` directory** as part of project setup / session-start hook

---

## Finding 9: COMMAND_GUIDE.md Is Heavy Process Context

### The Problem

`COMMAND_GUIDE.md` is 270 lines / ~14KB of instructional text describing when to use which command, what flags are available, and what shared state files are affected. This is loaded into agent context for workflow routing.

~70% of this file is process instruction (when/how to use commands). ~30% is reference (flags, state files).

### The Fix

**Split into two layers:**

1. **Quick-reference table** (agent context — ~30 lines):

```markdown
| Situation    | Command      |
| ------------ | ------------ |
| New session  | /orchestrate |
| Need a plan  | /plan        |
| Verify build | /healthcheck |
| End session  | /handoff     |
```

2. **Full documentation** (read on demand — 270 lines):
   Keep the full `COMMAND_GUIDE.md` but don't load it into every agent's context. The orchestrator reads it; individual agents only need the quick-reference table plus the specific command they're executing.

**Implementation**: Sync engine generates two outputs:

- `COMMAND_GUIDE.md` (full — for orchestrator and human reference)
- `COMMAND_QUICK_REF.md` (compact table — for agent context injection)

**Savings**: ~10KB per agent session for agents that don't need the full guide.

---

## Finding 10: Hooks Already Enforce Rules That Are Also Agent Instructions

### The Problem

`settings.yaml` defines hooks that enforce rules — but agents also carry the same rules as text instructions:

| Hook                                                                   | What It Enforces           | Matching Rule                               |
| ---------------------------------------------------------------------- | -------------------------- | ------------------------------------------- |
| `permissions.deny: ["rm -rf", "git push --force", "git reset --hard"]` | No destructive commands    | `ac-no-destructive-without-confirm`         |
| `hooks.preToolUse.protect-templates`                                   | Don't edit generated files | `ac-respect-generated-headers`              |
| `hooks.preToolUse.protect-sensitive`                                   | Protect sensitive files    | `sec-no-secrets` (partial)                  |
| `hooks.preToolUse.guard-destructive-commands`                          | Guard destructive ops      | `ac-no-destructive-without-confirm` (again) |
| `hooks.preToolUse.pre-push-validate`                                   | Validate before push       | `ac-run-checks`, `gw-sync-before-pr`        |

**Double enforcement**: The hook already blocks the behavior. The rule in agent context tells the agent not to do it. Both exist. The hook is the reliable one — the agent instruction is the redundant one.

### The Fix

For rules where hooks already enforce the behavior:

1. Mark the rule `agent-visible: false` in rules.yaml
2. Add comment: `enforced-by: hook:<hook-name>`
3. Agent context no longer carries these rules

The hook handles enforcement. The agent doesn't need to "remember" — it literally can't violate the rule because the hook blocks it.

---

## Finding 11: Examples and Anti-Patterns Are Rarely Referenced

### The Problem

Only 7 agents have `examples:` with code blocks. 13 agents have `anti-patterns:` lists. These are baked into agents.yaml and would be rendered into agent context even when the agent is doing a task that doesn't need them.

Example: The backend agent carries a "Service registration pattern" code example in context for every task — even when it's doing a code review, not implementing services.

### The Fix

**Move examples and anti-patterns to external reference files, loaded on demand:**

```yaml
# BEFORE (in agents.yaml — always in context)
examples:
  - title: Service registration pattern
    code: |
      export function registerBillingServices(container) { ... }

# AFTER (in agents.yaml — reference only)
examples-ref: docs/engineering/examples/backend-examples.md
anti-patterns-ref: docs/engineering/anti-patterns/backend-anti-patterns.md
```

When an agent needs examples (implementation tasks), the orchestrator includes the reference file. For review tasks, it doesn't.

**Savings**: Variable — code examples can be 5-20 lines each. Across 7 agents, ~50-150 lines of code that don't need to be in context for every task type.

---

## Consolidated Savings Estimate

| Finding                            | Current Cost                              | After Fix                      | Savings              |
| ---------------------------------- | ----------------------------------------- | ------------------------------ | -------------------- |
| 1. Domain-rules duplication        | ~13.4KB across file; ~640 words per agent | ~50 words per agent (IDs only) | **~590 words/agent** |
| 2. Preferred-tools duplication     | 111 lines                                 | ~10 lines                      | **~100 lines**       |
| 3. CI-enforceable rules in context | ~640 words per agent                      | 0 (tool-enforced)              | **~640 words/agent** |
| 4. Duplicate secrets rules         | 3 full descriptions                       | 1 full + 2 refs                | **~80 words**        |
| 5. Duplicate conventional commits  | 2 full descriptions                       | 1 merged, tool-enforced        | **~60 words**        |
| 6. Agent-conduct in every agent    | 178 chars \* 21 agents                    | 1 global config                | **~3,700 chars**     |
| 7. Process responsibilities        | ~40 lines                                 | ~28 lines                      | **~12 lines/agent**  |
| 8. Dead file references            | Error handling context waste              | No errors                      | **Variable**         |
| 9. Full COMMAND_GUIDE in context   | ~14KB per agent                           | ~2KB quick-ref                 | **~12KB/agent**      |
| 10. Rules duplicating hooks        | ~5 rules \* ~40 words                     | 0 (hook-enforced)              | **~200 words/agent** |
| 11. Always-loaded examples         | ~100 lines                                | On-demand only                 | **~100 lines**       |

**Conservative estimate**: Each agent session saves **~2,000-3,000 tokens** of wasted context. Across a sprint with multiple agents active, this adds up to tens of thousands of tokens.

More importantly: **reliability improves**. Rules enforced by scripts and hooks are 100% reliable. Rules carried as agent instructions are probabilistic — agents sometimes forget, misapply, or ignore them under context pressure.

---

## Implementation Roadmap

### Phase A — Quick Wins (Config-Only Changes)

| #   | Change                                                                       | Files Modified               |
| --- | ---------------------------------------------------------------------------- | ---------------------------- |
| A1  | Convert domain-rules from text strings to ID references                      | `agents.yaml`                |
| A2  | Define global-domain-rules for universal rules (git-workflow, agent-conduct) | `teams.yaml` process section |
| A3  | Define default preferred-tools; remove per-agent copies                      | `agents.yaml`, `teams.yaml`  |
| A4  | Add `agent-visible: false` to tool-enforced rules                            | `rules.yaml`                 |
| A5  | Merge `gw-conventional-commits` and `gw-pr-title-format`                     | `rules.yaml`                 |
| A6  | Add `extends:` for duplicate secrets rules                                   | `rules.yaml`                 |
| A7  | Remove or generate missing referenced files                                  | `AGENTS.md`, project setup   |

### Phase B — Sync Engine Changes

| #   | Change                                                           | Files Modified           |
| --- | ---------------------------------------------------------------- | ------------------------ |
| B1  | Resolve domain-rule IDs to text only when rendering full context | Sync engine              |
| B2  | Filter rules by `agent-visible` when generating agent output     | Sync engine              |
| B3  | Generate `COMMAND_QUICK_REF.md` alongside full guide             | Sync engine              |
| B4  | Move examples/anti-patterns to external files; load on demand    | Sync engine, agents.yaml |

### Phase C — Hook & CI Alignment

| #   | Change                                                                            | Files Modified                         |
| --- | --------------------------------------------------------------------------------- | -------------------------------------- |
| C1  | Add pre-commit hooks for: ts-lint, ts-format, py-lint, py-format, rs-fmt, iac-fmt | `.husky/`, `package.json`              |
| C2  | Add CI checks for: qa-coverage-threshold, ci-pin-actions, dep-lockfile-committed  | `.github/workflows/`                   |
| C3  | Add pre-push hook for gw-sync-before-pr                                           | `.husky/`, settings.yaml               |
| C4  | Add `enforced-by:` field to all enforcement rules                                 | `rules.yaml`                           |
| C5  | Generate enforcement matrix document                                              | `scripts/rules-enforcement-matrix.mjs` |

### Phase D — Responsibility Audit

| #   | Change                                                                  | Files Modified          |
| --- | ----------------------------------------------------------------------- | ----------------------- |
| D1  | Classify each responsibility as domain-expertise or process-enforcement | `agents.yaml`           |
| D2  | Move process-enforcement responsibilities to tooling/CI config          | Various CI/config files |
| D3  | Trim responsibility lists to domain-expertise only                      | `agents.yaml`           |

---

## Dependency on SPEC-PROC-001 through SPEC-PROC-004a/b

This audit's recommendations integrate with the process specs:

| This Audit Finding                          | Related Spec Feature                               | Integration                                            |
| ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| Global agent-conduct rules → process config | SPEC-PROC-001 TR-CC-1 (teams.yaml process section) | Agent-conduct rules live in same process block         |
| Tool-enforced rules → scripts               | SPEC-PROC-001 TR-CC-2 (script architecture)        | Rule enforcement scripts follow same pattern           |
| Enforcement matrix                          | SPEC-PROC-004a F-029 (poka-yoke registry)          | Registry tracks which rules have automated enforcement |
| Hook-enforced rules                         | SPEC-PROC-004a F-029 (poka-yoke expansion)         | Hooks are poka-yoke mechanisms                         |
| On-demand examples                          | SPEC-PROC-002 F-010 (Scrum Master as scripts)      | Same principle: push logic out of agent context        |

---

## Success Criteria

| Metric                            | Current             | Target                        |
| --------------------------------- | ------------------- | ----------------------------- |
| agents.yaml file size             | 50KB / 1,037 lines  | < 25KB / ~500 lines           |
| Domain-rules text per agent       | ~640 words          | < 100 words (IDs only)        |
| Rules with `agent-visible: false` | 0                   | 16+ (all tool-enforced rules) |
| Rules with `enforced-by:` field   | 0                   | All enforcement-type rules    |
| Duplicate text across agents      | ~25,000 words total | < 2,000 words                 |
| Missing referenced files          | 3                   | 0                             |
| Preferred-tools lines             | 111                 | < 15                          |

---

_This is a planning/audit document. No implementation changes have been made._
_See also: SPEC-PROC-001 through SPEC-PROC-004a/b for companion process specifications._
