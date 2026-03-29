/**
 * Tests for RuntimeStateManager
 * Uses real tmp directories to exercise file I/O paths.
 */
import { EventEmitter } from 'events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuntimeStateManager } from '../runtime-state-manager.mjs';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let tmpRoot;
let manager;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'agentkit-rsm-test-'));
  manager = new RuntimeStateManager(tmpRoot);
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Orchestrator state
// ---------------------------------------------------------------------------

describe('getState()', () => {
  it('returns empty object when no state file exists', () => {
    expect(manager.getState()).toEqual({});
  });

  it('returns persisted state when file exists', () => {
    const stateDir = join(tmpRoot, '.claude', 'state');
    mkdirSyncRecursive(stateDir);
    writeFileSync(
      join(stateDir, 'orchestrator.json'),
      JSON.stringify({ current_phase: 3 }),
      'utf-8'
    );
    expect(manager.getState()).toEqual({ current_phase: 3 });
  });
});

describe('updateState()', () => {
  it('merges patch into empty state', () => {
    const result = manager.updateState({ current_phase: 1, status: 'active' });
    expect(result.current_phase).toBe(1);
    expect(result.status).toBe('active');
  });

  it('shallow-merges patch without overwriting unrelated keys', () => {
    manager.updateState({ a: 1, b: 2 });
    const result = manager.updateState({ b: 99 });
    expect(result.a).toBe(1);
    expect(result.b).toBe(99);
  });

  it('persists state to disk atomically', () => {
    manager.updateState({ phase: 2 });
    const stateFile = join(tmpRoot, '.claude', 'state', 'orchestrator.json');
    expect(existsSync(stateFile)).toBe(true);
    const onDisk = JSON.parse(readFileSync(stateFile, 'utf-8'));
    expect(onDisk.phase).toBe(2);
    // No leftover .tmp file
    expect(existsSync(stateFile + '.tmp')).toBe(false);
  });

  it('emits state:updated event', () => {
    const events = [];
    manager._emitter.on('state:updated', (s) => events.push(s));
    manager.updateState({ x: 42 });
    expect(events).toHaveLength(1);
    expect(events[0].x).toBe(42);
  });
});

describe('advancePhase()', () => {
  it('sets current_phase to targetPhase', () => {
    const result = manager.advancePhase(3);
    expect(result.current_phase).toBe(3);
  });

  it('does not overwrite other state keys', () => {
    manager.updateState({ label: 'hello' });
    manager.advancePhase(2);
    expect(manager.getState().label).toBe('hello');
  });
});

describe('setTeamStatus()', () => {
  it('sets status for a team', () => {
    const result = manager.setTeamStatus('team-backend', 'in_progress');
    expect(result.team_progress['team-backend'].status).toBe('in_progress');
  });

  it('does not overwrite other teams', () => {
    manager.setTeamStatus('team-frontend', 'done');
    manager.setTeamStatus('team-backend', 'in_progress');
    const state = manager.getState();
    expect(state.team_progress['team-frontend'].status).toBe('done');
    expect(state.team_progress['team-backend'].status).toBe('in_progress');
  });

  it('merges into existing team entry without losing other fields', () => {
    manager.updateState({ team_progress: { 'team-backend': { status: 'idle', notes: 'hi' } } });
    manager.setTeamStatus('team-backend', 'working');
    expect(manager.getState().team_progress['team-backend'].notes).toBe('hi');
    expect(manager.getState().team_progress['team-backend'].status).toBe('working');
  });
});

// ---------------------------------------------------------------------------
// Task lifecycle — createTask / getTask roundtrip
// ---------------------------------------------------------------------------

