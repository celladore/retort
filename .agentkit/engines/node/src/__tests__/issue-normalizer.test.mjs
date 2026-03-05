import { describe, it, expect } from 'vitest';
import {
  normalizeIssue,
  deduplicateItems,
  inferPriority,
  inferTeam,
  mapStatus,
  extractAcceptanceCriteria,
  extractFilePaths,
  inferCategoryScores,
} from '../issue-normalizer.mjs';

describe('inferPriority', () => {
  const labelsMap = { bug: 'P1', critical: 'P0', enhancement: 'P2', security: 'P0' };

  it('returns P0 for critical labels', () => {
    expect(inferPriority(['critical'], labelsMap)).toBe('P0');
  });

  it('returns P1 for bug labels', () => {
    expect(inferPriority(['bug'], labelsMap)).toBe('P1');
  });

  it('returns highest priority when multiple labels match', () => {
    expect(inferPriority(['bug', 'critical'], labelsMap)).toBe('P0');
  });

  it('returns default P2 when no labels match', () => {
    expect(inferPriority(['unrelated'], labelsMap)).toBe('P2');
  });

  it('returns default P2 for empty labels', () => {
    expect(inferPriority([], labelsMap)).toBe('P2');
  });

  it('matches case-insensitively', () => {
    expect(inferPriority(['BUG'], labelsMap)).toBe('P1');
  });
});

describe('inferTeam', () => {
  const teamMap = { backend: 'backend', frontend: 'frontend', api: 'backend' };

  it('maps backend label to backend team', () => {
    expect(inferTeam(['backend'], teamMap, 'product')).toBe('backend');
  });

  it('maps api label to backend team', () => {
    expect(inferTeam(['api'], teamMap, 'product')).toBe('backend');
  });

  it('falls back to default team when no match', () => {
    expect(inferTeam(['unrelated'], teamMap, 'product')).toBe('product');
  });

  it('falls back for empty labels', () => {
    expect(inferTeam([], teamMap, 'product')).toBe('product');
  });
});

describe('mapStatus', () => {
  const stateMap = { open: 'open', closed: 'completed' };

  it('maps open state', () => {
    expect(mapStatus('open', stateMap)).toBe('open');
  });

  it('maps closed state', () => {
    expect(mapStatus('closed', stateMap)).toBe('completed');
  });

  it('returns default for unknown state', () => {
    expect(mapStatus('merged', stateMap)).toBe('open');
  });
});

describe('extractAcceptanceCriteria', () => {
  it('extracts checkbox items from body', () => {
    const body = '## Tasks\n- [ ] Fix the bug\n- [x] Add tests\n- [ ] Update docs';
    const criteria = extractAcceptanceCriteria(body);
    expect(criteria).toEqual(['Fix the bug', 'Add tests', 'Update docs']);
  });

  it('returns empty for body without checkboxes', () => {
    expect(extractAcceptanceCriteria('No checkboxes here')).toEqual([]);
  });

  it('returns empty for null body', () => {
    expect(extractAcceptanceCriteria(null)).toEqual([]);
  });
});

describe('extractFilePaths', () => {
  it('extracts backtick-quoted file paths', () => {
    const body = 'Fix `src/auth/token.ts` and `lib/utils.mjs`';
    const paths = extractFilePaths(body);
    expect(paths).toContain('src/auth/token.ts');
    expect(paths).toContain('lib/utils.mjs');
  });

  it('extracts paths starting with known directories', () => {
    const body = 'The issue is in src/components/Header.tsx';
    const paths = extractFilePaths(body);
    expect(paths).toContain('src/components/Header.tsx');
  });

  it('returns empty for null body', () => {
    expect(extractFilePaths(null)).toEqual([]);
  });
});

describe('normalizeIssue', () => {
  const config = {
    importLabelsMap: { bug: 'P1', critical: 'P0' },
    importStateMap: { open: 'open', closed: 'completed' },
    importTeamMap: { backend: 'backend' },
    ownerTeam: 'product',
    source: 'github',
  };

  const rawIssue = {
    number: 42,
    title: 'Fix auth timeout',
    body: '## Problem\nToken refresh fails.\n\n- [ ] Fix refresh logic\n- [ ] Add retry\n\nSee `src/auth/refresh.ts`',
    state: 'open',
    labels: [{ name: 'bug' }, { name: 'backend' }],
    assignees: [{ login: 'jdoe' }],
    milestone: { title: 'v2.1' },
    url: 'https://github.com/org/repo/issues/42',
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: '2026-03-01T14:30:00Z',
    closedAt: null,
  };

  it('normalizes a GitHub issue correctly', () => {
    const item = normalizeIssue(rawIssue, config);

    expect(item.externalId).toBe('GH#42');
    expect(item.title).toBe('Fix auth timeout');
    expect(item.priority).toBe('P1');
    expect(item.status).toBe('open');
    expect(item.team).toBe('backend');
    expect(item.assignee).toBe('jdoe');
    expect(item.source).toBe('github');
    expect(item.milestone).toBe('v2.1');
    expect(item.acceptance).toContain('Fix refresh logic');
    expect(item.files).toContain('src/auth/refresh.ts');
    expect(item.id).toMatch(/^bi-github-/);
    expect(item.dirty).toBe(false);
  });

  it('handles string labels', () => {
    const issue = { ...rawIssue, labels: ['bug', 'backend'] };
    const item = normalizeIssue(issue, config);
    expect(item.priority).toBe('P1');
    expect(item.team).toBe('backend');
  });

  it('handles missing fields gracefully', () => {
    const minimal = { number: 1, title: 'Test', state: 'open' };
    const item = normalizeIssue(minimal, config);
    expect(item.title).toBe('Test');
    expect(item.priority).toBe('P2');
    expect(item.team).toBe('product');
  });
});

