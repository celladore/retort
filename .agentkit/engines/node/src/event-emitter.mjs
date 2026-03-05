/**
 * AgentKit Forge — Event Emitter
 * Shared event logging helper. All agents and handlers should use this module
 * to write structured JSONL events to .agentkit/state/events.log.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function eventsDir(projectRoot) {
  return resolve(projectRoot, '.agentkit', 'state');
}

function eventsPath(projectRoot) {
  return resolve(eventsDir(projectRoot), 'events.log');
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Emit a structured event to the events log.
 * Auto-creates the state directory if missing.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @param {string} action      - Event action identifier (e.g. 'check_completed', 'import_issues')
 * @param {object} [data={}]   - Arbitrary event payload
 * @param {{ source?: string }} [opts={}] - Options. `source` identifies the emitting module.
 */
export function emitEvent(projectRoot, action, data = {}, opts = {}) {
  const dir = eventsDir(projectRoot);
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const event = {
      timestamp: new Date().toISOString(),
      action,
      ...(opts.source ? { source: opts.source } : {}),
      ...data,
    };
    appendFileSync(eventsPath(projectRoot), JSON.stringify(event) + '\n', 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[agentkit:events] Failed to emit '${action}': ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read events from the log with optional filtering.
 *
 * @param {string} projectRoot
 * @param {{ limit?: number, action?: string, source?: string }} [opts={}]
 * @returns {object[]}
 */
export function readEvents(projectRoot, opts = {}) {
  const { limit = 50, action, source } = opts;
  const path = eventsPath(projectRoot);
  if (!existsSync(path)) return [];

  const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
  let events = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (action) {
    events = events.filter((e) => e.action === action);
  }
  if (source) {
    events = events.filter((e) => e.source === source);
  }

  return events.slice(-limit);
}
