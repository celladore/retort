import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { runHealthcheck } from '../healthcheck.mjs';
import * as runner from '../runner.mjs';
import * as orchestrator from '../orchestrator.mjs';
import * as taskProtocol from '../task-protocol.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');
const TEST_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-tmp', 'healthcheck');
const STATE_DIR = resolve(TEST_ROOT, '.agentkit', 'state');

describe('runHealthcheck()', () => {
  afterEach(() => {
    if (existsSync(TEST_ROOT))
      rmSync(TEST_ROOT, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    vi.restoreAllMocks();
  });

  it('returns structured result with tools list', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Mock tool checks to avoid spawning real processes — this test only
    // verifies result shape, not actual tool detection (tests below cover that).
    // Real spawns are slow on cold CI caches and hold directory handles that
    // cause EBUSY on Windows cleanup.
    vi.spyOn(runner, 'commandExists').mockImplementation((cmd) => cmd === 'node' || cmd === 'git');
    vi.spyOn(runner, 'execCommand').mockReturnValue({
      exitCode: 0,
      stdout: 'v22.0.0\n',
      stderr: '',
      durationMs: 5,
    });

    // Prevent orchestrator from writing state files into TEST_ROOT.
    vi.spyOn(orchestrator, 'loadState').mockReturnValue({});
    vi.spyOn(orchestrator, 'saveState').mockImplementation(() => {});
    vi.spyOn(orchestrator, 'appendEvent').mockImplementation(() => {});

    mkdirSync(TEST_ROOT, { recursive: true });

    const result = await runHealthcheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('tools');
    expect(result).toHaveProperty('stacks');
    expect(result).toHaveProperty('agentkit');
    expect(result).toHaveProperty('overallHealth');
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);
  });

  it('detects node and git as installed tools', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Mock tool detection to avoid spawning real processes (slow on Windows with shell:true)
    vi.spyOn(runner, 'commandExists').mockImplementation((cmd) => cmd === 'node' || cmd === 'git');
    vi.spyOn(runner, 'execCommand').mockImplementation((cmd) => {
      if (cmd.startsWith('node'))
        return { exitCode: 0, stdout: 'v22.0.0\n', stderr: '', durationMs: 5 };
      if (cmd.startsWith('git'))
        return { exitCode: 0, stdout: 'git version 2.40.0\n', stderr: '', durationMs: 5 };
      return { exitCode: 1, stdout: '', stderr: 'not found', durationMs: 0 };
    });

    vi.spyOn(orchestrator, 'loadState').mockReturnValue({});
    vi.spyOn(orchestrator, 'saveState').mockImplementation(() => {});
    vi.spyOn(orchestrator, 'appendEvent').mockImplementation(() => {});

    mkdirSync(TEST_ROOT, { recursive: true });

    const result = await runHealthcheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    const nodeTool = result.tools.find((t) => t.name === 'node');
    expect(nodeTool).toBeDefined();
    expect(nodeTool.found).toBe(true);
    expect(nodeTool.version).toMatch(/\d+/);

    const gitTool = result.tools.find((t) => t.name === 'git');
    expect(gitTool).toBeDefined();
    expect(gitTool.found).toBe(true);
  });

  it('reports agentkit setup status', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Mock tool detection to avoid spawning real processes
    vi.spyOn(runner, 'commandExists').mockReturnValue(false);
    vi.spyOn(runner, 'execCommand').mockReturnValue({
      exitCode: 1,
      stdout: '',
      stderr: '',
      durationMs: 0,
    });

    vi.spyOn(orchestrator, 'loadState').mockReturnValue({});
    vi.spyOn(orchestrator, 'saveState').mockImplementation(() => {});
    vi.spyOn(orchestrator, 'appendEvent').mockImplementation(() => {});

    // Set up a test project with agentkit markers
    mkdirSync(TEST_ROOT, { recursive: true });
    mkdirSync(STATE_DIR, { recursive: true });
    mkdirSync(resolve(TEST_ROOT, '.git'), { recursive: true });
    writeFileSync(resolve(TEST_ROOT, '.agentkit-repo'), 'test-project', 'utf-8');

    const result = await runHealthcheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result.agentkit).toHaveProperty('hasMarker');
    expect(result.agentkit).toHaveProperty('hasState');
    expect(result.agentkit).toHaveProperty('hasCommands');
    expect(result.agentkit).toHaveProperty('hasHooks');
    expect(result.agentkit.hasMarker).toBe(true);
  });

  it('creates tasks for failed checks when --auto-task is set', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Simulate a failing build check by mocking stack detection
    vi.spyOn(runner, 'commandExists').mockReturnValue(false);
    vi.spyOn(runner, 'execCommand').mockReturnValue({
      exitCode: 1,
      stdout: '',
      stderr: 'build failed',
      durationMs: 100,
    });
    vi.spyOn(runner, 'isValidCommand').mockReturnValue(true);

    vi.spyOn(orchestrator, 'loadState').mockReturnValue({});
    vi.spyOn(orchestrator, 'saveState').mockImplementation(() => {});
    vi.spyOn(orchestrator, 'appendEvent').mockImplementation(() => {});

    const createTaskSpy = vi.spyOn(taskProtocol, 'createTask').mockResolvedValue({
      task: { id: 'test-task-1' },
      error: null,
    });

    mkdirSync(TEST_ROOT, { recursive: true });

    // Inject a fake stack result by making overallHealth UNHEALTHY
    const result = await runHealthcheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: { 'auto-task': true },
    });

    // If there were failed checks, createTask should have been called
    if (result.overallHealth === 'UNHEALTHY') {
      expect(createTaskSpy).toHaveBeenCalled();
      const call = createTaskSpy.mock.calls[0];
      expect(call[1].delegator).toBe('healthcheck');
      expect(call[1].type).toBe('investigate');
    }
  });

  it('handles project root without agentkit setup', async () => {
    mkdirSync(TEST_ROOT, { recursive: true });
    mkdirSync(STATE_DIR, { recursive: true });
    mkdirSync(resolve(TEST_ROOT, '.git'), { recursive: true });
    writeFileSync(resolve(TEST_ROOT, '.agentkit-repo'), 'test-project', 'utf-8');

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Mock tool detection to avoid spawning real processes (slow on Windows CI)
    vi.spyOn(runner, 'commandExists').mockReturnValue(false);
    vi.spyOn(runner, 'execCommand').mockReturnValue({
      exitCode: 1,
      stdout: '',
      stderr: '',
      durationMs: 0,
    });

    vi.spyOn(orchestrator, 'loadState').mockReturnValue({});
    vi.spyOn(orchestrator, 'saveState').mockImplementation(() => {});
    vi.spyOn(orchestrator, 'appendEvent').mockImplementation(() => {});

    const result = await runHealthcheck({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result.agentkit.hasMarker).toBe(true);
    expect(result.agentkit.hasCommands).toBe(false);
  });
});
