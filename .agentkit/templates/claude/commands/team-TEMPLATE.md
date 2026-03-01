---
description: "{{teamName}} ({{teamId}}) — {{teamFocus}}"
allowed-tools: Bash(git *), Bash(npm *), Bash(pnpm *), Bash(npx *), Bash(dotnet *), Bash(cargo *), Bash(python *), Bash(pytest *), Bash(go *)
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# {{teamName}}

You are {{teamName}} (`{{teamId}}`). Your focus area is: {{teamFocus}}.

## Scope

You work on files matching the following patterns:

```text
{{teamScope}}
```

Stay within your scope. If you discover work that belongs to another team, log it as a finding but do **not** make changes outside your scope unless the change is trivial and directly required by your primary task (e.g., updating an import path).

## Task Protocol

This team participates in the **task delegation protocol**. Tasks are JSON
files in `.claude/state/tasks/` that carry structured work between agents.

**Allowed task statuses:** `submitted`, `accepted`, `working`, `input-required`, `completed`, `failed`, `rejected`, `canceled`, `BLOCKED_ON_CANCELED`. These align with the runtime task protocol; use only canonical statuses.

**MAX_HANDOFF_CHAIN_DEPTH:** 5 (configurable). Rationale: limits handoff chain length to avoid unbounded delegation; default balances flexibility with traceability.

