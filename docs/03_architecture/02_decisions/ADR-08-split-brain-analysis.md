# ADR-08: Split-Brain Analysis — Script-Based vs Agent-Directive Enforcement

**Status**: proposed
**Date**: 2026-03-04
**Context**: Systematic audit of enforcement authority split between runtime scripts/CI and agent directive files

---

## 1. Context

AgentKit Forge governs agent behaviour through **three enforcement layers**:

| Layer | Mechanism | Binding? | Audience |
|-------|-----------|----------|----------|
| **L1 — Directives** | AGENTS.md, CLAUDE.md, copilot-instructions.md, cursorrules, windsurfrules, rules.yaml | Advisory (LLM-interpreted) | AI agents |
| **L2 — Hooks** | session-start.sh, protect-templates.sh, protect-sensitive.sh, guard-destructive-commands.sh, pre-push-validate.sh | Hard (process-level deny) | Claude Code only |
| **L3 — CI/CD** | ci.yml, branch-protection.yml, block-agentkit-changes.yml, template-protection.yml, codeql.yml, semgrep.yml | Hard (merge-blocking) | All contributors |

A "split-brain" occurs when two layers encode the **same rule with different semantics, scope, or enforcement strength**, creating ambiguity about which is authoritative. This analysis identifies every such conflict.

---

## 2. Findings — Identified Split-Brain Issues

### SB-1: Template Protection — Three Authorities, Inconsistent Scope

**The rule**: "Don't modify `.agentkit/templates/`, `.agentkit/engines/`, `.agentkit/overlays/`, `.agentkit/bin/`"

| Source | What it blocks | Gap |
|--------|---------------|-----|
| **CLAUDE.md template** (L1) | Also lists `.agentkit/spec/` as protected from AI agents | Soft, advisory only |
| **protect-templates.sh** (L2) | Blocks Write/Edit to all 5 paths including `.agentkit/spec/` | Hard, but Claude-only |
| **block-agentkit-changes.yml** (L3) | Blocks PR diffs touching `.agentkit/` (entire subtree) | Hard, all tools |
| **template-protection.yml** (L3) | Blocks `.agentkit/templates/`, `.agentkit/engines/`, `.agentkit/bin/` only | Hard, but narrower scope |
| **rules.yaml** `tp-no-direct-edit` (L1) | Lists spec/ as editable by users but not AI | Advisory |

**Split-brain**: The hook blocks `.agentkit/spec/` edits, but `rules.yaml` says spec is the "intended edit point for project configuration". Meanwhile, the CLAUDE.md template safety rule #4 says "never modify" spec, but the same template's "Generated File Sync" section instructs agents to "Edit spec files in `.agentkit/spec/`". The CI workflows have two overlapping checks (`block-agentkit-changes.yml` vs `template-protection.yml`) with different scopes.

**Impact**: An agent following CLAUDE.md's sync instructions would be denied by the protect-templates hook. A human editing spec/ would be blocked by `block-agentkit-changes.yml` in non-forge repos. The distinction between "users may edit spec" and "AI may not edit spec" is only enforceable in Claude Code via hooks.

---

### SB-2: Conventional Commits — Four Redundant Enforcement Points

**The rule**: "All commits and PR titles must use `type(scope): description`"

| Source | Enforces on | Gap |
|--------|------------|-----|
| **CLAUDE.md** (L1) | Commit messages + PR titles | Advisory |
| **copilot-instructions.md** (L1) | "Follow conventional commit convention" | Advisory, vague wording |
| **cursorrules/windsurfrules** (L1) | "All commits AND PR titles MUST use Conventional Commits" | Advisory |
| **session-start.sh** (L2) | Reminder in additionalContext output | Reminder only |
| **pre-push-validate.sh** (L2) | Validates commit format before push | Hard, Claude-only |
| **branch-protection.yml** (L3) | Validates PR title regex only | Hard, all tools |
| **rules.yaml** `gw-conventional-commits` (L1) | Full format with examples | Advisory |

**Split-brain**: The CI only validates PR **titles**, not individual commit messages. The pre-push hook validates commits but only runs in Claude Code sessions. For Cursor, Windsurf, Copilot, and human developers, non-conforming **commit messages** pass CI without detection. The copilot-instructions.md uses weaker language ("Follow conventional commit convention") vs CLAUDE.md's explicit format specification.

