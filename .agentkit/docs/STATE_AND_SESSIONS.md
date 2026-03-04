# State and Sessions

Understanding how agentkit-forge persists state across sessions and orchestration phases.

## Orchestrator State File

**Location:** `.claude/state/orchestrator.json`

This is the primary state file that tracks where the orchestrator is in its workflow. It is written after each phase transition and read at the start of every session.

### Fields

| Field                  | Type         | Description                                       |
| ---------------------- | ------------ | ------------------------------------------------- |
| `schema_version`       | string       | Version of the state file schema                  |
| `repo_id`              | string       | Unique identifier for the repository              |
| `branch`               | string       | Current working branch                            |
| `session_id`           | string       | Identifier for the current orchestration session  |
| `current_phase`        | number (1-5) | Which phase the orchestrator is currently in      |
| `phase_name`           | string       | Human-readable name of the current phase          |
| `last_phase_completed` | number       | The most recent phase that finished successfully  |
| `next_action`          | string       | Description of what the orchestrator will do next |
| `team_progress`        | object       | Progress tracking for all 10 agent teams          |
| `todo_items`           | array        | Outstanding work items across all teams           |
| `recent_results`       | array        | Results from the most recently completed actions  |
| `completed`            | boolean      | Whether the full orchestration run has finished   |

### How to Read

You can inspect the current orchestrator state at any time:

```bash
node .agentkit/engines/node/src/cli.mjs orchestrate --status
```

This prints a formatted summary of the current phase, team progress, and next action.

### Phases

The orchestrator moves through five phases in order:

| Phase | Name           | Description                                                         |
| ----- | -------------- | ------------------------------------------------------------------- |
| 1     | Discovery      | Analyze the repository, identify structure, and gather requirements |
| 2     | Planning       | Break work into tasks and assign to agent teams                     |
| 3     | Implementation | Agent teams execute their assigned tasks                            |
| 4     | Validation     | Run tests, linting, and verification across all changes             |
| 5     | Ship           | Finalize changes, generate summaries, and prepare for merge         |

## Events Log

**Location:** `.claude/state/events.log`

### Format

The events log uses JSONL format (one JSON object per line). Each entry contains:

- `timestamp` -- ISO 8601 timestamp of when the event occurred
- `action` -- The event type (e.g., `phase_start`, `team_dispatch`, `task_complete`)
- Additional context-specific fields depending on the action type

Example entries:

```jsonl
{"timestamp":"2026-02-23T10:00:00.000Z","action":"phase_start","phase":1,"phase_name":"Discovery"}
{"timestamp":"2026-02-23T10:01:12.000Z","action":"team_dispatch","team":"frontend","task_id":"feat-42"}
{"timestamp":"2026-02-23T10:05:30.000Z","action":"task_complete","team":"frontend","task_id":"feat-42","status":"success"}
```

### Purpose

- **Audit trail:** Full history of every action taken during an orchestration run
- **Session recovery:** If a session is interrupted, the events log helps the orchestrator understand what has already happened
- **Debugging:** Provides a chronological view of what went wrong and when

## Session Continuity

Orchestration sessions can span multiple Claude Code sessions. Continuity is maintained through three mechanisms:

1. **Handoff documents** -- At the end of a session, the orchestrator writes a handoff document to `docs/ai_handoffs/`. This document captures current context, decisions made, and what needs to happen next. The next session reads the most recent handoff to restore context.

2. **State file persistence** -- The `orchestrator.json` file persists on disk between sessions. When the orchestrator starts, it reads this file to determine which phase to resume from and what work remains.

3. **Lock files** -- Prevent two sessions from running the orchestrator concurrently. See below.

## Lock Files

**Location:** `.claude/state/orchestrator.lock`

The lock file prevents concurrent orchestration sessions from conflicting with each other.

### Contents

| Field        | Description                                      |
| ------------ | ------------------------------------------------ |
| `pid`        | Process ID of the session holding the lock       |
| `hostname`   | Machine hostname where the session is running    |
| `started_at` | ISO 8601 timestamp of when the lock was acquired |
| `session_id` | Session identifier matching the state file       |

### Stale Lock Detection

A lock is considered stale after **30 minutes** of inactivity. Stale locks are automatically cleared when the next session starts.

### Force Clearing a Lock

If a lock is stuck and you need to override it:

```bash
node .agentkit/engines/node/src/cli.mjs orchestrate --force-unlock
```

This removes the lock file regardless of its age or owner.

## Debugging Common Issues

### State Corruption

If the orchestrator state file becomes corrupted (malformed JSON, inconsistent phase data, etc.):

1. Delete the state file:
   ```bash
   rm .claude/state/orchestrator.json
   ```
2. Re-run `/orchestrate` to start a fresh orchestration session.

The events log is not affected and can still be used for auditing what happened before the reset.

### Lock Stuck

If the lock file is not being automatically cleared and you cannot start a new session:

```bash
node .agentkit/engines/node/src/cli.mjs orchestrate --force-unlock
```

This is safe to run at any time. It only removes the lock file and does not modify state.

### Events Log Too Large

The events log grows indefinitely. If it becomes too large:

- It is **safe to truncate** the file (`> .claude/state/events.log`)
- It is **safe to archive** the file (move or compress it)
- The orchestrator will create a new events log if the file is missing

Truncating the events log does not affect orchestrator state or session continuity. It only removes the historical audit trail.
