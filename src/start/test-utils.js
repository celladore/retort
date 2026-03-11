/**
 * Shared test utilities for the /start TUI.
 */

import { vi } from 'vitest';

/**
 * Create a RepoContext object with sensible defaults for testing.
 * All flags default to a "brand-new repo" state (nothing initialised).
 *
 * @param {Partial<import('./lib/detect.js').RepoContext>} [overrides]
 * @returns {import('./lib/detect.js').RepoContext}
 */
export function makeCtx(overrides = {}) {
  return {
    forgeInitialised: false,
    syncRun: false,
    discoveryDone: false,
    hasOrchestratorState: false,
    orchestratorPhase: null,
    phaseName: null,
    hasBacklog: false,
    backlogCount: 0,
    activeTaskCount: 0,
    branch: 'main',
    isClean: true,
    uncommittedCount: 0,
    lockHeld: false,
    flow: 'brand-new',
    teams: [],
    ...overrides,
  };
}

/**
 * Wait for an assertion to pass. Uses vi.waitFor for deterministic waits
 * instead of arbitrary setTimeout delays.
 *
 * @param {() => void} assertion - Function containing expect() calls
 * @param {number} [timeout=500] - Max wait time in ms
 */
export async function waitFor(assertion, timeout = 500) {
  return vi.waitFor(assertion, { timeout, interval: 10 });
}