describe('createTask() / getTask() roundtrip', () => {
  it('persists and retrieves a task by id', () => {
    const task = manager.createTask({ title: 'Write tests', team: 'testing' });
    expect(task.id).toBeTruthy();
    expect(task.state).toBe('submitted');
    expect(task.artifacts).toEqual([]);

    const retrieved = manager.getTask(task.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved.title).toBe('Write tests');
    expect(retrieved.id).toBe(task.id);
  });

  it('uses provided id if supplied', () => {
    const task = manager.createTask({ id: 'my-custom-id', title: 'Custom' });
    expect(task.id).toBe('my-custom-id');
    expect(manager.getTask('my-custom-id')).not.toBeNull();
  });

  it('assigns a default state of submitted', () => {
    const task = manager.createTask({ title: 'No state' });
    expect(task.state).toBe('submitted');
  });

  it('returns null for a missing task', () => {
    expect(manager.getTask('does-not-exist')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listTasks with filter
// ---------------------------------------------------------------------------

describe('listTasks()', () => {
  it('returns empty array when tasks dir does not exist', () => {
    expect(manager.listTasks()).toEqual([]);
  });

  it('lists all tasks when no filter is given', () => {
    manager.createTask({ title: 'A' });
    manager.createTask({ title: 'B' });
    expect(manager.listTasks()).toHaveLength(2);
  });

  it('filters tasks by status', () => {
    const t1 = manager.createTask({ title: 'A' }); // submitted
    const t2 = manager.createTask({ title: 'B' }); // submitted

    manager.transitionTask(t1.id, 'accepted');
    manager.transitionTask(t1.id, 'working');

    const working = manager.listTasks({ state: 'working' });
    expect(working).toHaveLength(1);
    expect(working[0].id).toBe(t1.id);

    const submitted = manager.listTasks({ state: 'submitted' });
    expect(submitted).toHaveLength(1);
    expect(submitted[0].id).toBe(t2.id);
  });
});

// ---------------------------------------------------------------------------
// transitionTask — valid and invalid transitions
// ---------------------------------------------------------------------------

describe('transitionTask()', () => {
  it('submitted → accepted is valid', () => {
    const task = manager.createTask({ title: 'T' });
    const updated = manager.transitionTask(task.id, 'accepted');
    expect(updated.state).toBe('accepted');
  });

  it('submitted → rejected is valid', () => {
    const task = manager.createTask({ title: 'T' });
    const updated = manager.transitionTask(task.id, 'rejected');
    expect(updated.state).toBe('rejected');
  });

  it('accepted → working is valid', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    const updated = manager.transitionTask(task.id, 'working');
    expect(updated.state).toBe('working');
  });

  it('working → completed is valid', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    manager.transitionTask(task.id, 'working');
    const updated = manager.transitionTask(task.id, 'completed');
    expect(updated.state).toBe('completed');
  });

  it('working → failed is valid', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    manager.transitionTask(task.id, 'working');
    const updated = manager.transitionTask(task.id, 'failed');
    expect(updated.state).toBe('failed');
  });

  it('failed → working (retry) is valid', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    manager.transitionTask(task.id, 'working');
    manager.transitionTask(task.id, 'failed');
    const updated = manager.transitionTask(task.id, 'working');
    expect(updated.state).toBe('working');
  });

  it('throws on invalid transition submitted → working', () => {
    const task = manager.createTask({ title: 'T' });
    expect(() => manager.transitionTask(task.id, 'working')).toThrow(/Invalid task transition/);
  });

  it('throws on invalid transition accepted → completed', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    expect(() => manager.transitionTask(task.id, 'completed')).toThrow(/Invalid task transition/);
  });

  it('throws for unknown task id', () => {
    expect(() => manager.transitionTask('ghost-id', 'accepted')).toThrow(/Task not found/);
  });

  it('merges extra data into the task on transition', () => {
    const task = manager.createTask({ title: 'T' });
    const updated = manager.transitionTask(task.id, 'accepted', { reviewer: 'alice' });
    expect(updated.reviewer).toBe('alice');
  });

  it('emits task:transitioned event', () => {
    const events = [];
    manager._emitter.on('task:transitioned', (e) => events.push(e));
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    expect(events[0]).toMatchObject({ taskId: task.id, from: 'submitted', to: 'accepted' });
  });

  it('transitions submitted to canceled', () => {
    const task = manager.createTask({ title: 'T' });
    const updated = manager.transitionTask(task.id, 'canceled');
    expect(updated.state).toBe('canceled');
  });

  it('transitions accepted to canceled', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    const updated = manager.transitionTask(task.id, 'canceled');
    expect(updated.state).toBe('canceled');
  });

  it('transitions working to input-required', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    manager.transitionTask(task.id, 'working');
    const updated = manager.transitionTask(task.id, 'input-required');
    expect(updated.state).toBe('input-required');
  });

  it('transitions input-required to working', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    manager.transitionTask(task.id, 'working');
    manager.transitionTask(task.id, 'input-required');
    const updated = manager.transitionTask(task.id, 'working');
    expect(updated.state).toBe('working');
  });

  it('transitions input-required to canceled', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    manager.transitionTask(task.id, 'working');
    manager.transitionTask(task.id, 'input-required');
    const updated = manager.transitionTask(task.id, 'canceled');
    expect(updated.state).toBe('canceled');
  });

  it('transitions working to canceled', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    manager.transitionTask(task.id, 'working');
    const updated = manager.transitionTask(task.id, 'canceled');
    expect(updated.state).toBe('canceled');
  });

  it('throws on transition out of terminal state completed', () => {
    const task = manager.createTask({ title: 'T' });
    manager.transitionTask(task.id, 'accepted');
    manager.transitionTask(task.id, 'working');
    manager.transitionTask(task.id, 'completed');
    expect(() => manager.transitionTask(task.id, 'working')).toThrow(/Invalid task transition/);
  });
});

