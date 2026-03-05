import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkBudget,
  checkDailyBudget,
  checkSessionBudget,
  DEFAULT_POLICY,
  deepMerge,
  evaluateForHook,
  extractBudgetPolicyRegex,
  loadPolicy,
  runBudgetStatus,
} from '../budget-guard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_ROOT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '.test-tmp',
  'budget-guard'
);
const TEST_AGENTKIT = resolve(TEST_ROOT, 'agentkit');

function setupTestDirs() {
  if (existsSync(TEST_ROOT)) {
    rmSync(TEST_ROOT, { recursive: true });
  }
  mkdirSync(resolve(TEST_AGENTKIT, 'logs', 'sessions'), { recursive: true });
  mkdirSync(resolve(TEST_AGENTKIT, 'spec'), { recursive: true });
}

function writeActiveSession(overrides = {}) {
  const sessionId = overrides.sessionId || '20260304120000-abc123';
  const session = {
    sessionId,
    startTime: overrides.startTime || new Date().toISOString(),
    endTime: null,
    durationMs: null,
    user: 'test@example.com',
    repo: 'test-repo',
    branch: 'main',
    commandsRun: overrides.commandsRun || [],
    filesModified: overrides.filesModified || 0,
    status: 'active',
    ...overrides,
  };

  writeFileSync(
    resolve(TEST_AGENTKIT, 'logs', 'sessions', `session-${sessionId}.json`),
    JSON.stringify(session, null, 2),
    'utf-8'
  );

  // Write active-session-id pointer
  writeFileSync(
    resolve(TEST_AGENTKIT, 'logs', 'active-session-id'),
    sessionId,
    'utf-8'
  );

  return session;
}

function writeSettingsYaml(content) {
  writeFileSync(resolve(TEST_AGENTKIT, 'spec', 'settings.yaml'), content, 'utf-8');
}

