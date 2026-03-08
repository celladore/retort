/**
 * AgentKit Forge — Task Protocol
 * File-based A2A-lite task delegation protocol.
 * Tasks are JSON files in .agentkit/state/tasks/ with lifecycle states,
 * messages, artifacts, dependency tracking, and chained handoffs.
 */
import { existsSync } from 'fs';
import { access, mkdir, open, readdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { VALID_TASK_TYPES } from './task-types.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum task title length to prevent DoS */
const MAX_TITLE_LENGTH = 500;

/** Maximum context object size (serialized) to prevent memory exhaustion */
const MAX_CONTEXT_SIZE = 10240; // 10KB

/** Valid task lifecycle states. */
export const TASK_STATES = [
  'submitted', // created by delegator, awaiting assignee review
  'accepted', // assignee acknowledged the task
  'working', // assignee is actively working
  'input-required', // assignee needs info from delegator
  'completed', // task finished successfully
  'failed', // task finished with errors
  'rejected', // assignee declined the task
  'canceled', // delegator canceled the task
  'BLOCKED_ON_CANCELED', // blocked only by canceled/failed/rejected deps; until manual descoping or retry
];

/** Terminal states — no further transitions allowed. */
export const TERMINAL_STATES = [
  'completed',
  'failed',
  'rejected',
  'canceled',
  'BLOCKED_ON_CANCELED',
];

/** Valid task types. */
export const TASK_TYPES = VALID_TASK_TYPES;

/** Valid priority levels. */
export const TASK_PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4'];

/** Valid area labels — matches issue template and spec-validator issueArea. */
export const TASK_AREAS = [
  'backend',
  'frontend',
  'data',
  'infra',
  'devops',
  'testing',
  'security',
  'docs',
  'product',
  'quality',
  'cli',
  'sync-engine',
];

/** Valid severity levels — matches issue template and spec-validator issueSeverity. */
export const TASK_SEVERITIES = ['critical', 'high', 'medium', 'low'];

/** Valid message roles. */
export const MESSAGE_ROLES = ['delegator', 'executor'];

/** Valid artifact types. */
export const ARTIFACT_TYPES = [
  'files-changed',
  'test-results',
  'review-findings',
  'plan',
  'summary',
];

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function tasksDir(projectRoot) {
  return resolve(projectRoot, '.agentkit', 'state', 'tasks');
}

const TASK_ID_PATH_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Additional characters that could indicate path traversal attempts */
const PATH_TRAVERSAL_CHARS = /[.\/\\]/;

export function normalizeTaskId(taskId) {
  if (typeof taskId !== 'string' || !TASK_ID_PATH_PATTERN.test(taskId)) {
    throw new Error(`Invalid task ID: ${taskId}`);
  }

  // Additional check for path traversal attempts
  if (PATH_TRAVERSAL_CHARS.test(taskId)) {
    throw new Error(`Task ID contains invalid characters: ${taskId}`);
  }

  return taskId;
}

function taskPath(projectRoot, taskId) {
  return resolve(tasksDir(projectRoot), `${normalizeTaskId(taskId)}.json`);
}

function handoffLockPath(projectRoot, taskId) {
  return resolve(tasksDir(projectRoot), `${normalizeTaskId(taskId)}.handoff.lock`);
}

async function ensureTasksDir(projectRoot) {
  const dir = tasksDir(projectRoot);
  // existsSync is fine for a quick check, but mkdir with recursive: true is safe to call anyway
  await mkdir(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// Input Validation and Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize text content to prevent injection attacks.
 * @param {string} text - Input text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';

  // Check for dangerous content before stripping
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(text)) {
      return ''; // Reject dangerous content entirely
    }
  }

  // Remove HTML tags and clean up
  return text
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .trim();
}

/**
 * Validate context object size and structure.
 * @param {object} context - Context object to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateContext(context) {
  if (!context || typeof context !== 'object') {
    return { valid: true }; // Empty or null context is fine
  }

  try {
    const serialized = JSON.stringify(context);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_CONTEXT_SIZE) {
      return {
        valid: false,
        error: `Context object too large (max ${MAX_CONTEXT_SIZE} bytes)`,
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: 'Context object contains non-serializable data',
    };
  }

  return { valid: true };
}

/**
 * Acquire a per-task handoff lock, run callback, release in finally.
 * Uses O_EXCL file creation for atomicity. Returns null if lock could not be acquired.
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T|null>}
 */
