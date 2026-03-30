/**
 * Tests for run-cli.mjs — agent task dispatch subcommand.
 */
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { advanceToWorking, assigneeToCommand, buildDispatchPrompt, runRun } from '../run-cli.mjs';
import { createTask, getTask } from '../task-protocol.mjs';

let tmpRoot;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'retort-run-test-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// assigneeToCommand
// ---------------------------------------------------------------------------

describe('assigneeToCommand', () => {
  it('maps BACKEND to /team-backend', () => {
    expect(assigneeToCommand('BACKEND')).toBe('/team-backend');
  });

  it('maps team-backend to /team-backend', () => {
    expect(assigneeToCommand('team-backend')).toBe('/team-backend');
  });

  it('maps TESTING to /team-testing', () => {
    expect(assigneeToCommand('TESTING')).toBe('/team-testing');
  });

  it('maps team_frontend to /team-frontend', () => {
    expect(assigneeToCommand('team_frontend')).toBe('/team-frontend');
  });

  it('maps plain lowercase name', () => {
    expect(assigneeToCommand('data')).toBe('/team-data');
  });
});

// ---------------------------------------------------------------------------
// buildDispatchPrompt
// ---------------------------------------------------------------------------

describe('buildDispatchPrompt', () => {
  it('includes task ID', () => {
    const task = {
      id: 'task-20260330-001',
      assignees: ['BACKEND'],
      type: 'implement',
      priority: 'P1',
      status: 'working',
      title: 'Add pagination',
      description: 'Implement cursor-based pagination',
      acceptanceCriteria: [],
      scope: [],
      dependsOn: [],
    };
    const prompt = buildDispatchPrompt(task);
    expect(prompt).toContain('task-20260330-001');
  });

  it('maps assignees to slash commands', () => {
    const task = {
      id: 'task-1',
      assignees: ['BACKEND', 'TESTING'],
      type: 'implement',
      priority: 'P2',
      status: 'working',
      title: 'Add feature',
      description: '',
      acceptanceCriteria: [],
      scope: [],
      dependsOn: [],
    };
    const prompt = buildDispatchPrompt(task);
    expect(prompt).toContain('/team-backend');
    expect(prompt).toContain('/team-testing');
  });

  it('falls back to /orchestrate with no assignees', () => {
    const task = {
      id: 'task-2',
      assignees: [],
      type: 'review',
      priority: 'P3',
      status: 'working',
      title: 'Review code',
      description: '',
      acceptanceCriteria: [],
      scope: [],
      dependsOn: [],
    };
    const prompt = buildDispatchPrompt(task);
    expect(prompt).toContain('/orchestrate');
  });

  it('includes acceptance criteria', () => {
    const task = {
      id: 'task-3',
      assignees: ['BACKEND'],
      type: 'implement',
      priority: 'P1',
      status: 'working',
      title: 'Add endpoint',
      description: '',
      acceptanceCriteria: ['Returns 200 on success', 'Validates input'],
      scope: [],
      dependsOn: [],
    };
    const prompt = buildDispatchPrompt(task);
    expect(prompt).toContain('Returns 200 on success');
    expect(prompt).toContain('Validates input');
  });

  it('includes scope', () => {
    const task = {
      id: 'task-4',
      assignees: ['BACKEND'],
      type: 'implement',
      priority: 'P2',
      status: 'working',
      title: 'Add endpoint',
      description: '',
      acceptanceCriteria: [],
      scope: ['apps/api/**', 'services/auth/**'],
      dependsOn: [],
    };
    const prompt = buildDispatchPrompt(task);
    expect(prompt).toContain('apps/api/**');
  });

  it('includes dependsOn when present', () => {
    const task = {
      id: 'task-5',
      assignees: ['BACKEND'],
      type: 'implement',
      priority: 'P2',
      status: 'working',
      title: 'Add endpoint',
      description: '',
      acceptanceCriteria: [],
      scope: [],
      dependsOn: ['task-00'],
    };
    const prompt = buildDispatchPrompt(task);
    expect(prompt).toContain('task-00');
  });

  it('omits optional sections when empty', () => {
    const task = {
      id: 'task-6',
      assignees: ['BACKEND'],
      type: 'implement',
      priority: 'P2',
      status: 'working',
      title: 'Add endpoint',
      description: '',
      acceptanceCriteria: [],
      scope: [],
      dependsOn: [],
    };
    const prompt = buildDispatchPrompt(task);
    expect(prompt).not.toContain('Acceptance Criteria');
    expect(prompt).not.toContain('Scope:');
    expect(prompt).not.toContain('Depends on:');
  });
});

// ---------------------------------------------------------------------------
// advanceToWorking
// ---------------------------------------------------------------------------

