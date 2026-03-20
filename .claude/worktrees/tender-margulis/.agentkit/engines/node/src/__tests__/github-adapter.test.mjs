import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process to avoid needing the real gh CLI
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

const { execFileSync } = await import('child_process');
const { GitHubAdapter } = await import('../github-adapter.mjs');

/** Helper to set up the standard auth + issue list mocks */
function setupFetchMocks(issues = []) {
  execFileSync
    .mockReset()
    .mockReturnValueOnce('') // auth check
    .mockReturnValueOnce(JSON.stringify(issues));
}

describe('GitHubAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new GitHubAdapter('/fake/project');
    execFileSync.mockReset();
  });

  describe('checkAuth', () => {
    it('returns ok when gh auth status succeeds', () => {
      execFileSync.mockReturnValue('');
      const result = adapter.checkAuth();
      expect(result.ok).toBe(true);
    });

    it('returns not-found message when gh is missing', () => {
      const err = new Error('not found');
      err.code = 'ENOENT';
      execFileSync.mockImplementation(() => {
        throw err;
      });
      const result = adapter.checkAuth();
      expect(result.ok).toBe(false);
      expect(result.message).toContain('gh CLI not found');
    });

    it('returns auth message when not authenticated', () => {
      const err = new Error('auth failed');
      err.stderr = 'You are not logged in';
      execFileSync.mockImplementation(() => {
        throw err;
      });
      const result = adapter.checkAuth();
      expect(result.ok).toBe(false);
      expect(result.message).toContain('gh not authenticated');
    });
  });

  describe('fetchIssues', () => {
    const sampleIssues = [
      { number: 1, title: 'Bug', state: 'open', labels: [], updatedAt: '2026-03-01T00:00:00Z' },
      { number: 2, title: 'Feature', state: 'open', labels: [], updatedAt: '2026-02-01T00:00:00Z' },
    ];

    it('returns parsed issues from gh CLI', () => {
      setupFetchMocks(sampleIssues);
      const issues = adapter.fetchIssues({ state: 'open' });
      expect(issues).toHaveLength(2);
      expect(issues[0].title).toBe('Bug');
    });

    it('validates state parameter', () => {
      expect(() => adapter.fetchIssues({ state: 'invalid' })).toThrow('Invalid state');
    });

    it('validates labels parameter type', () => {
      setupFetchMocks(sampleIssues);
      expect(() => adapter.fetchIssues({ labels: 123 })).toThrow('labels must be a string');
    });

    it('clamps limit to valid range', () => {
      setupFetchMocks(sampleIssues);
      adapter.fetchIssues({ limit: 5000 });
      // Second execFileSync call (issue list) should have --limit 1000
      const args = execFileSync.mock.calls[1][1];
      const limitIdx = args.indexOf('--limit');
      expect(args[limitIdx + 1]).toBe('1000');
    });

    it('passes --label flag when labels provided', () => {
      setupFetchMocks([]);
      adapter.fetchIssues({ labels: 'bug,feature' });
      const args = execFileSync.mock.calls[1][1];
      expect(args).toContain('--label');
      expect(args).toContain('bug,feature');
    });

    it('filters by since date client-side', () => {
      setupFetchMocks(sampleIssues);
      const issues = adapter.fetchIssues({ since: '2026-02-15T00:00:00Z' });
      expect(issues).toHaveLength(1);
      expect(issues[0].title).toBe('Bug');
    });

    it('throws on invalid since date', () => {
      setupFetchMocks(sampleIssues);
      expect(() => adapter.fetchIssues({ since: 'not-a-date' })).toThrow('Invalid "since" value');
    });

    it('throws on non-array response', () => {
      execFileSync
        .mockReset()
        .mockReturnValueOnce('') // auth
        .mockReturnValueOnce('{"error": "bad"}');
      expect(() => adapter.fetchIssues()).toThrow('expected JSON array');
    });

    it('detects timeout via err.signal', () => {
      let callCount = 0;
      execFileSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return ''; // auth check
        const err = new Error('timed out');
        err.signal = 'SIGTERM';
        throw err;
      });
      expect(() => adapter.fetchIssues()).toThrow('timed out after 30s');
    });

    it('detects timeout via err.killed', () => {
      let callCount = 0;
      execFileSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return ''; // auth check
        const err = new Error('killed');
        err.killed = true;
        throw err;
      });
      expect(() => adapter.fetchIssues()).toThrow('timed out after 30s');
    });
  });
});
