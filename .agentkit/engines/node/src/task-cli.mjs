/**
 * Retort — Task CLI Handlers
 * CLI entry points for the task delegation protocol.
 */
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  checkDependencies,
  createTask,
  formatTaskList,
  formatTaskSummary,
  getTask,
  listTasks,
  processHandoffs,
} from './task-protocol.mjs';
import { emitEvent } from './event-emitter.mjs';

function parseCsvFlag(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * List and inspect delegated tasks.
 * Flags: --status, --assignee, --type, --priority, --id, --process-handoffs
 */
export async function runTasks({ projectRoot, flags }) {
  if (flags.type && !TASK_TYPES.includes(flags.type)) {
    console.error(
      `[agentkit:tasks] Invalid --type "${flags.type}". Valid: ${TASK_TYPES.join(', ')}`
    );
    process.exit(1);
  }
  if (flags.priority && !TASK_PRIORITIES.includes(flags.priority)) {
    console.error(
      `[agentkit:tasks] Invalid --priority "${flags.priority}". Valid: ${TASK_PRIORITIES.join(', ')}`
    );
    process.exit(1);
  }

  // Single task detail
  if (flags.id) {
    const result = await getTask(projectRoot, flags.id);
    if (result.error) {
      console.error(`[agentkit:tasks] ${result.error}`);
      process.exit(1);
    }
    console.log(formatTaskSummary(result.task));
    const messages = Array.isArray(result.task.messages) ? result.task.messages : [];
    if (messages.length > 0) {
      console.log('\n--- Messages ---');
      for (const msg of messages) {
        console.log(`  [${msg.timestamp}] ${msg.role}/${msg.from || 'unknown'}: ${msg.content}`);
      }
    }
    const artifacts = Array.isArray(result.task.artifacts) ? result.task.artifacts : [];
    if (artifacts.length > 0) {
      console.log('\n--- Artifacts ---');
      for (const art of artifacts) {
        console.log(`  ${art.type}: ${art.summary || JSON.stringify(art)}`);
      }
    }
    return;
  }

  // Check dependencies and process handoffs before listing
  const depResult = await checkDependencies(projectRoot);
  if (depResult.errors?.length > 0) {
    for (const err of depResult.errors) {
      console.error(`[agentkit:tasks] Dependency check error: ${err}`);
    }
  }
  if ((depResult.unblocked ?? []).length > 0) {
    console.log(
      `[agentkit:tasks] Unblocked ${depResult.unblocked.length} task(s): ${(depResult.unblocked ?? []).join(', ')}`
    );
  }

  if (flags['process-handoffs']) {
    const handoffResult = await processHandoffs(projectRoot);
    if (handoffResult?.error) {
      console.error(`[agentkit:tasks] ${handoffResult.error}`);
      process.exit(1);
    }

    const createdTasks = Array.isArray(handoffResult?.created) ? handoffResult.created : [];
    const handoffErrors = Array.isArray(handoffResult?.errors) ? handoffResult.errors : [];

    if (handoffErrors.length > 0) {
      for (const err of handoffErrors) {
        console.error(`[agentkit:tasks] Handoff processing error: ${err}`);
      }
    }

    if (createdTasks.length > 0) {
      console.log(`[agentkit:tasks] Created ${createdTasks.length} handoff task(s)`);
      for (const task of createdTasks) {
        emitEvent(projectRoot, 'create_task', {
          actor: 'tasks:process-handoffs',
          taskId: task.id,
          dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
          handoffTo: Array.isArray(task.handoffTo) ? task.handoffTo : [],
        });
      }
    }

    if (handoffErrors.length > 0) {
      process.exit(1);
    }
  }

  // List with filters
  const filters = {};
  if (flags.status) filters.status = flags.status;
  if (flags.assignee) filters.assignee = flags.assignee;
  if (flags.type) filters.type = flags.type;
  if (flags.priority) filters.priority = flags.priority;

  const listResult = await listTasks(projectRoot, filters);
  if (listResult.error) {
    console.error(`[agentkit:tasks] ${listResult.error}`);
    process.exit(1);
  }
  const tasks = listResult.tasks || [];
  if (tasks.length === 0) {
    console.log('[agentkit:tasks] No tasks found.');
    return;
  }

  console.log(formatTaskList(tasks));
  console.log(`\nTotal: ${tasks.length} task(s)`);
}

/**
 * Create a delegated task.
 * Flags: --to, --title, --description, --type, --priority, --depends-on, --handoff-to, --scope
 */
export async function runDelegate({ projectRoot, flags }) {
  if (!flags.to) {
    console.error('[agentkit:delegate] --to <team> is required');
    process.exit(1);
  }

  const assignees = parseCsvFlag(flags.to);
  if (!assignees.length) {
    console.error('[agentkit:delegate] --to <team> is required');
    process.exit(1);
  }
  if (!flags.title) {
    console.error('[agentkit:delegate] --title <text> is required');
    process.exit(1);
  }
  if (flags.type && !TASK_TYPES.includes(flags.type)) {
    console.error(
      `[agentkit:delegate] Invalid --type "${flags.type}". Valid: ${TASK_TYPES.join(', ')}`
    );
    process.exit(1);
  }
  if (flags.priority && !TASK_PRIORITIES.includes(flags.priority)) {
    console.error(
      `[agentkit:delegate] Invalid --priority "${flags.priority}". Valid: ${TASK_PRIORITIES.join(', ')}`
    );
    process.exit(1);
  }

  const taskData = {
    delegator: 'cli',
    assignees: assignees,
    title: flags.title,
    description: flags.description || '',
    type: flags.type || 'implement',
    priority: flags.priority || 'P2',
    dependsOn: parseCsvFlag(flags['depends-on']),
    handoffTo: parseCsvFlag(flags['handoff-to']),
    scope: parseCsvFlag(flags.scope),
  };

  const result = await createTask(projectRoot, taskData);
  if (result.error) {
    console.error(`[agentkit:delegate] ${result.error}`);
    process.exit(1);
  }

  emitEvent(projectRoot, 'delegate', {
    actor: 'cli',
    taskId: result.task.id,
    dependsOn: Array.isArray(result.task.dependsOn) ? result.task.dependsOn : [],
    handoffTo: Array.isArray(result.task.handoffTo) ? result.task.handoffTo : [],
  });

  console.log(`[agentkit:delegate] Task created: ${result.task.id}`);
  console.log(formatTaskSummary(result.task));
}
