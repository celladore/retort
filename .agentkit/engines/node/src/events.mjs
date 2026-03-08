/**
 * AgentKit Forge — Event Logging Compatibility Adapter
 * Wraps event-emitter.mjs to preserve legacy appendEvent/readEvents signatures.
 * New code should import from event-emitter.mjs directly.
 */
import { emitEvent, readEvents as readEventsCanonical } from './event-emitter.mjs';

/**
 * Legacy compatibility wrapper for emitEvent.
 * @param {string} projectRoot
 * @param {string} action - What happened (e.g. 'phase_advanced', 'check_completed')
 * @param {object} data - Event data
 */
export async function appendEvent(projectRoot, action, data = {}) {
  // Legacy appendEvent is async but does not support source metadata.
  // Forward to emitEvent without source to preserve existing behavior.
  await emitEvent(projectRoot, action, data);
}

/**
 * Legacy compatibility wrapper for readEvents.
 * @param {string} projectRoot
 * @param {number} limit - Max events to return (default 20)
 * @returns {object[]}
 */
export function readEvents(projectRoot, limit = 20) {
  // Legacy readEvents takes a numeric limit; forward to canonical with options object.
  return readEventsCanonical(projectRoot, { limit });
}