**Impact**: Commit history contains non-conforming messages (evidence: `6d5ea1f Plan: Brand-Driven Editor Theme Generation (#193)` and `2e4a5f0 Expand code review to 10 criteria...` in the dev branch).

---

### SB-3: Destructive Command Guards — Hook vs Directive vs Permissions

**The rule**: "Never run destructive commands without confirmation"

| Source | Enforcement | Commands covered |
|--------|------------|-----------------|
| **settings.yaml** deny list (L2) | Hard deny in .claude/settings.json | rm -rf /, git push --force/-f, git reset --hard, terraform destroy, az group delete, gh repo delete |
| **guard-destructive-commands.sh** (L2) | Hard deny via PreToolUse hook | Same list + `DROP TABLE`, `DROP DATABASE` |
| **CLAUDE.md** safety rule #3 (L1) | Advisory | "Never run destructive commands without confirmation" |
| **rules.yaml** `ac-no-destructive-without-confirm` (L1) | Advisory | Generic "destructive commands" |

**Split-brain**: The permissions deny list and the hook script have **duplicate coverage** with slightly different sets. The hook catches SQL destructive commands (`DROP TABLE`) that the permissions system doesn't. Settings.yaml denies `git push --force*` but the hook uses regex patterns. If one is updated without the other, they drift apart. The directive layer uses vague "destructive commands" while the enforcement layers enumerate specific commands — an agent encountering an unlisted destructive command (e.g., `kubectl delete namespace`) would only be caught by the advisory layer.

---

### SB-4: Quality Gates — `/check` Command vs CI vs Directive

**The rule**: "Run quality gates before PR"

| Source | What runs | Gap |
|--------|----------|-----|
| **check.mjs** (script) | format → lint → typecheck → test → build, per tech stack | Detects stacks from teams.yaml |
| **ci.yml** (L3) | `pnpm test` + spec-validate + sync + validate + drift check | Fixed commands, not stack-aware |
| **CLAUDE.md** (L1) | "Always run `/check` before creating a PR" | Advisory |
| **rules.yaml** `ci-quality-gates` (L1) | Lists: lint, typecheck, unit tests, integration tests, spec validation, drift check | Advisory |

**Split-brain**: The `/check` command runs stack-detected quality gates (format, lint, typecheck, test, build) using `teams.yaml` tech stack definitions. But CI runs a **fixed pipeline** (`pnpm test` in `.agentkit/`) that does NOT invoke `/check` or use tech stack detection. The checks aren't the same. `/check` runs Prettier formatting and ESLint linting; CI does not. CI runs spec-validate and drift check; `/check` does not. A project could pass `/check` locally but fail CI (drift), or pass CI but have formatting issues that `/check` would catch.

---

### SB-5: Generated File Editing — Contradictory Instructions

**The rule**: "Never edit generated files directly"

| Source | Says |
|--------|------|
| **CLAUDE.md** safety rule #5 | "Never directly edit files marked `GENERATED by AgentKit Forge`" |
| **CLAUDE.md** safety rule #4 | "Never modify files in `.agentkit/spec/`" |
| **CLAUDE.md** sync section | "Edit spec files in `.agentkit/spec/`" then run sync |
| **rules.yaml** `tp-no-direct-edit` | "`.agentkit/spec/` is the intended edit point — users (not AI agents) may modify spec" |
| **protect-templates.sh** (L2) | Blocks all edits to `.agentkit/spec/` |

**Split-brain**: CLAUDE.md contains two directly contradictory statements: safety rule #4 says "never modify" spec, while the sync workflow section says "edit spec files in `.agentkit/spec/`". The rules.yaml tries to resolve this by saying only users (not AI) should edit spec, but this nuance is lost in the CLAUDE.md template where both instructions appear in the same document read by the same AI agent. The hook enforces the deny universally.

---

### SB-6: Branch Strategy — Default Branch Disagreement

**The rule**: "What is the default branch?"

