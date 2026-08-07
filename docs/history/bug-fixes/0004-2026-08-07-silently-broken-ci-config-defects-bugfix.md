# Silently broken CI config defects Resolution - Historical Summary

**Completed**: 2026-08-07
**Bug ID**: n/a — found while auditing loose ends after [#576](https://github.com/phoenixvc/retort/pull/576)
**PR**: [#579](https://github.com/phoenixvc/retort/pull/579)
**Severity**: High — `dev` was unmergeable without admin bypass

## Problem Description

Three independent CI-configuration defects, all sharing one failure mode: **the
config was invalid in a way that produced no useful signal**, so each had been
broken for a long time without anyone noticing.

1. **A required status check that could never match.** Every PR to `dev` sat
   permanently `BLOCKED`.
2. **Two workflows that had never run.** `coverage-report.yml` and
   `dependency-audit.yml` failed at startup with zero jobs scheduled.
3. **A stop hook that blocked on every dev-merge.** Routine `git merge origin/dev`
   commits were reported as non-conventional.

## Root Cause Analysis

### 1. Required status check context

`branchProtection.requiredStatusChecks` declared `'Branch Protection / branch-rules'`.
GitHub reports an Actions status check under the job's `name:` — or its **job id**
when `name:` is omitted — so `branch-protection.yml`'s job reports as
`branch-rules`. The `Workflow / Job` form only applies to reusable workflows
called via `uses:` at job level.

```text
REQUIRED 'Test'                             -> SUCCESS
REQUIRED 'Validate'                         -> SUCCESS
REQUIRED 'Branch Protection / branch-rules' -> NOT REPORTED
```

The context matched no reported check, so it could never go green. PRs #573, #575
and #576 all merged via admin bypass, which is only possible because
`enforceAdmins: false`. Without admin the branch was unmergeable; with admin the
gate was silently absent.

`ci.yml`'s own header comment already documented the correct name, so the spec
contradicted the repo's own documentation.

A second, compounding cause: `setup-agentkit-branch-governance.{sh,ps1}`
**hardcoded** the contexts array while templating every neighbouring field from
spec. Two independent definitions of the same value meant fixing the spec alone
would have left the governance script still applying the broken one.

### 2. Workflow startup failure

Both workflows used `hashFiles()` in a **job-level** `if:`. That function needs a
checked-out workspace and is not available in the `jobs.<job_id>.if` context. An
unavailable function invalidates the **entire workflow file** — which is why no
job ran at all, rather than the gate simply evaluating false.

The signal was poor: a run record with `event=push` on a `pull_request`-only
workflow, zero jobs, and conclusion `failure` with no logs. Nothing pointed at
the offending line.

### 3. Stop hook merge detection

The conventional-commit check skipped merge commits by **message prefix**:

```bash
[[ "$MSG" =~ ^Merge\ (remote-tracking\ branch|branch|pull\ request) ]] && continue
```

`git merge origin/dev` produces `Merge origin/dev into <branch>`, which matches
none of the three forms. Message-prefix matching is the wrong tool: the message
of a merge commit varies with what was merged, but the _structure_ does not.

## Solution Implemented

Spec now declares `'branch-rules'`, with each entry annotated with the
workflow and job it comes from, plus a note on how Actions contexts are named.
Both governance templates render `{{bpRequiredStatusChecksJson}}` — the variable
`.github/scripts/setup-branch-protection` already used — collapsing the two
definitions into one.

The five invalid job-level `hashFiles` gates are removed. They were redundant:
Rust and Python jobs are already gated at _generation_ time by
`{{#if hasLanguageRust}}` / `{{#if hasLanguagePython}}`, and the Node jobs
degrade gracefully on non-Node repos (`|| true`, "No coverage runner detected").
Both workflows are `continue-on-error` and non-blocking.

The stop hook detects merge commits structurally by parent count.

### Code Changes

- **`.agentkit/spec/project.yaml`**: `'Branch Protection / branch-rules'` →
  `'branch-rules'`, annotated.
- **`.agentkit/templates/scripts/setup-agentkit-branch-governance.{sh,ps1}`**:
  hardcoded contexts array → `{{bpRequiredStatusChecksJson}}`.
- **`.agentkit/templates/github/workflows/{coverage-report,dependency-audit}.yml`**:
  removed 5 invalid job-level `if: hashFiles(...)` lines.
- **`.agentkit/templates/claude/hooks/stop-build-check.sh`**: merge detection by
  `git log -1 --format=%P` parent count.
- **`.github/workflows/ci.yml`**: comment listed a `YAML Lint` required check that
  is not one; now points at the spec as source of truth and explains the
  context-naming rule.
- Regenerated: four branch-protection scripts, two workflows, one hook.

### Testing

- **Unit Tests**: none added — these are YAML/shell config with no harness.
  Verified by direct inspection and live API comparison.
- **Integration Tests**: see Verification — the suite is flaky independent of
  this change.
- **Manual Testing**: merge-detection logic exercised against real commits from
  the repo's own history.

## Verification

| Check                                        | Result                                           |
| -------------------------------------------- | ------------------------------------------------ |
| All four generated branch-protection scripts | `"contexts": ["Test","Validate","branch-rules"]` |
| Job-level `hashFiles` remaining              | 0 in both workflows                              |
| Merge detection — 2-parent commit            | skipped                                          |
| Merge detection — 1-parent commit            | still checked (rule unchanged)                   |
| `retort:spec-validate`                       | PASSED, 0 warnings                               |
| `retort:validate`                            | PASSED (16 pre-existing warnings)                |
| `retort:sync` drift                          | clean                                            |

The correlation evidence for defect 2 is worth recording: the only two workflows
in the repo using `hashFiles` at job level are exactly the two that fail. Every
other job-level `if:` uses allowed contexts, and those workflows run fine.

### Test Suite — Pre-Existing Flakiness

Four full runs of essentially the same code produced **1, 7, 13 and 5** failures.
Running the implicated files against **unmodified `dev`** reproduces them, which
establishes they are pre-existing rather than caused by this change.
`template-utils.test.mjs` — the only suite covering `branchProtection` — passes
all 240 tests.

Two contributors are identifiable:

- `prettier.test.mjs` is the known Windows `core.autocrlf` artifact: hand-authored
  files check out as CRLF while prettier defaults to LF. `prettier --write`
  produces a zero-byte content diff, and it passes on Linux CI.
- `discover.test.mjs > detectCommitConvention() — git-log heuristic` reads real
  `git log` output, making it sensitive to commits landing concurrently.

The remaining instability in `sync-agent-features` and `check-coverage` is not
explained and warrants its own investigation.

## Impact Assessment

Highest impact is defect 1: `dev` was unmergeable for anyone without admin, and
for admins the required-check gate was silently absent — a genuine check failure
would have looked identical to the block that was always present.

Defect 2 meant the repo had **no coverage reporting and no dependency audit** at
all, despite both appearing configured.

Defect 3 was friction rather than risk, but it fired on every dev-merge.

## Prevention Measures

The common thread: **invalid CI config fails quietly and in a way that mimics
something else.** A never-matching required context looks like a pending check.
An invalid workflow file looks like an unrelated push failure. A message-prefix
match that misses looks like a genuine lint violation.

Two concrete guards fall out of this:

- Required status-check contexts should be derived from, or cross-checked
  against, the workflow files that produce them — they are currently maintained
  by hand in spec and can silently drift.
- Prefer structural predicates over textual ones. Parent count cannot drift the
  way a message prefix can.

Removing the duplicated contexts array matters more than the value change: with
two definitions, a correct fix in one place still leaves the bug live in the
other.

## Lessons Learned

- **The strongest evidence was correlational and cheap.** Listing every
  job-level `if:` across all workflows took one command and showed the two
  failing workflows were precisely the two using `hashFiles` there.
- **Re-running an unreliable suite is worth more than reading one run.** A single
  13-failure run looked like a serious regression; four runs varying between 1
  and 13 identified flakiness, and a baseline run on `dev` confirmed it.
- **Both defects 1 and 2 were invisible because nothing ever went red in a way
  that pointed at them.** The admin bypass in particular hid defect 1 across at
  least three merges.

---

**Fix Author**: Claude Opus 5 (agent session), for Jurie Smit
**Reviewer**: pending — see [#579](https://github.com/phoenixvc/retort/pull/579)
**Status**: Resolved
