/**
 * AgentKit Forge — Tracker Adapter Factory
 * Creates the appropriate adapter for the configured issue tracker.
 */

/**
 * Creates a tracker adapter for the given tracker type.
 * @param {string} tracker - Tracker type: 'github' or 'linear'
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<{ fetchIssues: Function }>}
 */
export async function createAdapter(tracker, projectRoot) {
  switch (tracker) {
    case 'github': {
      const { GitHubAdapter } = await import('./github-adapter.mjs');
      return new GitHubAdapter(projectRoot);
    }
    case 'linear': {
      const { LinearAdapter } = await import('./linear-adapter.mjs');
      return new LinearAdapter(projectRoot);
    }
    default:
      throw new Error(`Unsupported tracker: "${tracker}". Supported: github, linear`);
  }
}