| Source | Says |
|--------|------|
| **project.yaml** | Not explicitly set (no `defaultBranch` field) |
| **CLAUDE.md template** | Uses `{{defaultBranch}}` placeholder |
| **AGENTS.md** (generated) | `Default Branch: main` |
| **copilot-instructions.md** | `Default Branch: main` |
| **ci.yml** | Triggers on `[main, dev]` |
| **branch-protection.yml** | Protects `[main, dev]` |
| **ci.yml validate step** | Enforces "PRs to main must come from dev" |
| **Actual git state** | `master` is the default branch, `origin/dev` exists |

**Split-brain**: The generated files reference `main` but the actual default branch in git is `master`. The CI enforces a `dev → main` promotion path, but since `main` doesn't exist (it's `master`), this rule may not trigger correctly. The project.yaml doesn't declare a `defaultBranch` field, so the CLAUDE.md template uses whatever value the sync engine defaults to.

---

### SB-7: Who Owns the copilot-instructions.md?

**The rule**: "copilot-instructions.md is generated"

| Source | Says |
|--------|------|
| **.gitignore** line 42 | Commented out: `# /.github/copilot-instructions.md` — scaffold-once, edit freely |
| **copilot-instructions.md** header | `<!-- GENERATED by AgentKit Forge v0.2.1 — DO NOT EDIT -->` |
| **Sync engine** | Regenerates it every sync |

