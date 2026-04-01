import { describe, expect, it } from 'vitest';
import { buildTeamsList } from '../var-builders.mjs';

describe('buildTeamsList', () => {
  it('should map a fully-populated team correctly', () => {
    const teams = [
      {
        id: 'backend',
        name: 'BACKEND',
        focus: 'API, services, core logic',
        scope: ['apps/api/**', 'services/**'],
        accepts: ['implement', 'review', 'plan'],
        'handoff-chain': ['testing', 'docs'],
      },
    ];

    const result = buildTeamsList(teams);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'backend',
      name: 'BACKEND',
      focus: 'API, services, core logic',
      scopeDisplay: '`apps/api/**`, `services/**`',
      acceptsDisplay: 'implement, review, plan',
      handoffDisplay: 'testing → docs',
    });
  });

  it('should return "—" for empty handoff-chain array', () => {
    const teams = [
      {
        id: 'security',
        name: 'SECURITY',
        focus: 'Auth, compliance',
        scope: ['auth/**'],
        accepts: ['review'],
        'handoff-chain': [],
      },
    ];

    const result = buildTeamsList(teams);

    expect(result[0].handoffDisplay).toBe('—');
  });

  it('should return "—" when handoff-chain is missing', () => {
    const teams = [{ id: 'quality', name: 'QUALITY', focus: 'Review', scope: [], accepts: [] }];

    const result = buildTeamsList(teams);

    expect(result[0].handoffDisplay).toBe('—');
  });

  it('should return "—" when handoff-chain is null', () => {
    const teams = [
      {
        id: 'docs',
        name: 'DOCS',
        focus: 'Documentation',
        scope: [],
        accepts: [],
        'handoff-chain': null,
      },
    ];

    const result = buildTeamsList(teams);

    expect(result[0].handoffDisplay).toBe('—');
  });

  it('should handle empty teams array', () => {
    expect(buildTeamsList([])).toEqual([]);
  });

  it('should handle null/undefined input', () => {
    expect(buildTeamsList(null)).toEqual([]);
    expect(buildTeamsList(undefined)).toEqual([]);
  });

  it('should default missing fields to empty strings', () => {
    const teams = [{}];

    const result = buildTeamsList(teams);

    expect(result[0]).toEqual({
      id: '',
      name: '',
      focus: '',
      scopeDisplay: '',
      acceptsDisplay: '',
      handoffDisplay: '—',
    });
  });

  it('should handle non-array scope gracefully', () => {
    const teams = [{ id: 't1', name: 'T', focus: '', scope: 'not-an-array', accepts: [] }];

    const result = buildTeamsList(teams);

    expect(result[0].scopeDisplay).toBe('');
  });

  it('should wrap each scope pattern in backticks', () => {
    const teams = [{ id: 't1', name: 'T', focus: '', scope: ['src/**', 'lib/**'], accepts: [] }];

    const result = buildTeamsList(teams);

    expect(result[0].scopeDisplay).toBe('`src/**`, `lib/**`');
  });

  it('should handle single-element handoff chain', () => {
    const teams = [
      {
        id: 'testing',
        name: 'TESTING',
        focus: 'Tests',
        scope: [],
        accepts: [],
        'handoff-chain': ['quality'],
      },
    ];

    const result = buildTeamsList(teams);

    expect(result[0].handoffDisplay).toBe('quality');
  });
});