// ---------------------------------------------------------------------------
// addArtifact
// ---------------------------------------------------------------------------

describe('addArtifact()', () => {
  it('appends artifact to task', () => {
    const task = manager.createTask({ title: 'T' });
    const art = { type: 'files-changed', files: ['src/foo.mjs'] };
    const updated = manager.addArtifact(task.id, art);
    expect(updated.artifacts).toHaveLength(1);
    expect(updated.artifacts[0]).toEqual(art);
  });

  it('preserves existing artifacts', () => {
    const task = manager.createTask({ title: 'T' });
    manager.addArtifact(task.id, { type: 'plan', content: 'step 1' });
    const updated = manager.addArtifact(task.id, { type: 'summary', content: 'done' });
    expect(updated.artifacts).toHaveLength(2);
  });

  it('persists artifacts to disk', () => {
    const task = manager.createTask({ title: 'T' });
    manager.addArtifact(task.id, { type: 'test-results', passed: true });
    const onDisk = manager.getTask(task.id);
    expect(onDisk.artifacts[0].type).toBe('test-results');
  });

  it('throws for unknown task id', () => {
    expect(() => manager.addArtifact('no-such-id', { type: 'plan' })).toThrow(/Task not found/);
  });
});

// ---------------------------------------------------------------------------
// setHandoff
// ---------------------------------------------------------------------------

describe('setHandoff()', () => {
  it('sets handoffTo on the task', () => {
    const task = manager.createTask({ title: 'T' });
    const updated = manager.setHandoff(task.id, 'team-frontend');
    expect(updated.handoffTo).toBe('team-frontend');
  });

  it('persists handoffTo to disk', () => {
    const task = manager.createTask({ title: 'T' });
    manager.setHandoff(task.id, 'team-testing');
    expect(manager.getTask(task.id).handoffTo).toBe('team-testing');
  });

  it('throws for unknown task id', () => {
    expect(() => manager.setHandoff('ghost', 'team-backend')).toThrow(/Task not found/);
  });
});

// ---------------------------------------------------------------------------
// getEventLog
// ---------------------------------------------------------------------------