**Split-brain**: The .gitignore explicitly **does not** ignore `copilot-instructions.md` (it's commented out as "scaffold-once — commit after first sync, edit freely"). But the file itself has a `GENERATED — DO NOT EDIT` header, and the sync engine overwrites it on every run. If a user edits it manually (as the gitignore pattern suggests), the next sync will silently overwrite their changes. The file is simultaneously "scaffold-once, owned by project" and "always-regenerated, don't edit."

---

### SB-8: Version Mismatch in Generated Headers

| Source | Version |
|--------|---------|
| **AGENTS.md** header | `AgentKit Forge v3.1.0` |
| **copilot-instructions.md** header | `AgentKit Forge v0.2.1` |
| **COMMAND_GUIDE.md** header | `AgentKit Forge v3.1.0` |

**Split-brain**: Different generated files claim different framework versions. This suggests the sync engine uses a per-template version or the files were generated at different times. Agents reading these files get inconsistent version signals.

---

### SB-9: Safety Rules — Inconsistent Numbering and Scope Across Outputs

The CLAUDE.md template has 9 safety rules. The copilot-instructions.md has 6. AGENTS.md inherits from the root template with different wording.

| Rule | CLAUDE.md | copilot-instructions.md | cursorrules |
|------|-----------|------------------------|-------------|
| No secrets | #1 | #1 | Yes |
| No force-push | #2 | #2 | No |
| No destructive cmds | #3 | #3 | No |
| No template edits | #4 | - | Yes |
| No generated file edits | #5 | - | Yes |
| Run /check before PR | #6 | #4 | No |
| Conventional commits | #7 | - | Yes |
| Document breaking changes | #8 | #5 | No |
| Write tests | #9 | #6 | No |
| Sync after spec edit | Detailed section | - | Yes |

**Split-brain**: Agents using different tools receive different safety rule subsets. A Copilot agent doesn't know about template protection. A Cursor agent doesn't know about force-push restrictions. Only Claude Code agents get the full rule set + hook enforcement.

---

## 3. Incoming PRs / Branch State

- **master** and **origin/dev** are in sync at `2be76d6`
- No open PRs detected (gh CLI not available in this environment)
- Notable non-conforming commits already merged to dev:
  - `6d5ea1f Plan: Brand-Driven Editor Theme Generation (#193)` — violates conventional commits
  - `2e4a5f0 Expand code review to 10 criteria...` — violates conventional commits
  - `26bd9a6 chore: apply prettier to consolidation delta` — OK
- The branch naming `master` vs CI references to `main` is a concrete active issue

---

## 4. Decision — Proposed Resolution Strategy

### Principle: **Single Source, Graduated Enforcement**

Every rule should be:
1. **Defined once** in a canonical location (`.agentkit/spec/`)
2. **Rendered consistently** across all directive outputs (CLAUDE.md, AGENTS.md, copilot-instructions.md, cursorrules, etc.)
3. **Enforced at the hardest available layer** (CI > hooks > directives)

### 4.1 Immediate Fixes (SB-1, SB-5, SB-6, SB-7, SB-8)

| Issue | Fix |
|-------|-----|
| **SB-1**: Template protection contradiction | Remove `.agentkit/spec/` from `protect-templates.sh` PROTECTED_PATTERNS. Spec is the intended edit point. Add a separate `protect-spec-from-ai.sh` hook that only blocks when running in an AI context, or rely on the existing CI `block-agentkit-changes.yml` for non-forge repos |
| **SB-5**: Contradictory CLAUDE.md instructions | Rewrite safety rule #4 to: "Never modify files in `.agentkit/templates/`, `.agentkit/engines/`, `.agentkit/overlays/`, or `.agentkit/bin/`. The edit point for project configuration is `.agentkit/spec/` — modify spec YAML there and run sync." Remove the contradictory "never modify spec" wording |
| **SB-6**: Branch name mismatch | Add `defaultBranch: main` to `project.yaml` and rename `master` → `main`, or update all CI refs to `master`. Ensure the sync engine reads and uses this value consistently |
| **SB-7**: copilot-instructions.md ownership | Either (a) make it always-regenerated by adding it to .gitignore (not commented), or (b) make it truly scaffold-once by removing the `GENERATED` header and skipping it during sync if it exists. Pick one |
| **SB-8**: Version mismatch | Ensure sync engine stamps all outputs with the same version from a single `version` field in package.json or project.yaml |

### 4.2 Structural Improvements (SB-2, SB-3, SB-4, SB-9)

| Issue | Fix |
|-------|-----|
| **SB-2**: Conventional commits gap | Add a `commitlint` CI job or a commit-msg git hook (generated by sync) that validates individual commit messages, not just PR titles. This closes the gap for non-Claude tools |
| **SB-3**: Destructive command overlap | Consolidate the deny list into a single canonical source in `settings.yaml`. Have `guard-destructive-commands.sh` read from the same source (or be generated from it) rather than maintaining a parallel list. Add `kubectl delete`, `helm uninstall` to the canonical list |
| **SB-4**: Check vs CI divergence | Either (a) have CI invoke the same `/check` engine (`node .agentkit/engines/node/src/cli.mjs check`) instead of ad-hoc commands, or (b) document explicitly that `/check` is a local pre-flight and CI is the authoritative gate, with the understanding that they test different things. Option (a) is strongly preferred |
| **SB-9**: Safety rule parity | Generate all directive files from the same rules.yaml source. Each rule in rules.yaml should have a `platforms` field indicating which outputs include it. The sync engine should render the appropriate subset per platform |

### 4.3 Architecture Improvement — Rule Provenance Chain

```
rules.yaml (canonical)
    ↓ sync engine reads
    ├── CLAUDE.md (full set, Claude-specific wording)
    ├── AGENTS.md (universal subset)
    ├── copilot-instructions.md (Copilot subset)
    ├── cursorrules (Cursor subset)
    ├── windsurfrules (Windsurf subset)
    ├── settings.yaml deny list (permissions)
    ├── hook scripts (runtime enforcement)
    └── CI workflows (merge-blocking)
```

Each rendered output should include a provenance comment mapping back to the rule ID:
```markdown
<!-- Rule: gw-conventional-commits | Enforcement: L1+L2+L3 -->
```

This makes it trivially auditable whether a rule is consistently represented.

---

## 5. Consequences

**If adopted:**
- Single source of truth for every rule, eliminating drift
- CI and `/check` converge on the same gate logic
- All AI tools receive safety rules proportional to their enforcement capability
- Audit trail from rendered output back to canonical rule

**If not adopted:**
- Rules will continue to drift as the framework evolves
- Non-Claude agents will operate with incomplete safety rules
- Developers will encounter contradictory instructions in different files
- CI and local checks will continue to test different things

---

## 6. Priority Order

1. **SB-6** (branch name) — Active breakage risk, immediate fix
2. **SB-5** (contradictory instructions) — Confuses every agent session
3. **SB-1** (template protection scope) — Blocks legitimate spec edits
4. **SB-4** (check vs CI) — Most impactful structural improvement
5. **SB-7** (copilot-instructions ownership) — Silent data loss risk
6. **SB-9** (safety rule parity) — Platform fairness
7. **SB-2** (commit message enforcement) — Already has evidence of violations
8. **SB-8** (version mismatch) — Cosmetic but undermines trust
9. **SB-3** (destructive command overlap) — Low risk, maintenance burden
