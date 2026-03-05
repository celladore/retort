import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SUGGESTION_STATES,
  TERMINAL_SUGGESTION_STATES,
  listSuggestions,
  loadSuggestion,
  saveSuggestions,
  updateSuggestionStatus,
  wasRejected,
} from '../suggestion-store.mjs';
import { existsSync, promises as fsPromises } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

const { mkdtemp, readdir, rm } = fsPromises;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('suggestion-store constants', () => {
  it('exports valid suggestion states', () => {
    expect(SUGGESTION_STATES).toEqual([
      'pending_review',
      'approved',
      'rejected',
      'deferred',
    ]);
  });

  it('exports terminal states', () => {
    expect(TERMINAL_SUGGESTION_STATES).toEqual(['approved', 'rejected']);
  });
});

// ---------------------------------------------------------------------------
// Store operations
// ---------------------------------------------------------------------------

describe('suggestion-store operations', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(resolve(tmpdir(), 'suggestion-store-test-'));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  const sampleReport = {
    generatedAt: '2026-03-04T00:00:00.000Z',
    suggestions: [
      {
        id: 'SUG-001',
        category: 'documentation',
        title: 'Create README',
        rationale: 'No README found.',
        impact: 'high',
        effort: 'S',
        riskIfSkipped: 'medium',
        alignment: 'high',
        score: 15,
        suggestedArtifacts: [],
      },
      {
        id: 'SUG-002',
        category: 'testing',
        title: 'Add E2E tests',
        rationale: 'No E2E tests found.',
        impact: 'medium',
        effort: 'L',
        riskIfSkipped: 'medium',
        alignment: 'medium',
        score: 10,
        suggestedArtifacts: [],
      },
    ],
  };

  it('saves suggestions with namespaced filenames to avoid ID collisions', async () => {
    const result = await saveSuggestions(tempRoot, sampleReport);

    expect(result.count).toBe(2);

    // Files should be namespaced by timestamp, not bare SUG-NNN
    const dir = resolve(tempRoot, '.claude', 'state', 'suggestions');
    const entries = await readdir(dir);
    const suggestionFiles = entries.filter((e) => e.includes('_SUG-') && e.endsWith('.yaml'));
    expect(suggestionFiles.length).toBe(2);

    // Verify namespacing pattern: timestamp_SUG-NNN.yaml
    for (const file of suggestionFiles) {
      expect(file).toMatch(/_SUG-\d{3}\.yaml$/);
    }
  });

  it('loads a saved suggestion by bare ID (most recent match)', async () => {
    await saveSuggestions(tempRoot, sampleReport);
    const suggestion = await loadSuggestion(tempRoot, 'SUG-001');

    expect(suggestion).not.toBeNull();
    expect(suggestion.title).toBe('Create README');
    expect(suggestion.status).toBe('pending_review');
    expect(suggestion.category).toBe('documentation');
    expect(suggestion).toHaveProperty('namespacedId');
  });

  it('returns null for non-existent suggestion', async () => {
    const suggestion = await loadSuggestion(tempRoot, 'SUG-999');
    expect(suggestion).toBeNull();
  });

  it('rejects invalid suggestion IDs (path traversal prevention)', async () => {
    await expect(loadSuggestion(tempRoot, '../../../etc/passwd')).rejects.toThrow(
      'Invalid suggestion ID',
    );
    await expect(loadSuggestion(tempRoot, 'SUG-001; rm -rf /')).rejects.toThrow(
      'Invalid suggestion ID',
    );
    await expect(loadSuggestion(tempRoot, '')).rejects.toThrow('Invalid suggestion ID');
  });

  it('lists saved suggestions with namespaced IDs', async () => {
    await saveSuggestions(tempRoot, sampleReport);
    const ids = await listSuggestions(tempRoot);

    expect(ids.length).toBe(2);
    for (const id of ids) {
      expect(id).toMatch(/_SUG-\d{3}$/);
    }
  });

  it('returns empty list when no suggestions exist', async () => {
    const ids = await listSuggestions(tempRoot);
    expect(ids).toEqual([]);
  });

  it('updates suggestion status to approved', async () => {
    await saveSuggestions(tempRoot, sampleReport);
    const updated = await updateSuggestionStatus(tempRoot, 'SUG-001', 'approved');

    expect(updated.status).toBe('approved');
    expect(updated).toHaveProperty('statusUpdatedAt');

    // Verify persistence
    const reloaded = await loadSuggestion(tempRoot, 'SUG-001');
    expect(reloaded.status).toBe('approved');
  });

  it('updates suggestion status to deferred with reason', async () => {
    await saveSuggestions(tempRoot, sampleReport);
    const updated = await updateSuggestionStatus(
      tempRoot,
      'SUG-002',
      'deferred',
      'Not a priority this quarter',
    );

    expect(updated.status).toBe('deferred');
    expect(updated.statusReason).toBe('Not a priority this quarter');
  });

  it('rejects invalid status values', async () => {
    await saveSuggestions(tempRoot, sampleReport);

    await expect(
      updateSuggestionStatus(tempRoot, 'SUG-001', 'invalid_status'),
    ).rejects.toThrow('Invalid suggestion status');
  });

  it('rejects updates to non-existent suggestions', async () => {
    await expect(
      updateSuggestionStatus(tempRoot, 'SUG-999', 'approved'),
    ).rejects.toThrow('Suggestion not found');
  });

  it('rejects updates with invalid IDs (path traversal prevention)', async () => {
    await expect(
      updateSuggestionStatus(tempRoot, '../secret', 'approved'),
    ).rejects.toThrow('Invalid suggestion ID');
  });

  it('prevents updates to terminal-state suggestions', async () => {
    await saveSuggestions(tempRoot, sampleReport);
    await updateSuggestionStatus(tempRoot, 'SUG-001', 'approved');

    await expect(
      updateSuggestionStatus(tempRoot, 'SUG-001', 'deferred'),
    ).rejects.toThrow('terminal state');
  });

  it('saves rejection fingerprint on reject', async () => {
    await saveSuggestions(tempRoot, sampleReport);
    await updateSuggestionStatus(tempRoot, 'SUG-001', 'rejected', 'Not needed');

    const rejected = await wasRejected(tempRoot, 'Create README');
    expect(rejected).toBe(true);
  });

  it('rejection check is case-insensitive', async () => {
    await saveSuggestions(tempRoot, sampleReport);
    await updateSuggestionStatus(tempRoot, 'SUG-001', 'rejected', 'Not needed');

    const rejected = await wasRejected(tempRoot, 'create readme');
    expect(rejected).toBe(true);
  });

  it('wasRejected returns false for non-rejected items', async () => {
    await saveSuggestions(tempRoot, sampleReport);

    const rejected = await wasRejected(tempRoot, 'Something else entirely');
    expect(rejected).toBe(false);
  });

  it('wasRejected returns false when no rejections exist', async () => {
    const rejected = await wasRejected(tempRoot, 'Create README');
    expect(rejected).toBe(false);
  });
});