describe('getEventLog()', () => {
  it('returns empty array when no log exists', async () => {
    expect(await manager.getEventLog()).toEqual([]);
  });

  it('reads events written to the log file', async () => {
    const stateDir = join(tmpRoot, '.claude', 'state');
    mkdirSyncRecursive(stateDir);
    const line = JSON.stringify({
      action: 'test_event',
      value: 1,
      timestamp: new Date().toISOString(),
    });
    writeFileSync(join(stateDir, 'events.log'), line + '\n', 'utf-8');

    const events = await manager.getEventLog();
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('test_event');
  });

  it('filters events by action', async () => {
    const stateDir = join(tmpRoot, '.claude', 'state');
    mkdirSyncRecursive(stateDir);
    const lines =
      [
        JSON.stringify({ action: 'phase_advanced', ts: '1' }),
        JSON.stringify({ action: 'task_created', ts: '2' }),
        JSON.stringify({ action: 'phase_advanced', ts: '3' }),
      ].join('\n') + '\n';
    writeFileSync(join(stateDir, 'events.log'), lines, 'utf-8');

    const filtered = await manager.getEventLog({ action: 'phase_advanced' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.action === 'phase_advanced')).toBe(true);
  });

  it('respects limit parameter', async () => {
    const stateDir = join(tmpRoot, '.claude', 'state');
    mkdirSyncRecursive(stateDir);
    const lines =
      Array.from({ length: 10 }, (_, i) => JSON.stringify({ action: 'test', idx: i })).join('\n') +
      '\n';
    writeFileSync(join(stateDir, 'events.log'), lines, 'utf-8');

    const limited = await manager.getEventLog({ limit: 3 });
    expect(limited).toHaveLength(3);
    // newest (last) entries returned in reverse order
    expect(limited[0].idx).toBe(9);
    expect(limited[2].idx).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// lock / unlock
// ---------------------------------------------------------------------------

describe('lock() / unlock()', () => {
  it('acquires a lock on a resource', () => {
    expect(() => manager.lock('my-resource')).not.toThrow();
  });

  it('throws when locking an already-locked resource', () => {
    manager.lock('res');
    expect(() => manager.lock('res')).toThrow(/Resource already locked/);
  });

  it('allows re-locking after unlock', () => {
    manager.lock('res');
    manager.unlock('res');
    expect(() => manager.lock('res')).not.toThrow();
  });

  it('unlock is a no-op for unlocked resource', () => {
    expect(() => manager.unlock('not-locked')).not.toThrow();
  });

  it('emits lock:acquired and lock:released events', () => {
    const acquired = [];
    const released = [];
    manager._emitter.on('lock:acquired', (e) => acquired.push(e));
    manager._emitter.on('lock:released', (e) => released.push(e));

    manager.lock('r');
    manager.unlock('r');

    expect(acquired[0]).toEqual({ resource: 'r' });
    expect(released[0]).toEqual({ resource: 'r' });
  });

  it('locks are independent per resource', () => {
    manager.lock('r1');
    expect(() => manager.lock('r2')).not.toThrow();
    expect(() => manager.lock('r1')).toThrow(/Resource already locked/);
  });
});

// ---------------------------------------------------------------------------
// Constructor — accepts external EventEmitter
// ---------------------------------------------------------------------------

describe('constructor', () => {
  it('uses a provided external EventEmitter', () => {
    const ee = new EventEmitter();
    const m = new RuntimeStateManager(tmpRoot, ee);
    const events = [];
    ee.on('state:updated', (s) => events.push(s));
    m.updateState({ x: 1 });
    expect(events).toHaveLength(1);
  });

  it('creates its own EventEmitter when none is provided', () => {
    const m = new RuntimeStateManager(tmpRoot);
    expect(m._emitter).toBeInstanceOf(EventEmitter);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkdirSyncRecursive(dir) {
  mkdirSync(dir, { recursive: true });
}
