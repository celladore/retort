import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { runPlan } from '../plan-runner.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const TEST_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-tmp', 'plan');
const STATE_DIR = resolve(TEST_ROOT, '.claude', 'state');

function setupTestProject(phase = 1, extras = {}) {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(resolve(TEST_ROOT, '.git'), { recursive: true });
  writeFileSync(resolve(TEST_ROOT, '.agentkit-repo'), 'test-project', 'utf-8');

  const phases = { 1: 'Discovery', 2: 'Planning', 3: 'Implementation', 4: 'Validation', 5: 'Ship' };
  const state = {
    schema_version: '1.0.0',
    repo_id: 'test-project',
    branch: 'main',
    current_phase: phase,
    phase_name: phases[phase],
    next_action: 'Test action',
    team_progress: {},
    todo_items: [],
    completed: false,
    ...extras,
  };

  writeFileSync(resolve(STATE_DIR, 'orchestrator.json'), JSON.stringify(state, null, 2), 'utf-8');
}

describe('runPlan()', () => {
  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    vi.restoreAllMocks();
  });

  it('returns structured result for phase 1', async () => {
    setupTestProject(1);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runPlan({
      projectRoot: TEST_ROOT,
      flags: {},
    });

    expect(result.phase).toBe(1);
    expect(result.phaseName).toBe('Discovery');
    expect(result.guidance).toBeDefined();
    expect(result.guidance.title).toBe('Discovery Phase');
    expect(result.guidance.commands).toContain('/discover');
  });

  it('returns correct guidance for each phase', async () => {
    const expectedCommands = {
      1: '/discover',
      2: '/plan',
      3: '/team-backend',
      4: '/check',
      5: '/deploy',
    };

    for (const [phase, expectedCmd] of Object.entries(expectedCommands)) {
      setupTestProject(Number(phase));
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runPlan({ projectRoot: TEST_ROOT, flags: {} });
      expect(result.guidance.commands).toContain(expectedCmd);

      vi.restoreAllMocks();
    }
  });

  it('includes active teams in output', async () => {
    setupTestProject(3, {
      team_progress: {
        'team-backend': { status: 'in_progress', notes: 'API work' },
        'team-frontend': { status: 'idle', notes: '' },
      },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runPlan({ projectRoot: TEST_ROOT, flags: {} });
    expect(result.activeTeams).toBe(1); // only backend is non-idle

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('team-backend');
  });

  it('includes todo items count', async () => {
    setupTestProject(3, {
      todo_items: [
        { id: 'T-1', title: 'Task 1', status: 'pending' },
        { id: 'T-2', title: 'Task 2', status: 'done' },
      ],
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runPlan({ projectRoot: TEST_ROOT, flags: {} });
    expect(result.todoItems).toBe(2);
  });

  describe('backlog parsing', () => {
    it('parses standard markdown table from AGENT_BACKLOG.md', async () => {
      setupTestProject(2);

      const backlogContent = `# Agent Backlog

## Active Sprint

| ID | Title | Status | Team | Priority |
|----|-------|--------|------|----------|
| B-1 | Build API | pending | team-backend | high |
| B-2 | Add tests | in_progress | team-testing | medium |

## Icebox

Nothing here.
`;
      writeFileSync(resolve(TEST_ROOT, 'AGENT_BACKLOG.md'), backlogContent, 'utf-8');

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runPlan({ projectRoot: TEST_ROOT, flags: {} });
      expect(result.backlogItems).toBe(2);
    });

    it('handles missing AGENT_BACKLOG.md gracefully', async () => {
      setupTestProject(2);

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runPlan({ projectRoot: TEST_ROOT, flags: {} });
      expect(result.backlogItems).toBe(0);
    });

    it('handles empty backlog table', async () => {
      setupTestProject(2);
      writeFileSync(
        resolve(TEST_ROOT, 'AGENT_BACKLOG.md'),
        '# Empty backlog\n\nNothing here.\n',
        'utf-8'
      );

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await runPlan({ projectRoot: TEST_ROOT, flags: {} });
      expect(result.backlogItems).toBe(0);
    });
  });
});
