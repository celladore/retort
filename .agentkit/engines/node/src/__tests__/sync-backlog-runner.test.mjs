import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// Mock the tracker-adapter
vi.mock('../tracker-adapter.mjs', () => ({
  createAdapter: vi.fn(),
}));

const { createAdapter } = await import('../tracker-adapter.mjs');
const { runSyncBacklog } = await import('../sync-backlog-runner.mjs');

function makeTempDirs() {
  const id = randomBytes(6).toString('hex');
  const projectRoot = resolve(tmpdir(), `agentkit-sync-test-${id}`);
  const agentkitRoot = resolve(projectRoot, '.agentkit');
  const specDir = resolve(agentkitRoot, 'spec');
  const stateDir = resolve(projectRoot, '.claude', 'state');
  mkdirSync(specDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  return { projectRoot, agentkitRoot, specDir, stateDir };
}

function writeProjectYaml(specDir, overrides = {}) {
  const project = {
    name: 'test-project',
    process: {
      issueTracker: 'github',
      intake: {
        autoImport: true,
        importLabelsMap: { bug: 'P1' },
        importStateMap: { open: 'open', closed: 'completed' },
        importTeamMap: {},
        ownerTeam: 'product',
        ...overrides,
      },
    },
  };
  writeFileSync(resolve(specDir, 'project.yaml'), JSON.stringify(project), 'utf-8');
}

describe('runSyncBacklog', () => {
  let dirs;

  beforeEach(() => {
    dirs = makeTempDirs();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dirs.projectRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('syncs with external tracker when autoImport is true', async () => {
    writeProjectYaml(dirs.specDir);
    const mockAdapter = {
      fetchIssues: vi.fn().mockReturnValue([
        { number: 1, title: 'Bug', state: 'open', labels: [{ name: 'bug' }], body: '' },
      ]),
    };
    createAdapter.mockResolvedValue(mockAdapter);

    await runSyncBacklog({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    expect(createAdapter).toHaveBeenCalledWith('github', dirs.projectRoot);
    const jsonPath = resolve(dirs.projectRoot, '.claude', 'state', 'backlog.json');
    expect(existsSync(jsonPath)).toBe(true);
  });

  it('skips tracker when tracker is none', async () => {
    writeProjectYaml(dirs.specDir);
    const project = JSON.parse(readFileSync(resolve(dirs.specDir, 'project.yaml'), 'utf-8'));
    project.process.issueTracker = 'none';
    writeFileSync(resolve(dirs.specDir, 'project.yaml'), JSON.stringify(project), 'utf-8');

    await runSyncBacklog({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    expect(createAdapter).not.toHaveBeenCalled();
  });

  it('collects orchestrator healthcheck items', async () => {
    writeProjectYaml(dirs.specDir);
    const project = JSON.parse(readFileSync(resolve(dirs.specDir, 'project.yaml'), 'utf-8'));
    project.process.issueTracker = 'none';
    writeFileSync(resolve(dirs.specDir, 'project.yaml'), JSON.stringify(project), 'utf-8');

    // Write orchestrator state with risks
    writeFileSync(
      resolve(dirs.stateDir, 'orchestrator.json'),
      JSON.stringify({
        risks: [
          { title: 'Missing tests', description: 'Low coverage', severity: 'high', team: 'testing' },
        ],
      }),
      'utf-8'
    );

    await runSyncBacklog({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    const jsonPath = resolve(dirs.projectRoot, '.claude', 'state', 'backlog.json');
    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    expect(data.items.some((i) => i.title === 'Missing tests')).toBe(true);
    expect(data.items.find((i) => i.title === 'Missing tests').priority).toBe('P1');
  });

  it('forwards since and limit flags to fetchIssues', async () => {
    writeProjectYaml(dirs.specDir);
    const mockAdapter = {
      fetchIssues: vi.fn().mockReturnValue([]),
    };
    createAdapter.mockResolvedValue(mockAdapter);

    await runSyncBacklog({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: { since: '2026-01-01T00:00:00Z', limit: '50' },
    });

    expect(mockAdapter.fetchIssues).toHaveBeenCalledWith(
      expect.objectContaining({
        since: '2026-01-01T00:00:00Z',
        limit: 50,
      })
    );
  });

  it('warns on --direction push', async () => {
    writeProjectYaml(dirs.specDir);
    const project = JSON.parse(readFileSync(resolve(dirs.specDir, 'project.yaml'), 'utf-8'));
    project.process.issueTracker = 'none';
    writeFileSync(resolve(dirs.specDir, 'project.yaml'), JSON.stringify(project), 'utf-8');

    await runSyncBacklog({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: { direction: 'push' },
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('--direction push is not yet implemented')
    );
  });

  it('applies team filter for display only', async () => {
    writeProjectYaml(dirs.specDir);
    const project = JSON.parse(readFileSync(resolve(dirs.specDir, 'project.yaml'), 'utf-8'));
    project.process.issueTracker = 'none';
    writeFileSync(resolve(dirs.specDir, 'project.yaml'), JSON.stringify(project), 'utf-8');

    await runSyncBacklog({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: { team: 'backend' },
    });

    // Team filter is display-only — all items should be persisted
    const jsonPath = resolve(dirs.projectRoot, '.claude', 'state', 'backlog.json');
    expect(existsSync(jsonPath)).toBe(true);
  });

  it('writes events.log entry', async () => {
    writeProjectYaml(dirs.specDir);
    const project = JSON.parse(readFileSync(resolve(dirs.specDir, 'project.yaml'), 'utf-8'));
    project.process.issueTracker = 'none';
    writeFileSync(resolve(dirs.specDir, 'project.yaml'), JSON.stringify(project), 'utf-8');

    await runSyncBacklog({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    const eventsPath = resolve(dirs.stateDir, 'events.log');
    expect(existsSync(eventsPath)).toBe(true);
    const log = readFileSync(eventsPath, 'utf-8');
    expect(log).toContain('[BACKLOG]');
    expect(log).toContain('[SYNC]');
  });
});
