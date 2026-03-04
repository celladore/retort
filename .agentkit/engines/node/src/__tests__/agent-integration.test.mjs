import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadAgentNotifies,
  loadTeamHandoffChains,
  processNotifications,
  autoCreateTestTask,
  autoCreateIntegrationTestTask,
  autoCreateDocTask,
  autoCreateSecurityReviewTask,
  autoCreateDependencyAuditTask,
  autoCreateQualityReviewTask,
  routeTestFailureToTestingTeam,
  validateTestAcceptanceCriteria,
  resolveCoverageCommand,
  parseCoveragePercentage,
  getIncrementalTestCommands,
  processTaskCompletion,
} from '../agent-integration.mjs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return mkdtempSync(resolve(tmpdir(), 'agentkit-integration-test-'));
}

function setupTaskDir(projectRoot) {
  const dir = resolve(projectRoot, '.claude', 'state', 'tasks');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeTask(projectRoot, task) {
  const dir = setupTaskDir(projectRoot);
  writeFileSync(
    resolve(dir, `${task.id}.json`),
    JSON.stringify(task, null, 2),
    'utf-8'
  );
  return task;
}

function makeCompletedTask(overrides = {}) {
  return {
    id: 'task-20260304-001-abc123',
    type: 'implement',
    status: 'completed',
    priority: 'P1',
    delegator: 'orchestrator',
    assignees: ['team-backend'],
    title: 'Add user API endpoint',
    description: 'Add user CRUD endpoints',
    acceptanceCriteria: ['Endpoint works', 'Tests pass'],
    scope: ['apps/api/**'],
    dependsOn: [],
    blockedBy: [],
    handoffTo: [],
    handoffContext: '',
    artifacts: [
      { type: 'files-changed', paths: ['apps/api/users.ts', 'apps/api/users.test.ts'] },
      { type: 'test-results', passed: 10, failed: 0, testsAdded: 3 },
    ],
    messages: [],
    createdAt: '2026-03-04T10:00:00Z',
    updatedAt: '2026-03-04T11:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// loadAgentNotifies
// ---------------------------------------------------------------------------

describe('loadAgentNotifies', () => {
  it('loads notifies from real agents.yaml', () => {
    const { agentNotifies, teamToAgents } = loadAgentNotifies(AGENTKIT_ROOT);

    // Backend agent notifies test-lead and frontend
    expect(agentNotifies.backend).toContain('test-lead');
    expect(agentNotifies.backend).toContain('frontend');

    // Frontend notifies test-lead and brand-guardian
    expect(agentNotifies.frontend).toContain('test-lead');

    // Data notifies backend and test-lead
    expect(agentNotifies.data).toContain('test-lead');
    expect(agentNotifies.data).toContain('backend');

    // Categories should have agents
    expect(teamToAgents.engineering).toContain('backend');
    expect(teamToAgents.testing).toContain('test-lead');
  });

  it('returns empty maps for non-existent path', () => {
    const { agentNotifies, teamToAgents } = loadAgentNotifies('/nonexistent');
    expect(agentNotifies).toEqual({});
    expect(teamToAgents).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// loadTeamHandoffChains
// ---------------------------------------------------------------------------

describe('loadTeamHandoffChains', () => {
  it('loads handoff chains from real teams.yaml', () => {
    const chains = loadTeamHandoffChains(AGENTKIT_ROOT);

    // Backend → testing, docs
    expect(chains.backend).toEqual(['testing', 'docs']);
    // Frontend → testing, docs
    expect(chains.frontend).toEqual(['testing', 'docs']);
    // Infra → devops, security
    expect(chains.infra).toEqual(['devops', 'security']);
    // Testing → quality
    expect(chains.testing).toEqual(['quality']);
  });

  it('returns empty for non-existent path', () => {
    const chains = loadTeamHandoffChains('/nonexistent');
    expect(chains).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// processNotifications
// ---------------------------------------------------------------------------

describe('processNotifications', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates notification tasks for agents in the notifies list', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({ assignees: ['team-backend'] });

    const notifiesMap = { backend: ['test-lead', 'frontend'] };
    const { created, errors } = await processNotifications(tmpDir, task, notifiesMap);

    expect(errors).toEqual([]);
    expect(created).toHaveLength(2);
    expect(created[0].assignees).toEqual(['team-test-lead']);
    expect(created[0].type).toBe('review');
    expect(created[0].title).toContain('[Notification]');
    expect(created[1].assignees).toEqual(['team-frontend']);
  });

  it('skips non-completed tasks', async () => {
    const task = makeCompletedTask({ status: 'working' });
    const { created } = await processNotifications(tmpDir, task, { backend: ['test-lead'] });
    expect(created).toHaveLength(0);
  });

  it('does not self-notify', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({ assignees: ['team-backend'] });

    // Backend notifies backend — should be skipped
    const { created } = await processNotifications(tmpDir, task, { backend: ['backend'] });
    expect(created).toHaveLength(0);
  });

  it('does not create duplicate notifications', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask();

    // Pre-create a notification task
    writeTask(tmpDir, {
      id: 'task-20260304-002-def456',
      assignees: ['team-test-lead'],
      context: { notificationFrom: task.id },
      status: 'submitted',
      dependsOn: [],
    });

    const { created } = await processNotifications(tmpDir, task, { backend: ['test-lead'] });
    expect(created).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// autoCreateTestTask
// ---------------------------------------------------------------------------

describe('autoCreateTestTask', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates a test task for completed engineering tasks', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask();
    writeTask(tmpDir, task);

    const { created } = await autoCreateTestTask(tmpDir, task, {});

    expect(created).not.toBeNull();
    expect(created.assignees).toEqual(['team-testing']);
    expect(created.type).toBe('test');
    expect(created.title).toContain('[Auto-test]');
    expect(created.dependsOn).toContain(task.id);
  });

  it('does not create test tasks for non-engineering teams', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({ assignees: ['team-testing'] });
    writeTask(tmpDir, task);

    const { created } = await autoCreateTestTask(tmpDir, task, {});
    expect(created).toBeNull();
  });

  it('does not duplicate test tasks', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask();
    writeTask(tmpDir, task);

    // Pre-create test task
    writeTask(tmpDir, {
      id: 'task-20260304-010-xyz789',
      type: 'test',
      status: 'submitted',
      assignees: ['team-testing'],
      context: { testFor: task.id },
      dependsOn: [],
    });

    const { created } = await autoCreateTestTask(tmpDir, task, {});
    expect(created).toBeNull();
  });

  it('skips if handoffTo already includes testing', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({ handoffTo: ['team-testing'] });
    writeTask(tmpDir, task);

    const { created } = await autoCreateTestTask(tmpDir, task, {});
    expect(created).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// autoCreateDocTask
// ---------------------------------------------------------------------------

describe('autoCreateDocTask', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates doc task when public-facing files change for teams with docs chain', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      artifacts: [
        { type: 'files-changed', paths: ['apps/api/routes/users.ts', 'README.md'] },
      ],
    });
    writeTask(tmpDir, task);

    const chains = { backend: ['testing', 'docs'] };
    const { created } = await autoCreateDocTask(tmpDir, task, chains);

    expect(created).not.toBeNull();
    expect(created.assignees).toEqual(['team-docs']);
    expect(created.type).toBe('document');
  });

  it('skips doc task for teams without docs in chain', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      assignees: ['team-infra'],
      artifacts: [{ type: 'files-changed', paths: ['infra/main.tf'] }],
    });
    writeTask(tmpDir, task);

    const chains = { infra: ['devops', 'security'] };
    const { created } = await autoCreateDocTask(tmpDir, task, chains);
    expect(created).toBeNull();
  });

  it('skips for internal-only file changes', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      artifacts: [
        { type: 'files-changed', paths: ['src/utils/helpers.ts', 'src/lib/internal.ts'] },
      ],
    });
    writeTask(tmpDir, task);

    const chains = { backend: ['testing', 'docs'] };
    const { created } = await autoCreateDocTask(tmpDir, task, chains);
    expect(created).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// autoCreateSecurityReviewTask
