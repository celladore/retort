/**
 * Tests for task-protocol.mjs — A2A-lite task delegation protocol.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addTaskArtifact,
  addTaskMessage,
  checkDependencies,
  createTask,
  formatTaskList,
  formatTaskSummary,
  generateTaskId,
  getTask,
  listTasks,
  processHandoffs,
  updateTaskStatus,
} from '../task-protocol.mjs';

let tmpRoot;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'agentkit-task-test-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Task ID generation
// ---------------------------------------------------------------------------

describe('generateTaskId', () => {
  it('generates sequential IDs for the same day', async () => {
    const id1 = await generateTaskId(tmpRoot);
    expect(id1).toMatch(/^task-\d{8}-001-[a-z0-9]{6}$/);

    await createTask(tmpRoot, {
      title: 'First',
      delegator: 'test',
      assignees: ['team-backend'],
    });
    const id2 = await generateTaskId(tmpRoot);
    expect(id2).toMatch(/^task-\d{8}-002-[a-z0-9]{6}$/);
  });
});

// ---------------------------------------------------------------------------
// CRUD — createTask
// ---------------------------------------------------------------------------

describe('createTask', () => {
  it('creates a task with valid data', async () => {
    const result = await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['team-backend'],
      title: 'Add pagination',
      description: 'Implement cursor-based pagination',
      priority: 'P1',
      acceptanceCriteria: ['supports cursor param', 'returns nextCursor'],
      scope: ['src/api/**'],
    });

    expect(result.error).toBeUndefined();
    expect(result.task).toBeDefined();
    expect(result.task.id).toMatch(/^task-\d{8}-\d{3}-[a-z0-9]{6}$/);
    expect(result.task.status).toBe('submitted');
    expect(result.task.type).toBe('implement');
    expect(result.task.priority).toBe('P1');
    expect(result.task.delegator).toBe('orchestrator');
    expect(result.task.assignees).toEqual(['team-backend']);
    expect(result.task.messages).toHaveLength(1);
    expect(result.task.messages[0].role).toBe('delegator');
  });

  it('returns error for missing title', async () => {
    const result = await createTask(tmpRoot, {
      delegator: 'test',
      assignees: ['team-backend'],
    });
    expect(result.error).toContain('title is required');
    expect(result.task).toBeNull();
  });

  it('returns error for missing delegator', async () => {
    const result = await createTask(tmpRoot, {
      title: 'Test',
      assignees: ['team-backend'],
    });
    expect(result.error).toContain('delegator is required');
    expect(result.task).toBeNull();
  });

  it('returns error for empty assignees', async () => {
    const result = await createTask(tmpRoot, {
      title: 'Test',
      delegator: 'test',
      assignees: [],
    });
    expect(result.error).toContain('At least one assignee');
    expect(result.task).toBeNull();
  });

  it('returns error for invalid task type', async () => {
    const result = await createTask(tmpRoot, {
      title: 'Test',
      delegator: 'test',
      assignees: ['x'],
      type: 'invalid',
    });
    expect(result.error).toContain('Invalid task type');
    expect(result.task).toBeNull();
  });

  it('returns error for invalid priority', async () => {
    const result = await createTask(tmpRoot, {
      title: 'Test',
      delegator: 'test',
      assignees: ['x'],
      priority: 'P9',
    });
    expect(result.error).toContain('Invalid priority');
    expect(result.task).toBeNull();
  });

  it('defaults type to implement and priority to P2', async () => {
    const result = await createTask(tmpRoot, {
      title: 'Test',
      delegator: 'test',
      assignees: ['x'],
    });
    expect(result.task.type).toBe('implement');
    expect(result.task.priority).toBe('P2');
  });

  it('returns error for non-existent dependency', async () => {
    const result = await createTask(tmpRoot, {
      title: 'Test',
      delegator: 'test',
      assignees: ['x'],
      dependsOn: ['task-99999999-999'],
    });
    expect(result.error).toContain('Dependency task not found');
    expect(result.task).toBeNull();
  });

  it('returns error for invalid dependency task ID', async () => {
    const result = await createTask(tmpRoot, {
      title: 'Test',
      delegator: 'test',
      assignees: ['x'],
      dependsOn: ['../escape'],
    });
    expect(result.error).toContain('Invalid dependency task ID');
    expect(result.task).toBeNull();
  });

  it('sets blockedBy when dependency is not yet complete', async () => {
    const dep = await createTask(tmpRoot, {
      title: 'Dep',
      delegator: 'test',
      assignees: ['x'],
    });
    const result = await createTask(tmpRoot, {
      title: 'Blocked',
      delegator: 'test',
      assignees: ['y'],
      dependsOn: [dep.task.id],
    });
    expect(result.task.blockedBy).toContain(dep.task.id);
  });
});

// ---------------------------------------------------------------------------
// CRUD — getTask
// ---------------------------------------------------------------------------

describe('getTask', () => {
  it('retrieves an existing task', async () => {
    const created = await createTask(tmpRoot, {
      title: 'Test',
      delegator: 'test',
      assignees: ['x'],
    });
    const result = await getTask(tmpRoot, created.task.id);
    expect(result.task).toBeDefined();
    expect(result.task.title).toBe('Test');
  });

  it('returns error for non-existent task', async () => {
    const result = await getTask(tmpRoot, 'task-00000000-999');
    expect(result.error).toContain('not found');
    expect(result.task).toBeNull();
  });

  it('returns error for invalid task ID path traversal attempt', async () => {
    const result = await getTask(tmpRoot, '../evil');
    expect(result.error).toContain('Invalid task ID');
    expect(result.task).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CRUD — listTasks
// ---------------------------------------------------------------------------

describe('listTasks', () => {
  it('returns empty list when no tasks exist', async () => {
    const result = await listTasks(tmpRoot);
    expect(result.tasks).toEqual([]);
  });

  it('lists all tasks', async () => {
    await createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['x'] });
    await createTask(tmpRoot, { title: 'B', delegator: 'test', assignees: ['y'] });
    const result = await listTasks(tmpRoot);
    expect(result.tasks).toHaveLength(2);
  });

  it('filters by status', async () => {
    await createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['x'] });
    const result1 = await listTasks(tmpRoot, { status: 'submitted' });
    expect(result1.tasks).toHaveLength(1);
    const result2 = await listTasks(tmpRoot, { status: 'completed' });
    expect(result2.tasks).toHaveLength(0);
  });

  it('filters by assignee', async () => {
    await createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['team-backend'] });
    await createTask(tmpRoot, { title: 'B', delegator: 'test', assignees: ['team-frontend'] });
    const result = await listTasks(tmpRoot, { assignee: 'team-backend' });
    expect(result.tasks).toHaveLength(1);
  });

  it('sorts by priority then date', async () => {
    await createTask(tmpRoot, { title: 'Low', delegator: 'test', assignees: ['x'], priority: 'P3' });
    await createTask(tmpRoot, { title: 'High', delegator: 'test', assignees: ['x'], priority: 'P0' });
    const { tasks } = await listTasks(tmpRoot);
    expect(tasks[0].title).toBe('High');
    expect(tasks[1].title).toBe('Low');
  });
});

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

describe('updateTaskStatus', () => {
  it('transitions submitted → accepted', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = await updateTaskStatus(tmpRoot, created.task.id, 'accepted', {
      from: 'team-backend',
      content: 'Accepted.',
    });
    expect(result.task.status).toBe('accepted');
    expect(result.task.messages).toHaveLength(2);
  });

  it('transitions accepted → working', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    await updateTaskStatus(tmpRoot, created.task.id, 'accepted', { from: 'x' });
    const result = await updateTaskStatus(tmpRoot, created.task.id, 'working', { from: 'x' });
    expect(result.task.status).toBe('working');
  });

  it('transitions working → completed', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    await updateTaskStatus(tmpRoot, created.task.id, 'accepted', { from: 'x' });
    await updateTaskStatus(tmpRoot, created.task.id, 'working', { from: 'x' });
    const result = await updateTaskStatus(tmpRoot, created.task.id, 'completed', { from: 'x' });
    expect(result.task.status).toBe('completed');
  });

  it('rejects invalid transition submitted → completed', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = await updateTaskStatus(tmpRoot, created.task.id, 'completed', { from: 'x' });
    expect(result.error).toContain('Invalid transition');
  });

  it('rejects transition from terminal state', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    await updateTaskStatus(tmpRoot, created.task.id, 'rejected', { from: 'x' });
    const result = await updateTaskStatus(tmpRoot, created.task.id, 'accepted', { from: 'x' });
    expect(result.error).toContain('none (terminal state)');
  });

  it('supports submitted → rejected', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = await updateTaskStatus(tmpRoot, created.task.id, 'rejected', {
      from: 'team-backend',
      content: 'Not in my scope.',
    });
    expect(result.task.status).toBe('rejected');
  });

  it('supports submitted → canceled', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = await updateTaskStatus(tmpRoot, created.task.id, 'canceled', {
      from: 'orchestrator',
      content: 'Descoped by orchestrator.',
    });
    expect(result.task.status).toBe('canceled');
  });

  it('supports accepted → canceled', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    await updateTaskStatus(tmpRoot, created.task.id, 'accepted', { from: 'x' });
    const result = await updateTaskStatus(tmpRoot, created.task.id, 'canceled', {
      from: 'orchestrator',
      content: 'Canceled before execution.',
    });
    expect(result.task.status).toBe('canceled');
  });

  it('supports working → input-required → working', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    await updateTaskStatus(tmpRoot, created.task.id, 'accepted', { from: 'x' });
    await updateTaskStatus(tmpRoot, created.task.id, 'working', { from: 'x' });
    await updateTaskStatus(tmpRoot, created.task.id, 'input-required', { from: 'x' });
    const result = await updateTaskStatus(tmpRoot, created.task.id, 'working', { from: 'x' });
    expect(result.task.status).toBe('working');
  });
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

describe('addTaskMessage', () => {
  it('adds a message to a task', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = await addTaskMessage(tmpRoot, created.task.id, {
      role: 'executor',
      from: 'team-backend',
      content: 'Working on it.',
    });
    expect(result.task.messages).toHaveLength(2);
    expect(result.task.messages[1].content).toBe('Working on it.');
  });

  it('rejects message on terminal task', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    await updateTaskStatus(tmpRoot, created.task.id, 'rejected', { from: 'x' });
    const result = await addTaskMessage(tmpRoot, created.task.id, {
      role: 'delegator',
      from: 'test',
      content: 'Please reconsider.',
    });
    expect(result.error).toContain('terminal state');
  });

  it('rejects invalid message role', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = await addTaskMessage(tmpRoot, created.task.id, {
      role: 'observer',
      from: 'test',
      content: 'Hi.',
    });
    expect(result.error).toContain('Invalid message role');
  });
});

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

describe('addTaskArtifact', () => {
  it('adds a files-changed artifact', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = await addTaskArtifact(tmpRoot, created.task.id, {
      type: 'files-changed',
      paths: ['src/api/users.ts'],
      summary: 'Added pagination',
    });
    expect(result.task.artifacts).toHaveLength(1);
    expect(result.task.artifacts[0].type).toBe('files-changed');
    expect(result.task.artifacts[0].addedAt).toBeDefined();
  });

  it('adds a test-results artifact', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = await addTaskArtifact(tmpRoot, created.task.id, {
      type: 'test-results',
      passed: 10,
      failed: 0,
      added: 3,
    });
    expect(result.task.artifacts[0].passed).toBe(10);
  });

  it('rejects invalid artifact type', async () => {
    const created = await createTask(tmpRoot, { title: 'T', delegator: 'test', assignees: ['x'] });
    const result = await addTaskArtifact(tmpRoot, created.task.id, { type: 'banana' });
    expect(result.error).toContain('Invalid artifact type');
  });
});

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

describe('checkDependencies', () => {
  it('unblocks task when dependency completes', async () => {
    const dep = await createTask(tmpRoot, { title: 'Dep', delegator: 'test', assignees: ['a'] });
    const blocked = await createTask(tmpRoot, {
      title: 'Blocked',
      delegator: 'test',
      assignees: ['b'],
      dependsOn: [dep.task.id],
    });
    expect(blocked.task.blockedBy).toContain(dep.task.id);

    await updateTaskStatus(tmpRoot, dep.task.id, 'accepted', { from: 'a' });
    await updateTaskStatus(tmpRoot, dep.task.id, 'working', { from: 'a' });
    await updateTaskStatus(tmpRoot, dep.task.id, 'completed', { from: 'a' });

    const { unblocked } = await checkDependencies(tmpRoot);
    expect(unblocked).toContain(blocked.task.id);

    // Verify blockedBy is now empty
    const updated = await getTask(tmpRoot, blocked.task.id);
    expect(updated.task.blockedBy).toEqual([]);
  });

  it('keeps task blocked when dependency is still in progress', async () => {
    const dep = await createTask(tmpRoot, { title: 'Dep', delegator: 'test', assignees: ['a'] });
    await createTask(tmpRoot, {
      title: 'Blocked',
      delegator: 'test',
      assignees: ['b'],
      dependsOn: [dep.task.id],
    });

    const { unblocked } = await checkDependencies(tmpRoot);
    expect(unblocked).toEqual([]);
  });

  it('surfaces dependency cycle errors and skips propagation', async () => {
    const taskA = await createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['a'] });
    const taskB = await createTask(tmpRoot, {
      title: 'B',
      delegator: 'test',
      assignees: ['b'],
      dependsOn: [taskA.task.id],
    });

    const taskAPath = resolve(tmpRoot, '.claude', 'state', 'tasks', `${taskA.task.id}.json`);
    const taskAData = JSON.parse(readFileSync(taskAPath, 'utf-8'));
    taskAData.dependsOn = [taskB.task.id];
    writeFileSync(taskAPath, JSON.stringify(taskAData, null, 2) + '\n', 'utf-8');

    const result = await checkDependencies(tmpRoot);
    expect(result.errors.some((e) => e.includes('Dependency cycle detected'))).toBe(true);
    expect(result.unblocked).toEqual([]);
  });

  it('detects self-loop cycle', async () => {
    const taskA = await createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['a'] });
    const taskAPath = resolve(tmpRoot, '.claude', 'state', 'tasks', `${taskA.task.id}.json`);
    const taskAData = JSON.parse(readFileSync(taskAPath, 'utf-8'));
    taskAData.dependsOn = [taskA.task.id];
    writeFileSync(taskAPath, JSON.stringify(taskAData, null, 2) + '\n', 'utf-8');

    const result = await checkDependencies(tmpRoot);
    expect(result.errors.some((e) => e.includes('Dependency cycle detected'))).toBe(true);
    expect(result.unblocked).toEqual([]);
  });

  it('detects multiple disjoint cycles', async () => {
    const taskA = await createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['a'] });
    const taskB = await createTask(tmpRoot, {
      title: 'B',
      delegator: 'test',
      assignees: ['b'],
      dependsOn: [taskA.task.id],
    });
    const taskC = await createTask(tmpRoot, { title: 'C', delegator: 'test', assignees: ['c'] });
    const taskD = await createTask(tmpRoot, {
      title: 'D',
      delegator: 'test',
      assignees: ['d'],
      dependsOn: [taskC.task.id],
    });

    const taskAPath = resolve(tmpRoot, '.claude', 'state', 'tasks', `${taskA.task.id}.json`);
    const taskCPath = resolve(tmpRoot, '.claude', 'state', 'tasks', `${taskC.task.id}.json`);
    const taskAData = JSON.parse(readFileSync(taskAPath, 'utf-8'));
    const taskCData = JSON.parse(readFileSync(taskCPath, 'utf-8'));
    taskAData.dependsOn = [taskB.task.id];
    taskCData.dependsOn = [taskD.task.id];
    writeFileSync(taskAPath, JSON.stringify(taskAData, null, 2) + '\n', 'utf-8');
    writeFileSync(taskCPath, JSON.stringify(taskCData, null, 2) + '\n', 'utf-8');

    const result = await checkDependencies(tmpRoot);
    expect(result.errors.filter((e) => e.includes('Dependency cycle detected'))).toHaveLength(2);
    expect(result.unblocked).toEqual([]);
  });

  it('sets BLOCKED_ON_CANCELED and keeps canceled deps in blockedBy', async () => {
    const dep = await createTask(tmpRoot, { title: 'Dep', delegator: 'test', assignees: ['a'] });
    const blocked = await createTask(tmpRoot, {
      title: 'Blocked',
      delegator: 'test',
      assignees: ['b'],
      dependsOn: [dep.task.id],
    });

    await updateTaskStatus(tmpRoot, dep.task.id, 'canceled', {
      from: 'orchestrator',
      content: 'Canceled.',
    });

    const { unblocked } = await checkDependencies(tmpRoot);
    expect(unblocked).toEqual([]);

    const updated = await getTask(tmpRoot, blocked.task.id);
    expect(updated.task.blockedBy).toContain(dep.task.id);
    expect(updated.task.status).toBe('BLOCKED_ON_CANCELED');
    expect(updated.task.blockedReason).toBe('canceled');
  });
});

// ---------------------------------------------------------------------------
// Handoff processing
// ---------------------------------------------------------------------------

describe('processHandoffs', () => {
  it('creates follow-up tasks for completed tasks with handoffTo', async () => {
    const task = await createTask(tmpRoot, {
      title: 'Schema migration',
      delegator: 'orchestrator',
      assignees: ['data'],
      handoffTo: ['backend'],
      handoffContext: 'Migration applied. Update API to use new cursor field.',
    });

    await updateTaskStatus(tmpRoot, task.task.id, 'accepted', { from: 'data' });
    await updateTaskStatus(tmpRoot, task.task.id, 'working', { from: 'data' });
    await updateTaskStatus(tmpRoot, task.task.id, 'completed', { from: 'data' });

    const { created, errors } = await processHandoffs(tmpRoot);
    expect(errors).toEqual([]);
    expect(created).toHaveLength(1);
    expect(created[0].title).toContain('[Handoff]');
    expect(created[0].assignees).toEqual(['backend']);
    expect(created[0].description).toContain('cursor field');
    expect(created[0].context.handoffFrom).toBe(task.task.id);
  });

  it('does not re-process already processed handoffs', async () => {
    const task = await createTask(tmpRoot, {
      title: 'Test',
      delegator: 'orchestrator',
      assignees: ['a'],
      handoffTo: ['b'],
    });
    await updateTaskStatus(tmpRoot, task.task.id, 'accepted', { from: 'a' });
    await updateTaskStatus(tmpRoot, task.task.id, 'working', { from: 'a' });
    await updateTaskStatus(tmpRoot, task.task.id, 'completed', { from: 'a' });

    await processHandoffs(tmpRoot);
    const { created } = await processHandoffs(tmpRoot);
    expect(created).toHaveLength(0);
  });

  it('creates tasks for multiple handoff targets', async () => {
    const task = await createTask(tmpRoot, {
      title: 'Shared lib update',
      delegator: 'orchestrator',
      assignees: ['platform'],
      handoffTo: ['backend', 'frontend'],
      handoffContext: 'Shared types updated.',
    });
    await updateTaskStatus(tmpRoot, task.task.id, 'accepted', { from: 'platform' });
    await updateTaskStatus(tmpRoot, task.task.id, 'working', { from: 'platform' });
    await updateTaskStatus(tmpRoot, task.task.id, 'completed', { from: 'platform' });

    const { created } = await processHandoffs(tmpRoot);
    expect(created).toHaveLength(2);
    expect(created.map((t) => t.assignees[0]).sort()).toEqual(['backend', 'frontend']);
  });

  it('skips tasks with no handoffTo', async () => {
    const task = await createTask(tmpRoot, {
      title: 'Solo',
      delegator: 'test',
      assignees: ['x'],
    });
    await updateTaskStatus(tmpRoot, task.task.id, 'accepted', { from: 'x' });
    await updateTaskStatus(tmpRoot, task.task.id, 'working', { from: 'x' });
    await updateTaskStatus(tmpRoot, task.task.id, 'completed', { from: 'x' });

    const { created } = await processHandoffs(tmpRoot);
    expect(created).toHaveLength(0);
  });

  it('does not mark handoff as processed when any downstream task creation fails', async () => {
    const task = await createTask(tmpRoot, {
      title: 'Partial handoff',
      delegator: 'orchestrator',
      assignees: ['data'],
      handoffTo: ['backend', 'frontend'],
    });
    await updateTaskStatus(tmpRoot, task.task.id, 'accepted', { from: 'data' });
    await updateTaskStatus(tmpRoot, task.task.id, 'working', { from: 'data' });
    await updateTaskStatus(tmpRoot, task.task.id, 'completed', { from: 'data' });

    const taskPath = resolve(tmpRoot, '.claude', 'state', 'tasks', `${task.task.id}.json`);
    const taskData = JSON.parse(readFileSync(taskPath, 'utf-8'));
    taskData.priority = 'P9';
    writeFileSync(taskPath, JSON.stringify(taskData, null, 2) + '\n', 'utf-8');

    const firstRun = await processHandoffs(tmpRoot);
    expect(firstRun.errors.length).toBeGreaterThan(0);
    expect(firstRun.created).toHaveLength(0);
    const after = await getTask(tmpRoot, task.task.id);
    expect(after.task._handoffProcessed).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

describe('formatTaskSummary', () => {
  it('produces a readable summary', async () => {
    const { task } = await createTask(tmpRoot, {
      title: 'Test task',
      delegator: 'orchestrator',
      assignees: ['team-backend'],
      priority: 'P1',
      handoffTo: ['team-testing'],
    });
    const summary = formatTaskSummary(task);
    expect(summary).toContain('Test task');
    expect(summary).toContain('P1');
    expect(summary).toContain('team-backend');
    expect(summary).toContain('team-testing');
  });
});

describe('formatTaskList', () => {
  it('returns message for empty list', () => {
    expect(formatTaskList([])).toBe('No tasks found.');
  });

  it('produces a markdown table', async () => {
    await createTask(tmpRoot, { title: 'A', delegator: 'test', assignees: ['x'], priority: 'P0' });
    await createTask(tmpRoot, { title: 'B', delegator: 'test', assignees: ['y'], priority: 'P2' });
    const { tasks } = await listTasks(tmpRoot);
    const table = formatTaskList(tasks);
    expect(table).toContain('| ID |');
    expect(table).toContain('submitted');
  });
});