describe('advanceToWorking', () => {
  it('transitions submitted → working in two steps', async () => {
    const { task: created } = await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['BACKEND'],
      title: 'Add pagination',
    });

    expect(created.status).toBe('submitted');

    const result = await advanceToWorking(tmpRoot, created.id);
    expect(result.error).toBeUndefined();
    expect(result.task.status).toBe('working');
  });

  it('transitions accepted → working', async () => {
    const { task: created } = await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['BACKEND'],
      title: 'Add pagination',
    });

    // Manually accept first
    const { updateTaskStatus } = await import('../task-protocol.mjs');
    await updateTaskStatus(tmpRoot, created.id, 'accepted');

    const result = await advanceToWorking(tmpRoot, created.id);
    expect(result.error).toBeUndefined();
    expect(result.task.status).toBe('working');
  });

  it('returns error for non-existent task', async () => {
    const result = await advanceToWorking(tmpRoot, 'task-nonexistent');
    expect(result.error).toBeDefined();
    expect(result.task).toBeNull();
  });

  it('records messages for each transition', async () => {
    const { task: created } = await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['BACKEND'],
      title: 'Add pagination',
    });

    await advanceToWorking(tmpRoot, created.id, 'test-actor');

    const { task } = await getTask(tmpRoot, created.id);
    const statusMessages = task.messages.filter((m) => m.statusChange);
    expect(statusMessages).toHaveLength(2);
    expect(statusMessages[0].from).toBe('test-actor');
    expect(statusMessages[1].from).toBe('test-actor');
  });
});

// ---------------------------------------------------------------------------
// runRun
// ---------------------------------------------------------------------------

describe('runRun', () => {
  it('dispatches the first submitted task', async () => {
    await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['BACKEND'],
      title: 'Add pagination',
    });

    const output = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      output.push(s);
      return true;
    });

    await runRun({ projectRoot: tmpRoot, flags: { json: true } });

    const result = JSON.parse(output[0]);
    expect(result.error).toBeUndefined();
    expect(result.taskId).toMatch(/^task-/);
    expect(result.status).toBe('working');
    expect(result.dryRun).toBe(false);
    expect(result.prompt).toContain('/team-backend');
  });

  it('dry-run does not transition state', async () => {
    const { task: created } = await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['BACKEND'],
      title: 'Add pagination',
    });

    const output = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      output.push(s);
      return true;
    });

    await runRun({ projectRoot: tmpRoot, flags: { 'dry-run': true, json: true } });

    const result = JSON.parse(output[0]);
    expect(result.dryRun).toBe(true);

    // Task should still be submitted
    const { task } = await getTask(tmpRoot, created.id);
    expect(task.status).toBe('submitted');
  });

  it('dispatches specific task by --id', async () => {
    // Create two tasks
    await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['BACKEND'],
      title: 'Task A',
      priority: 'P0',
    });
    const { task: taskB } = await createTask(tmpRoot, {
      type: 'review',
      delegator: 'orchestrator',
      assignees: ['TESTING'],
      title: 'Task B',
      priority: 'P3',
    });

    const output = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      output.push(s);
      return true;
    });

    await runRun({ projectRoot: tmpRoot, flags: { id: taskB.id, json: true } });

    const result = JSON.parse(output[0]);
    expect(result.taskId).toBe(taskB.id);
    expect(result.status).toBe('working');
  });

  it('exits with error for non-existent --id', async () => {
    const output = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      output.push(s);
      return true;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('EXIT');
    });

    await expect(
      runRun({ projectRoot: tmpRoot, flags: { id: 'task-bogus', json: true } })
    ).rejects.toThrow('EXIT');

    expect(exitSpy).toHaveBeenCalledWith(1);
    const result = JSON.parse(output[0]);
    expect(result.error).toBeDefined();
  });

  it('exits with error when dispatching a completed task', async () => {
    const { task: created } = await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['BACKEND'],
      title: 'Done task',
    });

    // Advance to completed
    const { updateTaskStatus } = await import('../task-protocol.mjs');
    await updateTaskStatus(tmpRoot, created.id, 'accepted');
    await updateTaskStatus(tmpRoot, created.id, 'working');
    await updateTaskStatus(tmpRoot, created.id, 'completed');

    const output = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      output.push(s);
      return true;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('EXIT');
    });

    await expect(
      runRun({ projectRoot: tmpRoot, flags: { id: created.id, json: true } })
    ).rejects.toThrow('EXIT');

    expect(exitSpy).toHaveBeenCalledWith(1);
    const result = JSON.parse(output[0]);
    expect(result.error).toContain('not dispatchable');
  });

  it('returns empty when no submitted tasks', async () => {
    const output = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      output.push(s);
      return true;
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runRun({ projectRoot: tmpRoot, flags: { json: true } });

    const result = JSON.parse(output[0]);
    expect(result.error).toContain('No submitted tasks');
    consoleSpy.mockRestore();
  });

  it('filters by --assignee', async () => {
    await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['BACKEND'],
      title: 'Backend task',
    });
    const { task: frontendTask } = await createTask(tmpRoot, {
      type: 'implement',
      delegator: 'orchestrator',
      assignees: ['FRONTEND'],
      title: 'Frontend task',
    });

    const output = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      output.push(s);
      return true;
    });

    await runRun({ projectRoot: tmpRoot, flags: { assignee: 'FRONTEND', json: true } });

    const result = JSON.parse(output[0]);
    expect(result.taskId).toBe(frontendTask.id);
  });
});
