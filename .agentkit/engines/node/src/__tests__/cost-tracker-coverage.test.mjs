/**
 * Coverage-targeted tests for cost-tracker.mjs.
 * Focus: parsePeriodDays branches, runCost CLI handler, formatMs/formatReportTable
 * (exercised via runCost), generateReport aggregations, and edge cases for
 * endSession, recordCommand, logEvent, and generateSessionId.
 *
 * See issue #520 (branch-coverage ratchet) for the broader context.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  endSession,
  generateReport,
  generateSessionId,
  getSessions,
  initSession,
  logEvent,
  recordCommand,
  runCost,
} from '../cost-tracker.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_AGENTKIT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '.test-tmp',
  'cost-tracker-coverage',
  'agentkit'
);
const TEST_PROJECT = resolve(TEST_AGENTKIT, '..');

const DAY_MS = 86_400_000;

function setup() {
  if (existsSync(TEST_PROJECT)) {
    rmSync(TEST_PROJECT, { recursive: true });
  }
  mkdirSync(resolve(TEST_AGENTKIT, 'logs'), { recursive: true });
  mkdirSync(TEST_PROJECT, { recursive: true });
  writeFileSync(resolve(TEST_PROJECT, '.agentkit-repo'), 'test-cov', 'utf-8');
}

function teardown() {
  if (existsSync(TEST_PROJECT)) {
    rmSync(TEST_PROJECT, { recursive: true });
  }
}

function writeSession(sessionId, overrides = {}) {
  const dir = resolve(TEST_AGENTKIT, 'logs', 'sessions');
  mkdirSync(dir, { recursive: true });
  const session = {
    sessionId,
    startTime: new Date().toISOString(),
    endTime: null,
    durationMs: null,
    user: 'test@example.com',
    repo: 'test-cov',
    branch: 'main',
    commandsRun: [],
    filesModified: 0,
    status: 'completed',
    ...overrides,
  };
  writeFileSync(resolve(dir, `session-${sessionId}.json`), JSON.stringify(session, null, 2) + '\n');
  return session;
}

describe('cost-tracker — coverage push', () => {
  beforeEach(setup);
  afterEach(teardown);

  describe('parsePeriodDays — exercised via getSessions cutoff', () => {
    it('treats a positive number as a day count', () => {
      writeSession('20260101120000-num005', {
        startTime: new Date(Date.now() - 5 * DAY_MS).toISOString(),
      });
      writeSession('20260101120000-num020', {
        startTime: new Date(Date.now() - 20 * DAY_MS).toISOString(),
      });
      const sessions = getSessions(TEST_AGENTKIT, { last: 10 });
      expect(sessions.map((s) => s.sessionId)).toEqual(['20260101120000-num005']);
    });

    it('defaults to 7d for zero or negative numbers', () => {
      writeSession('20260101120000-near05', {
        startTime: new Date(Date.now() - 5 * DAY_MS).toISOString(),
      });
      writeSession('20260101120000-far010', {
        startTime: new Date(Date.now() - 10 * DAY_MS).toISOString(),
      });
      expect(getSessions(TEST_AGENTKIT, { last: 0 }).map((s) => s.sessionId)).toEqual([
        '20260101120000-near05',
      ]);
      expect(getSessions(TEST_AGENTKIT, { last: -3 }).map((s) => s.sessionId)).toEqual([
        '20260101120000-near05',
      ]);
    });

    it('parses "<n>d" string format', () => {
      writeSession('20260101120000-str010', {
        startTime: new Date(Date.now() - 10 * DAY_MS).toISOString(),
      });
      writeSession('20260101120000-str020', {
        startTime: new Date(Date.now() - 20 * DAY_MS).toISOString(),
      });
      expect(getSessions(TEST_AGENTKIT, { last: '15d' }).map((s) => s.sessionId)).toEqual([
        '20260101120000-str010',
      ]);
    });

    it('parses bare numeric string as days', () => {
      writeSession('20260101120000-bar010', {
        startTime: new Date(Date.now() - 10 * DAY_MS).toISOString(),
      });
      expect(getSessions(TEST_AGENTKIT, { last: '15' })).toHaveLength(1);
    });

    it('warns and falls back to 7d on invalid string format', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        writeSession('20260101120000-inv005', {
          startTime: new Date(Date.now() - 5 * DAY_MS).toISOString(),
        });
        writeSession('20260101120000-inv010', {
          startTime: new Date(Date.now() - 10 * DAY_MS).toISOString(),
        });
        const sessions = getSessions(TEST_AGENTKIT, { last: 'not-a-period' });
        expect(sessions.map((s) => s.sessionId)).toEqual(['20260101120000-inv005']);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid period format'));
      } finally {
        warn.mockRestore();
      }
    });

    it('falls back to 7d when "0d" or "0" is passed', () => {
      writeSession('20260101120000-zd0005', {
        startTime: new Date(Date.now() - 5 * DAY_MS).toISOString(),
      });
      writeSession('20260101120000-zd0010', {
        startTime: new Date(Date.now() - 10 * DAY_MS).toISOString(),
      });
      expect(getSessions(TEST_AGENTKIT, { last: '0d' }).map((s) => s.sessionId)).toEqual([
        '20260101120000-zd0005',
      ]);
      expect(getSessions(TEST_AGENTKIT, { last: '0' }).map((s) => s.sessionId)).toEqual([
        '20260101120000-zd0005',
      ]);
    });

    it('falls back to 7d for non-string non-number values', () => {
      writeSession('20260101120000-obj005', {
        startTime: new Date(Date.now() - 5 * DAY_MS).toISOString(),
      });
      writeSession('20260101120000-obj010', {
        startTime: new Date(Date.now() - 10 * DAY_MS).toISOString(),
      });
      const sessions = getSessions(TEST_AGENTKIT, { last: { foo: 'bar' } });
      expect(sessions.map((s) => s.sessionId)).toEqual(['20260101120000-obj005']);
    });
  });

  describe('runCost — CLI handler', () => {
    let logSpy;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    function logged() {
      return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    }

    it('default branch with no sessions prints help and a zero count', async () => {
      await runCost({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT, flags: {} });
      const out = logged();
      expect(out).toContain('Usage tracking');
      expect(out).toContain('cost --summary');
      expect(out).toContain('Sessions (last 30 days): 0');
    });

    it('default branch with sessions reports totals via formatMs', async () => {
      writeSession('20260101120000-defrun', {
        startTime: new Date(Date.now() - 1 * DAY_MS).toISOString(),
        durationMs: 2 * 3_600_000 + 30 * 60_000,
        filesModified: 5,
      });
      await runCost({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT, flags: {} });
      const out = logged();
      expect(out).toContain('Sessions (last 30 days): 1');
      expect(out).toContain('Total duration: 2h 30m');
      expect(out).toContain('Total files modified: 5');
    });

    it('default branch reports 0s when total duration is zero', async () => {
      writeSession('20260101120000-zerodu', {
        startTime: new Date(Date.now() - 1 * DAY_MS).toISOString(),
        durationMs: 0,
      });
      await runCost({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT, flags: {} });
      expect(logged()).toContain('Total duration: 0s');
    });

    it('--summary with no sessions prints empty-state message', async () => {
      await runCost({
        agentkitRoot: TEST_AGENTKIT,
        projectRoot: TEST_PROJECT,
        flags: { summary: true },
      });
      const out = logged();
      expect(out).toContain('No sessions found');
      expect(out).toContain('Sessions are recorded automatically');
    });

    it('--summary renders active and completed rows with formatMs', async () => {
      writeSession('20260101120000-actsum', {
        startTime: new Date(Date.now() - 1 * DAY_MS).toISOString(),
        status: 'active',
        durationMs: null,
      });
      writeSession('20260101120000-secsum', {
        startTime: new Date(Date.now() - 2 * DAY_MS).toISOString(),
        status: 'completed',
        durationMs: 45_000,
      });
      writeSession('20260101120000-minsum', {
        startTime: new Date(Date.now() - 3 * DAY_MS).toISOString(),
        status: 'completed',
        durationMs: 15 * 60_000,
      });
      await runCost({
        agentkitRoot: TEST_AGENTKIT,
        projectRoot: TEST_PROJECT,
        flags: { summary: true, last: '7d' },
      });
      const out = logged();
      expect(out).toContain('Recent session summary');
      expect(out).toContain('active');
      expect(out).toContain('completed');
      expect(out).toContain('45s');
      expect(out).toContain('15m');
    });

    it('--sessions default format prints session list', async () => {
      writeSession('20260101120000-listit', {
        startTime: new Date(Date.now() - 1 * DAY_MS).toISOString(),
        status: 'completed',
      });
      await runCost({
        agentkitRoot: TEST_AGENTKIT,
        projectRoot: TEST_PROJECT,
        flags: { sessions: true },
      });
      const out = logged();
      expect(out).toContain('1 session(s) found');
      expect(out).toContain('20260101120000-listit');
    });

    it('--sessions --format=json emits JSON-parseable output', async () => {
      writeSession('20260101120000-jsonit', {
        startTime: new Date(Date.now() - 1 * DAY_MS).toISOString(),
        status: 'completed',
      });
      await runCost({
        agentkitRoot: TEST_AGENTKIT,
        projectRoot: TEST_PROJECT,
        flags: { sessions: true, format: 'json' },
      });
      const json = JSON.parse(logSpy.mock.calls[0][0]);
      expect(Array.isArray(json)).toBe(true);
      expect(json[0].sessionId).toBe('20260101120000-jsonit');
    });

    it('--report --format=table renders aggregate sections', async () => {
      const month = new Date().toISOString().slice(0, 7);
      writeSession('20260101120000-rep001', {
        startTime: `${month}-01T10:00:00.000Z`,
        durationMs: 3_600_000 + 5 * 60_000,
        filesModified: 4,
        user: 'alice@example.com',
      });
      writeSession('20260101120000-rep002', {
        startTime: `${month}-02T11:00:00.000Z`,
        durationMs: 30 * 60_000,
        filesModified: 1,
        user: 'bob@example.com',
      });
      logEvent(TEST_AGENTKIT, { event: 'command_run', command: 'check' });
      logEvent(TEST_AGENTKIT, { event: 'command_run', command: 'check' });
      logEvent(TEST_AGENTKIT, { event: 'command_run', command: 'discover' });

      await runCost({
        agentkitRoot: TEST_AGENTKIT,
        projectRoot: TEST_PROJECT,
        flags: { report: true, month },
      });
      const out = logged();
      expect(out).toContain(`Cost & Usage Report: ${month}`);
      expect(out).toContain('By User');
      expect(out).toContain('alice@example.com');
      expect(out).toContain('bob@example.com');
      expect(out).toContain('By Command');
      expect(out).toContain('check');
      expect(out).toContain('discover');
    });

    it('--report --format=json emits parsed report payload', async () => {
      const month = new Date().toISOString().slice(0, 7);
      writeSession('20260101120000-rjson1', {
        startTime: `${month}-01T10:00:00.000Z`,
        durationMs: 1000,
        filesModified: 0,
      });
      await runCost({
        agentkitRoot: TEST_AGENTKIT,
        projectRoot: TEST_PROJECT,
        flags: { report: true, format: 'json', month },
      });
      const data = JSON.parse(logSpy.mock.calls[0][0]);
      expect(data.month).toBe(month);
      expect(data.totalSessions).toBe(1);
    });

    it('--report --format=csv emits header and per-user rows', async () => {
      const month = new Date().toISOString().slice(0, 7);
      writeSession('20260101120000-rcsv01', {
        startTime: `${month}-01T10:00:00.000Z`,
        durationMs: 1000,
        filesModified: 2,
        user: 'alice@example.com',
      });
      await runCost({
        agentkitRoot: TEST_AGENTKIT,
        projectRoot: TEST_PROJECT,
        flags: { report: true, format: 'csv', month },
      });
      const out = logged();
      expect(out.split('\n')[0]).toBe('user,sessions,duration_ms,files_modified');
      expect(out).toContain('alice@example.com,1,1000,2');
    });

    it('--report defaults month to current YYYY-MM when not provided', async () => {
      // Freeze the clock so the test can't straddle a month boundary
      // between runCost's `new Date()` and our expected-month computation.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
      try {
        await runCost({
          agentkitRoot: TEST_AGENTKIT,
          projectRoot: TEST_PROJECT,
          flags: { report: true, format: 'json' },
        });
        const data = JSON.parse(logSpy.mock.calls[0][0]);
        expect(data.month).toBe('2026-05');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('endSession — corrupted session file', () => {
    it('returns null and warns on unparseable JSON', () => {
      const sessDir = resolve(TEST_AGENTKIT, 'logs', 'sessions');
      mkdirSync(sessDir, { recursive: true });
      writeFileSync(resolve(sessDir, 'session-corrupt-id.json'), '{ not valid json', 'utf-8');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const result = endSession({
          agentkitRoot: TEST_AGENTKIT,
          projectRoot: TEST_PROJECT,
          sessionId: 'corrupt-id',
        });
        expect(result).toBeNull();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Corrupted session file'));
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('recordCommand — fallback edge cases', () => {
    it('skips corrupted session files during O(N) scan', async () => {
      const session = initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });
      const sessDir = resolve(TEST_AGENTKIT, 'logs', 'sessions');
      writeFileSync(resolve(sessDir, 'session-corrupt-x.json'), '{ corrupt', 'utf-8');
      const pointerPath = resolve(TEST_AGENTKIT, 'logs', 'active-session-id');
      if (existsSync(pointerPath)) rmSync(pointerPath);

      await recordCommand(TEST_AGENTKIT, 'check');

      const real = JSON.parse(
        readFileSync(resolve(sessDir, `session-${session.sessionId}.json`), 'utf-8')
      );
      expect(real.commandsRun.map((c) => c.command)).toContain('check');
    });

    it('rejects pointer contents that fail the session-id pattern', async () => {
      initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });
      const pointerPath = resolve(TEST_AGENTKIT, 'logs', 'active-session-id');
      writeFileSync(pointerPath, 'invalid/id', 'utf-8');

      await expect(recordCommand(TEST_AGENTKIT, 'check')).resolves.not.toThrow();

      // Pointer should be self-healed during fallback
      expect(readFileSync(pointerPath, 'utf-8').trim()).toMatch(/^\d{14}-[0-9a-f]+$/);
    });
  });

  describe('generateReport — populated aggregations', () => {
    it('aggregates sessions by user and events by command', () => {
      const month = new Date().toISOString().slice(0, 7);
      writeSession('20260101120000-aggre1', {
        startTime: `${month}-01T10:00:00.000Z`,
        durationMs: 60_000,
        filesModified: 3,
        user: 'alice@example.com',
      });
      writeSession('20260101120000-aggre2', {
        startTime: `${month}-02T11:00:00.000Z`,
        durationMs: 120_000,
        filesModified: 1,
        user: 'alice@example.com',
      });
      writeSession('20260101120000-aggre3', {
        startTime: `${month}-03T11:00:00.000Z`,
        durationMs: null,
        filesModified: undefined,
        user: undefined,
      });
      logEvent(TEST_AGENTKIT, { event: 'command_run', command: 'check' });
      logEvent(TEST_AGENTKIT, { event: 'session_start', user: 'alice' });
      logEvent(TEST_AGENTKIT, { event: 'command_run', command: 'check' });

      const report = generateReport(TEST_AGENTKIT, month);
      expect(report.totalSessions).toBe(3);
      expect(report.byUser['alice@example.com'].sessions).toBe(2);
      expect(report.byUser['alice@example.com'].durationMs).toBe(180_000);
      expect(report.byUser['alice@example.com'].filesModified).toBe(4);
      expect(report.byUser.unknown.sessions).toBe(1);
      expect(report.byCommand.check.count).toBe(2);
      expect(report.byCommand.session_start).toBeUndefined();
    });

    it('returns empty aggregates when month has no sessions or events', () => {
      const report = generateReport(TEST_AGENTKIT, '2020-01');
      expect(report.totalSessions).toBe(0);
      expect(report.totalEvents).toBe(0);
      expect(report.byUser).toEqual({});
      expect(report.byCommand).toEqual({});
    });
  });

  describe('logEvent — directory bootstrap', () => {
    it('creates logsDir if it does not yet exist', () => {
      // Freeze the clock so the path logEvent computes (`usage-YYYY-MM-DD`)
      // matches the path we assert on, even at midnight rollover.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
      const fresh = resolve(TEST_PROJECT, 'fresh-cost-tracker', 'agentkit');
      try {
        if (existsSync(fresh)) rmSync(fresh, { recursive: true });
        mkdirSync(dirname(fresh), { recursive: true });

        logEvent(fresh, { event: 'first' });

        const logPath = resolve(fresh, 'logs', 'usage-2026-05-15.jsonl');
        expect(existsSync(logPath)).toBe(true);
      } finally {
        if (existsSync(dirname(fresh))) rmSync(dirname(fresh), { recursive: true });
        vi.useRealTimers();
      }
    });
  });

  describe('generateSessionId — environment without crypto', () => {
    it('throws a clear error when crypto.getRandomValues is unavailable', () => {
      vi.stubGlobal('crypto', undefined);
      try {
        expect(() => generateSessionId()).toThrow(/crypto\.getRandomValues is not available/);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