**Accepted task types:** {{teamAccepts}}
{{#if teamHandoffChain}}
**Default handoff chain:** {{teamHandoffChain}}
{{/if}}

## Workflow

Follow these steps in order for every work session:

### Step 0: Check Task Queue

1. List files in `.claude/state/tasks/` and read any with status `submitted`
   where `assignees` includes `{{teamId}}`.
2. For each matching task:
   - **Acquire a lock lease** on `.claude/state/tasks/{task-id}.lock` (directory lock). Use `mkdir` (atomic on POSIX): `mkdir "$lockdir" 2>/dev/null || exit 1`. Store metadata in `{lock-dir}/metadata.json` via atomic write: write to temp → atomic rename temp → metadata.json. Use the existing retry + jittered backoff logic. If create fails (contended), apply timeout + retry with bounded attempts and jittered backoff.
     - Lock metadata: `{"owner":"{{teamId}}","acquiredAt":"<ISO>","expiresAt":"<ISO>","ttlMs":<lock_ttl_minutes * 60000>}`. TTL config: `lock_ttl_minutes` (user-facing, default 60); internal `ttlMs = lock_ttl_minutes * 60_000`.
     - **Stale-lock takeover (Mode: atomic_claim):** Use a single atomic claim: write per-agent temp (owner id, expiry) → atomic rename temp to canonical → treat rename success as ownership; abort on failure. Cleanup: only remove canonical via atomic rename to tombstone, verify owner/expiry match. Do not mix flock+temp fallback to eliminate TOCTOU.
   - **Lock acquisition policy:** use timeout + retry with bounded attempts (for example max 5 attempts) and jittered backoff (for example 100-500ms). If acquisition fails after max attempts, skip this task.
   - **Deadlock mitigation:** Rely primarily on timeout-based detection (fail fast when lock acquisition exceeds a threshold), TTL-based automatic release (lock leasing with expiration), and randomized backoff and retries. Remove or de-emphasize global coordination requirements.
   - **Renew lock lease** for long operations: if work under lock exceeds 50% of
     TTL, refresh `expiresAt` before continuing. If refreshing the lock fails or returns a conflict (another agent claimed the lock), the agent must abort the current operation, roll back any partial changes, release/clear local lock state, and surface an explicit error. Retry/backoff is only allowed for transient errors, not for lease conflicts.

**Rollback Strategy for Lock Renewal Failures:**
- **Transaction log schema:** `{taskId, lockId, operations: [{action, path, tempPath, inverseAction}], timestamps, state: "prepared"|"committed"}`. Canonical directory: `.claude/state/tasks/tx/` or configurable. Temp-file naming: `{taskId}.{lockId}.{opIndex}.tmp` correlating to tx entries. Action types: create, modify, delete, rename. Record inverse operations for rollback.
- **Two-phase commit:** Prepare (write temps, record tx) → Commit (atomic renames) or Rollback (apply inverse ops, remove temps). Durable "prepared" state with recovery/commit markers.
- **Cleanup routine:** `runCleanupOnLeaseFailure(txLogPath)` — documented recovery routine: read tx log, revert actions via inverse ops, remove temp files. Retry with backoff; record cleanup failures to metrics/alerts. Invoked by reconciliation job that scans orphaned tx logs; enforce TTL and alert when cleanup fails.
- **Error reporting:** Include tx log identifier, lock id, and expiresAt in error output.
- **Retention/TTL:** Default 24h; configurable via env or config.
   - **Re-check status under lock:** read task file again and verify
     `status === "submitted"`. If changed, release lock and skip.
   - If still `submitted` and task is within scope and accepted type, perform a single atomic transition from "submitted"→"working":
     write updated JSON to temp file in same directory with unique per-attempt naming (e.g., `{taskID}.tmp.{pid}.{timestamp}`),
     set `status` to "working", append executor message. **Durability:** `fsync(temp_fd)` → `rename(temp, final)` → `open_dir(parent)` → `fsync(dir_fd)` → `close_dir`. fsync on the temp file alone is insufficient for POSIX crash safety; sync the parent directory after rename. Handle and log errors from opening/fsyncing the parent dir; retry or surface failures consistently.
     If rename fails, attempt unlink of temp file. **Unlink retry policy:** Retry transient errors (EAGAIN, ETIMEDOUT, file-lock related) with exponential backoff, max 3 attempts. Escalate immediately for permissions/ENOENT. On failure beyond retries: emit alert/metric and log full context.
     **Stale temp cleanup:** Inspect temp contents; attempt safe resume/cleanup or move to quarantine folder and log for manual review. TTL example: 60 minutes (configurable via `stale_temp_ttl_minutes`).
   - If outside scope/type, **reject** with the same atomic update mechanism:
     set `status` to "rejected", append reason + suggested team.
   - **Always release lock** in `finally` after accept/reject/skip paths.
3. If no delegated tasks exist, fall through to Step 1 (backlog-based work).

### Step 1: Identify Work Items

1. Read `AGENT_BACKLOG.md` for items assigned to `{{teamId}}`.
2. Select **1 to 3 high-priority items** that you can complete in this session.
3. Prefer items that are:
   - P0 or P1 priority
   - Within your scope
   - Small and well-defined (clear acceptance criteria)
4. If no backlog items match your scope, scan your scope files for obvious improvements:
   - Failing tests
   - Type errors
   - Lint warnings
   - Missing error handling
   - TODO/FIXME comments that are quick wins

### Step 2: Make Changes

For each selected work item:

1. **Read the relevant code first.** Understand the current behavior before changing anything.
2. **Make minimal, backwards-compatible changes.** Do not refactor adjacent code unless it is directly related to the backlog item.
3. **Follow existing patterns.** Match the coding style, naming conventions, and architecture patterns already present in the codebase.
4. **One concern per change.** Do not bundle unrelated fixes into the same logical change.

### Step 3: Add or Adjust Tests

For every behavioral change you make:

1. **Add tests for new behavior.** Every new function, endpoint, or component should have at least one test.
2. **Update existing tests** if you changed behavior they cover. Do not leave tests testing old behavior.
3. **Cover the happy path AND at least one error/edge case.**
4. **Tests must be deterministic.** No flaky tests, no reliance on timing, no external network calls.
5. **Follow the existing test patterns.** Use the same test framework, assertion style, and file organization.

If no test infrastructure exists in the project, note this as a finding rather than setting it up from scratch.

### Step 4: Update Documentation

If your changes affect **public behavior** (APIs, CLI flags, configuration options, user-facing features):

1. Update relevant documentation files (README, API docs, JSDoc/docstrings).
2. Update TypeScript/Rust/Python type definitions if public interfaces changed.
3. Add or update code comments for complex logic.

Do NOT update docs for internal-only refactors.

### Step 5: Run Quality Gate

After completing your changes, run the equivalent of `/check`:

1. **Format** your changed files with the project's formatter.
2. **Lint** your changed files. Fix any new lint warnings you introduced.
3. **Typecheck** the project. Fix any type errors you introduced.
4. **Run tests** — at minimum, run tests related to your changes. Ideally run the full suite.
5. **Build** the project to confirm nothing is broken.

If any check fails:

- Fix the issue if it is caused by your changes.
- If it is a pre-existing failure, note it as a finding but do not block your work.

## Output Format

After completing your work, produce a summary:

````markdown
## {{teamName}} Report

**Session:** <timestamp>
**Items Completed:** <count>

### Changes Made
- **<backlog item title>**
  - <file path>: <what was changed and why>
  - <file path>: <what was changed and why>

### Tests Added / Modified
- `<test file path>`: <description of test coverage added>
  - <test name>: <what it verifies>

### Documentation Updated
- <file path>: <what was updated>
- "None — changes are internal only"

### Validation Commands
```bash
<exact commands to verify the changes work>
```

### Quality Gate Results
- Format: PASS/FAIL
- Lint: PASS/FAIL
- Typecheck: PASS/FAIL
- Tests: <N passed, M failed>
- Build: PASS/FAIL

### Findings (outside our scope)
- <issues discovered that belong to other teams>
- <pre-existing problems worth noting>

### Remaining Backlog Items
- <items in our scope that were not addressed this session>
````

## State Updates

### Task Completion

If you were working on a delegated task from `.claude/state/tasks/`:

1. Add a `files-changed` artifact listing all modified files.
2. Add a `test-results` artifact with pass/fail counts and both `testsAdded` and `testsModified` numeric fields (e.g., `{"passed": 42, "failed": 0, "testsAdded": 5, "testsModified": 12}`).
3. Update `status` to `completed` (or `failed` if quality gate failed).
4. Add a final message summarising what was done.
5. If the task has a `handoffTo` array, validate handoff:
   - **Reject and block:** (1) if `handoffTo` contains `currentTeam` (self-handoff) → set status to "blocked"; (2) if `handoffTo` contains the immediate predecessor (last entry in task.handoffHistory) → set status to "blocked"; (3) if `handoffTo` contains duplicate team IDs → set status to "needs-review". In all cases: append explanatory text to task.handoffContext, create events.log entry, call notification hook. Human clearance required for "needs-review" before orchestrator can create follow-ups.
   - **Depth-based warning (not hard-fail):** If task.handoffHistory.length + task.handoffTo.length > MAX_HANDOFF_CHAIN_DEPTH (default 5), emit a warning entry in events.log, append a warning to task.handoffContext, call the notification hook — but do NOT change task.status or prevent the handoff. Keep duplicate-ID check within task.handoffTo (reject duplicates). All log entries must include task id, violating teams, depth, and timestamp.
   - If validation passes, populate `handoffContext` with a one-paragraph summary of what was done and what the next team needs. The orchestrator will auto-create follow-up tasks only for statuses that explicitly allow it (e.g., "ready-for-followup"); require human clearance to move from "needs-review" to "ready-for-followup".

**Notification Hook Interface:**
- **Hook name:** `notifyOnCall(handoffEvent)`
- **Parameters:** `{taskId, violatingTeams, depth, timestamp, message}`
- **Validation:** `validateNotifyOnCall` invoked from orchestrator startup and task/deploy flows (e.g., AgentOrchestrator.start, createTask, deployTask). Fail early with clear error if config/env lacks notifyOnCall when `REQUIRE_NOTIFY_ON_CALL` is enabled (default: true for production).
- **Implementation options:** HTTP endpoint, event bus, or local file sink (`.claude/state/alerts.json`)
- **Failure handling:** On runtime notification errors: call `emitFallbackAlert`, log to events.log, set task.status = "needs-review" (not "blocked"). Prevent orchestrator auto-followup routine from creating follow-ups while status == "needs-review". Split handoffContext into `errorContext` (why fallback was triggered) and `workSummary` (what was done and next-team steps). `emitFallbackAlert` populates both.
6. If no `handoffTo` is set but you identified downstream work, set
   `handoffTo` to the appropriate team(s) from your handoff chain:
   {{#if teamHandoffChain}}
   {{teamHandoffChain}}
   {{/if}}

### Events and Orchestrator State

Append to `.claude/state/events.log`:

```text
[<timestamp>] [TEAM] [{{teamId}}] Completed <N> items. Changes: <file count> files. Tests: <added count> added, <modified count> modified. Gate: <PASS|FAIL>.
```

If `.claude/state/orchestrator.json` exists, update the team entry:

```json
{
  "teams": {
    "{{teamId}}": {
      "lastRun": "<timestamp>",
      "itemsCompleted": ["<item titles>"],
      "filesChanged": ["<file paths>"],
      "testsAdded": <number>,
      "testsModified": <number>,
      "gateStatus": "<PASS|FAIL>"
    }
  }
}
```

## Rules

1. **Stay in scope.** Work on files matching `{{teamScope}}`. Log out-of-scope findings for other teams.
2. **Backwards compatible.** Do not break existing behavior unless the backlog item explicitly calls for it.
3. **Test everything.** Untested changes are incomplete changes.
4. **Small batches.** 1-3 items per session. Quality over quantity.
5. **Leave it better.** If you touch a file, it should be in better shape when you leave than when you arrived.
6. **No gold plating.** Do what the backlog item says. Do not add features or refactors that were not requested.
7. **Report honestly.** If the quality gate fails, say so. Do not hide failures.
