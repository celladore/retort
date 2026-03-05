import { mkdirSync, readFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emitEvent, readEvents } from '../event-emitter.mjs';

const TEST_ROOT = resolve(import.meta.dirname, '__fixtures__', 'event-emitter-test');

beforeEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('emitEvent', () => {
  it('creates state directory and writes JSONL event', () => {
    emitEvent(TEST_ROOT, 'test_action', { key: 'value' });

    const logPath = resolve(TEST_ROOT, '.agentkit', 'state', 'events.log');
    const content = readFileSync(logPath, 'utf-8').trim();
    const event = JSON.parse(content);

    expect(event.action).toBe('test_action');
    expect(event.key).toBe('value');
    expect(event.timestamp).toBeDefined();
  });

  it('appends multiple events as separate lines', () => {
    emitEvent(TEST_ROOT, 'first');
    emitEvent(TEST_ROOT, 'second');

    const logPath = resolve(TEST_ROOT, '.agentkit', 'state', 'events.log');
    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).action).toBe('first');
    expect(JSON.parse(lines[1]).action).toBe('second');
  });

  it('includes source field when provided', () => {
    emitEvent(TEST_ROOT, 'sourced_event', {}, { source: 'orchestrator' });

    const logPath = resolve(TEST_ROOT, '.agentkit', 'state', 'events.log');
    const event = JSON.parse(readFileSync(logPath, 'utf-8').trim());

    expect(event.source).toBe('orchestrator');
  });

  it('omits source field when not provided', () => {
    emitEvent(TEST_ROOT, 'no_source');

    const logPath = resolve(TEST_ROOT, '.agentkit', 'state', 'events.log');
    const event = JSON.parse(readFileSync(logPath, 'utf-8').trim());

    expect(event.source).toBeUndefined();
  });

  it('does not throw on write failure', () => {
    // Pass an invalid path that cannot be created
    expect(() => {
      emitEvent('', 'should_not_throw');
    }).not.toThrow();
  });
});

describe('readEvents', () => {
  it('returns empty array when no events file exists', () => {
    expect(readEvents(TEST_ROOT)).toEqual([]);
  });

  it('reads all events by default (up to limit)', () => {
    emitEvent(TEST_ROOT, 'a');
    emitEvent(TEST_ROOT, 'b');
    emitEvent(TEST_ROOT, 'c');

    const events = readEvents(TEST_ROOT);

    expect(events).toHaveLength(3);
    expect(events.map((e) => e.action)).toEqual(['a', 'b', 'c']);
  });

  it('respects limit option', () => {
    for (let i = 0; i < 10; i++) {
      emitEvent(TEST_ROOT, `event_${i}`);
    }

    const events = readEvents(TEST_ROOT, { limit: 3 });

    expect(events).toHaveLength(3);
    expect(events[0].action).toBe('event_7');
  });

  it('filters by action', () => {
    emitEvent(TEST_ROOT, 'check_completed', { result: 'pass' });
    emitEvent(TEST_ROOT, 'import_issues', { added: 5 });
    emitEvent(TEST_ROOT, 'check_completed', { result: 'fail' });

    const events = readEvents(TEST_ROOT, { action: 'check_completed' });

    expect(events).toHaveLength(2);
    expect(events.every((e) => e.action === 'check_completed')).toBe(true);
  });

  it('filters by source', () => {
    emitEvent(TEST_ROOT, 'event1', {}, { source: 'orchestrator' });
    emitEvent(TEST_ROOT, 'event2', {}, { source: 'import-issues' });
    emitEvent(TEST_ROOT, 'event3', {}, { source: 'orchestrator' });

    const events = readEvents(TEST_ROOT, { source: 'orchestrator' });

    expect(events).toHaveLength(2);
    expect(events.every((e) => e.source === 'orchestrator')).toBe(true);
  });

  it('handles malformed JSONL lines gracefully', () => {
    // Write a valid event, then corrupt a line
    emitEvent(TEST_ROOT, 'valid');
    const logPath = resolve(TEST_ROOT, '.agentkit', 'state', 'events.log');
    const { appendFileSync } = require('fs');
    appendFileSync(logPath, 'not-valid-json\n');
    emitEvent(TEST_ROOT, 'also_valid');

    const events = readEvents(TEST_ROOT);

    expect(events).toHaveLength(2);
    expect(events[0].action).toBe('valid');
    expect(events[1].action).toBe('also_valid');
  });
});
