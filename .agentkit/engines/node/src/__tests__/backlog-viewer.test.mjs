import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { runBacklogViewer } from '../backlog-viewer.mjs';

describe('backlog-viewer', () => {
  let tempDir;
  let consoleSpy;
  let stdoutSpy;

  const sampleBacklog = {
    version: 1,
    lastUpdated: '2026-03-01T00:00:00Z',
    count: 3,
    items: [
      {
        id: 'bi-1',
        externalId: 'GH#1',
        title: 'Fix bug',
        priority: 'P0',
        status: 'open',
        phase: 'Planning',
        team: 'backend',
        source: 'github',
        what: 'Auth fix',
      },
      {
        id: 'bi-2',
        externalId: 'GH#2',
        title: 'Add feature',
        priority: 'P2',
        status: 'open',
        phase: 'Discovery',
        team: 'frontend',
        source: 'github',
        what: 'Dashboard',
      },
      {
        id: 'bi-3',
        externalId: null,
        title: 'Manual task',
        priority: 'P1',
        status: 'open',
        phase: 'Planning',
        team: 'docs',
        source: 'manual',
        what: 'Write docs',
      },
    ],
  };

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'agentkit-viewer-test-'));
    mkdirSync(resolve(tempDir, '.agentkit', 'state'), { recursive: true });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function writeBacklog(items = sampleBacklog) {
    writeFileSync(
      resolve(tempDir, '.agentkit', 'state', 'backlog.json'),
      JSON.stringify(items),
      'utf-8'
    );
  }

  it('displays table format by default', async () => {
    writeBacklog();
    await runBacklogViewer({ projectRoot: tempDir, flags: {} });
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('Priority');
    expect(output).toContain('Fix bug');
    expect(output).toContain('Add feature');
  });

  it('displays JSON format', async () => {
    writeBacklog();
    await runBacklogViewer({ projectRoot: tempDir, flags: { format: 'json' } });
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(3);
  });

  it('displays CSV format', async () => {
    writeBacklog();
    await runBacklogViewer({ projectRoot: tempDir, flags: { format: 'csv' } });
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('id,externalId,title');
    expect(output).toContain('Fix bug');
  });

  it('displays YAML format', async () => {
    writeBacklog();
    await runBacklogViewer({ projectRoot: tempDir, flags: { format: 'yaml' } });
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('title: Fix bug');
  });

  it('filters by team', async () => {
    writeBacklog();
    await runBacklogViewer({ projectRoot: tempDir, flags: { team: 'backend' } });
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('Fix bug');
    expect(output).not.toContain('Add feature');
    expect(output).not.toContain('Manual task');
  });

  it('filters by priority', async () => {
    writeBacklog();
    await runBacklogViewer({ projectRoot: tempDir, flags: { priority: 'P0' } });
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('Fix bug');
    expect(output).not.toContain('Manual task');
  });

  it('sorts by team', async () => {
    writeBacklog();
    await runBacklogViewer({ projectRoot: tempDir, flags: { format: 'json', sort: 'team' } });
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    const parsed = JSON.parse(output);
    expect(parsed[0].team).toBe('backend');
    expect(parsed[1].team).toBe('docs');
    expect(parsed[2].team).toBe('frontend');
  });

  it('shows "No backlog items" for empty backlog', async () => {
    writeBacklog({ version: 1, count: 0, items: [] });
    await runBacklogViewer({ projectRoot: tempDir, flags: {} });
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('No backlog items found');
  });

  it('handles missing JSON store gracefully', async () => {
    await runBacklogViewer({ projectRoot: tempDir, flags: {} });
    const output = stdoutSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('No backlog items found');
  });
});
