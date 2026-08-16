---
description: 'Reconcile the next Retort backlog item in read-only mode'
allowed-tools: Bash(git status), Bash(git diff), Bash(git diff --cached), Bash(git log), Bash(git log --oneline), Bash(git show), Bash(gh issue list), Bash(gh issue view), Bash(pnpm --version), Bash(node --version)
generated_by: 'retort'
last_model: 'sync-engine'
last_updated: '2026-08-15'
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://code.claude.com/docs/en/commands
---

# /reconcile-next — Reconcile the next Retort ticket (read-only mode)

Use this command to start a session that should only reconcile one Retort ticket and produce a clean handoff state.

## Usage

```
/reconcile-next
/reconcile-next <ticket-id>
```

## Required behavior

1. Do not implement code, touch infrastructure, or modify project source.
2. Process exactly one ticket per session unless the user explicitly asks to continue.
3. Keep the work scope strictly `Retort` only.

## PreToolUse hook

Before any Bash tool use, verify the command is one of the explicitly allowed read-only
operations. Reject any command that could modify state:

- No `git add`, `git commit`, `git push`, `git checkout`, `git merge`, `git rebase`
- No `gh issue create`, `gh issue edit`, `gh issue close`, `gh pr create`, `gh pr merge`
- No `pnpm` or `node` commands that write files or start servers
- No `rm`, `mv`, `cp`, `touch`, `mkdir`, or other filesystem write operations

## Reconciliation flow

### 1) Select the next ticket

1. If a ticket ID is provided as an argument, run `get_task` directly for that ID and skip discovery. If `get_task` fails, return an explicit lookup-failure result and stop processing immediately. Do not continue with an unverified ticket or emit a handoff summary.
2. If no ticket ID is provided, run `task_check` for open Retort-facing work. If `task_check` fails or returns no candidates, return an explicit no-work result and stop processing immediately. Do not continue with an unverified ticket or emit a handoff summary.
3. Pick the single highest-priority candidate and do not switch tickets until this one is closed out of this session.

### 2) Recheck session scope and project

1. Verify the ticket is Retort-only.
2. Verify title/context indicates no edits outside Retort scope.
3. If scope is not Retort-only, immediately stop and return a drift note.

### 3) Reconciliation-only review

1. Review only reconciliation evidence and ticket fields.
2. Do not change code, configs, tests, docs, or branch state.
3. If existing fields still match evidence, write:
   - `reconciled; code scope confirmed`
   - `no field changes needed`
4. If scope is now clear but execution gaps remain, log a minimal implementation framing:
   - one explicit next task
   - exact files/slots/locations to change
   - acceptance criterion for handoff
5. If drift is newly discovered, update only:
   - ticket status needed for it to remain actionable
   - minimal field set required to represent that drift (`status`, `controlledBy` if blocked, plus owner notes)

### 4) Log and close the reconciliation cycle

1. Use `log_agent_message` to write an explicit reconciliation summary that names the selected ticket and includes evidence references.
2. Await acknowledgement that the write succeeded before proceeding.
3. Include the exact phrase in the summary only if the write was acknowledged:
   - `ready for handoff to implementation later`
4. If the write fails or acknowledgement is absent, report reconciliation as incomplete and omit the phrase.
5. End with a crisp one-ticket conclusion.

## Exit condition for this command

All outcomes share one requirement: **no implementation done in this run**.

Distinct exit criteria per outcome:

- **Successful reconciliation**: requires a verified ticket, a logged reconciliation summary, an explicit Retort/UI note (scope confirmed or re-framed for next action), and `ready for handoff to implementation later` present only if the log write was acknowledged.
- **No-work**: requires only the explicit no-work result; no summary log needed.
- **Lookup-failure**: requires only the explicit lookup-failure result; no summary log needed.
- **Drift**: requires the drift note documented per section 2, step 3; may log a minimal field update per section 3, step 5, but does not require the full reconciliation summary.
