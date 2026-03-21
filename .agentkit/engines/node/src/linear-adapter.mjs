/**
 * Retort — Linear Adapter (Stub)
 * Placeholder for Linear issue tracker integration.
 * Implements the same interface as GitHubAdapter.
 */

export class LinearAdapter {
  /** @param {string} projectRoot */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  /**
   * @returns {{ ok: boolean, message?: string }}
   */
  checkAuth() {
    return {
      ok: false,
      message:
        'Linear adapter is not yet implemented. ' +
        'To contribute, implement fetchIssues() using the Linear MCP server, ' +
        'linear CLI, or Linear GraphQL API. ' +
        'See github-adapter.mjs for the expected interface.',
    };
  }

  /**
   * @param {object} _options
   * @returns {never}
   */
  fetchIssues(_options) {
    const auth = this.checkAuth();
    throw new Error(auth.message);
  }
}