async function withHandoffLock(projectRoot, taskId, fn) {
  await ensureTasksDir(projectRoot);
  const lockPath = handoffLockPath(projectRoot, taskId);
  let fd;
  let acquiredLock = false;
  try {
    fd = await open(lockPath, 'wx');
    acquiredLock = true;
    await fd.close();
    fd = null;
    return await fn();
  } catch (err) {
    if (err?.code === 'EEXIST') {
      return null;
    }
    throw err;
  } finally {
    if (fd != null) {
      try {
        await fd.close();
      } catch {
        /* ignore */
      }
    }
    if (acquiredLock) {
      try {
        await unlink(lockPath).catch(() => {});
      } catch {
        /* ignore cleanup */
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a fixed 6-character random suffix (hex) for collision resistance.
 * Uses globalThis.crypto.getRandomValues (Web Crypto) for reliable length; Buffer.from converts the 3-byte Uint8Array to a 6-character hex string.
 * @returns {string}
 */
function generateRandomSuffix() {
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
    throw new Error(
      'AgentKit Forge Node engine requires Node.js >= 22 with Web Crypto API available (globalThis.crypto.getRandomValues).'
    );
  }
  const bytes = new Uint8Array(3);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}

/**
 * Generate a unique task ID using timestamp + random approach.
 * Format: task-YYYYMMDD-HHMMSS-XXXXXX
 * @param {string} projectRoot
 * @returns {Promise<string>}
 */
export async function generateTaskId(projectRoot) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
  const randomSuffix = generateRandomSuffix();

  return `task-${dateStr}-${timeStr}-${randomSuffix}`;
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

async function writeTaskFile(projectRoot, taskId, data) {
  await ensureTasksDir(projectRoot);
  const path = taskPath(projectRoot, taskId);
  const tmpPath = `${path}.${process.pid}.${Date.now()}.${generateRandomSuffix()}.tmp`;

  // Use atomic file creation with O_EXCL to prevent race conditions
  try {
    await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    await rename(tmpPath, path);
  } catch (err) {
    // Clean up temp file on any error
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore cleanup errors */
    }

    if (err?.code === 'EEXIST') {
      // File already exists, this should be rare with our new ID generation
      throw new Error(`Task file already exists: ${taskId}`);
    } else {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new task.
 * @param {string} projectRoot
 * @param {object} taskData
 * @param {string} taskData.title - Human-readable title
 * @param {string} taskData.delegator - Who created the task
 * @param {string[]} taskData.assignees - Teams/agents this task is assigned to
 * @param {string} [taskData.type] - One of TASK_TYPES (default 'implement')
 * @param {string} [taskData.priority] - One of TASK_PRIORITIES (default P2)
 * @param {string} [taskData.area] - One of TASK_AREAS (e.g. 'backend', 'security')
 * @param {string} [taskData.severity] - One of TASK_SEVERITIES (e.g. 'critical', 'high')
 * @param {string[]} [taskData.dependsOn] - Task IDs that must complete first
 * @param {string[]} [taskData.handoffTo] - Teams to auto-delegate to on completion
 * @param {string} [taskData.handoffContext] - Context for the handoff
 * @param {object} [taskData.context] - Additional context (backlogItemId, relatedFiles, etc.)
 * @returns {Promise<{ task: object, error?: string }>}
 */
export async function createTask(projectRoot, taskData) {
  // Validate required fields
  if (!taskData.title || typeof taskData.title !== 'string') {
    return { task: null, error: 'Task title is required' };
  }
  if (taskData.title.length > MAX_TITLE_LENGTH) {
    return {
      task: null,
      error: `Task title too long (max ${MAX_TITLE_LENGTH} characters)`,
    };
  }
  if (!taskData.delegator || typeof taskData.delegator !== 'string') {
    return { task: null, error: 'Task delegator is required' };
  }
  if (!Array.isArray(taskData.assignees) || taskData.assignees.length === 0) {
    return { task: null, error: 'At least one assignee is required' };
  }

  // Validate and sanitize context
  const contextValidation = validateContext(taskData.context);
  if (!contextValidation.valid) {
    return { task: null, error: contextValidation.error };
  }

  // Sanitize text fields
  const sanitizedTitle = sanitizeText(taskData.title);
  const sanitizedDescription = sanitizeText(taskData.description || '');

  if (!sanitizedTitle) {
    return { task: null, error: 'Task title contains invalid content' };
  }

  if (taskData.type && !TASK_TYPES.includes(taskData.type)) {
    return {
      task: null,
      error: `Invalid task type: ${taskData.type}. Valid: ${TASK_TYPES.join(', ')}`,
    };
  }
  if (taskData.priority && !TASK_PRIORITIES.includes(taskData.priority)) {
    return {
      task: null,
      error: `Invalid priority: ${taskData.priority}. Valid: ${TASK_PRIORITIES.join(', ')}`,
    };
  }
  if (taskData.area && !TASK_AREAS.includes(taskData.area)) {
    return {
      task: null,
      error: `Invalid area: ${taskData.area}. Valid: ${TASK_AREAS.join(', ')}`,
    };
  }
  if (taskData.severity && !TASK_SEVERITIES.includes(taskData.severity)) {
    return {
      task: null,
      error: `Invalid severity: ${taskData.severity}. Valid: ${TASK_SEVERITIES.join(', ')}`,
    };
  }

  // Validate dependsOn references exist and are in valid states
  if (Array.isArray(taskData.dependsOn)) {
    for (const depId of taskData.dependsOn) {
      if (!TASK_ID_PATH_PATTERN.test(depId)) {
        return { task: null, error: `Invalid dependency task ID: ${depId}` };
      }
      if (!existsSync(taskPath(projectRoot, depId))) {
        return { task: null, error: `Dependency task not found: ${depId}` };
      }

      // Check if dependency is in a terminal state (completed, failed, rejected, canceled)
      const depTask = await getTask(projectRoot, depId);
      if (depTask.task) {
        const depStatus = depTask.task.status;
        if (TERMINAL_STATES.includes(depStatus)) {
          return {
            task: null,
            error: `Cannot depend on task in terminal state: ${depId} (status: ${depStatus})`,
          };
        }
      }
    }
  }

  const now = new Date().toISOString();
  const taskId = await generateTaskId(projectRoot);

  const task = {
    id: taskId,
    type: taskData.type || 'implement',
    status: 'submitted',
    priority: taskData.priority || 'P2',
    area: taskData.area || null,
    severity: taskData.severity || null,
    createdAt: now,
    updatedAt: now,

    delegator: taskData.delegator,
    assignees: taskData.assignees,
    dependsOn: taskData.dependsOn || [],
    blockedBy: [],

    title: sanitizedTitle,
    description: sanitizedDescription,
    acceptanceCriteria: taskData.acceptanceCriteria || [],
    scope: taskData.scope || [],
    context: taskData.context || {},

    messages: [
      {
        role: 'delegator',
        from: taskData.delegator,
        timestamp: now,
        content: sanitizedDescription || sanitizedTitle,
      },
    ],

    artifacts: [],

    handoffTo: taskData.handoffTo || [],
    handoffContext: taskData.handoffContext || '',
  };

  // Check if blocked by incomplete dependencies
  if (task.dependsOn.length > 0) {
    const blockers = new Set();
    for (const depId of task.dependsOn) {
      const dep = await getTask(projectRoot, depId);
      if (!dep.task) continue;
      const depStatus = dep.task.status;
      // Only block on non-completed tasks (terminal states are already validated above)
      if (depStatus !== 'completed') {
        blockers.add(depId);
      }
    }
    task.blockedBy = [...blockers];
  }

  await writeTaskFile(projectRoot, taskId, task);
  return { task };
}

/**
 * Get a task by ID.
 * @param {string} projectRoot
 * @param {string} taskId
 * @returns {Promise<{ task: object|null, error?: string }>}
 */
export async function getTask(projectRoot, taskId) {
  let path;
  try {
    path = taskPath(projectRoot, taskId);
  } catch {
    return { task: null, error: `Invalid task ID: ${taskId}` };
  }

  try {
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return { task: data };
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return { task: null, error: `Task not found: ${taskId}` };
    }
    return { task: null, error: `Failed to parse task ${taskId}: ${err.message}` };
  }
}

/**
 * List tasks with optional filters.
 * @param {string} projectRoot
 * @param {object} [filters]
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.assignee] - Filter by assignee
 * @param {string} [filters.delegator] - Filter by delegator
 * @param {string} [filters.type] - Filter by type
 * @param {string} [filters.priority] - Filter by priority
 * @param {string} [filters.area] - Filter by area
 * @param {string} [filters.severity] - Filter by severity
 * @returns {Promise<{ tasks: object[] }>}
 */
export async function listTasks(projectRoot, filters = {}) {
  const dir = tasksDir(projectRoot);

  try {
    await access(dir);
  } catch (err) {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') {
      return { tasks: [] };
    }
    throw err;
  }

  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'));
  } catch (err) {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') {
      return { tasks: [] };
    }
    throw err;
  }

  const tasks = [];
  let skippedTaskFiles = 0;
  const MAX_READ_CONCURRENCY = 32;

  for (let i = 0; i < files.length; i += MAX_READ_CONCURRENCY) {
    const batch = files.slice(i, i + MAX_READ_CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (file) => {
        try {
          const content = await readFile(resolve(dir, file), 'utf-8');
          return JSON.parse(content);
        } catch (err) {
          skippedTaskFiles++;
          if (process.env.AGENTKIT_DEBUG) {
            console.warn(`[agentkit:task] Skipped unreadable task file: ${file} — ${err?.message}`);
          }
          return null;
        }
      })
    );

    for (const data of results) {
      if (!data) continue;

      if (filters.status && data.status !== filters.status) continue;
      if (
        filters.assignee &&
        !(Array.isArray(data.assignees) && data.assignees.includes(filters.assignee))
      )
        continue;
      if (filters.delegator && data.delegator !== filters.delegator) continue;
      if (filters.type && data.type !== filters.type) continue;
      if (filters.priority && data.priority !== filters.priority) continue;
      if (filters.area && data.area !== filters.area) continue;
      if (filters.severity && data.severity !== filters.severity) continue;

      tasks.push(data);
    }
  }

  // Sort by priority (P0 first), then by creation date (newest first)
  tasks.sort((a, b) => {
    const paRaw = TASK_PRIORITIES.indexOf(a.priority);
    const pbRaw = TASK_PRIORITIES.indexOf(b.priority);
    const pa = paRaw === -1 ? Number.POSITIVE_INFINITY : paRaw;
    const pb = pbRaw === -1 ? Number.POSITIVE_INFINITY : pbRaw;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return { tasks, skippedTaskFiles };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/** Valid state transitions map. */
const VALID_TRANSITIONS = {
  submitted: ['accepted', 'rejected', 'canceled'],
  accepted: ['working', 'rejected', 'canceled'],
  working: ['completed', 'failed', 'input-required', 'canceled'],
  'input-required': ['working', 'canceled'],
  completed: [],
  failed: [],
  rejected: [],
  canceled: [],
};

/**
 * Update a task's status.
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} newStatus - One of TASK_STATES
 * @param {object} [messageData] - Optional message data to add with status change
 * @param {string} [messageData.role] - Message role (default: 'executor')
 * @param {string} [messageData.from] - Message sender (default: 'unknown')
 * @param {string} [messageData.content] - Optional message content
 * @returns {Promise<{ task: object|null, error?: string }>}
 */
export async function updateTaskStatus(projectRoot, taskId, newStatus, messageData = {}) {
  const result = await getTask(projectRoot, taskId);
  if (!result.task) return result;

  const task = result.task;

  if (!TASK_STATES.includes(newStatus)) {
    return { task: null, error: `Invalid status: ${newStatus}. Valid: ${TASK_STATES.join(', ')}` };
  }

  const allowed = VALID_TRANSITIONS[task.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return {
      task: null,
      error: `Invalid transition: ${task.status} → ${newStatus}. Allowed: ${(allowed || []).join(', ') || 'none (terminal state)'}`,
    };
  }

  if (messageData.role && !MESSAGE_ROLES.includes(messageData.role)) {
    return {
      task: null,
      error: `Invalid message role: ${messageData.role}. Valid: ${MESSAGE_ROLES.join(', ')}`,
    };
  }

  const now = new Date().toISOString();
  task.status = newStatus;
  task.updatedAt = now;

  // Add status change message
  if (!Array.isArray(task.messages)) task.messages = [];
  if (messageData.from || messageData.content) {
    task.messages.push({
      role: messageData.role || 'executor',
      from: messageData.from || 'unknown',
      timestamp: now,
      content: messageData.content || `Status changed to ${newStatus}`,
      statusChange: newStatus,
    });
  }

  await writeTaskFile(projectRoot, taskId, task);
  return { task };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * Add a message to a task.
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {object} message
 * @param {string} message.role - 'delegator' or 'executor'
 * @param {string} message.from - Who sent the message
 * @param {string} message.content - Message content
 * @returns {Promise<{ task: object|null, error?: string }>}
 */
export async function addTaskMessage(projectRoot, taskId, message) {
  const result = await getTask(projectRoot, taskId);
  if (!result.task) return result;

  if (!MESSAGE_ROLES.includes(message.role)) {
    return {
      task: null,
      error: `Invalid message role: ${message.role}. Valid: ${MESSAGE_ROLES.join(', ')}`,
    };
  }

  if (typeof message.from !== 'string' || message.from.trim() === '') {
    return { task: null, error: 'Invalid message.from: must be a non-empty string' };
  }

  if (typeof message.content !== 'string' || message.content.trim() === '') {
    return { task: null, error: 'Invalid message.content: must be a non-empty string' };
  }

  const task = result.task;

  if (TERMINAL_STATES.includes(task.status)) {
    return { task: null, error: `Cannot add messages to task in terminal state: ${task.status}` };
  }

  const now = new Date().toISOString();
  if (!Array.isArray(task.messages)) task.messages = [];
  task.messages.push({
    role: message.role,
    from: message.from,
    timestamp: now,
    content: message.content,
  });
  task.updatedAt = now;

  await writeTaskFile(projectRoot, taskId, task);
  return { task };
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

/**
 * Add an artifact to a task.
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {object} artifact
 * @param {string} artifact.type - One of ARTIFACT_TYPES
 * @param {string[]} [artifact.paths] - File paths (for files-changed)
 * @param {string} [artifact.summary] - Summary of the artifact
 * @param {number} [artifact.passed] - Tests passed (for test-results)
 * @param {number} [artifact.failed] - Tests failed (for test-results)
 * @param {number} [artifact.added] - Tests added (for test-results)
 * @returns {Promise<{ task: object|null, error?: string }>}
 */
export async function addTaskArtifact(projectRoot, taskId, artifact) {
  const result = await getTask(projectRoot, taskId);
  if (!result.task) return result;

  if (!ARTIFACT_TYPES.includes(artifact.type)) {
    return {
      task: null,
      error: `Invalid artifact type: ${artifact.type}. Valid: ${ARTIFACT_TYPES.join(', ')}`,
    };
  }

  const task = result.task;
  if (TERMINAL_STATES.includes(task.status)) {
    return { task: null, error: `Cannot add artifacts to task in terminal state: ${task.status}` };
  }
  if (!Array.isArray(task.artifacts)) task.artifacts = [];
  const now = new Date().toISOString();
  task.artifacts.push({
    ...artifact,
    addedAt: now,
  });
  task.updatedAt = now;

  await writeTaskFile(projectRoot, taskId, task);
  return { task };
}

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

/**
 * Check all tasks and unblock those whose dependencies have completed.
 * @param {string} projectRoot
 * @returns {Promise<{ unblocked: string[], errors: string[] }>}
 */
export async function checkDependencies(projectRoot) {
  const { tasks } = await listTasks(projectRoot);
  const unblocked = [];
  const errors = [];
  const { errors: cycleErrors, cycleTaskIds } = detectDependencyCycles(tasks);

  const tasksToProcess = tasks.filter((task) => !cycleTaskIds.has(task.id));

  for (const task of tasksToProcess) {
    if (TERMINAL_STATES.includes(task.status)) continue;
    if (!Array.isArray(task.dependsOn) || task.dependsOn.length === 0) continue;

    const newBlockers = [];
    let hasInProgressDep = false;
    let hasCanceledDep = false;

    for (const depId of task.dependsOn) {
      const dep = await getTask(projectRoot, depId);
      if (!dep.task) {
        errors.push(`Task ${task.id}: dependency ${depId} not found`);
        continue;
      }
      if (dep.task.status === 'completed') {
        // Dependency satisfied — don't add to blockers
      } else if (['failed', 'rejected', 'canceled'].includes(dep.task.status)) {
        hasCanceledDep = true;
        newBlockers.push(depId);
      } else {
        hasInProgressDep = true;
        newBlockers.push(depId);
      }
    }

    const priorBlockers = Array.isArray(task.blockedBy) ? task.blockedBy : [];
    const priorStatus = task.status;
    const wasBlocked = priorBlockers.length > 0;
    task.blockedBy = newBlockers;
    if (newBlockers.length > 0 && !hasInProgressDep && hasCanceledDep) {
      task.blockedReason = 'canceled';
      task.status = 'BLOCKED_ON_CANCELED';
    } else if (
      task.status === 'BLOCKED_ON_CANCELED' &&
      (newBlockers.length === 0 || hasInProgressDep)
    ) {
      delete task.blockedReason;
      task.status = 'submitted';
    }
    const blockersChanged = JSON.stringify(priorBlockers) !== JSON.stringify(newBlockers);
    const statusChanged = task.status !== priorStatus;
    if (blockersChanged || statusChanged) {
      task.updatedAt = new Date().toISOString();
      await writeTaskFile(projectRoot, task.id, task);
    }

    if (wasBlocked && newBlockers.length === 0 && !hasCanceledDep) {
      unblocked.push(task.id);
    }
  }

  return { unblocked, errors: [...errors, ...cycleErrors] };
}

function detectDependencyCycles(tasks) {
  const taskById = new Map();
  for (const task of tasks) {
    if (task?.id) taskById.set(task.id, task);
  }

  const visiting = new Set();
  const visited = new Set();
  const path = [];
  const errors = [];
  const cycleTaskIds = new Set();

  function walk(taskId) {
    if (visiting.has(taskId)) {
      const start = path.indexOf(taskId);
      const cycle = [...path.slice(start), taskId];
      errors.push(`Dependency cycle detected: ${cycle.join(' -> ')}`);
      for (const id of cycle) {
        cycleTaskIds.add(id);
      }
      return;
    }
    if (visited.has(taskId)) return;

    visiting.add(taskId);
    path.push(taskId);

    const task = taskById.get(taskId);
    const deps = Array.isArray(task?.dependsOn) ? task.dependsOn : [];
    for (const depId of deps) {
      if (!taskById.has(depId)) continue;
      walk(depId);
    }

    path.pop();
    visiting.delete(taskId);
    visited.add(taskId);
  }

  for (const taskId of taskById.keys()) {
    walk(taskId);
  }

  return { errors, cycleTaskIds };
}

// ---------------------------------------------------------------------------
// Handoff processing
// ---------------------------------------------------------------------------

/**
 * Process completed tasks with handoffTo and create follow-up tasks.
 * @param {string} projectRoot
 * @param {string} [delegator] - Who to attribute the new tasks to (default: 'orchestrator')
 * @returns {Promise<{ created: object[], errors: string[] }>}
 */
export async function processHandoffs(projectRoot, delegator = 'orchestrator') {
  const { tasks } = await listTasks(projectRoot, { status: 'completed' });
  const created = [];
  const errors = [];
  const { tasks: allTasks } = await listTasks(projectRoot);

  for (const task of tasks) {
    if (!Array.isArray(task.handoffTo) || task.handoffTo.length === 0) continue;

    const result = await withHandoffLock(projectRoot, task.id, async () => {
      const fresh = await getTask(projectRoot, task.id);
      if (!fresh.task) return { created: [], errors: [] };
      const t = fresh.task;
      if (!Array.isArray(t._handoffProcessedTargets)) {
        t._handoffProcessedTargets = [];
      }

      const localCreated = [];
      const localErrors = [];

      for (const targetTeam of t.handoffTo) {
        if (t._handoffProcessedTargets.includes(targetTeam)) continue;

        const existingHandoff = allTasks.find(
          (ot) =>
            ot.id !== t.id &&
            ot.context?.handoffFrom === t.id &&
            Array.isArray(ot.assignees) &&
            ot.assignees.includes(targetTeam)
        );
        if (existingHandoff) {
          t._handoffProcessedTargets.push(targetTeam);
          t.updatedAt = new Date().toISOString();
          await writeTaskFile(projectRoot, t.id, t);
          continue;
        }

        const createResult = await createTask(projectRoot, {
          type: t.type || 'implement',
          delegator,
          assignees: [targetTeam],
          title: `[Handoff] ${t.title}`,
          description: t.handoffContext || `Continuation of ${t.id}: ${t.title}`,
          priority: t.priority,
          dependsOn: [],
          scope: t.scope,
          context: {
            ...t.context,
            handoffFrom: t.id,
            handoffFromTeam: t.assignees.join(', '),
            previousArtifacts: t.artifacts,
          },
        });

        if (createResult.error) {
          localErrors.push(
            `Failed to create handoff task for ${targetTeam}: ${createResult.error}`
          );
        } else {
          localCreated.push(createResult.task);
          t._handoffProcessedTargets.push(targetTeam);
          t.updatedAt = new Date().toISOString();
          await writeTaskFile(projectRoot, t.id, t);
        }
      }

      if (t._handoffProcessedTargets.length === t.handoffTo.length) {
        t._handoffProcessed = true;
        t.updatedAt = new Date().toISOString();
        await writeTaskFile(projectRoot, t.id, t);
      }

      return { created: localCreated, errors: localErrors };
    });

    if (result) {
      created.push(...result.created);
      errors.push(...result.errors);
    }
  }

  return { created, errors };
}

// ---------------------------------------------------------------------------
// Summary / display helpers
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable task summary.
 * @param {object} task
 * @returns {string}
 */
export function formatTaskSummary(task) {
  const safeTask = task && typeof task === 'object' ? task : {};
  const safeAssignees = Array.isArray(safeTask.assignees) ? safeTask.assignees : [];
  const safeDependsOn = Array.isArray(safeTask.dependsOn) ? safeTask.dependsOn : [];
  const safeBlockedBy = Array.isArray(safeTask.blockedBy) ? safeTask.blockedBy : [];
  const safeHandoffTo = Array.isArray(safeTask.handoffTo) ? safeTask.handoffTo : [];
  const safeArtifacts = Array.isArray(safeTask.artifacts) ? safeTask.artifacts : [];
  const safeMessages = Array.isArray(safeTask.messages) ? safeTask.messages : [];
  const lines = [
    `Task: ${safeTask.id || 'unknown'}`,
    `Title: ${safeTask.title || '(untitled)'}`,
    `Type: ${safeTask.type || 'unknown'} | Priority: ${safeTask.priority || 'unknown'} | Status: ${safeTask.status || 'unknown'}`,
    safeTask.area ? `Area: ${safeTask.area}` : null,
    safeTask.severity ? `Severity: ${safeTask.severity}` : null,
    `Delegator: ${safeTask.delegator || 'unknown'} → Assignees: ${safeAssignees.join(', ')}`,
  ];

  if (safeDependsOn.length > 0) {
    lines.push(`Depends on: ${safeDependsOn.join(', ')}`);
  }
  if (safeBlockedBy.length > 0) {
    lines.push(`Blocked by: ${safeBlockedBy.join(', ')}`);
  }
  if (safeHandoffTo.length > 0) {
    lines.push(`Handoff to: ${safeHandoffTo.join(', ')}`);
  }
  if (safeArtifacts.length > 0) {
    lines.push(`Artifacts: ${safeArtifacts.length}`);
  }

  lines.push(`Created: ${safeTask.createdAt || 'unknown'}`);
  lines.push(`Updated: ${safeTask.updatedAt || 'unknown'}`);
  lines.push(`Messages: ${safeMessages.length}`);

  return lines.filter(Boolean).join('\n');
}

/**
 * Generate a markdown-formatted task list.
 * @param {object[]} tasks
 * @returns {string}
 */
export function formatTaskList(tasks) {
  if (tasks.length === 0) return 'No tasks found.';

  const escapeCell = (value) =>
    String(value ?? '')
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ');

  const statusIcon = {
    submitted: '[SUBMITTED]',
    accepted: '[ACCEPTED]',
    working: '[WORKING]',
    'input-required': '[INPUT-REQUIRED]',
    completed: '[COMPLETED]',
    failed: '[FAILED]',
    rejected: '[REJECTED]',
    canceled: '[CANCELED]',
  };

  const lines = [
    '| ID | Priority | Status | Type | Title | Assignees |',
    '|----|----------|--------|------|-------|-----------|',
  ];

  for (const task of tasks) {
    const icon = statusIcon[task?.status] || '?';
    const assignees = Array.isArray(task?.assignees) ? task.assignees.join(', ') : '';
    lines.push(
      `| ${escapeCell(task?.id)} | ${escapeCell(task?.priority)} | ${escapeCell(`${icon} ${task?.status || 'unknown'}`)} | ${escapeCell(task?.type)} | ${escapeCell(task?.title)} | ${escapeCell(assignees)} |`
    );
  }

  return lines.join('\n');
}
