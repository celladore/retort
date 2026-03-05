import { describe, it, expect, vi } from 'vitest';

// Mock the adapter modules — use class syntax so `new` works
vi.mock('../github-adapter.mjs', () => ({
  GitHubAdapter: class MockGitHubAdapter {
    constructor() {
      this.fetchIssues = vi.fn().mockReturnValue([]);
      this.checkAuth = vi.fn().mockReturnValue({ ok: true });
    }
  },
}));

vi.mock('../linear-adapter.mjs', () => ({
  LinearAdapter: class MockLinearAdapter {
    constructor() {
      this.fetchIssues = vi.fn().mockReturnValue([]);
    }
  },
}));

const { createAdapter } = await import('../tracker-adapter.mjs');

describe('createAdapter', () => {
  it('creates a GitHubAdapter for "github" tracker', async () => {
    const adapter = await createAdapter('github', '/fake/root');
    expect(adapter).toBeDefined();
    expect(adapter.fetchIssues).toBeDefined();
  });

  it('creates a LinearAdapter for "linear" tracker', async () => {
    const adapter = await createAdapter('linear', '/fake/root');
    expect(adapter).toBeDefined();
    expect(adapter.fetchIssues).toBeDefined();
  });

  it('throws for unsupported tracker type', async () => {
    await expect(createAdapter('jira', '/fake/root')).rejects.toThrow('Unsupported tracker');
    await expect(createAdapter('jira', '/fake/root')).rejects.toThrow('jira');
  });

  it('throws for empty tracker', async () => {
    await expect(createAdapter('', '/fake/root')).rejects.toThrow('Unsupported tracker');
  });
});