// ---------------------------------------------------------------------------

describe('autoCreateSecurityReviewTask', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates security review for teams with security in chain', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      assignees: ['team-infra'],
      artifacts: [{ type: 'files-changed', paths: ['infra/iam.tf'] }],
    });
    writeTask(tmpDir, task);

    const chains = { infra: ['devops', 'security'] };
    const { created } = await autoCreateSecurityReviewTask(tmpDir, task, chains);

    expect(created).not.toBeNull();
    expect(created.assignees).toEqual(['team-security']);
    expect(created.type).toBe('review');
    expect(created.priority).toBe('P1');
  });

  it('skips for teams without security in chain', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({ assignees: ['team-backend'] });
    writeTask(tmpDir, task);

    const chains = { backend: ['testing', 'docs'] };
    const { created } = await autoCreateSecurityReviewTask(tmpDir, task, chains);
    expect(created).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// autoCreateDependencyAuditTask
// ---------------------------------------------------------------------------

describe('autoCreateDependencyAuditTask', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates audit task when dependency files change', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      artifacts: [
        { type: 'files-changed', paths: ['package.json', 'pnpm-lock.yaml', 'src/app.ts'] },
      ],
    });
    writeTask(tmpDir, task);

    const { created } = await autoCreateDependencyAuditTask(tmpDir, task);

    expect(created).not.toBeNull();
    expect(created.assignees).toEqual(['team-devops']);
    expect(created.type).toBe('investigate');
    expect(created.title).toContain('[Dependency audit]');
  });

  it('skips when no dependency files changed', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      artifacts: [{ type: 'files-changed', paths: ['src/app.ts', 'src/utils.ts'] }],
    });
    writeTask(tmpDir, task);

    const { created } = await autoCreateDependencyAuditTask(tmpDir, task);
    expect(created).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// autoCreateQualityReviewTask
