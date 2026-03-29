/**
 * Retort — RuntimeStateManager
 * Orchestrator state, task lifecycle, event logging, and advisory locking
 * for the Retort agent runtime.
 *
 * State directory: <projectRoot>/.claude/state/
 * Orchestrator state: <stateDir>/orchestrator.json
 * Task files:        <stateDir>/tasks/<taskId>.json
 * Event log:         <stateDir>/events.log  (newline-delimited JSON)
 */
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Task state machine
// ---------------------------------------------------------------------------

/**
 * Valid task lifecycle transitions.
 * Map of currentState → Set of allowed next states.
 */
const VALID_TRANSITIONS = new Map([
  ['submitted', new Set(['accepted', 'rejected'])],
  ['accepted', new Set(['working'])],
  ['working', new Set(['completed', 'failed'])],
  ['failed', new Set(['working'])], // retry
]);

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function stateDir(projectRoot) {
  return join(projectRoot, '.claude', 'state');
}

function orchestratorPath(projectRoot) {
  return join(stateDir(projectRoot), 'orchestrator.json');
}

function tasksDir(projectRoot) {
  return join(stateDir(projectRoot), 'tasks');
}

function taskPath(projectRoot, taskId) {
  return join(tasksDir(projectRoot), `${taskId}.json`);
}

