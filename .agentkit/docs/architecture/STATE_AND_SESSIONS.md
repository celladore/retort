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

### Example State File

A typical `orchestrator.json` looks like this:

```json
{
  "schema_version": "1.0.0",
  "repo_id": "my-project",
  "branch": "feature/rate-limiting",
  "session_id": "sess-20260223-143000",
  "current_phase": 3,
  "phase_name": "Implementation",
  "last_phase_completed": 2,
  "next_action": "Delegate rate limiting implementation to team-backend",
  "team_progress": {
    "T1-backend": {
      "status": "in_progress",
      "notes": "Task TASK-002: Add rate limit to auth endpoints",
      "last_updated": "2026-02-23T14:28:00.000Z"
    },
    "T2-frontend": { "status": "idle", "notes": "" },
    "T3-data": {
      "status": "done",
      "notes": "Task TASK-001: Create rate limit schema",
      "last_updated": "2026-02-23T14:20:00.000Z"
    },
      "T4-infra": { "status": "idle", "notes": "" },
      "T5-devops": { "status": "idle", "notes": "" },
      "T6-testing": { "status": "idle", "notes": "" },
      "T7-security": { "status": "idle", "notes": "" },
      "T8-docs": { "status": "idle", "notes": "" },
      "T9-product": { "status": "idle", "notes": "" },
      "T10-quality": { "status": "idle", "notes": "" }
  },
  "todo_items": [
    {
      "id": "TASK-002",
      "title": "Add rate limit to auth endpoints",
       "team": "T1-backend",
      "priority": "P1",
      "status": "in-progress"
    },
    {
      "id": "TASK-003",
      "title": "Write rate limit unit tests",
       "team": "T6-testing",
      "priority": "P1",
      "status": "pending"
    }
  ],
    // Note: team_progress uses full team IDs as keys (e.g., "T1-backend"), while todo_items.team uses full team IDs for consistency.
  "recent_results": [
    {
      "action": "task_complete",
      "task_id": "TASK-001",
      "team": "data",
      "status": "success",
      "files_changed": 2
    }
  ],
  "completed": false
}
```

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
{"timestamp":"2026-02-23T10:00:00.000Z","action":"phase_set","phase":1,"phase_name":"Discovery"}
{"timestamp":"2026-02-23T10:01:12.000Z","action":"discovery_complete","stacks":["typescript","react"],"build":"pnpm","tests":"vitest","issues":2}
{"timestamp":"2026-02-23T10:02:00.000Z","action":"phase_set","phase":2,"phase_name":"Planning"}
{"timestamp":"2026-02-23T10:03:30.000Z","action":"plan_created","task":"Add rate limiting","steps":4,"files_to_touch":5}
{"timestamp":"2026-02-23T10:03:31.000Z","action":"phase_set","phase":3,"phase_name":"Implementation"}
{"timestamp":"2026-02-23T10:03:45.000Z","action":"team_dispatch","team":"backend","task_id":"TASK-001","title":"Create rate limit middleware"}
{"timestamp":"2026-02-23T10:08:30.000Z","action":"task_complete","team":"backend","task_id":"TASK-001","status":"success","files_changed":3,"tests_added":4}
{"timestamp":"2026-02-23T10:08:45.000Z","action":"team_dispatch","team":"testing","task_id":"TASK-002","title":"Write integration tests for rate limiter"}
{"timestamp":"2026-02-23T10:12:00.000Z","action":"task_complete","team":"testing","task_id":"TASK-002","status":"success","files_changed":1,"tests_added":6}
{"timestamp":"2026-02-23T10:12:01.000Z","action":"healthcheck_completed","status":"pass"}
{"timestamp":"2026-02-23T10:12:30.000Z","action":"check_completed","result":"pass","format":"pass","lint":"pass","typecheck":"pass","tests":"pass","build":"pass"}
{"timestamp":"2026-02-23T10:13:00.000Z","action":"review_completed","verdict":"APPROVE","files_reviewed":4}
{"timestamp":"2026-02-23T10:13:16.000Z","action":"phase_set","phase":5,"phase_name":"Ship"}
{"timestamp":"2026-02-23T10:14:00.000Z","action":"handoff_generated","path":"docs/ai_handoffs/2026-02-23-rate-limiting.md"}
{"timestamp":"2026-02-23T10:14:01.000Z","action":"session_complete","tasks_completed":2,"files_changed":4,"tests_added":10}
```

### Event Action Types

| Action                  | Phase | Description                                     |
| ----------------------- | ----- | ----------------------------------------------- |
| `orchestrate_invoked`   | Any   | Default orchestrate run started                 |
| `phase_set`             | Any   | Orchestrator transitions to a new phase         |
| `discovery_complete`    | 1     | Codebase scan finished                          |
| `plan_created`          | 2     | Implementation plan generated                   |
| `plan_viewed`           | 2     | Plan viewed via `/plan`                         |
| `team_dispatch`         | 3     | Task assigned to a team agent                   |
| `task_complete`         | 3     | Team agent finished a task                      |
| `healthcheck_completed` | 4     | Healthcheck finished                            |
| `check_completed`       | 4     | Full quality check results                      |
| `review_completed`      | 4     | Code review verdict                             |
| `handoff_generated`     | 5     | Handoff document written to disk                |
| `session_complete`      | 5     | Orchestration run finished                      |
| `lock_force_released`   | Any   | Session lock force-cleared via `--force-unlock` |

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
