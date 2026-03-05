import { describe, it, expect } from 'vitest';
import {
  calculateScore,
  validateWeights,
  DEFAULT_WEIGHTS,
  PHASE_ADJUSTMENTS,
  DEFAULT_THRESHOLDS,
} from '../weighted-scorer.mjs';

describe('validateWeights', () => {
  it('validates default weights sum to 100', () => {
    const result = validateWeights(DEFAULT_WEIGHTS);
    expect(result.valid).toBe(true);
    expect(result.sum).toBe(100);
  });

  it('rejects weights that do not sum to 100', () => {
    const result = validateWeights({ severity: 50, impact: 30 });
    expect(result.valid).toBe(false);
    expect(result.sum).toBe(80);
  });
});

describe('calculateScore', () => {
  it('returns score between 0 and 100', () => {
    const { score } = calculateScore({
      severity: 8,
      impact: 7,
      urgency: 6,
      effort: 3,
      alignment: 8,
      risk: 5,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns maximum score when all categories are 10', () => {
    const { score } = calculateScore({
      severity: 10,
      impact: 10,
      urgency: 10,
      effort: 10,
      alignment: 10,
      risk: 10,
    });
    // Effort has negative weight (-10), so all-10s: positive categories contribute
    // 90% of weight * 10 = 90, effort contributes -10% * 10 = -10, total = 80
    expect(score).toBe(80);
  });

  it('returns minimum score when all categories are 0', () => {
    const { score } = calculateScore({
      severity: 0,
      impact: 0,
      urgency: 0,
      effort: 0,
      alignment: 0,
      risk: 0,
    });
    expect(score).toBe(0);
  });

  it('defaults missing categories to 5', () => {
    const full = calculateScore({
      severity: 5,
      impact: 5,
      urgency: 5,
      effort: 5,
      alignment: 5,
      risk: 5,
    });
    const partial = calculateScore({});

    expect(partial.score).toBe(full.score);
  });

  it('clamps input scores to [0, 10]', () => {
    const normal = calculateScore({ severity: 10 });
    const over = calculateScore({ severity: 15 });
    const under = calculateScore({ severity: -5 });
    const zero = calculateScore({ severity: 0 });

    expect(over.score).toBe(normal.score);
    expect(under.breakdown.severity).toBe(zero.breakdown.severity);
  });

  it('maps high scores to P0', () => {
    const { priority } = calculateScore({
      severity: 10,
      impact: 10,
      urgency: 10,
      effort: 0,
      alignment: 10,
      risk: 10,
    });
    expect(priority).toBe('P0');
  });

  it('maps low scores to P3', () => {
    const { priority } = calculateScore({
      severity: 1,
      impact: 1,
      urgency: 1,
      effort: 9,
      alignment: 1,
      risk: 1,
    });
    expect(priority).toBe('P3');
  });

  it('provides breakdown per category', () => {
    const { breakdown } = calculateScore({
      severity: 8,
      impact: 7,
      urgency: 6,
      effort: 3,
      alignment: 8,
      risk: 5,
    });

    expect(Object.keys(breakdown)).toEqual(
      expect.arrayContaining(['severity', 'impact', 'urgency', 'effort', 'alignment', 'risk'])
    );
    // Effort has negative weight, so its contribution should be negative
    expect(breakdown.effort).toBeLessThan(0);
  });

  it('applies phase adjustments', () => {
    const scores = {
      severity: 8,
      impact: 7,
      urgency: 6,
      effort: 3,
      alignment: 8,
      risk: 5,
    };

    const noPhase = calculateScore(scores);
    const legacy = calculateScore(scores, { phase: 'legacy' });

    // Legacy phase boosts severity (1.5x) and risk (2.0x), so score should differ
    expect(legacy.score).not.toBe(noPhase.score);
  });

  it('ignores unknown phase', () => {
    const scores = { severity: 8, impact: 7 };
    const result = calculateScore(scores, { phase: 'unknown-phase' });

    expect(result.score).toBeGreaterThan(0);
  });

  it('accepts custom weights', () => {
    const scores = { severity: 10, impact: 0 };

    const severityOnly = calculateScore(scores, {
      weights: { severity: 100, impact: 0 },
    });

    expect(severityOnly.score).toBe(100);
  });

  it('accepts custom thresholds', () => {
    const { priority } = calculateScore(
      { severity: 7, impact: 7, urgency: 7, effort: 3, alignment: 7, risk: 7 },
      { thresholds: { Critical: 90, High: 70, Medium: 40, Low: 0 } }
    );
    expect(['Critical', 'High', 'Medium', 'Low']).toContain(priority);
  });

  it('handles zero-sum weights gracefully', () => {
    const { score, priority } = calculateScore({ severity: 10 }, { weights: {} });
    expect(score).toBe(0);
    expect(priority).toBe('P3');
  });
});

describe('PHASE_ADJUSTMENTS', () => {
  it('has entries for all standard phases', () => {
    expect(Object.keys(PHASE_ADJUSTMENTS)).toEqual(
      expect.arrayContaining(['greenfield', 'active', 'maintenance', 'legacy'])
    );
  });
});

describe('DEFAULT_THRESHOLDS', () => {
  it('has descending thresholds from P0 to P3', () => {
    expect(DEFAULT_THRESHOLDS.P0).toBeGreaterThan(DEFAULT_THRESHOLDS.P1);
    expect(DEFAULT_THRESHOLDS.P1).toBeGreaterThan(DEFAULT_THRESHOLDS.P2);
    expect(DEFAULT_THRESHOLDS.P2).toBeGreaterThan(DEFAULT_THRESHOLDS.P3);
  });
});
