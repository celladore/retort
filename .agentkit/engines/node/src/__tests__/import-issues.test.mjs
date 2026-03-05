import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// Create isolated temp dirs for each test
function makeTempDirs() {
  const id = randomBytes(6).toString('hex');
  const projectRoot = resolve(tmpdir(), `agentkit-import-test-${id}`);
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
        importLabelsMap: { bug: 'P1', critical: 'P0', enhancement: 'P2' },
        importStateMap: { open: 'open', closed: 'completed' },
        importTeamMap: { backend: 'backend', frontend: 'frontend' },
        ownerTeam: 'product',
        ...overrides,
      },
    },
  };
  // js-yaml is available via the project deps
  writeFileSync(resolve(specDir, 'project.yaml'), JSON.stringify(project), 'utf-8');
}

// Mock the tracker-adapter to avoid needing gh CLI
vi.mock('../tracker-adapter.mjs', () => ({
  createAdapter: vi.fn(),
}));

const { createAdapter } = await import('../tracker-adapter.mjs');
const { runImportIssues } = await import('../import-issues.mjs');

describe('runImportIssues', () => {
  let dirs;

  beforeEach(() => {
    dirs = makeTempDirs();
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(dirs.projectRoot, { recursive: true, force: true });
  });

  it('skips import when autoImport is false and --force not set', async () => {
    writeProjectYaml(dirs.specDir, { autoImport: false });
    const result = await runImportIssues({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });
    expect(result.imported).toBe(0);
    expect(createAdapter).not.toHaveBeenCalled();
  });

  it('imports when --force is set even with autoImport false', async () => {
    writeProjectYaml(dirs.specDir, { autoImport: false });
    const mockAdapter = {
      fetchIssues: vi.fn().mockReturnValue([
        { number: 1, title: 'Test bug', state: 'open', labels: [{ name: 'bug' }], body: '' },
      ]),
    };
    createAdapter.mockResolvedValue(mockAdapter);

    const result = await runImportIssues({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: { force: true },
    });

    expect(result.imported).toBe(1);
    expect(createAdapter).toHaveBeenCalledWith('github', dirs.projectRoot);
  });

  it('writes both JSON and markdown stores', async () => {
    writeProjectYaml(dirs.specDir);
    const mockAdapter = {
      fetchIssues: vi.fn().mockReturnValue([
        { number: 10, title: 'Fix auth', state: 'open', labels: [{ name: 'bug' }], body: '' },
        { number: 11, title: 'Add feature', state: 'open', labels: [{ name: 'enhancement' }], body: '' },
      ]),
    };
    createAdapter.mockResolvedValue(mockAdapter);

    await runImportIssues({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    const jsonPath = resolve(dirs.projectRoot, '.claude', 'state', 'backlog.json');
    expect(existsSync(jsonPath)).toBe(true);
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    expect(jsonData.items).toHaveLength(2);

    const mdPath = resolve(dirs.projectRoot, 'AGENT_BACKLOG.md');
    expect(existsSync(mdPath)).toBe(true);
    const md = readFileSync(mdPath, 'utf-8');
    expect(md).toContain('Fix auth');
    expect(md).toContain('Add feature');
  });

  it('appends to events.log', async () => {
    writeProjectYaml(dirs.specDir);
    const mockAdapter = {
      fetchIssues: vi.fn().mockReturnValue([
        { number: 1, title: 'Bug', state: 'open', labels: [], body: '' },
      ]),
    };
    createAdapter.mockResolvedValue(mockAdapter);

    await runImportIssues({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    const eventsPath = resolve(dirs.stateDir, 'events.log');
    expect(existsSync(eventsPath)).toBe(true);
    const log = readFileSync(eventsPath, 'utf-8');
    expect(log).toContain('[IMPORT]');
    expect(log).toContain('[GITHUB]');
  });

  it('dry-run does not write files', async () => {
    writeProjectYaml(dirs.specDir);
    const mockAdapter = {
      fetchIssues: vi.fn().mockReturnValue([
        { number: 1, title: 'Bug', state: 'open', labels: [], body: '' },
      ]),
    };
    createAdapter.mockResolvedValue(mockAdapter);

    const result = await runImportIssues({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: { 'dry-run': true },
    });

    expect(result.dryRun).toBe(true);
    const jsonPath = resolve(dirs.projectRoot, '.claude', 'state', 'backlog.json');
    expect(existsSync(jsonPath)).toBe(false);
  });

  it('preserves existing manual items from markdown on first import', async () => {
    writeProjectYaml(dirs.specDir);

    // Write a legacy markdown backlog with a manual item
    const mdPath = resolve(dirs.projectRoot, 'AGENT_BACKLOG.md');
    writeFileSync(mdPath, `# Backlog
| Priority | Team | Task | Phase | Status | Notes |
| -------- | ---- | ---- | ----- | ------ | ----- |
| P1 | backend | Manual task | Planning | Open | Important |
`, 'utf-8');

    const mockAdapter = {
      fetchIssues: vi.fn().mockReturnValue([
        { number: 5, title: 'New issue', state: 'open', labels: [], body: '' },
      ]),
    };
    createAdapter.mockResolvedValue(mockAdapter);

    const result = await runImportIssues({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    expect(result.preserved).toBe(1);
    expect(result.imported).toBe(1);

    const jsonPath = resolve(dirs.projectRoot, '.claude', 'state', 'backlog.json');
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    expect(jsonData.items.length).toBeGreaterThanOrEqual(2);
    expect(jsonData.items.some((i) => i.title === 'Manual task')).toBe(true);
  });

  it('deduplicates on subsequent imports', async () => {
    writeProjectYaml(dirs.specDir);
    const mockAdapter = {
      fetchIssues: vi.fn().mockReturnValue([
        { number: 1, title: 'Bug v1', state: 'open', labels: [], body: '' },
      ]),
    };
    createAdapter.mockResolvedValue(mockAdapter);

    await runImportIssues({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    // Import again with updated title
    mockAdapter.fetchIssues.mockReturnValue([
      { number: 1, title: 'Bug v2', state: 'open', labels: [], body: '' },
    ]);

    const result = await runImportIssues({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    expect(result.updated).toBe(1);
    expect(result.imported).toBe(0);

    const jsonPath = resolve(dirs.projectRoot, '.claude', 'state', 'backlog.json');
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    expect(jsonData.items).toHaveLength(1);
    expect(jsonData.items[0].title).toBe('Bug v2');
  });

  it('returns early when tracker is none', async () => {
    writeProjectYaml(dirs.specDir, { autoImport: true });
    // Override issueTracker
    const project = JSON.parse(readFileSync(resolve(dirs.specDir, 'project.yaml'), 'utf-8'));
    project.process.issueTracker = 'none';
    writeFileSync(resolve(dirs.specDir, 'project.yaml'), JSON.stringify(project), 'utf-8');

    const result = await runImportIssues({
      agentkitRoot: dirs.agentkitRoot,
      projectRoot: dirs.projectRoot,
      flags: {},
    });

    expect(result.imported).toBe(0);
    expect(createAdapter).not.toHaveBeenCalled();
  });
});
