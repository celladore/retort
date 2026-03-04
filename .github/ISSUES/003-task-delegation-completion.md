# feat(tasks): Complete task delegation lifecycle

**Priority:** P1 — High
**Labels:** `enhancement`, `cli`, `orchestration`
**Blocked by:** None

---

## Problem

`task-cli.mjs` and `task-protocol.mjs` implement create + list + single-task-detail + handoff processing, but the CLAUDE.md templates promise a richer protocol that isn't fully realized:

**What exists:**
- `agentkit delegate --to <team> --title <text>` — creates a task file
- `agentkit tasks` — lists tasks with filters (--status, --assignee, --type, --priority)
- `agentkit tasks --id <id>` — shows task detail with messages/artifacts
- `agentkit tasks --process-handoffs` — processes completed tasks' handoff chains
- `checkDependencies()` — unblocks tasks whose dependencies are met

**What's missing:**
- No `agentkit tasks --update <id> --status working` (state transitions)
- No task conflict detection (two agents claiming same task)
- No task timeout/staleness detection
- No task dependency visualization
- No task completion verification (did the assignee actually do it?)
- No audit trail beyond events.log

---

## Implementation Plan

### Step 1: Add `--update` flag to task-cli.mjs (~2 hours)

In `task-cli.mjs`, add handling for `--update` + `--status`:

```javascript
// In runTasks(), after the --id single-task block:
if (flags.update) {
  const result = await updateTaskStatus(projectRoot, flags.update, {
    status: flags.status,   // submitted | working | blocked | completed | delivered
    message: flags.message, // optional status message
  });
  // Validate transitions: submitted→working, working→completed, completed→delivered
  // Reject: completed→submitted (no backwards), working→submitted (no revert)
  // Log state transition to events.log
}
```

Add to `task-protocol.mjs`:

```javascript
export async function updateTaskStatus(projectRoot, taskId, { status, message }) {
  // 1. Load task file from .claude/state/tasks/<id>.yaml
  // 2. Validate state transition is legal
  // 3. Update status field
  // 4. Append to messages array: { timestamp, role: 'system', content: `Status → ${status}` }
  // 5. If status === 'completed' and task.handoffTo exists:
  //    - Auto-trigger handoff processing for this task
  // 6. Write updated task file
  // 7. Return { task, previousStatus }
}

const VALID_TRANSITIONS = {
  submitted: ['working', 'blocked'],
  working: ['completed', 'blocked'],
  blocked: ['working', 'submitted'],
  completed: ['delivered'],
  delivered: [], // terminal
};
```

### Step 2: Add conflict detection (~1 hour)

In `task-protocol.mjs`, add:

```javascript
export async function detectConflicts(projectRoot) {
  // 1. List all tasks with status 'working'
  // 2. Group by scope (file patterns)
  // 3. If two tasks have overlapping scopes and both are 'working':
  //    - Return conflict warning with task IDs and overlapping paths
  // 4. Return { conflicts: [...] }
}
```

Wire into `runTasks()` — show conflicts at the top of task list output.

### Step 3: Add staleness detection (~1 hour)

```javascript
export async function detectStaleTasks(projectRoot, thresholdHours = 24) {
  // 1. List all tasks with status 'working'
  // 2. Check last message timestamp or updatedAt
  // 3. If older than threshold: flag as stale
  // 4. Return { stale: [...] }
}
```

Add `--stale` flag to `agentkit tasks` to show stale tasks.

### Step 4: Add task dependency graph (~1 hour)

```javascript
// Add --graph flag to agentkit tasks
if (flags.graph) {
  // 1. Load all tasks
  // 2. Build adjacency list from dependsOn + handoffTo
  // 3. Output ASCII dependency graph:
  //    TASK-001 (working) → TASK-002 (submitted) → TASK-003 (submitted)
  //                       ↘ TASK-004 (blocked)
  // 4. Highlight: blocked tasks in red, completed in green
}
```

### Step 5: Wire flags into CLI (~15 min)

In `cli.mjs` `VALID_FLAGS`:

```javascript
tasks: ['status', 'assignee', 'type', 'priority', 'id', 'process-handoffs',
        'update', 'message', 'stale', 'graph', 'help'],
```

### Step 6: Tests (~2 hours)

- Test valid state transitions
- Test invalid transitions are rejected
- Test conflict detection with overlapping scopes
- Test staleness threshold
- Test handoff auto-processing on completion

---

## Acceptance Criteria

- [ ] `agentkit tasks --update <id> --status working` transitions task state
- [ ] Invalid transitions are rejected with clear error
- [ ] Completing a task auto-processes its handoff chain
- [ ] `agentkit tasks` shows conflict warnings for overlapping working tasks
- [ ] `agentkit tasks --stale` shows tasks inactive for >24h
- [ ] `agentkit tasks --graph` shows dependency graph
- [ ] All state changes logged to events.log
- [ ] Tests cover transition matrix

---

## Related

- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
