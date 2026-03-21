/**
 * Retort — Event Emitter
 * Shared event logging helper. All agents and handlers should use this module
 * to write structured JSONL events to .agentkit/state/events.log.
 */
import { existsSync } from 'fs';
import { appendFile, mkdir, readFile } from 'fs/promises';
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
export async function emitEvent(projectRoot, action, data = {}, opts = {}) {
  const dir = eventsDir(projectRoot);
  try {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const event = {
      ...data,
      timestamp: new Date().toISOString(),
      action,
      ...(opts.source ? { source: opts.source } : {}),
    };
    await appendFile(eventsPath(projectRoot), JSON.stringify(event) + '\n', 'utf-8');
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
 * @returns {Promise<object[]>}
 */
export async function readEvents(projectRoot, opts = {}) {
  const { limit = 50, action, source } = opts;
  const path = eventsPath(projectRoot);
  if (!existsSync(path)) return [];

  try {
    const content = await readFile(path, 'utf-8');
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

    if (action) {
      events = events.filter((e) => e.action === action);
    }
    if (source) {
      events = events.filter((e) => e.source === source);
    }

    // Return most recent events first (reverse chronological order)
    return events.slice(-limit).reverse();
  } catch (error) {
    console.warn(`[agentkit:events] Failed to read events: ${error}`);
    return [];
  }
}