describe('deduplicateItems', () => {
  it('adds new items', () => {
    const existing = [];
    const incoming = [{ externalId: 'GH#1', title: 'Issue 1', dirty: false }];
    const result = deduplicateItems(existing, incoming);
    expect(result.added).toBe(1);
    expect(result.merged).toHaveLength(1);
  });

  it('updates existing items by externalId', () => {
    const existing = [{ externalId: 'GH#1', title: 'Old title', dirty: false }];
    const incoming = [{ externalId: 'GH#1', title: 'New title', dirty: false }];
    const result = deduplicateItems(existing, incoming);
    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
    expect(result.merged[0].title).toBe('New title');
  });

  it('preserves manual items without externalId', () => {
    const existing = [{ externalId: null, title: 'Manual item', dirty: false }];
    const incoming = [{ externalId: 'GH#1', title: 'New issue', dirty: false }];
    const result = deduplicateItems(existing, incoming);
    expect(result.preserved).toBe(1);
    expect(result.merged).toHaveLength(2);
  });

  it('preserves dirty local overrides', () => {
    const existing = [
      { externalId: 'GH#1', title: 'Issue', team: 'my-override', priority: 'P0', dirty: true },
    ];
    const incoming = [
      { externalId: 'GH#1', title: 'Updated', team: 'backend', priority: 'P2', dirty: false },
    ];
    const result = deduplicateItems(existing, incoming);
    expect(result.merged[0].team).toBe('my-override');
    expect(result.merged[0].priority).toBe('P0');
    expect(result.merged[0].title).toBe('Updated');
  });

  it('deduplicates manual items by title on repeated imports', () => {
    const existing = [{ externalId: null, title: 'Manual task', dirty: false }];
    const incoming = [{ externalId: null, title: 'Manual task', dirty: false }];
    const result = deduplicateItems(existing, incoming);
    // Should not duplicate the manual item
    const manuals = result.merged.filter((i) => !i.externalId);
    expect(manuals).toHaveLength(1);
  });

  it('allows different-titled manual items from incoming', () => {
    const existing = [{ externalId: null, title: 'Existing manual', dirty: false }];
    const incoming = [{ externalId: null, title: 'New manual', dirty: false }];
    const result = deduplicateItems(existing, incoming);
    const manuals = result.merged.filter((i) => !i.externalId);
    expect(manuals).toHaveLength(2);
    expect(result.added).toBe(1);
  });
});

describe('inferCategoryScores', () => {
  it('maps P0 priority to severity 10', () => {
    const scores = inferCategoryScores({ priority: 'P0', labels: [] });
    expect(scores.severity).toBe(10);
  });

  it('maps P3 priority to severity 3', () => {
    const scores = inferCategoryScores({ priority: 'P3', labels: [] });
    expect(scores.severity).toBe(3);
  });

  it('defaults severity to 5 for unknown priority', () => {
    const scores = inferCategoryScores({ priority: 'unknown', labels: [] });
    expect(scores.severity).toBe(5);
  });

  it('detects breaking/blocker labels as high impact', () => {
    const scores = inferCategoryScores({ priority: 'P2', labels: ['breaking-change'] });
    expect(scores.impact).toBe(9);
  });

  it('detects urgent labels as high urgency', () => {
    const scores = inferCategoryScores({ priority: 'P2', labels: ['urgent'] });
    expect(scores.urgency).toBe(9);
  });

  it('detects security labels as high risk', () => {
    const scores = inferCategoryScores({ priority: 'P2', labels: ['security'] });
    expect(scores.risk).toBe(8);
  });

  it('returns neutral scores for items with no special labels', () => {
    const scores = inferCategoryScores({ priority: 'P2', labels: ['enhancement'] });
    expect(scores.impact).toBe(5);
    expect(scores.urgency).toBe(5);
    expect(scores.effort).toBe(5);
    expect(scores.alignment).toBe(5);
    expect(scores.risk).toBe(5);
  });

  it('handles missing labels gracefully', () => {
    const scores = inferCategoryScores({ priority: 'P1' });
    expect(scores.severity).toBe(7);
    expect(scores.impact).toBe(5);
  });
});
