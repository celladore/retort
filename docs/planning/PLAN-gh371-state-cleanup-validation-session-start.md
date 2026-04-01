# Implementation Plan: GH#371 — State cleanup, validation, and session-start directory creation

**Goal:** Agent state is reliable: required state directories exist before any command runs, orchestrator state is validated on load, and stale task files can be cleaned so agents never fail or misbehave due to missing or corrupt state.

<<<<<<< HEAD
**Scope:** P1 product backlog item [GH#371](https://github.com/JustAGhosT/retort/issues/371).
=======
**Scope:** P1 product backlog item [GH#371](https://github.com/JustAGhosT/agentkit-forge/issues/371).

> > > > > > > origin/main

> > > > > > > origin/main

> > > > > > > origin/main

---

## 1. Goal (one sentence)

When a user starts a session or runs the orchestrator, the state directory (and required subdirs) exist, orchestrator state is validated and reset if corrupt, and optional cleanup of stale task files is available so that no command fails or misbehaves due to missing or invalid state.

---

## 2. Assumptions

- The engine uses `.agentkit/state` at runtime (orchestrator.mjs); templates and docs refer to `.claude/state`. Migration from `.claude/state` to `.agentkit/state` already exists. Session-start and “ensure dirs” should create the directory that the active tooling expects (per-platform: Claude → `.claude/state`, engine → `.agentkit/state`). Plan assumes we ensure **both** `.claude/state` and `.claude/state/tasks` in session-start for compatibility, and that the engine continues to ensure `.agentkit/state` (and migration) on first load.
- Hooks run in project root; they can safely run `mkdir -p` (or PowerShell equivalent) for state dirs.
- “Stale” tasks are defined as: `status` in `['working','accepted']` and `updatedAt` (or file mtime) older than a configurable threshold (e.g. 24 hours). Cleanup is optional and non-destructive (e.g. set status to `input-required` with a note, or move to an `archive/` subdir); no deletion of task files without explicit opt-in.
- Schema validation for `orchestrator.json` means: required top-level keys present, `current_phase` in 1–5, `team_progress` object; invalid or missing fields trigger reset to default state (current behavior is already “create default if missing/corrupt”; extend to validate and reset on schema mismatch).

---

## 3. Steps (numbered, atomic, ordered, testable)

1. **Add state-directory creation to session-start (Unix)**  
   In `.agentkit/templates/claude/hooks/session-start.sh`, after parsing the JSON payload and before tool detection, add a block that creates the state directory and the tasks subdirectory if they do not exist. Use `CWD` (or `$PWD`) as the project root. Create `.claude/state` and `.claude/state/tasks` with `mkdir -p`. Use a single line (e.g. `mkdir -p "${CWD}/.claude/state/tasks"`) so both dirs exist. **Reason:** SPEC-PROC-005 and GH#371 require state dirs to exist at session start so that any command (orchestrate, plan, team-\*) can write state without ENOENT.

2. **Add state-directory creation to session-start (Windows)**  
   In `.agentkit/templates/claude/hooks/session-start.ps1`, add the equivalent logic: resolve project root from the JSON payload (or `$PWD`), then ensure `.claude\state` and `.claude\state\tasks` exist using `New-Item -ItemType Directory -Force`. **Reason:** Parity with Unix so Windows users and Cursor/VS Code on Windows do not hit missing-state-dir errors.

3. **Ensure engine creates `tasks` subdir when saving state**  
   In `.agentkit/engines/node/src/orchestrator.mjs`, in `saveState` (or immediately after `migrateStateDirIfNeeded` in `loadState`), ensure the `tasks` subdirectory exists under the state directory (e.g. `mkdirSync(resolve(stateDir(projectRoot), 'tasks'), { recursive: true })`). **Reason:** Task protocol writes under `state/tasks/`; if only the state dir was created by migration or first run, task files can still fail; ensuring `tasks` exists once per load/save avoids that.

4. **Add optional schema validation when loading orchestrator state**  
   In `.agentkit/engines/node/src/orchestrator.mjs`, in `loadState`, after reading the JSON file, validate that the object has required keys (`schema_version`, `current_phase`, `team_progress`, etc.) and that `current_phase` is an integer 1–5. If validation fails, log a warning and replace with `createDefaultState(projectRoot)` then `saveState(projectRoot, state)`. **Reason:** Corrupt or hand-edited state can break the orchestrator; failing fast and resetting is safer than undefined behavior.

5. **Document and implement optional stale-task cleanup**  
   Define “stale” in the task protocol (e.g. in `.agentkit/spec/teams.yaml` or in a short doc under `docs/orchestration/`): task in `working` or `accepted` and last updated (from task file `messages` or file mtime) older than a threshold (e.g. 24h). Add a small function in the engine (e.g. in `task-protocol.mjs` or `orchestrator.mjs`) that lists task files, reads each, and if stale: either (a) update the task file to set `status` to `input-required` and append a message “Stale: no progress within threshold; requesting human guidance”, or (b) move the file to `state/tasks/archive/` with a timestamped name. Expose this via an orchestrator flag (e.g. `--clean-stale-tasks`) or a separate CLI command, and document it in the orchestrate command and COMMAND_GUIDE. **Reason:** Long-lived `working` tasks with no progress block handoffs and confuse dashboards; optional cleanup keeps the task list meaningful.

6. **Add tests for state-dir creation and validation**  
   In the engine test suite, add tests: (1) session-start hook (or a minimal script that invokes the same mkdir logic) leaves `.claude/state` and `.claude/state/tasks` present when run in a temp project root; (2) `loadState` with a corrupt `orchestrator.json` (e.g. missing `current_phase` or invalid value) results in default state being written and returned; (3) after `saveState`, the `tasks` subdir exists. **Reason:** Regression safety and documentation of expected behavior.

7. **Update docs and run sync**  
   In `docs/orchestration/` or `docs/architecture/specs/`, add a short subsection (or update SPEC-PROC-005) stating that session-start ensures `.claude/state` and `.claude/state/tasks` exist, and that the engine ensures `.agentkit/state` (and migration) and validates/resets corrupt orchestrator state. If a new flag or command was added for stale-task cleanup, document it in the orchestrate command template and in COMMAND_GUIDE. Run `pnpm --dir .agentkit agentkit:sync` and commit generated changes if any. **Reason:** Single source of truth and consistent behavior across adopters.

---

## 4. File touch list

| File                                                                                        | Action            | Description                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agentkit/templates/claude/hooks/session-start.sh`                                         | MODIFY            | Add `mkdir -p` for `.claude/state` and `.claude/state/tasks` after parsing payload.                                                                                                                   |
| `.agentkit/templates/claude/hooks/session-start.ps1`                                        | MODIFY            | Add `New-Item -ItemType Directory -Force` for `.claude\state` and `.claude\state\tasks`.                                                                                                              |
| `.agentkit/engines/node/src/orchestrator.mjs`                                               | MODIFY            | Ensure `tasks` subdir in state dir (in loadState or saveState); add schema validation in loadState with reset on failure.                                                                             |
| `.agentkit/engines/node/src/task-protocol.mjs` (or orchestrator.mjs)                        | MODIFY            | Add function to list tasks, detect stale (working/accepted + old), and either update status to input-required or move to archive; call from orchestrator when a flag is set or from a small CLI path. |
| `.agentkit/spec/commands.yaml` (or equivalent)                                              | MODIFY            | If exposing stale cleanup via a new flag on orchestrate, add the flag and description.                                                                                                                |
| `.agentkit/engines/node/src/__tests__/orchestrator.test.mjs`                                | MODIFY            | Add test: loadState with corrupt JSON returns and persists default state.                                                                                                                             |
| `.agentkit/engines/node/src/__tests__/orchestrator.test.mjs` or new hook test               | MODIFY            | Add test: after saveState, `stateDir/tasks` exists.                                                                                                                                                   |
| `docs/architecture/specs/SPEC-PROC-005-code-over-context-audit.md` or `docs/orchestration/` | MODIFY            | State that session-start creates `.claude/state` and `.claude/state/tasks`; engine ensures state dir and validates/resets corrupt state; document stale-task cleanup if added.                        |
| `.agentkit/templates/claude/commands/orchestrate.md` (if flag added)                        | GENERATED by sync | Will reflect new flag after sync.                                                                                                                                                                     |
| `.agentkit/templates/root/COMMAND_GUIDE.md` (if flag added)                                 | GENERATED by sync | Will reflect new flag after sync.                                                                                                                                                                     |

---

## 5. Validation plan

Commands to run from repo root; copy-paste ready.

```bash
# 1. Ensure no regressions in orchestrator
pnpm --dir .agentkit exec node --test engines/node/src/__tests__/orchestrator.test.mjs

# 2. Run full agentkit validate (hooks and structure)
pnpm --dir .agentkit agentkit:validate

# 3. Session-start: in a temp dir with no .claude/state, run session-start and assert dirs exist
export TMP_PROJECT=$(mktemp -d)
cp -r .claude/hooks/session-start.sh "$TMP_PROJECT/.claude/hooks/" 2>/dev/null || true
mkdir -p "$TMP_PROJECT/.claude/hooks"
# Simulate hook invocation (echo minimal JSON, then run hook)
echo '{"session_id":"test","cwd":"'$TMP_PROJECT'"}' | bash "$TMP_PROJECT/.claude/hooks/session-start.sh" >/dev/null 2>&1 || true
test -d "$TMP_PROJECT/.claude/state" && test -d "$TMP_PROJECT/.claude/state/tasks" && echo "PASS: state dirs exist" || echo "FAIL: state dirs missing"
rm -rf "$TMP_PROJECT"

# 4. Orchestrator: corrupt state file then load — should get default state
# (Manual or add to orchestrator.test.mjs: write invalid JSON to state path, loadState, assert current_phase === 1 and file overwritten)
pnpm --dir .agentkit exec node --test engines/node/src/__tests__/orchestrator.test.mjs
```

---

## 6. Rollback plan

- **Session-start changes:** Revert the added `mkdir` / `New-Item` block in both hook templates; run `pnpm --dir .agentkit agentkit:sync` to regenerate adopters’ hooks. No data migration.
- **Engine changes:** Revert orchestrator.mjs and task-protocol.mjs changes; redeploy. If adopters already had `tasks` created, leaving the dir in place is harmless.
- **Stale cleanup:** If implemented as a flag-only or separate command, disable or remove the flag/command; no automatic migration to roll back.
- **Tests:** Revert new test cases if the feature is reverted.

---

## 7. Risks

- **Dual state paths:** Repo uses `.claude/state`; engine uses `.agentkit/state` with migration. Ensuring only `.claude/state` in session-start might leave `.agentkit/state` missing until the first engine run. Mitigation: document that the first orchestrator run performs migration and creates `.agentkit/state`; session-start only guarantees `.claude/state` so that any tool (including those that read `.claude/state`) does not fail. Alternatively, ensure both in session-start if the hook can know the tool (complex).
- **Stale cleanup policy:** Marking tasks as `input-required` or moving to archive can surprise users who left tasks in `working` intentionally. Mitigation: make cleanup opt-in (flag or separate command), document threshold and behavior, and prefer “status update + message” over moving files so history remains visible.
- **Schema validation strictness:** Resetting on any schema mismatch might wipe intentional additions (e.g. extra keys). Mitigation: validate only required keys and critical fields (`current_phase` range); allow extra keys so adopters can extend state.
