/**
 * Retort — Run CLI Handler
 * Picks up the next agent task from the queue and dispatches it.
 * Transitions the task through submitted → accepted → working and prints
 * a formatted dispatch prompt for the assigned agent.
 */
import { emitEvent } from './event-emitter.mjs';
import { formatTaskSummary, getTask, listTasks, updateTaskStatus } from './task-protocol.mjs';

/**
 * Map an assignee team name to its slash command.
 * Normalises common formats: 'BACKEND', 'team-backend', 'backend' → '/team-backend'.
 * @param {string} assignee
 * @returns {string}
 */
export function assigneeToCommand(assignee) {
  const normalised = assignee
    .toLowerCase()
    .replace(/^team[-_]?/, '')
    .replace(/[-_]/g, '-');
  return `/team-${normalised}`;
}

/**
 * Build the agent dispatch prompt for a task.
 * @param {object} task
 * @returns {string}
 */
export function buildDispatchPrompt(task) {
  const commands = (task.assignees || []).map(assigneeToCommand);
  const commandLine = commands.length > 0 ? commands.join(' or ') : '/orchestrate';

  const lines = [];
  lines.push(`## Task Dispatch: ${task.id}`);
  lines.push('');
  lines.push(`**Invoke:** ${commandLine}`);
  lines.push(`**Type:** ${task.type}  **Priority:** ${task.priority}  **Status:** ${task.status}`);

  if (task.title) {
    lines.push('');
    lines.push(`### ${task.title}`);
  }

  if (task.description) {
    lines.push('');
    lines.push(task.description);
  }

  const criteria = Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [];
  if (criteria.length > 0) {
    lines.push('');
    lines.push('**Acceptance Criteria:**');
    for (const c of criteria) {
      lines.push(`- ${c}`);
    }
  }

  const scope = Array.isArray(task.scope) ? task.scope : [];
  if (scope.length > 0) {
    lines.push('');
    lines.push(`**Scope:** ${scope.join(', ')}`);
  }

  const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  if (deps.length > 0) {
    lines.push('');
    lines.push(`**Depends on:** ${deps.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Transition a task from its current state toward 'working'.
 * Chains: submitted → accepted → working.
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} actor - Name to record as the actor in messages
 * @returns {Promise<{ task: object|null, error?: string }>}
 */
export async function advanceToWorking(projectRoot, taskId, actor = 'cli:run') {
  let result = await getTask(projectRoot, taskId);
  if (!result.task) return result;

  const { task } = result;

  if (task.status === 'submitted') {
    result = await updateTaskStatus(projectRoot, taskId, 'accepted', {
      role: 'executor',
      from: actor,
      content: 'Task accepted via retort run',
    });
    if (!result.task) return result;
  }

  if (result.task.status === 'accepted') {
    result = await updateTaskStatus(projectRoot, taskId, 'working', {
      role: 'executor',
      from: actor,
      content: 'Task dispatched via retort run',
    });
  }

  return result;
}

/**
 * Dispatch the next (or a specific) agent task.
 *
 * Flags:
 *   --id <task-id>       Run a specific task (default: highest-priority submitted task)
 *   --assignee <team>    Filter candidates to tasks assigned to this team
 *   --dry-run            Preview without transitioning state
 *   --json               Machine-readable JSON output
 */
export async function runRun({ projectRoot, flags }) {
  const dryRun = Boolean(flags['dry-run']);
  const useJson = Boolean(flags.json);

  let task;

  if (flags.id) {
    // Explicit task ID
    const result = await getTask(projectRoot, flags.id);
    if (!result.task) {
      const msg = result.error || `Task not found: ${flags.id}`;
      if (useJson) {
        process.stdout.write(JSON.stringify({ error: msg }) + '\n');
      } else {
        console.error(`[retort:run] ${msg}`);
      }
      process.exit(1);
    }
    task = result.task;
  } else {
    // Find highest-priority submitted task
    const filters = { status: 'submitted' };
    if (flags.assignee) filters.assignee = flags.assignee;

    const listResult = await listTasks(projectRoot, filters);
    if (listResult.error) {
      const msg = listResult.error;
      if (useJson) {
        process.stdout.write(JSON.stringify({ error: msg }) + '\n');
      } else {
        console.error(`[retort:run] ${msg}`);
      }
      process.exit(1);
    }

    const candidates = listResult.tasks || [];
    if (candidates.length === 0) {
      const msg = flags.assignee
        ? `No submitted tasks found for assignee "${flags.assignee}"`
        : 'No submitted tasks in queue';
      if (useJson) {
        process.stdout.write(JSON.stringify({ error: msg }) + '\n');
      } else {
        console.log(`[retort:run] ${msg}`);
      }
      return;
    }

    // listTasks returns tasks sorted by priority (P0 first)
    task = candidates[0];
  }

  // Validate that the task is dispatchable
  if (!['submitted', 'accepted'].includes(task.status)) {
    const msg = `Task ${task.id} is not dispatchable (status: ${task.status})`;
    if (useJson) {
      process.stdout.write(JSON.stringify({ error: msg }) + '\n');
    } else {
      console.error(`[retort:run] ${msg}`);
    }
    process.exit(1);
  }

  if (!dryRun) {
    const advResult = await advanceToWorking(projectRoot, task.id);
    if (!advResult.task) {
      const msg = advResult.error || `Failed to advance task ${task.id}`;
      if (useJson) {
        process.stdout.write(JSON.stringify({ error: msg }) + '\n');
      } else {
        console.error(`[retort:run] ${msg}`);
      }
      process.exit(1);
    }
    task = advResult.task;

    emitEvent(projectRoot, 'run', {
      actor: 'cli:run',
      taskId: task.id,
      assignees: Array.isArray(task.assignees) ? task.assignees : [],
    });
  }

  if (useJson) {
    process.stdout.write(
      JSON.stringify({
        taskId: task.id,
        status: task.status,
        dryRun,
        prompt: buildDispatchPrompt(task),
      }) + '\n'
    );
    return;
  }

  if (dryRun) {
    console.log(`[retort:run] DRY RUN — task ${task.id} would be dispatched`);
  } else {
    console.log(`[retort:run] Dispatched ${task.id} → working`);
  }
  console.log('');
  console.log(buildDispatchPrompt(task));
  console.log('');
  if (!dryRun) {
    console.log(formatTaskSummary(task));
  }
}
