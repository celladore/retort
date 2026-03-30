/**
 * Shared test utilities for the /start TUI.
 */

import { vi } from 'vitest';
import type { RepoContext } from './lib/detect.js';

/**
 * Create a RepoContext object with sensible defaults for testing.
 * All flags default to a "brand-new repo" state (nothing initialised).
 */
export function makeCtx(overrides: Partial<RepoContext> = {}): RepoContext {
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
 * @param assertion - Function containing expect() calls
 * @param timeout - Max wait time in ms
 */
export async function waitFor(assertion: () => void, timeout = 500): Promise<void> {
  return vi.waitFor(assertion, { timeout, interval: 10 });
}