function eventsPath(projectRoot) {
  return join(stateDir(projectRoot), 'events.log');
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

/**
 * Write JSON to a file atomically: write to .tmp then rename.
 * @param {string} filePath
 * @param {object} data
 */
function writeAtomicJson(filePath, data) {
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// RuntimeStateManager
// ---------------------------------------------------------------------------

export class RuntimeStateManager {
  /**
   * @param {string} projectRoot - Absolute path to the project root (not .agentkit/)
   * @param {EventEmitter} [eventEmitter] - Optional external EventEmitter; one is created if omitted
   */
  constructor(projectRoot, eventEmitter) {
    this._projectRoot = projectRoot;
    this._emitter = eventEmitter instanceof EventEmitter ? eventEmitter : new EventEmitter();
    /** @type {Set<string>} Advisory lock registry */
    this._locks = new Set();
  }

  // -------------------------------------------------------------------------
  // Orchestrator state
  // -------------------------------------------------------------------------

  /**
   * Read orchestrator state from disk.
   * Returns an empty object `{}` if the state file does not exist yet.
   * @returns {object}
   */
  getState() {
    const p = orchestratorPath(this._projectRoot);
    if (!existsSync(p)) return {};
    try {
      return JSON.parse(readFileSync(p, 'utf-8'));
    } catch {
      return {};
    }
  }

  /**
   * Shallow-merge `patch` into existing orchestrator state and persist.
   * @param {object} patch
   * @returns {object} Updated state
   */
  updateState(patch) {
    const current = this.getState();
    const next = { ...current, ...patch };
    const dir = stateDir(this._projectRoot);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeAtomicJson(orchestratorPath(this._projectRoot), next);
    this._emitter.emit('state:updated', next);
    return next;
  }

  /**
   * Advance the current phase to `targetPhase`.
   * Persists `current_phase: targetPhase` into orchestrator state.
   * @param {number} targetPhase
   * @returns {object} Updated state
   */
  advancePhase(targetPhase) {
    return this.updateState({ current_phase: targetPhase });
  }

  /**
   * Set the status of a team in the orchestrator state.
   * Merges into `team_progress` without overwriting other teams.
   * @param {string} teamId
   * @param {string} status
   * @returns {object} Updated state
   */
  setTeamStatus(teamId, status) {
    const current = this.getState();
    const teamProgress = { ...(current.team_progress ?? {}) };
    teamProgress[teamId] = { ...(teamProgress[teamId] ?? {}), status };
    return this.updateState({ team_progress: teamProgress });
  }

  // -------------------------------------------------------------------------
  // Task lifecycle
  // -------------------------------------------------------------------------

  /**
   * Create a new task and persist it to disk.
   * Assigns a random UUID if `taskData.id` is not provided.
   * @param {object} taskData
   * @returns {object} Created task
   */
  createTask(taskData) {
    const id = taskData?.id ?? randomUUID();
    const task = {
      ...taskData,
      id,
      state: taskData?.state ?? 'submitted',
      artifacts: taskData?.artifacts ?? [],
      createdAt: new Date().toISOString(),
    };

    const dir = tasksDir(this._projectRoot);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeAtomicJson(taskPath(this._projectRoot, id), task);
    this._emitter.emit('task:created', task);
    return task;
  }

  /**
   * Read a task from disk by ID.
   * @param {string} taskId
   * @returns {object|null} Task object or null if not found
   */
  getTask(taskId) {
    const p = taskPath(this._projectRoot, taskId);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * List tasks from disk, optionally filtered by `filter.state`.
   * @param {{ state?: string } | undefined} [filter]
   * @returns {object[]}
   */
  listTasks(filter) {
    const dir = tasksDir(this._projectRoot);
    if (!existsSync(dir)) return [];

    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    const tasks = files
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(dir, f), 'utf-8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (filter?.state) {
      return tasks.filter((t) => t.state === filter.state);
    }
    return tasks;
  }

  /**
   * Transition a task to a new state, validating against the state machine.
   * Throws if the transition is invalid.
   * @param {string} taskId
   * @param {string} newState
   * @param {object} [data] - Extra fields to merge into the task
   * @returns {object} Updated task
   */
  transitionTask(taskId, newState, data = {}) {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const allowed = VALID_TRANSITIONS.get(task.state);
    if (!allowed || !allowed.has(newState)) {
      throw new Error(
        `Invalid task transition: ${task.state} → ${newState} (task: ${taskId})`
      );
    }

    const updated = {
      ...task,
      ...data,
      state: newState,
      updatedAt: new Date().toISOString(),
    };
    writeAtomicJson(taskPath(this._projectRoot, taskId), updated);
    this._emitter.emit('task:transitioned', { taskId, from: task.state, to: newState });
    return updated;
  }

  /**
   * Append an artifact to a task's `artifacts` array.
   * @param {string} taskId
   * @param {object} artifact
   * @returns {object} Updated task
   */
  addArtifact(taskId, artifact) {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const updated = {
      ...task,
      artifacts: [...(task.artifacts ?? []), artifact],
      updatedAt: new Date().toISOString(),
    };
    writeAtomicJson(taskPath(this._projectRoot, taskId), updated);
    this._emitter.emit('task:artifact:added', { taskId, artifact });
    return updated;
  }

  /**
   * Set the `handoffTo` field on a task, indicating downstream team routing.
   * @param {string} taskId
   * @param {string} targetTeam
   * @returns {object} Updated task
   */
  setHandoff(taskId, targetTeam) {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const updated = {
      ...task,
      handoffTo: targetTeam,
      updatedAt: new Date().toISOString(),
    };
    writeAtomicJson(taskPath(this._projectRoot, taskId), updated);
    this._emitter.emit('task:handoff:set', { taskId, targetTeam });
    return updated;
  }

  // -------------------------------------------------------------------------
  // Event log
  // -------------------------------------------------------------------------

  /**
   * Read events from the JSONL event log.
   * @param {{ action?: string, limit?: number } | undefined} [filter]
   * @returns {Promise<object[]>}
   */
  async getEventLog(filter) {
    const p = eventsPath(this._projectRoot);
    if (!existsSync(p)) return [];

    try {
      const content = await readFile(p, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      let events = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      if (filter?.action) {
        events = events.filter((e) => e.action === filter.action);
      }

      const limit = filter?.limit ?? 50;
      return events.slice(-limit).reverse();
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Advisory locking
  // -------------------------------------------------------------------------

  /**
   * Acquire an in-memory advisory lock on `resource`.
   * Throws if the resource is already locked.
   * @param {string} resource
   */
  lock(resource) {
    if (this._locks.has(resource)) {
      throw new Error(`Resource already locked: ${resource}`);
    }
    this._locks.add(resource);
    this._emitter.emit('lock:acquired', { resource });
  }

  /**
   * Release an in-memory advisory lock on `resource`.
   * No-op if the resource is not locked.
   * @param {string} resource
   */
  unlock(resource) {
    this._locks.delete(resource);
    this._emitter.emit('lock:released', { resource });
  }
}
