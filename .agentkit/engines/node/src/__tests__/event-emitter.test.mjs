import { readFileSync, rmSync } from 'fs';
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
  it('creates state directory and writes JSONL event', async () => {
    await emitEvent(TEST_ROOT, 'test_action', { key: 'value' });

    const logPath = resolve(TEST_ROOT, '.agentkit', 'state', 'events.log');
    const content = readFileSync(logPath, 'utf-8').trim();
    const event = JSON.parse(content);

    expect(event.action).toBe('test_action');
    expect(event.key).toBe('value');
    expect(event.timestamp).toBeDefined();
  });

  it('appends multiple events as separate lines', async () => {
    await emitEvent(TEST_ROOT, 'first');
    await emitEvent(TEST_ROOT, 'second');

    const logPath = resolve(TEST_ROOT, '.agentkit', 'state', 'events.log');
    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).action).toBe('first');
    expect(JSON.parse(lines[1]).action).toBe('second');
  });

  it('includes source field when provided', async () => {
    await emitEvent(TEST_ROOT, 'sourced_event', {}, { source: 'orchestrator' });

    const logPath = resolve(TEST_ROOT, '.agentkit', 'state', 'events.log');
    const event = JSON.parse(readFileSync(logPath, 'utf-8').trim());

    expect(event.source).toBe('orchestrator');
  });

  it('omits source field when not provided', async () => {
    await emitEvent(TEST_ROOT, 'no_source');

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
  it('reads events with limit', async () => {
    await emitEvent(TEST_ROOT, 'event1');
    await emitEvent(TEST_ROOT, 'event2');
    await emitEvent(TEST_ROOT, 'event3');

    const events = await readEvents(TEST_ROOT, { limit: 2 });
    expect(events).toHaveLength(2);
    expect(events[0].action).toBe('event3'); // Most recent first
    expect(events[1].action).toBe('event2');
  });

  it('filters by source', async () => {
    await emitEvent(TEST_ROOT, 'event1', {}, { source: 'orchestrator' });
    await emitEvent(TEST_ROOT, 'event2', {}, { source: 'import-issues' });
    await emitEvent(TEST_ROOT, 'event3', {}, { source: 'orchestrator' });

    const events = await readEvents(TEST_ROOT, { source: 'orchestrator' });

    expect(events).toHaveLength(2);
    expect(events.every((e) => e.source === 'orchestrator')).toBe(true);
  });

  it('handles malformed JSONL lines gracefully', async () => {
    // Write a valid event, then corrupt a line
    await emitEvent(TEST_ROOT, 'valid');
    const logPath = resolve(TEST_ROOT, '.agentkit', 'state', 'events.log');
    const { appendFileSync } = require('fs');
    appendFileSync(logPath, 'not-valid-json\n');
    await emitEvent(TEST_ROOT, 'also_valid');

    const events = await readEvents(TEST_ROOT);
    expect(events).toHaveLength(2);
    expect(events[0].action).toBe('also_valid');
    expect(events[1].action).toBe('valid');
  });
});
