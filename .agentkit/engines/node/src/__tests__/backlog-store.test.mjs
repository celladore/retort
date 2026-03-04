import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import {
  readBacklogJson,
  writeBacklogJson,
  readBacklogMarkdown,
  writeBacklogMarkdown,
  filterItems,
  sortItems,
} from '../backlog-store.mjs';

describe('backlog-store', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'agentkit-backlog-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const sampleItems = [
    {
      id: 'bi-github-abc',
      externalId: 'GH#1',
      title: 'Fix auth bug',
      priority: 'P1',
      status: 'open',
      phase: 'Planning',
      team: 'backend',
      source: 'github',
      what: 'Auth tokens expire',
      why: '',
      acceptance: [],
      files: [],
      labels: ['bug'],
      milestone: null,
    },
    {
      id: 'bi-github-def',
      externalId: 'GH#2',
      title: 'Add dashboard',
      priority: 'P2',
      status: 'open',
      phase: 'Discovery',
      team: 'frontend',
      source: 'github',
      what: 'New dashboard page',
      why: '',
      acceptance: [],
      files: [],
      labels: ['enhancement'],
      milestone: 'v2',
    },
    {
      id: null,
      externalId: null,
      title: 'Manual task',
      priority: 'P3',
      status: 'open',
      phase: 'Planning',
      team: 'docs',
      source: 'manual',
      what: 'Write docs',
      why: '',
      acceptance: [],
      files: [],
      labels: [],
      milestone: null,
    },
  ];

  describe('JSON store', () => {
    it('returns empty array when file does not exist', () => {
      expect(readBacklogJson(tempDir)).toEqual([]);
    });

    it('writes and reads items round-trip', async () => {
      await writeBacklogJson(tempDir, sampleItems);

      const read = readBacklogJson(tempDir);
      expect(read).toHaveLength(3);
      expect(read[0].externalId).toBe('GH#1');
      expect(read[1].title).toBe('Add dashboard');
    });

    it('includes metadata in JSON file', async () => {
      await writeBacklogJson(tempDir, sampleItems);

      const raw = JSON.parse(
        readFileSync(resolve(tempDir, '.claude', 'state', 'backlog.json'), 'utf-8')
      );
      expect(raw.version).toBe(1);
      expect(raw.count).toBe(3);
      expect(raw.lastUpdated).toBeTruthy();
    });
  });

  describe('Markdown store', () => {
    it('returns empty array when file does not exist', () => {
      expect(readBacklogMarkdown(tempDir)).toEqual([]);
    });

    it('writes markdown with priority sections', async () => {
      await writeBacklogMarkdown(tempDir, sampleItems, 'test-repo');

      const content = readFileSync(resolve(tempDir, 'AGENT_BACKLOG.md'), 'utf-8');
      expect(content).toContain('# Agent Backlog — test-repo');
      expect(content).toContain('## P1 — High Priority');
      expect(content).toContain('Fix auth bug');
      expect(content).toContain('GH#1');
      expect(content).toContain('## P2 — Medium Priority');
      expect(content).toContain('Add dashboard');
    });
  });

  describe('filterItems', () => {
    it('filters by team', () => {
      const result = filterItems(sampleItems, { team: 'backend' });
      expect(result).toHaveLength(1);
      expect(result[0].team).toBe('backend');
    });

    it('filters by priority', () => {
      const result = filterItems(sampleItems, { priority: 'P1,P2' });
      expect(result).toHaveLength(2);
    });

    it('filters by source', () => {
      const result = filterItems(sampleItems, { source: 'manual' });
      expect(result).toHaveLength(1);
    });

    it('combines filters', () => {
      const result = filterItems(sampleItems, { team: 'backend', priority: 'P1' });
      expect(result).toHaveLength(1);
    });

    it('returns all items with no filters', () => {
      expect(filterItems(sampleItems, {})).toHaveLength(3);
    });
  });

  describe('sortItems', () => {
    it('sorts by priority (default)', () => {
      const reversed = [...sampleItems].reverse();
      const sorted = sortItems(reversed, 'priority');
      expect(sorted[0].priority).toBe('P1');
      expect(sorted[1].priority).toBe('P2');
      expect(sorted[2].priority).toBe('P3');
    });

    it('sorts by team', () => {
      const sorted = sortItems(sampleItems, 'team');
      expect(sorted[0].team).toBe('backend');
      expect(sorted[1].team).toBe('docs');
      expect(sorted[2].team).toBe('frontend');
    });
  });
});
