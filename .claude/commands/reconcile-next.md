---
description: 'Reconcile the next Retort backlog item in read-only mode'
allowed-tools: Bash(git status), Bash(git diff*), Bash(git log*), Bash(git show*), Bash(gh issue list), Bash(gh issue view*), Bash(pnpm --version), Bash(node --version)
generated_by: 'retort'
last_model: 'sync-engine'
last_updated: '2026-08-15'
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
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

## Reconciliation flow

### 1) Select the next ticket

1. Run `task_check` for open Retort-facing work.
2. If a ticket ID is provided, run `get_task` for that ID and skip discovery.
3. If no candidates are found, return a no-work result and stop.
4. If `get_task` lookup fails, return a lookup-failure result and stop.
5. Pick the single highest-priority candidate and do not switch tickets until this one is closed out of this session.

### 2) Recheck session scope and project

1. Verify ticket metadata indicates Retort-only execution.
2. Verify title/context indicates no edits outside the declared scope.
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

1. Use `log_agent_message` with an explicit reconciliation summary and evidence references.
2. Confirm the log write succeeded before proceeding.
3. Include the exact phrase in the summary only if the log write was confirmed:
   - `ready for handoff to implementation later`
4. If the log write fails or ticket confirmation is absent, state that reconciliation is incomplete instead.
5. End with a crisp one-ticket conclusion.

## Exit condition for this command

- One-ticket reconciliation summary logged on the ticket.
- Explicit Retort/UI note: scope confirmed or re-framed for next action.
- No implementation done in this run.
- Ready-to-dispatch implementation note present: `ready for handoff to implementation later`.
