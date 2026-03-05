import { describe, expect, it } from 'vitest';
import {
  EFFORT_LEVELS,
  IMPACT_LEVELS,
  SUGGESTION_CATEGORIES,
  formatReportAsMarkdown,
  formatReportAsYaml,
  runExpansionAnalysis,
} from '../expansion-analyzer.mjs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('expansion-analyzer constants', () => {
  it('exports valid suggestion categories', () => {
    expect(SUGGESTION_CATEGORIES).toEqual([
      'documentation',
      'testing',
      'security',
      'architecture',
      'operations',
      'feature',
    ]);
  });

  it('exports valid impact levels', () => {
    expect(IMPACT_LEVELS).toEqual(['critical', 'high', 'medium', 'low']);
  });

  it('exports valid effort levels', () => {
    expect(EFFORT_LEVELS).toEqual(['XS', 'S', 'M', 'L', 'XL']);
  });
});

// ---------------------------------------------------------------------------
// Analysis engine
// ---------------------------------------------------------------------------

describe('runExpansionAnalysis', () => {
  // Use the actual project root for integration-style tests
  const projectRoot = resolve(import.meta.dirname, '..', '..', '..', '..', '..');
  const agentkitRoot = resolve(projectRoot, '.agentkit');

  it('returns a report with required fields', async () => {
    const report = await runExpansionAnalysis({
      projectRoot,
      agentkitRoot,
      flags: { maxSuggestions: 5 },
    });

    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('projectRoot');
    expect(report).toHaveProperty('totalAnalyzersRun');
    expect(report).toHaveProperty('totalRawSuggestions');
    expect(report).toHaveProperty('suggestions');
    expect(Array.isArray(report.suggestions)).toBe(true);
  });

  it('respects maxSuggestions limit', async () => {
    const report = await runExpansionAnalysis({
      projectRoot,
      agentkitRoot,
      flags: { maxSuggestions: 3 },
    });

    expect(report.suggestions.length).toBeLessThanOrEqual(3);
  });

  it('assigns sequential suggestion IDs', async () => {
    const report = await runExpansionAnalysis({
      projectRoot,
      agentkitRoot,
      flags: { maxSuggestions: 5 },
    });

    for (let i = 0; i < report.suggestions.length; i++) {
      expect(report.suggestions[i].id).toBe(`SUG-${String(i + 1).padStart(3, '0')}`);
    }
  });

  it('filters by category', async () => {
    const report = await runExpansionAnalysis({
      projectRoot,
      agentkitRoot,
      flags: { category: 'security', maxSuggestions: 20 },
    });

    expect(report.categoriesAnalyzed).toEqual(['security']);
    for (const s of report.suggestions) {
      expect(s.category).toBe('security');
    }
  });

  it('filters by minimum impact', async () => {
    const report = await runExpansionAnalysis({
      projectRoot,
      agentkitRoot,
      flags: { minImpact: 'high', maxSuggestions: 20 },
    });

    for (const s of report.suggestions) {
      expect(['critical', 'high']).toContain(s.impact);
    }
  });

  it('each suggestion has required properties', async () => {
    const report = await runExpansionAnalysis({
      projectRoot,
      agentkitRoot,
      flags: { maxSuggestions: 10 },
    });

    for (const s of report.suggestions) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('category');
      expect(s).toHaveProperty('title');
      expect(s).toHaveProperty('rationale');
      expect(s).toHaveProperty('impact');
      expect(s).toHaveProperty('effort');
      expect(s).toHaveProperty('riskIfSkipped');
      expect(s).toHaveProperty('alignment');
      expect(s).toHaveProperty('score');
      expect(typeof s.score).toBe('number');
      expect(SUGGESTION_CATEGORIES).toContain(s.category);
      expect(IMPACT_LEVELS).toContain(s.impact);
      expect(EFFORT_LEVELS).toContain(s.effort);
    }
  });

  it('suggestions are sorted by score descending', async () => {
    const report = await runExpansionAnalysis({
      projectRoot,
      agentkitRoot,
      flags: { maxSuggestions: 20 },
    });

    for (let i = 1; i < report.suggestions.length; i++) {
      expect(report.suggestions[i - 1].score).toBeGreaterThanOrEqual(
        report.suggestions[i].score,
      );
    }
  });

  it('handles missing discovery report gracefully', async () => {
    const report = await runExpansionAnalysis({
      projectRoot,
      agentkitRoot,
      discoveryReport: {},
      flags: { maxSuggestions: 5 },
    });

    expect(report).toHaveProperty('suggestions');
    expect(Array.isArray(report.suggestions)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

describe('formatReportAsMarkdown', () => {
  it('produces markdown with header and table', () => {
    const report = {
      generatedAt: '2026-03-04T00:00:00.000Z',
      categoriesAnalyzed: ['documentation', 'testing'],
      totalRawSuggestions: 5,
      totalAfterDedup: 4,
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
          suggestedArtifacts: [{ type: 'docs', path: 'README.md' }],
        },
      ],
    };

    const md = formatReportAsMarkdown(report);
    expect(md).toContain('# Expansion Analysis Report');
    expect(md).toContain('SUG-001');
    expect(md).toContain('Create README');
    expect(md).toContain('documentation, testing');
    expect(md).toContain('No README found.');
  });

  it('handles empty suggestions', () => {
    const report = {
      generatedAt: '2026-03-04T00:00:00.000Z',
      categoriesAnalyzed: ['testing'],
      totalRawSuggestions: 0,
      totalAfterDedup: 0,
      suggestions: [],
    };

    const md = formatReportAsMarkdown(report);
    expect(md).toContain('No suggestions found');
  });
});

describe('formatReportAsYaml', () => {
  it('produces valid YAML string', () => {
    const report = {
      generatedAt: '2026-03-04T00:00:00.000Z',
      suggestions: [],
    };

    const yml = formatReportAsYaml(report);
    expect(typeof yml).toBe('string');
    expect(yml).toContain('generatedAt');
  });
});
