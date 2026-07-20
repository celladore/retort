import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHASES,
  VALID_TEAM_IDS,
  acquireLock,
  advancePhase,
  appendEvent,
  checkLock,
  clearTeamsSpecCache,
  computeEscalation,
  delegateTask,
  getStatus,
  getTasksSummary,
  getTasksSummaryAsync,
  loadState,
  orchestratorCheckDependencies,
  orchestratorProcessHandoffs,
  readEvents,
  releaseLock,
  resolveTeamByArea,
  routePhase4TestFailure,
  runOrchestrate,
  saveState,
  setPhase,
  updateTeamStatus,
} from '../orchestrator.mjs';

// Use a temporary directory for tests; unique per run to avoid Windows EPERM on rmSync
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_BASE = resolve(__dirname, '..', '..', '..', '..', '..', '.test-tmp', 'orchestrator');
let TEST_ROOT;
let STATE_DIR;
let TASKS_DIR;
let AGENTKIT_ROOT;

describe('orchestrator', () => {
  beforeEach(() => {
    const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    TEST_ROOT = resolve(TEST_BASE, id);
    STATE_DIR = resolve(TEST_ROOT, '.agentkit', 'state');
    TASKS_DIR = resolve(TEST_ROOT, '.agentkit', 'state', 'tasks');
    AGENTKIT_ROOT = resolve(TEST_ROOT, '.agentkit');
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(resolve(TEST_ROOT, '.agentkit-repo'), 'test-project', 'utf-8');
    mkdirSync(resolve(TEST_ROOT, '.git'), { recursive: true });
  });

  describe('loadState()', () => {
    it('creates default state when none exists', async () => {
      const state = await loadState(TEST_ROOT);
      expect(state.schema_version).toBe('1.0.0');
      expect(state.repo_id).toBe('test-project');
      expect(state.current_phase).toBe(1);
      expect(state.phase_name).toBe('Discovery');
      expect(state.completed).toBe(false);
      expect(Object.keys(state.team_progress)).toHaveLength(10);
    });

    it('reads existing state from disk', async () => {
      const custom = {
        schema_version: '1.0.0',
        repo_id: 'custom',
        current_phase: 3,
        phase_name: 'Implementation',
        team_progress: {},
        completed: false,
      };
      writeFileSync(resolve(STATE_DIR, 'orchestrator.json'), JSON.stringify(custom), 'utf-8');
      const state = await loadState(TEST_ROOT);
      expect(state.repo_id).toBe('custom');
      expect(state.current_phase).toBe(3);
    });
  });

  describe('saveState()', () => {
    it('writes state to disk', async () => {
      const state = { schema_version: '1.0.0', repo_id: 'save-test', current_phase: 2 };
      await saveState(TEST_ROOT, state);

      const onDisk = JSON.parse(readFileSync(resolve(STATE_DIR, 'orchestrator.json'), 'utf-8'));
      expect(onDisk.repo_id).toBe('save-test');
      expect(onDisk.current_phase).toBe(2);
    });
  });

  describe('advancePhase()', () => {
    it('transitions 1→2→3→4→5', () => {
      let state = { current_phase: 1, completed: false };
      for (let i = 2; i <= 5; i++) {
        const result = advancePhase(state);
        expect(result.advanced).toBe(true);
        expect(result.state.current_phase).toBe(i);
        expect(result.state.phase_name).toBe(PHASES[i]);
        state = result.state;
      }
    });

    it('marks completed when advancing past phase 5', () => {
      const state = { current_phase: 5, completed: false };
      const result = advancePhase(state);
      expect(result.advanced).toBe(true);
      expect(result.state.completed).toBe(true);
    });

    it('rejects advancement when already completed', () => {
      const state = { current_phase: 5, completed: true };
      const result = advancePhase(state);
      expect(result.advanced).toBe(false);
      expect(result.error).toContain('already complete');
    });
  });

  describe('setPhase()', () => {
    it('jumps to a valid phase', () => {
      const state = { current_phase: 1 };
      const result = setPhase(state, 4);
      expect(result.state.current_phase).toBe(4);
      expect(result.state.phase_name).toBe('Validation');
      expect(result.error).toBeUndefined();
    });

    it('rejects invalid phase numbers', () => {
      const state = { current_phase: 1 };
      expect(setPhase(state, 0).error).toBeDefined();
      expect(setPhase(state, 6).error).toBeDefined();
      expect(setPhase(state, 2.5).error).toBeDefined();
    });
  });

  describe('updateTeamStatus()', () => {
    it('updates a valid team', () => {
      const state = {
        team_progress: {
          'team-backend': { status: 'idle', notes: '' },
        },
      };
      const result = updateTeamStatus(state, 'team-backend', 'in_progress', 'Working on API');
      expect(result.state.team_progress['team-backend'].status).toBe('in_progress');
      expect(result.state.team_progress['team-backend'].notes).toBe('Working on API');
      expect(result.error).toBeUndefined();
    });

    it('rejects unknown team IDs', () => {
      const state = { team_progress: {} };
      const result = updateTeamStatus(state, 'team-marketing', 'idle');
      expect(result.error).toContain('Unknown team');
    });

    it('rejects invalid statuses', () => {
      const state = { team_progress: { 'team-backend': { status: 'idle' } } };
      const result = updateTeamStatus(state, 'team-backend', 'invalid');
      expect(result.error).toContain('Invalid status');
    });
  });

  describe('lock management', () => {
    it('acquires and releases locks', async () => {
      const result = await acquireLock(TEST_ROOT, { pid: 1234 });
      expect(result.acquired).toBe(true);

      const status = await checkLock(TEST_ROOT);
      expect(status.locked).toBe(true);
      expect(status.lock.pid).toBe(1234);

      const released = await releaseLock(TEST_ROOT);
      expect(released).toBe(true);

      expect((await checkLock(TEST_ROOT)).locked).toBe(false);
    });

    it('rejects concurrent lock acquisition', async () => {
      await acquireLock(TEST_ROOT, { pid: 1 });
      const result = await acquireLock(TEST_ROOT, { pid: 2 });
      expect(result.acquired).toBe(false);
      expect(result.existingLock.pid).toBe(1);
      await releaseLock(TEST_ROOT);
    });

    it('detects stale locks', async () => {
      // Write a lock with old timestamp
      const lockData = {
        pid: 999,
        hostname: 'test',
        started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        session_id: '',
      };
      writeFileSync(resolve(STATE_DIR, 'orchestrator.lock'), JSON.stringify(lockData), 'utf-8');

      const status = await checkLock(TEST_ROOT);
      expect(status.locked).toBe(true);
      expect(status.stale).toBe(true);

      // Stale lock should be overridden
      const result = await acquireLock(TEST_ROOT, { pid: 999 });
      expect(result.acquired).toBe(true);
      await releaseLock(TEST_ROOT);
    });
  });

  describe('event logging', () => {
    it('appends events and reads them back', async () => {
      await appendEvent(TEST_ROOT, 'test_action', { team: 'team-backend', data: 'hello' });
      await appendEvent(TEST_ROOT, 'test_action_2', { data: 'world' });

      const events = await readEvents(TEST_ROOT);
      expect(events).toHaveLength(2);
      expect(events[0].action).toBe('test_action_2'); // Most recent first
      expect(events[0].data).toBe('world');
      expect(events[1].action).toBe('test_action'); // Earlier event
      expect(events[1].team).toBe('team-backend');
      expect(events[1].data).toBe('hello');
      expect(events[0].timestamp).toBeDefined();
    });

    it('returns empty array when no events exist', async () => {
      const events = await readEvents(TEST_ROOT);
      expect(events).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await appendEvent(TEST_ROOT, `action_${i}`);
      }
      const events = await readEvents(TEST_ROOT, 3);
      expect(events).toHaveLength(3);
      // Should return the LAST 3 events (most recent first)
      expect(events[0].action).toBe('action_9'); // Most recent
      expect(events[1].action).toBe('action_8'); // Middle
      expect(events[2].action).toBe('action_7'); // Oldest of the 3
    });
  });

  describe('getStatus()', () => {
    it('returns a formatted status string', async () => {
      // Create initial state
      await loadState(TEST_ROOT);
      const status = await getStatus(TEST_ROOT);
      expect(status).toContain('Orchestrator Status');
      expect(status).toContain('Phase');
      expect(status).toContain('Team Progress');
    });
  });

  describe('constants', () => {
    it('defines all 5 phases', () => {
      expect(Object.keys(PHASES)).toHaveLength(5);
      expect(PHASES[1]).toBe('Discovery');
      expect(PHASES[5]).toBe('Ship');
    });

    it('defines all 10 team IDs', () => {
      expect(VALID_TEAM_IDS).toHaveLength(10);
      expect(VALID_TEAM_IDS).toContain('team-backend');
      expect(VALID_TEAM_IDS).toContain('team-quality');
    });
  });

  describe('getTasksSummary()', () => {
    it('returns empty-queue message when tasks directory does not exist', async () => {
      const result = await getTasksSummary(TEST_ROOT);
      expect(result).toBe('No tasks in the task queue.');
    });

    it('returns empty-queue message when readdirSync throws', async () => {
      // Create a file at the tasks path so readdirSync throws ENOTDIR
      mkdirSync(resolve(TEST_ROOT, '.agentkit', 'state'), { recursive: true });
      writeFileSync(TASKS_DIR, 'not-a-directory');
      const result = await getTasksSummary(TEST_ROOT);
      expect(result).toBe('No tasks in the task queue.');
    });

    it('skips corrupted JSON files and still returns valid output', async () => {
      mkdirSync(TASKS_DIR, { recursive: true });
      writeFileSync(resolve(TASKS_DIR, 'bad.json'), '{ invalid json !!');
      writeFileSync(
        resolve(TASKS_DIR, 'good.json'),
        JSON.stringify({
          id: 'task-001',
          status: 'in_progress',
          title: 'Do something',
          priority: 'P1',
          assignees: ['team-backend'],
          createdAt: new Date().toISOString(),
        })
      );
      const result = await getTasksSummary(TEST_ROOT);
      expect(result).toContain('Active tasks: 1');
    });

    it('ignores non-object JSON payloads (arrays, primitives)', async () => {
      mkdirSync(TASKS_DIR, { recursive: true });
      writeFileSync(resolve(TASKS_DIR, 'array.json'), JSON.stringify([1, 2, 3]));
      writeFileSync(resolve(TASKS_DIR, 'number.json'), '42');
      writeFileSync(resolve(TASKS_DIR, 'string.json'), '"just a string"');
      const result = await getTasksSummary(TEST_ROOT);
      expect(result).toBe('No tasks in the task queue.');
    });

    it('counts non-terminal tasks as active and terminal tasks as completed', async () => {
      mkdirSync(TASKS_DIR, { recursive: true });
      const now = new Date().toISOString();
      writeFileSync(
        resolve(TASKS_DIR, 'active1.json'),
        JSON.stringify({
          id: 'task-001',
          status: 'in_progress',
          title: 'Task 1',
          priority: 'P1',
          assignees: ['team-backend'],
          createdAt: now,
        })
      );
      writeFileSync(
        resolve(TASKS_DIR, 'active2.json'),
        JSON.stringify({
          id: 'task-002',
          status: 'submitted',
          title: 'Task 2',
          priority: 'P2',
          assignees: ['team-frontend'],
          createdAt: now,
        })
      );
      writeFileSync(
        resolve(TASKS_DIR, 'done1.json'),
        JSON.stringify({
          id: 'task-003',
          status: 'completed',
          title: 'Task 3',
          priority: 'P1',
          assignees: ['team-backend'],
          createdAt: now,
        })
      );
      writeFileSync(
        resolve(TASKS_DIR, 'done2.json'),
        JSON.stringify({
          id: 'task-004',
          status: 'failed',
          title: 'Task 4',
          priority: 'P3',
          assignees: ['team-backend'],
          createdAt: now,
        })
      );
      const result = await getTasksSummary(TEST_ROOT);
      expect(result).toContain('Active tasks: 2');
      expect(result).toContain('Completed/closed tasks: 2');
    });

    it('omits active section when all tasks are terminal', async () => {
      mkdirSync(TASKS_DIR, { recursive: true });
      const now = new Date().toISOString();
      writeFileSync(
        resolve(TASKS_DIR, 'done.json'),
        JSON.stringify({
          id: 'task-001',
          status: 'canceled',
          title: 'Done',
          priority: 'P1',
          assignees: ['team-backend'],
          createdAt: now,
        })
      );
      const result = await getTasksSummary(TEST_ROOT);
      expect(result).not.toContain('Active tasks');
      expect(result).toContain('Completed/closed tasks: 1');
    });

    it('sorts active tasks by priority then newest createdAt first', async () => {
      mkdirSync(TASKS_DIR, { recursive: true });
      writeFileSync(
        resolve(TASKS_DIR, 'task-low-priority.json'),
        JSON.stringify({
          id: 'task-low-priority',
          status: 'working',
          priority: 'P2',
          title: 'Low priority',
          assignees: [],
          createdAt: '2024-01-01T08:00:00Z',
        })
      );
      writeFileSync(
        resolve(TASKS_DIR, 'task-high-older.json'),
        JSON.stringify({
          id: 'task-high-older',
          status: 'working',
          priority: 'P0',
          title: 'High priority older',
          assignees: [],
          createdAt: '2024-01-01T09:00:00Z',
        })
      );
      writeFileSync(
        resolve(TASKS_DIR, 'task-high-newer.json'),
        JSON.stringify({
          id: 'task-high-newer',
          status: 'working',
          priority: 'P0',
          title: 'Newer high priority',
          assignees: [],
          createdAt: '2024-01-01T10:00:00Z',
        })
      );
      const result = await getTasksSummary(TEST_ROOT);
      const newerPos = result.indexOf('task-high-newer');
      const olderPos = result.indexOf('task-high-older');
      const lowPos = result.indexOf('task-low-priority');
      expect(newerPos).toBeLessThan(olderPos);
      expect(olderPos).toBeLessThan(lowPos);
    });
  });

  describe('resolveTeamByArea()', () => {
    beforeEach(() => {
      clearTeamsSpecCache();
    });

    it('returns default routing for known areas without config', () => {
      expect(resolveTeamByArea('backend')).toBe('backend');
      expect(resolveTeamByArea('frontend')).toBe('frontend');
      expect(resolveTeamByArea('cli')).toBe('backend');
      expect(resolveTeamByArea('sync-engine')).toBe('devops');
    });

    it('falls back to quality for unknown areas', () => {
      expect(resolveTeamByArea('unknown-area')).toBe('quality');
    });

    it('reads routing from teams.yaml when available', () => {
      mkdirSync(resolve(AGENTKIT_ROOT, 'spec'), { recursive: true });
      writeFileSync(
        resolve(AGENTKIT_ROOT, 'spec', 'teams.yaml'),
        'intake:\n  routing:\n    backend: custom-backend-team\n',
        'utf-8'
      );
      expect(resolveTeamByArea('backend', AGENTKIT_ROOT)).toBe('custom-backend-team');
      // Other areas still use defaults
      expect(resolveTeamByArea('frontend', AGENTKIT_ROOT)).toBe('frontend');
    });

    it('preserves teams.yaml routing values as-is', () => {
      clearTeamsSpecCache();
      mkdirSync(resolve(AGENTKIT_ROOT, 'spec'), { recursive: true });
      writeFileSync(
        resolve(AGENTKIT_ROOT, 'spec', 'teams.yaml'),
        'intake:\n  routing:\n    data: team-analytics\n',
        'utf-8'
      );
      expect(resolveTeamByArea('data', AGENTKIT_ROOT)).toBe('team-analytics');
    });
  });

  describe('computeEscalation()', () => {
    beforeEach(() => {
      clearTeamsSpecCache();
    });

    it('returns empty array when no escalation rules match', () => {
      const result = computeEscalation({ area: 'docs', priority: 'P3', severity: 'low' });
      expect(result).toEqual([]);
    });

    it('escalates critical security issues to security teams', () => {
      const result = computeEscalation({ area: 'security', priority: 'P0', severity: 'critical' });
      expect(result).toContain('security');
      expect(result).toContain('devops');
    });

    it('escalates critical backend issues to security teams', () => {
      const result = computeEscalation({ area: 'backend', priority: 'P1', severity: 'critical' });
      expect(result).toContain('security');
    });

    it('does not escalate critical docs issues to security teams', () => {
      const result = computeEscalation({ area: 'docs', priority: 'P0', severity: 'critical' });
      // P0 still triggers ops team, but not security escalation for docs area
      expect(result).not.toContain('security');
    });

    it('escalates all-users P0 to blocked cross-team', () => {
      const result = computeEscalation({ area: 'frontend', priority: 'P0', impact: 'all users' });
      expect(result).toContain('product');
    });

    it('does not escalate P1 all-users impact', () => {
      const result = computeEscalation({ area: 'frontend', priority: 'P1', impact: 'all users' });
      expect(result).not.toContain('product');
    });

    it('notifies operations team for any P0', () => {
      const result = computeEscalation({ area: 'docs', priority: 'P0' });
      expect(result).toContain('quality');
    });

    it('reads operations team from config', () => {
      mkdirSync(resolve(AGENTKIT_ROOT, 'spec'), { recursive: true });
      writeFileSync(
        resolve(AGENTKIT_ROOT, 'spec', 'teams.yaml'),
        'intake:\n  operationsTeam: devops\n  escalation:\n    securityCritical: [infra]\n    blockedCrossTeam: [engineering]\n',
        'utf-8'
      );
      const result = computeEscalation(
        { area: 'backend', priority: 'P0', severity: 'critical', impact: 'all users' },
        AGENTKIT_ROOT
      );
      expect(result).toContain('devops');
      expect(result).toContain('infra');
      expect(result).toContain('engineering');
    });
  });

  // -------------------------------------------------------------------------
  // getTasksSummaryAsync — async equivalent of getTasksSummary
  // -------------------------------------------------------------------------

  describe('getTasksSummaryAsync()', () => {
    it('returns empty-queue message when there are no tasks', async () => {
      const result = await getTasksSummaryAsync(TEST_ROOT);
      expect(result).toBe('No tasks in the task queue.');
    });

    it('returns active task counts for in-progress tasks', async () => {
      mkdirSync(TASKS_DIR, { recursive: true });
      writeFileSync(
        resolve(TASKS_DIR, 't1.json'),
        JSON.stringify({
          id: 'task-001',
          status: 'in_progress',
          title: 'Active',
          priority: 'P1',
          assignees: ['team-backend'],
          createdAt: new Date().toISOString(),
        })
      );
      const result = await getTasksSummaryAsync(TEST_ROOT);
      expect(result).toContain('Active tasks: 1');
    });

    it('counts terminal tasks separately', async () => {
      mkdirSync(TASKS_DIR, { recursive: true });
      writeFileSync(
        resolve(TASKS_DIR, 't1.json'),
        JSON.stringify({
          id: 'task-001',
          status: 'completed',
          title: 'Done',
          priority: 'P1',
          assignees: ['team-backend'],
          createdAt: new Date().toISOString(),
        })
      );
      const result = await getTasksSummaryAsync(TEST_ROOT);
      expect(result).toContain('Completed/closed tasks: 1');
    });
  });

  // -------------------------------------------------------------------------
  // runOrchestrate — CLI handler
  // -------------------------------------------------------------------------

  describe('runOrchestrate()', () => {
    let logSpy;
    let errorSpy;
    let exitSpy;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('--status prints orchestrator status and returns', async () => {
      await runOrchestrate({
        agentkitRoot: AGENTKIT_ROOT,
        projectRoot: TEST_ROOT,
        flags: { status: true },
      });
      const out = logSpy.mock.calls.flat().join('\n');
      expect(out).toContain('Orchestrator Status');
    });

    it('--force-unlock with no existing lock prints "no lock"', async () => {
      await runOrchestrate({
        agentkitRoot: AGENTKIT_ROOT,
        projectRoot: TEST_ROOT,
        flags: { 'force-unlock': true },
      });
      const out = logSpy.mock.calls.flat().join('\n');
      expect(out).toContain('No lock to release');
    });

    it('--force-unlock with existing lock releases it', async () => {
      acquireLock(TEST_ROOT);
      await runOrchestrate({
        agentkitRoot: AGENTKIT_ROOT,
        projectRoot: TEST_ROOT,
        flags: { 'force-unlock': true },
      });
      const out = logSpy.mock.calls.flat().join('\n');
      expect(out).toContain('Lock released');
    });

    it('--phase N sets the orchestrator phase and persists state', async () => {
      await runOrchestrate({
        agentkitRoot: AGENTKIT_ROOT,
        projectRoot: TEST_ROOT,
        flags: { phase: '3' },
      });
      const out = logSpy.mock.calls.flat().join('\n');
      expect(out).toContain('Phase set to 3');
      const state = await loadState(TEST_ROOT);
      expect(state.current_phase).toBe(3);
    });

    it('--phase with an invalid value reports an error', async () => {
      await runOrchestrate({
        agentkitRoot: AGENTKIT_ROOT,
        projectRoot: TEST_ROOT,
        flags: { phase: '99' },
      });
      const errOut = errorSpy.mock.calls.flat().join('\n');
      expect(errOut.length).toBeGreaterThan(0);
    });

    it('default flow prints phase, next action, and event log entry', async () => {
      await runOrchestrate({
        agentkitRoot: AGENTKIT_ROOT,
        projectRoot: TEST_ROOT,
        flags: {},
      });
      const out = logSpy.mock.calls.flat().join('\n');
      expect(out).toContain('Current phase:');
      expect(out).toContain('Next action:');
    });

    it('exits with error when an existing lock blocks execution', async () => {
      // Acquire a lock to force the locked-state branch
      acquireLock(TEST_ROOT, { pid: 99999 });

      await expect(
        runOrchestrate({
          agentkitRoot: AGENTKIT_ROOT,
          projectRoot: TEST_ROOT,
          flags: {},
        })
      ).rejects.toThrow('process.exit called');

      const errOut = errorSpy.mock.calls.flat().join('\n');
      expect(errOut).toContain('Session locked');
    });

    it('passes userContext through when extra args supplied', async () => {
      await runOrchestrate({
        agentkitRoot: AGENTKIT_ROOT,
        projectRoot: TEST_ROOT,
        flags: { _args: ['build', 'auth'] },
      });
      // The event log should have userContext embedded
      const events = await readEvents(TEST_ROOT);
      const orchEvent = events.find((e) => e.action === 'orchestrate_invoked');
      expect(orchEvent).toBeDefined();
      // userContext is part of the data payload
      const userCtx = orchEvent?.userContext ?? orchEvent?.data?.userContext;
      expect(userCtx).toBe('build auth');
    });
  });

  // -------------------------------------------------------------------------
  // delegateTask
  // -------------------------------------------------------------------------

  describe('delegateTask()', () => {
    it('creates a task and updates orchestrator state with active_tasks and team_progress', async () => {
      const state = await loadState(TEST_ROOT);
      const result = await delegateTask(TEST_ROOT, state, {
        type: 'implement',
        title: 'Add pagination',
        assignees: ['team-backend'],
        priority: 'P1',
      });

      expect(result.error).toBeUndefined();
      expect(result.task.id).toMatch(/^task-/);
      expect(result.task.assignees).toEqual(['team-backend']);
      expect(result.state.active_tasks['team-backend']).toContain(result.task.id);
      expect(result.state.team_progress['team-backend'].status).toBe('in_progress');
    });

    it('preserves existing team_progress entries on subsequent delegations', async () => {
      const state = await loadState(TEST_ROOT);
      const r1 = await delegateTask(TEST_ROOT, state, {
        type: 'implement',
        title: 'First',
        assignees: ['team-backend'],
      });
      const r2 = await delegateTask(TEST_ROOT, r1.state, {
        type: 'implement',
        title: 'Second',
        assignees: ['team-backend'],
      });

      expect(r2.state.active_tasks['team-backend'].length).toBe(2);
      expect(Object.keys(r2.state.team_progress['team-backend'].tasks).length).toBe(2);
    });

    it('handles tasks with multiple assignees', async () => {
      const state = await loadState(TEST_ROOT);
      const result = await delegateTask(TEST_ROOT, state, {
        type: 'implement',
        title: 'Cross-team task',
        assignees: ['team-backend', 'team-frontend'],
      });

      expect(result.state.active_tasks['team-backend']).toContain(result.task.id);
      expect(result.state.active_tasks['team-frontend']).toContain(result.task.id);
    });

    it('returns the original state and an error when createTask fails', async () => {
      const state = await loadState(TEST_ROOT);
      const result = await delegateTask(TEST_ROOT, state, {
        // missing required fields — should fail validation
        type: 'invalid-type-that-does-not-exist',
        title: '',
      });

      expect(result.error).toBeDefined();
      expect(result.task).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // orchestratorCheckDependencies
  // -------------------------------------------------------------------------

  describe('orchestratorCheckDependencies()', () => {
    it('returns a state object even when there are no tasks', async () => {
      const state = await loadState(TEST_ROOT);
      const result = await orchestratorCheckDependencies(TEST_ROOT, state);
      expect(result).toBeDefined();
      expect(result.state).toBeDefined();
      expect(Array.isArray(result.unblocked)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('clones state defensively (does not mutate input)', async () => {
      const state = await loadState(TEST_ROOT);
      const beforeJson = JSON.stringify(state);
      await orchestratorCheckDependencies(TEST_ROOT, state);
      expect(JSON.stringify(state)).toBe(beforeJson);
    });
  });

  // -------------------------------------------------------------------------
  // orchestratorProcessHandoffs
  // -------------------------------------------------------------------------

  describe('orchestratorProcessHandoffs()', () => {
    it('returns the state unchanged when there are no handoffs to process', async () => {
      const state = await loadState(TEST_ROOT);
      const result = await orchestratorProcessHandoffs(TEST_ROOT, state);
      expect(result.created).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.state).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // routePhase4TestFailure
  // -------------------------------------------------------------------------

  describe('routePhase4TestFailure()', () => {
    it('returns null task when no failed checks are present', async () => {
      const state = await loadState(TEST_ROOT);
      const checkResult = {
        overallStatus: 'PASS',
        stacks: [],
      };
      const result = await routePhase4TestFailure(TEST_ROOT, state, checkResult, ['team-backend']);
      expect(result.task).toBeNull();
      expect(result.state).toBe(state); // returns same state when nothing routed
    });
  });
});
