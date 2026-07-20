import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { runHandoff } from '../handoff.mjs';
import * as runner from '../runner.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const TEST_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-tmp', 'handoff');
const STATE_DIR = resolve(TEST_ROOT, '.agentkit', 'state');

function setupTestProject(stateOverrides = {}) {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(resolve(TEST_ROOT, '.git'), { recursive: true });
  writeFileSync(resolve(TEST_ROOT, '.agentkit-repo'), 'test-project', 'utf-8');

  const defaultState = {
    schema_version: '1.0.0',
    repo_id: 'test-project',
    branch: 'main',
    current_phase: 3,
    phase_name: 'Implementation',
    next_action: 'Continue implementing features',
    team_progress: {
      'team-backend': { status: 'in_progress', notes: 'Working on API' },
      'team-frontend': { status: 'idle', notes: '' },
    },
    todo_items: [
      { id: 'T-1', title: 'Build API endpoints', status: 'in_progress' },
      { id: 'T-2', title: 'Add tests', status: 'pending' },
    ],
    completed: false,
    ...stateOverrides,
  };

  writeFileSync(
    resolve(STATE_DIR, 'orchestrator.json'),
    JSON.stringify(defaultState, null, 2),
    'utf-8'
  );
}

describe('runHandoff()', () => {
  beforeEach(() => {
    setupTestProject();

    // Mock git commands to avoid spawning real processes (slow on Windows with shell:true)
    vi.spyOn(runner, 'execCommand').mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref'))
        return { exitCode: 0, stdout: 'main\n', stderr: '', durationMs: 5 };
      if (cmd.includes('git log'))
        return { exitCode: 0, stdout: 'abc1234 Initial commit\n', stderr: '', durationMs: 5 };
      if (cmd.includes('git status --porcelain'))
        return { exitCode: 0, stdout: '', stderr: '', durationMs: 5 };
      if (cmd.includes('git diff')) return { exitCode: 0, stdout: '', stderr: '', durationMs: 5 };
      return { exitCode: 1, stdout: '', stderr: '', durationMs: 0 };
    });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    vi.restoreAllMocks();
  });

  it('returns structured handoff result', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('branch');
    expect(result).toHaveProperty('phase');
    expect(result).toHaveProperty('phaseName');
    expect(result).toHaveProperty('uncommittedCount');
    expect(result).toHaveProperty('document');
    expect(result.phase).toBe(3);
    expect(result.phaseName).toBe('Implementation');
  });

  it('generates document with expected sections', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result.document).toContain('# Session Handoff');
    expect(result.document).toContain('## Summary');
    expect(result.document).toContain('## Git State');
    expect(result.document).toContain('## Next Steps');
    expect(result.document).toContain('Implementation');
  });

  it('includes active team progress in document', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result.document).toContain('## Team Progress');
    expect(result.document).toContain('team-backend');
    expect(result.document).toContain('in_progress');
    // team-frontend is idle and should NOT appear
    expect(result.document).not.toContain('team-frontend');
  });

  it('includes open todo items in document', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result.document).toContain('## Open Items');
    expect(result.document).toContain('T-1');
    expect(result.document).toContain('Build API endpoints');
  });

  it('escapes pipe characters in team notes', async () => {
    setupTestProject({
      team_progress: {
        'team-backend': { status: 'in_progress', notes: 'A | B | C' },
      },
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    // Pipes in notes should be escaped for markdown table
    expect(result.document).toContain('A \\| B \\| C');
  });

  it('saves handoff file when --save flag is set', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: { save: true },
    });

    const handoffDir = resolve(TEST_ROOT, 'docs', 'ai_handoffs');
    expect(existsSync(handoffDir)).toBe(true);

    // There should be a handoff file
    const { readdirSync } = await import('fs');
    const files = readdirSync(handoffDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^handoff-.*\.md$/);

    const content = readFileSync(resolve(handoffDir, files[0]), 'utf-8');
    expect(content).toContain('# Session Handoff');
  });

  it('renders uncommitted files section when there are uncommitted changes', async () => {
    // Override git status mock to return many uncommitted files (>10 to exercise truncation)
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fileLines = Array.from({ length: 13 }, (_, i) => ` M  src/file${i}.js`).join('\n');
    vi.mocked(runner.execCommand).mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref'))
        return { exitCode: 0, stdout: 'feat/x\n', stderr: '', durationMs: 5 };
      if (cmd.includes('git status --porcelain'))
        return { exitCode: 0, stdout: fileLines + '\n', stderr: '', durationMs: 5 };
      if (cmd.includes('git log -5'))
        return {
          exitCode: 0,
          stdout: 'abc1 first\ndef2 second\n',
          stderr: '',
          durationMs: 5,
        };
      if (cmd.includes('git log'))
        return { exitCode: 0, stdout: 'abc1234 Initial\n', stderr: '', durationMs: 5 };
      if (cmd.includes('git diff')) return { exitCode: 0, stdout: '', stderr: '', durationMs: 5 };
      return { exitCode: 1, stdout: '', stderr: '', durationMs: 0 };
    });

    const result = await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result.uncommittedCount).toBe(13);
    expect(result.document).toContain('### Uncommitted Files');
    expect(result.document).toContain('### Recent Commits');
    expect(result.document).toContain('and 3 more'); // truncation marker
    // Next-steps should mention reviewing uncommitted changes
    expect(result.document).toContain('Review and commit');
  });

  it('warns and falls back to "unknown" branch when git is not available', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.mocked(runner.execCommand).mockReturnValue({
      exitCode: 1,
      stdout: '',
      stderr: 'not a git repo',
      durationMs: 5,
    });

    const result = await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });
    expect(result.branch).toBe('unknown');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('handles state with no team_progress and no todo_items gracefully', async () => {
    setupTestProject({ team_progress: {}, todo_items: [] });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: {},
    });

    // Without active teams or todos, those sections should be omitted
    expect(result.document).not.toContain('## Team Progress');
    expect(result.document).not.toContain('## Open Items');
  });

  it('passes userContext through when extra args supplied', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runHandoff({
      agentkitRoot: AGENTKIT_ROOT,
      projectRoot: TEST_ROOT,
      flags: { _args: ['extra', 'context'] },
    });
    const out = logSpy.mock.calls.flat().join('\n');
    expect(out).toContain('Context: extra context');
  });
});
