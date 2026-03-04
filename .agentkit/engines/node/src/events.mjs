/**
 * AgentKit Forge — Event Logging
 * Extracted from orchestrator.mjs to break circular imports.
 * (orchestrator.mjs ↔ agent-integration.mjs both need appendEvent)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

function stateDir(projectRoot) {
  return resolve(projectRoot, '.claude', 'state');
}

function eventsPath(projectRoot) {
  return resolve(stateDir(projectRoot), 'events.log');
}

/**
 * Append an event to the events log.
 * @param {string} projectRoot
 * @param {string} action - What happened (e.g. 'phase_advanced', 'check_completed')
 * @param {object} data - Event data
 */
export function appendEvent(projectRoot, action, data = {}) {
  const dir = stateDir(projectRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const event = {
    timestamp: new Date().toISOString(),
    action,
    ...data,
  };
  appendFileSync(eventsPath(projectRoot), JSON.stringify(event) + '\n', 'utf-8');
}

/**
 * Read recent events from the log.
 * @param {string} projectRoot
 * @param {number} limit - Max events to return (default 20)
 * @returns {object[]}
 */
export function readEvents(projectRoot, limit = 20) {
  const path = eventsPath(projectRoot);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
  const events = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return events.slice(-limit);
}
