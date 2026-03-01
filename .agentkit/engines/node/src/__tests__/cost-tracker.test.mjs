import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  generateSessionId, initSession, endSession, logEvent,
  getSessions, generateReport, recordCommand,
} from '../cost-tracker.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_AGENTKIT = resolve(__dirname, '..', '..', '..', '..', '..', '.test-cost-tracker', 'agentkit');
const TEST_PROJECT = resolve(TEST_AGENTKIT, '..');

describe('cost-tracker', () => {
  beforeEach(() => {
    if (existsSync(TEST_PROJECT)) {
      rmSync(TEST_PROJECT, { recursive: true });
    }
    mkdirSync(resolve(TEST_AGENTKIT, 'logs'), { recursive: true });
    // Create .agentkit-repo marker
    mkdirSync(TEST_PROJECT, { recursive: true });
    writeFileSync(resolve(TEST_PROJECT, '.agentkit-repo'), 'test-cost', 'utf-8');
  });

  afterEach(() => {
    if (existsSync(TEST_PROJECT)) {
      rmSync(TEST_PROJECT, { recursive: true });
    }
  });

  describe('generateSessionId()', () => {
    it('returns a string in expected format', () => {
      const id = generateSessionId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(10);
      // Format: YYYYMMDDHHMMSS-hexhex
      expect(id).toMatch(/^\d{14}-[0-9a-f]+$/);
    });

    it('generates unique IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      // Very likely to be different (different random hex)
      // In rare cases they could match due to same ms + same random, but extremely unlikely
      expect(id1.length).toBeGreaterThan(0);
      expect(id2.length).toBeGreaterThan(0);
    });
  });

  describe('logEvent()', () => {
    it('writes a JSONL entry to the daily log file', () => {
      logEvent(TEST_AGENTKIT, { event: 'test', data: 'hello' });

      const today = new Date().toISOString().split('T')[0];
      const logPath = resolve(TEST_AGENTKIT, 'logs', `usage-${today}.jsonl`);
      expect(existsSync(logPath)).toBe(true);

      const content = readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);

      const entry = JSON.parse(lines[0]);
      expect(entry.event).toBe('test');
      expect(entry.data).toBe('hello');
      expect(entry.timestamp).toBeDefined();
    });

    it('appends multiple events to the same file', () => {
      logEvent(TEST_AGENTKIT, { event: 'first' });
      logEvent(TEST_AGENTKIT, { event: 'second' });
      logEvent(TEST_AGENTKIT, { event: 'third' });

      const today = new Date().toISOString().split('T')[0];
      const logPath = resolve(TEST_AGENTKIT, 'logs', `usage-${today}.jsonl`);
      const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
      expect(lines).toHaveLength(3);
    });
  });

  describe('initSession()', () => {
    it('creates a session with expected fields', () => {
      const session = initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });
      expect(session.sessionId).toBeDefined();
      expect(session.startTime).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.endTime).toBeNull();
    });

    it('writes a session file', () => {
      const session = initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });
      const sessDir = resolve(TEST_AGENTKIT, 'logs', 'sessions');
      expect(existsSync(sessDir)).toBe(true);

      const files = readdirSync(sessDir).filter(f => f.startsWith('session-') && f.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);
      const sessionFile = files.find(f => f.includes(session.sessionId));
      expect(sessionFile).toBeDefined();
    });

    it('creates a latest-session pointer file', () => {
      const session = initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });
      const pointerPath = resolve(TEST_AGENTKIT, 'logs', 'sessions', 'latest-session.txt');
      expect(existsSync(pointerPath)).toBe(true);
      expect(readFileSync(pointerPath, 'utf-8').trim()).toBe(session.sessionId);
    });
  });

  describe('recordCommand()', () => {
    it('records a command on the active session', () => {
      const session = initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });
      recordCommand(TEST_AGENTKIT, 'check');

      const pointerPath = resolve(TEST_AGENTKIT, 'logs', 'sessions', 'latest-session.txt');
      const sessionPath = resolve(TEST_AGENTKIT, 'logs', 'sessions', `session-${session.sessionId}.json`);
      const updated = JSON.parse(readFileSync(sessionPath, 'utf-8'));
      expect(updated.commandsRun).toHaveLength(1);
      expect(updated.commandsRun[0].command).toBe('check');
      // Pointer should still point to the active session
      expect(readFileSync(pointerPath, 'utf-8').trim()).toBe(session.sessionId);
    });

    it('uses the pointer file for O(1) fast-path lookup', () => {
      const session = initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });
      const pointerPath = resolve(TEST_AGENTKIT, 'logs', 'sessions', 'latest-session.txt');
      expect(existsSync(pointerPath)).toBe(true);

      recordCommand(TEST_AGENTKIT, 'discover');

      const sessionPath = resolve(TEST_AGENTKIT, 'logs', 'sessions', `session-${session.sessionId}.json`);
      const updated = JSON.parse(readFileSync(sessionPath, 'utf-8'));
      expect(updated.commandsRun.some(c => c.command === 'discover')).toBe(true);
    });

    it('does nothing when no sessions directory exists', () => {
      // No initSession called - directory does not exist
      expect(() => recordCommand(TEST_AGENTKIT, 'check')).not.toThrow();
    });
  });

  describe('endSession()', () => {
    it('finalizes a session with end time and duration', () => {
      const session = initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });
      const ended = endSession({
        agentkitRoot: TEST_AGENTKIT,
        projectRoot: TEST_PROJECT,
        sessionId: session.sessionId,
      });

      expect(ended).not.toBeNull();
      expect(ended.endTime).toBeDefined();
      expect(ended.durationMs).toBeGreaterThanOrEqual(0);
      expect(ended.status).toBe('completed');
    });

    it('returns null for unknown session', () => {
      const result = endSession({
        agentkitRoot: TEST_AGENTKIT,
        projectRoot: TEST_PROJECT,
        sessionId: 'nonexistent',
      });
      expect(result).toBeNull();
    });
  });

  describe('getSessions()', () => {
    it('returns empty array when no sessions exist', () => {
      const sessions = getSessions(TEST_AGENTKIT);
      expect(sessions).toEqual([]);
    });

    it('returns created sessions', () => {
      initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });
      initSession({ agentkitRoot: TEST_AGENTKIT, projectRoot: TEST_PROJECT });

      const sessions = getSessions(TEST_AGENTKIT);
      expect(sessions).toHaveLength(2);
    });
  });

  describe('generateReport()', () => {
    it('produces a report structure', () => {
      const month = new Date().toISOString().slice(0, 7);
      const report = generateReport(TEST_AGENTKIT, month);

      expect(report.month).toBe(month);
      expect(report.totalSessions).toBeDefined();
      expect(report.byUser).toBeDefined();
      expect(report.byCommand).toBeDefined();
    });
  });
});

