/**
 * AgentKit Forge — GitHub Adapter
 * Fetches issues from GitHub using the `gh` CLI.
 */
import { execFileSync } from 'child_process';

export class GitHubAdapter {
  /** @param {string} projectRoot */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  /**
   * Checks if `gh` CLI is available and authenticated.
   * @returns {{ ok: boolean, message?: string }}
   */
  checkAuth() {
    try {
      execFileSync('gh', ['auth', 'status'], {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return { ok: true };
    } catch (err) {
      const stderr = err.stderr || err.message || '';
      if (stderr.includes('not found') || err.code === 'ENOENT') {
        return {
          ok: false,
          message:
            'gh CLI not found. Install: https://cli.github.com/ then run: gh auth login',
        };
      }
      return {
        ok: false,
        message: `gh not authenticated. Run: gh auth login\n${stderr}`,
      };
    }
  }

  /**
   * Fetches issues from GitHub.
   * @param {object} options
   * @param {string} [options.state='open'] - Issue state filter
   * @param {string|null} [options.labels=null] - Comma-separated label filter
   * @param {string|null} [options.since=null] - ISO date — only issues updated since
   * @param {number} [options.limit=100] - Maximum issues to fetch
   * @returns {object[]} Array of raw GitHub issue objects
   */
  fetchIssues({ state = 'open', labels = null, since = null, limit = 100 } = {}) {
    // Clamp limit to prevent excessive API calls
    limit = Math.min(Math.max(1, Number(limit) || 100), 1000);
    const auth = this.checkAuth();
    if (!auth.ok) {
      throw new Error(auth.message);
    }

    const fields = [
      'number',
      'title',
      'body',
      'state',
      'labels',
      'assignees',
      'milestone',
      'url',
      'createdAt',
      'updatedAt',
      'closedAt',
    ].join(',');

    const args = [
      'issue',
      'list',
      '--json',
      fields,
      '--limit',
      String(limit),
    ];

    args.push('--state', state);

    if (labels) {
      args.push('--label', labels);
    }

    try {
      const stdout = execFileSync('gh', args, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30_000,
      });

      const issues = JSON.parse(stdout);

      // Client-side filter by --since (gh doesn't support this natively on issue list)
      if (since) {
        const sinceDate = new Date(since);
        if (Number.isNaN(sinceDate.getTime())) {
          throw new Error(
            `Invalid "since" value: ${since}. Expected ISO 8601 date, e.g. "2024-01-31T00:00:00Z".`
          );
        }
        return issues.filter((issue) => new Date(issue.updatedAt) >= sinceDate);
      }

      return issues;
    } catch (err) {
      if (err.killed) {
        throw new Error('gh issue list timed out after 30s');
      }
      const stderr = err.stderr || '';
      throw new Error(`Failed to fetch GitHub issues: ${stderr || err.message}`);
    }
  }
}