// ---------------------------------------------------------------------------

describe('autoCreateQualityReviewTask', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates quality review for testing team completion', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      assignees: ['team-testing'],
      type: 'test',
    });
    writeTask(tmpDir, task);

    const chains = { testing: ['quality'] };
    const { created } = await autoCreateQualityReviewTask(tmpDir, task, chains);

    expect(created).not.toBeNull();
    expect(created.assignees).toEqual(['team-quality']);
    expect(created.type).toBe('review');
  });

  it('skips for teams without quality in chain', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({ assignees: ['team-backend'] });
    writeTask(tmpDir, task);

    const chains = { backend: ['testing', 'docs'] };
    const { created } = await autoCreateQualityReviewTask(tmpDir, task, chains);
    expect(created).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// routeTestFailureToTestingTeam
// ---------------------------------------------------------------------------

describe('routeTestFailureToTestingTeam', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates test failure task when tests fail', async () => {
    setupTaskDir(tmpDir);
    const checkResult = {
      overallPassed: false,
      stacks: [{
        stack: 'node',
        steps: [
          { step: 'test', status: 'FAIL', stderr: 'FAIL tests/auth.test.ts' },
          { step: 'format', status: 'PASS', stderr: '' },
        ],
      }],
    };

    const { created } = await routeTestFailureToTestingTeam(
      tmpDir, checkResult, ['team-backend']
    );

    expect(created).not.toBeNull();
    expect(created.assignees).toEqual(['team-testing']);
    expect(created.type).toBe('test');
    expect(created.title).toContain('[Test failure]');
    expect(created.priority).toBe('P1');
  });

  it('returns null when all tests pass', async () => {
    const checkResult = {
      overallPassed: true,
      stacks: [{ stack: 'node', steps: [{ step: 'test', status: 'PASS' }] }],
    };

    const { created } = await routeTestFailureToTestingTeam(
      tmpDir, checkResult, ['team-backend']
    );
    expect(created).toBeNull();
  });

  it('does not route build-only failures to testing', async () => {
    setupTaskDir(tmpDir);
    const checkResult = {
      overallPassed: false,
      stacks: [{
        stack: 'node',
        steps: [
          { step: 'build', status: 'FAIL', stderr: 'Build failed' },
          { step: 'test', status: 'PASS', stderr: '' },
        ],
      }],
    };

    const { created } = await routeTestFailureToTestingTeam(
      tmpDir, checkResult, ['team-backend']
    );
    expect(created).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateTestAcceptanceCriteria
// ---------------------------------------------------------------------------

describe('validateTestAcceptanceCriteria', () => {
  it('passes for completed tasks with test artifacts', () => {
    const task = makeCompletedTask();
    const { passed, warnings } = validateTestAcceptanceCriteria(task);
    expect(passed).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it('warns when no test-results artifact exists', () => {
    const task = makeCompletedTask({
      artifacts: [{ type: 'files-changed', paths: ['app.ts'] }],
    });
    const { passed, warnings } = validateTestAcceptanceCriteria(task);
    expect(passed).toBe(false);
    expect(warnings[0]).toContain('No test-results artifact');
  });

  it('warns when no tests were added', () => {
    const task = makeCompletedTask({
      artifacts: [
        { type: 'files-changed', paths: ['app.ts'] },
        { type: 'test-results', passed: 5, failed: 0, testsAdded: 0, added: 0 },
      ],
    });
    const { passed, warnings } = validateTestAcceptanceCriteria(task);
    expect(passed).toBe(false);
    expect(warnings[0]).toContain('No new tests added');
  });

  it('warns when tests are failing', () => {
    const task = makeCompletedTask({
      artifacts: [
        { type: 'test-results', passed: 8, failed: 2, testsAdded: 3 },
      ],
    });
    const { passed, warnings } = validateTestAcceptanceCriteria(task);
    expect(passed).toBe(false);
    expect(warnings[0]).toContain('2 test(s) failed');
  });

  it('warns when source files changed but no test files', () => {
    const task = makeCompletedTask({
      artifacts: [
        { type: 'files-changed', paths: ['src/api.ts', 'src/model.ts'] },
        { type: 'test-results', passed: 5, failed: 0, testsAdded: 1 },
      ],
    });
    const { passed, warnings } = validateTestAcceptanceCriteria(task);
    expect(passed).toBe(false);
    expect(warnings[0]).toContain('no test files modified');
  });

  it('passes for non-implement tasks', () => {
    const task = makeCompletedTask({ type: 'review' });
    const { passed } = validateTestAcceptanceCriteria(task);
    expect(passed).toBe(true);
  });

  it('passes for non-completed tasks', () => {
    const task = makeCompletedTask({ status: 'working' });
    const { passed } = validateTestAcceptanceCriteria(task);
    expect(passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveCoverageCommand
// ---------------------------------------------------------------------------

describe('resolveCoverageCommand', () => {
  it('resolves vitest coverage command', () => {
    const result = resolveCoverageCommand({ testCommand: 'npx vitest run' });
    expect(result.command).toContain('--coverage');
    expect(result.parser).toBe('vitest');
  });

  it('resolves jest coverage command', () => {
    const result = resolveCoverageCommand({ testCommand: 'npx jest' });
    expect(result.command).toContain('--coverage');
    expect(result.parser).toBe('jest');
  });

  it('resolves pytest coverage command', () => {
    const result = resolveCoverageCommand({ testCommand: 'pytest' });
    expect(result.command).toContain('--cov');
    expect(result.parser).toBe('pytest');
  });

  it('resolves cargo test coverage command', () => {
    const result = resolveCoverageCommand({ testCommand: 'cargo test' });
    expect(result.command).toContain('tarpaulin');
    expect(result.parser).toBe('tarpaulin');
  });

  it('resolves go test coverage command', () => {
    const result = resolveCoverageCommand({ testCommand: 'go test ./...' });
    expect(result.command).toContain('-coverprofile');
    expect(result.parser).toBe('go');
  });

  it('returns null command for unknown framework', () => {
    const result = resolveCoverageCommand({ testCommand: 'custom-test-runner' });
    expect(result.command).toBeNull();
    expect(result.parser).toBe('unknown');
  });

  it('returns null for missing testCommand', () => {
    const result = resolveCoverageCommand({});
    expect(result.command).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseCoveragePercentage
// ---------------------------------------------------------------------------

describe('parseCoveragePercentage', () => {
  it('parses vitest/jest "All files" format', () => {
    const output = 'All files |  85.42 |  72.13 |  90.00 |  85.42';
    expect(parseCoveragePercentage(output, 'vitest')).toBeCloseTo(85.42);
  });

  it('parses jest "Statements" format', () => {
    const output = 'Statements : 78.5% ( 157/200 )';
    expect(parseCoveragePercentage(output, 'jest')).toBeCloseTo(78.5);
  });

  it('parses pytest coverage format', () => {
    const output = 'TOTAL   500   125    75.0%';
    expect(parseCoveragePercentage(output, 'pytest')).toBeCloseTo(75.0);
  });

  it('parses tarpaulin coverage format', () => {
    const output = '88.5% coverage, 354/400 lines covered';
    expect(parseCoveragePercentage(output, 'tarpaulin')).toBeCloseTo(88.5);
  });

  it('parses go coverage format', () => {
    const output = 'total:\t(statements)\t92.3%';
    expect(parseCoveragePercentage(output, 'go')).toBeCloseTo(92.3);
  });

  it('returns null for empty output', () => {
    expect(parseCoveragePercentage('', 'vitest')).toBeNull();
    expect(parseCoveragePercentage(null, 'jest')).toBeNull();
  });

  it('returns null for unparseable output', () => {
    expect(parseCoveragePercentage('no coverage here', 'vitest')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getIncrementalTestCommands
// ---------------------------------------------------------------------------

describe('getIncrementalTestCommands', () => {
  const stacks = [
    {
      name: 'node',
      testCommand: 'pnpm test',
      scope: ['src/**/*.ts', 'package.json'],
    },
    {
      name: 'rust',
      testCommand: 'cargo test',
      scope: ['src/**/*.rs', 'Cargo.toml'],
    },
  ];

  it('returns test commands for matching stacks', () => {
    const commands = getIncrementalTestCommands(['src/app.ts', 'src/main.rs'], stacks);
    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual({ stack: 'node', command: 'pnpm test' });
    expect(commands[1]).toEqual({ stack: 'rust', command: 'cargo test' });
  });

  it('returns only matching stacks', () => {
    const commands = getIncrementalTestCommands(['package.json'], stacks);
    expect(commands).toHaveLength(1);
    expect(commands[0].stack).toBe('node');
  });

  it('returns empty for no matches', () => {
    const commands = getIncrementalTestCommands(['docs/readme.md'], stacks);
    expect(commands).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(getIncrementalTestCommands([], stacks)).toHaveLength(0);
    expect(getIncrementalTestCommands(null, stacks)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// processTaskCompletion (integration test)
// ---------------------------------------------------------------------------

describe('processTaskCompletion', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('processes a backend task completion end-to-end', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      artifacts: [
        { type: 'files-changed', paths: ['apps/api/routes/users.ts', 'apps/api/routes/users.test.ts'] },
        { type: 'test-results', passed: 10, failed: 0, testsAdded: 3 },
      ],
    });
    writeTask(tmpDir, task);

    const result = await processTaskCompletion(tmpDir, AGENTKIT_ROOT, task);

    // Should create notifications (backend notifies test-lead, frontend)
    expect(result.notifications.length).toBeGreaterThan(0);

    // Should create a test task
    expect(result.testTasks).toHaveLength(1);
    expect(result.testTasks[0].assignees).toEqual(['team-testing']);

    // Should create a doc task (backend has docs in chain + API files changed)
    expect(result.docTasks).toHaveLength(1);
    expect(result.docTasks[0].assignees).toEqual(['team-docs']);

    // No warnings (good acceptance criteria)
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('processes an infra task with security chain', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      assignees: ['team-infra'],
      artifacts: [
        { type: 'files-changed', paths: ['infra/iam.tf'] },
        { type: 'test-results', passed: 5, failed: 0, testsAdded: 1 },
      ],
    });
    writeTask(tmpDir, task);

    const result = await processTaskCompletion(tmpDir, AGENTKIT_ROOT, task);

    // Should create security review (infra has security in chain)
    expect(result.securityTasks).toHaveLength(1);
    expect(result.securityTasks[0].assignees).toEqual(['team-security']);
  });

  it('warns on missing test acceptance criteria', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      artifacts: [{ type: 'files-changed', paths: ['src/app.ts'] }],
      // No test-results artifact
    });
    writeTask(tmpDir, task);

    const result = await processTaskCompletion(tmpDir, AGENTKIT_ROOT, task);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('No test-results artifact');
  });

  it('skips non-completed tasks', async () => {
    const task = makeCompletedTask({ status: 'working' });
    const result = await processTaskCompletion(tmpDir, AGENTKIT_ROOT, task);

    expect(result.notifications).toHaveLength(0);
    expect(result.testTasks).toHaveLength(0);
    expect(result.docTasks).toHaveLength(0);
    expect(result.securityTasks).toHaveLength(0);
  });

  it('creates dependency audit task when lock files change', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      assignees: ['team-backend'],
      artifacts: [
        { type: 'files-changed', paths: ['package.json', 'pnpm-lock.yaml', 'src/app.ts'] },
        { type: 'test-results', passed: 5, failed: 0, testsAdded: 1 },
      ],
    });
    writeTask(tmpDir, task);

    const result = await processTaskCompletion(tmpDir, AGENTKIT_ROOT, task);
    expect(result.dependencyAudits).toHaveLength(1);
    expect(result.dependencyAudits[0].assignees).toEqual(['team-devops']);
    expect(result.dependencyAudits[0].context.depFilesChanged).toContain('pnpm-lock.yaml');
  });

  it('does not create dependency audit when no lock files change', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      assignees: ['team-backend'],
      artifacts: [
        { type: 'files-changed', paths: ['src/app.ts', 'src/app.test.ts'] },
        { type: 'test-results', passed: 5, failed: 0, testsAdded: 1 },
      ],
    });
    writeTask(tmpDir, task);

    const result = await processTaskCompletion(tmpDir, AGENTKIT_ROOT, task);
    expect(result.dependencyAudits).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// autoCreateIntegrationTestTask (cross-team trigger)
// ---------------------------------------------------------------------------

describe('autoCreateIntegrationTestTask', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates integration test when both backend and frontend tasks are completed', async () => {
    setupTaskDir(tmpDir);

    // Write a completed frontend task first
    const frontendTask = makeCompletedTask({
      id: 'task-20260304-002-def456',
      assignees: ['team-frontend'],
      title: 'Add user profile UI',
    });
    writeTask(tmpDir, frontendTask);

    // Now complete a backend task
    const backendTask = makeCompletedTask({
      id: 'task-20260304-003-ghi789',
      assignees: ['team-backend'],
      title: 'Add user API endpoint',
    });
    writeTask(tmpDir, backendTask);

    const result = await autoCreateIntegrationTestTask(tmpDir, backendTask);
    expect(result.created).not.toBeNull();
    expect(result.created.assignees).toEqual(['team-testing']);
    expect(result.created.context.integrationTestType).toBe('backend-frontend');
    expect(result.created.context.integrationTestFor).toContain(backendTask.id);
    expect(result.created.context.integrationTestFor).toContain(frontendTask.id);
  });

  it('skips when no complement team task exists', async () => {
    setupTaskDir(tmpDir);

    const backendTask = makeCompletedTask({
      assignees: ['team-backend'],
    });
    writeTask(tmpDir, backendTask);

    const result = await autoCreateIntegrationTestTask(tmpDir, backendTask);
    expect(result.created).toBeNull();
  });

  it('skips for non-backend/frontend teams', async () => {
    setupTaskDir(tmpDir);

    const infraTask = makeCompletedTask({
      assignees: ['team-infra'],
    });
    writeTask(tmpDir, infraTask);

    const result = await autoCreateIntegrationTestTask(tmpDir, infraTask);
    expect(result.created).toBeNull();
  });

  it('skips when integration test already exists', async () => {
    setupTaskDir(tmpDir);

    const frontendTask = makeCompletedTask({
      id: 'task-20260304-002-def456',
      assignees: ['team-frontend'],
    });
    writeTask(tmpDir, frontendTask);

    const backendTask = makeCompletedTask({
      id: 'task-20260304-003-ghi789',
      assignees: ['team-backend'],
    });
    writeTask(tmpDir, backendTask);

    // Write an existing integration test task
    writeTask(tmpDir, {
      id: 'task-20260304-004-jkl012',
      type: 'test',
      status: 'working',
      assignees: ['team-testing'],
      context: { integrationTestFor: [backendTask.id, frontendTask.id] },
    });

    const result = await autoCreateIntegrationTestTask(tmpDir, backendTask);
    expect(result.created).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// autoCreateDocTask — empty changedFiles edge case
// ---------------------------------------------------------------------------

describe('autoCreateDocTask', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('skips when changedFiles is empty (no files-changed artifact)', async () => {
    setupTaskDir(tmpDir);
    const task = makeCompletedTask({
      assignees: ['team-backend'],
      artifacts: [
        // No files-changed artifact at all
        { type: 'test-results', passed: 5, failed: 0, testsAdded: 1 },
      ],
    });
    writeTask(tmpDir, task);

    const chains = { backend: ['testing', 'docs'] };
    const result = await autoCreateDocTask(tmpDir, task, chains);
    expect(result.created).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveCoverageCommand — pnpm/npm test with projectRoot detection
// ---------------------------------------------------------------------------

describe('resolveCoverageCommand with projectRoot', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('detects vitest from package.json devDependencies for pnpm test', () => {
    writeFileSync(
      resolve(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^4.0.0' } }),
      'utf-8'
    );
    const result = resolveCoverageCommand({ testCommand: 'pnpm test' }, tmpDir);
    expect(result.command).toBe('pnpm test -- --coverage');
    expect(result.parser).toBe('vitest');
  });

  it('detects jest from package.json devDependencies for npm test', () => {
    writeFileSync(
      resolve(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { jest: '^29.0.0' } }),
      'utf-8'
    );
    const result = resolveCoverageCommand({ testCommand: 'npm test' }, tmpDir);
    expect(result.command).toBe('npm test -- --coverage');
    expect(result.parser).toBe('jest');
  });

  it('returns null for pnpm test when no recognized runner in deps', () => {
    writeFileSync(
      resolve(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { mocha: '^10.0.0' } }),
      'utf-8'
    );
    const result = resolveCoverageCommand({ testCommand: 'pnpm test' }, tmpDir);
    expect(result.command).toBeNull();
    expect(result.parser).toBe('unknown');
  });

  it('returns null for pnpm test without projectRoot', () => {
    const result = resolveCoverageCommand({ testCommand: 'pnpm test' });
    expect(result.command).toBeNull();
    expect(result.parser).toBe('unknown');
  });

  it('detects runner from scripts.test when no devDependency', () => {
    writeFileSync(
      resolve(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { test: 'vitest run' } }),
      'utf-8'
    );
    const result = resolveCoverageCommand({ testCommand: 'pnpm test' }, tmpDir);
    expect(result.command).toBe('pnpm test -- --coverage');
    expect(result.parser).toBe('vitest');
  });
});

// ---------------------------------------------------------------------------
// getIncrementalTestCommands — glob matching correctness
// ---------------------------------------------------------------------------

describe('getIncrementalTestCommands glob matching', () => {
  const stacks = [
    { name: 'node', testCommand: 'pnpm test', scope: ['src/**/*.ts'] },
    { name: 'rust', testCommand: 'cargo test', scope: ['src/**/*.rs', 'Cargo.toml'] },
  ];

  it('does not match src/app.rs against src/**/*.ts', () => {
    const commands = getIncrementalTestCommands(['src/app.rs'], stacks);
    // Should only match rust, not node
    expect(commands).toHaveLength(1);
    expect(commands[0].stack).toBe('rust');
  });

  it('matches deeply nested files with **', () => {
    const commands = getIncrementalTestCommands(['src/lib/utils/deep/file.ts'], stacks);
    expect(commands).toHaveLength(1);
    expect(commands[0].stack).toBe('node');
  });

  it('matches exact filenames', () => {
    const commands = getIncrementalTestCommands(['Cargo.toml'], stacks);
    expect(commands).toHaveLength(1);
    expect(commands[0].stack).toBe('rust');
  });

  it('does not match files outside scope prefix', () => {
    const commands = getIncrementalTestCommands(['lib/app.ts'], stacks);
    expect(commands).toHaveLength(0);
  });
});