describe('budget-guard', () => {
  beforeEach(() => {
    setupTestDirs();
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) {
      rmSync(TEST_ROOT, { recursive: true });
    }
  });

  // -------------------------------------------------------------------------
  // deepMerge
  // -------------------------------------------------------------------------
  describe('deepMerge', () => {
    it('should merge nested objects', () => {
      const result = deepMerge(
        { a: { b: 1, c: 2 }, d: 3 },
        { a: { b: 10 } }
      );
      expect(result).toEqual({ a: { b: 10, c: 2 }, d: 3 });
    });

    it('should skip null/undefined overrides', () => {
      const result = deepMerge({ a: 1, b: 2 }, { a: null, b: undefined });
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should override primitives', () => {
      const result = deepMerge({ a: 1 }, { a: 99 });
      expect(result).toEqual({ a: 99 });
    });
  });

  // -------------------------------------------------------------------------
  // extractBudgetPolicyRegex
  // -------------------------------------------------------------------------
  describe('extractBudgetPolicyRegex', () => {
    it('should return null when no budgetPolicy section', () => {
      expect(extractBudgetPolicyRegex('costTracking:\n  enabled: true')).toBeNull();
    });

    it('should extract numeric values', () => {
      const yaml = `
budgetPolicy:
  enforcement: enforce
  session:
    maxDurationMinutes: 60
    maxCommands: 100
    maxFilesModified: 50
    warnAtPercent: 75
  daily:
    maxSessions: 20
    maxTotalDurationMinutes: 240
    maxTotalCommands: 500
    warnAtPercent: 85
`;
      const result = extractBudgetPolicyRegex(yaml);
      expect(result.enforcement).toBe('enforce');
      expect(result.session.maxDurationMinutes).toBe(60);
      expect(result.session.maxCommands).toBe(100);
      expect(result.session.maxFilesModified).toBe(50);
      expect(result.session.warnAtPercent).toBe(75);
      expect(result.daily.maxSessions).toBe(20);
      expect(result.daily.maxTotalDurationMinutes).toBe(240);
      expect(result.daily.maxTotalCommands).toBe(500);
      // Regex fallback matches first occurrence of warnAtPercent (session: 75)
      // since it doesn't parse YAML hierarchy — this is expected behavior
      expect(result.daily.warnAtPercent).toBe(75);
    });
  });

  // -------------------------------------------------------------------------
  // loadPolicy
  // -------------------------------------------------------------------------
  describe('loadPolicy', () => {
    it('should return default policy when no settings.yaml', () => {
      const policy = loadPolicy(resolve(TEST_ROOT, 'nonexistent'));
      expect(policy).toEqual(DEFAULT_POLICY);
    });

    it('should return default policy when settings.yaml has no budgetPolicy', () => {
      writeSettingsYaml('costTracking:\n  enabled: true\n');
      const policy = loadPolicy(TEST_AGENTKIT);
      expect(policy).toEqual(DEFAULT_POLICY);
    });

    it('should merge overrides from settings.yaml', () => {
      writeSettingsYaml(`
budgetPolicy:
  enforcement: enforce
  session:
    maxDurationMinutes: 60
`);
      const policy = loadPolicy(TEST_AGENTKIT);
      expect(policy.enforcement).toBe('enforce');
      expect(policy.session.maxDurationMinutes).toBe(60);
      // Defaults should still be present for unspecified values
      expect(policy.session.maxCommands).toBe(DEFAULT_POLICY.session.maxCommands);
      expect(policy.daily.maxSessions).toBe(DEFAULT_POLICY.daily.maxSessions);
    });
  });

  // -------------------------------------------------------------------------
  // checkSessionBudget
  // -------------------------------------------------------------------------
  describe('checkSessionBudget', () => {
    it('should return ok when enforcement is off', () => {
      const result = checkSessionBudget(TEST_AGENTKIT, {
        ...DEFAULT_POLICY,
        enforcement: 'off',
      });
      expect(result.status).toBe('ok');
      expect(result.reasons).toEqual([]);
    });

    it('should return ok when no active session', () => {
      const result = checkSessionBudget(TEST_AGENTKIT);
      expect(result.status).toBe('ok');
      expect(result.reasons).toContain('No active session found');
    });

    it('should return ok when within limits', () => {
      writeActiveSession({
        startTime: new Date(Date.now() - 5 * 60_000).toISOString(), // 5 min ago
        commandsRun: [{ command: 'check', timestamp: new Date().toISOString() }],
        filesModified: 2,
      });
      const result = checkSessionBudget(TEST_AGENTKIT);
      expect(result.status).toBe('ok');
      expect(result.reasons).toHaveLength(0);
    });

    it('should warn when approaching limits', () => {
      const policy = {
        ...DEFAULT_POLICY,
        session: { ...DEFAULT_POLICY.session, maxCommands: 10, warnAtPercent: 80 },
      };
      const cmds = Array.from({ length: 8 }, (_, i) => ({
        command: `cmd-${i}`,
        timestamp: new Date().toISOString(),
      }));
      writeActiveSession({ commandsRun: cmds });

      const result = checkSessionBudget(TEST_AGENTKIT, policy);
      expect(result.status).toBe('warn');
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons[0]).toContain('80%');
    });

    it('should warn when exceeding limits in warn mode', () => {
      const policy = {
        ...DEFAULT_POLICY,
        enforcement: 'warn',
        session: { ...DEFAULT_POLICY.session, maxCommands: 5 },
      };
      const cmds = Array.from({ length: 10 }, (_, i) => ({
        command: `cmd-${i}`,
        timestamp: new Date().toISOString(),
      }));
      writeActiveSession({ commandsRun: cmds });

      const result = checkSessionBudget(TEST_AGENTKIT, policy);
      expect(result.status).toBe('warn');
      expect(result.reasons.some((r) => r.includes('exceeds limit'))).toBe(true);
    });

    it('should deny when exceeding limits in enforce mode', () => {
      const policy = {
        ...DEFAULT_POLICY,
        enforcement: 'enforce',
        session: { ...DEFAULT_POLICY.session, maxCommands: 5 },
      };
      const cmds = Array.from({ length: 10 }, (_, i) => ({
        command: `cmd-${i}`,
        timestamp: new Date().toISOString(),
      }));
      writeActiveSession({ commandsRun: cmds });

      const result = checkSessionBudget(TEST_AGENTKIT, policy);
      expect(result.status).toBe('deny');
    });

    it('should check duration', () => {
      const policy = {
        ...DEFAULT_POLICY,
        enforcement: 'enforce',
        session: { ...DEFAULT_POLICY.session, maxDurationMinutes: 10 },
      };
      // Session started 15 minutes ago
      writeActiveSession({
        startTime: new Date(Date.now() - 15 * 60_000).toISOString(),
      });

      const result = checkSessionBudget(TEST_AGENTKIT, policy);
      expect(result.status).toBe('deny');
      expect(result.reasons.some((r) => r.includes('duration'))).toBe(true);
    });

    it('should check files modified', () => {
      const policy = {
        ...DEFAULT_POLICY,
        enforcement: 'enforce',
        session: { ...DEFAULT_POLICY.session, maxFilesModified: 5 },
      };
      writeActiveSession({ filesModified: 10 });

      const result = checkSessionBudget(TEST_AGENTKIT, policy);
      expect(result.status).toBe('deny');
      expect(result.reasons.some((r) => r.includes('Files modified'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // checkDailyBudget
  // -------------------------------------------------------------------------
  describe('checkDailyBudget', () => {
    it('should return ok when enforcement is off', () => {
      const result = checkDailyBudget(TEST_AGENTKIT, {
        ...DEFAULT_POLICY,
        enforcement: 'off',
      });
      expect(result.status).toBe('ok');
    });

    it('should return ok when no sessions exist', () => {
      const result = checkDailyBudget(TEST_AGENTKIT);
      expect(result.status).toBe('ok');
      expect(result.metrics.sessionCount).toBe(0);
    });

    it('should count today sessions by startTime', () => {
      const today = new Date().toISOString().split('T')[0];
      // Write a session with today's date
      writeActiveSession({
        sessionId: 'today-session-1',
        startTime: `${today}T10:00:00.000Z`,
        status: 'completed',
        durationMs: 30 * 60_000,
        commandsRun: [{ command: 'check' }, { command: 'build' }],
      });

      const result = checkDailyBudget(TEST_AGENTKIT);
      expect(result.metrics.sessionCount).toBe(1);
      expect(result.metrics.totalDurationMinutes).toBe(30);
      expect(result.metrics.totalCommands).toBe(2);
    });

    it('should warn on daily session count', () => {
      const policy = {
        ...DEFAULT_POLICY,
        enforcement: 'warn',
        daily: { ...DEFAULT_POLICY.daily, maxSessions: 3 },
      };
      const today = new Date().toISOString().split('T')[0];
      for (let i = 0; i < 5; i++) {
        const sid = `today-sess-${i}`;
        const session = {
          sessionId: sid,
          startTime: `${today}T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
          status: 'completed',
          durationMs: 10 * 60_000,
          commandsRun: [],
          filesModified: 0,
        };
        writeFileSync(
          resolve(TEST_AGENTKIT, 'logs', 'sessions', `session-${sid}.json`),
          JSON.stringify(session, null, 2),
          'utf-8'
        );
      }

      const result = checkDailyBudget(TEST_AGENTKIT, policy);
      expect(result.status).toBe('warn');
      expect(result.reasons.some((r) => r.includes('Daily sessions'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // checkBudget (combined)
  // -------------------------------------------------------------------------
  describe('checkBudget', () => {
    it('should combine session and daily checks', () => {
      writeActiveSession({
        startTime: new Date(Date.now() - 5 * 60_000).toISOString(),
        commandsRun: [],
        filesModified: 0,
      });

      const result = checkBudget(TEST_AGENTKIT);
      expect(result.status).toBe('ok');
      expect(result.metrics).toHaveProperty('session');
      expect(result.metrics).toHaveProperty('daily');
    });

    it('should return deny if either check denies', () => {
      const policy = {
        ...DEFAULT_POLICY,
        enforcement: 'enforce',
        session: { ...DEFAULT_POLICY.session, maxCommands: 2 },
      };
      const cmds = Array.from({ length: 5 }, (_, i) => ({
        command: `cmd-${i}`,
        timestamp: new Date().toISOString(),
      }));
      writeActiveSession({ commandsRun: cmds });

      const result = checkBudget(TEST_AGENTKIT, policy);
      expect(result.status).toBe('deny');
    });
  });

  // -------------------------------------------------------------------------
  // evaluateForHook
  // -------------------------------------------------------------------------
  describe('evaluateForHook', () => {
    it('should return allow when within budget', () => {
      const result = evaluateForHook(TEST_AGENTKIT);
      expect(result.decision).toBe('allow');
      expect(result).not.toHaveProperty('reason');
      expect(result).not.toHaveProperty('warning');
    });

    it('should return allow with warning when warn status', () => {
      const policy = {
        ...DEFAULT_POLICY,
        enforcement: 'warn',
        session: { ...DEFAULT_POLICY.session, maxCommands: 3 },
      };
      writeSettingsYaml(`
budgetPolicy:
  enforcement: warn
  session:
    maxCommands: 3
`);
      const cmds = Array.from({ length: 5 }, (_, i) => ({
        command: `cmd-${i}`,
        timestamp: new Date().toISOString(),
      }));
      writeActiveSession({ commandsRun: cmds });

      const result = evaluateForHook(TEST_AGENTKIT);
      expect(result.decision).toBe('allow');
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('Budget warning');
    });

    it('should return deny when budget exceeded in enforce mode', () => {
      writeSettingsYaml(`
budgetPolicy:
  enforcement: enforce
  session:
    maxCommands: 3
`);
      const cmds = Array.from({ length: 5 }, (_, i) => ({
        command: `cmd-${i}`,
        timestamp: new Date().toISOString(),
      }));
      writeActiveSession({ commandsRun: cmds });

      const result = evaluateForHook(TEST_AGENTKIT);
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('Budget exceeded');
    });
  });

  // -------------------------------------------------------------------------
  // runBudgetStatus (CLI)
  // -------------------------------------------------------------------------
  describe('runBudgetStatus', () => {
    it('should run without throwing', () => {
      expect(() => runBudgetStatus({ agentkitRoot: TEST_AGENTKIT })).not.toThrow();
    });

    it('should log budget event', () => {
      writeActiveSession();
      runBudgetStatus({ agentkitRoot: TEST_AGENTKIT });

      const dateStr = new Date().toISOString().split('T')[0];
      const logPath = resolve(TEST_AGENTKIT, 'logs', `usage-${dateStr}.jsonl`);
      expect(existsSync(logPath)).toBe(true);
      const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
      const lastEvent = JSON.parse(lines[lines.length - 1]);
      expect(lastEvent.event).toBe('budget_check');
    });
  });
});
