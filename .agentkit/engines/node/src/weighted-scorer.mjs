/**
 * AgentKit Forge — Weighted Priority Scorer
 * Deterministic scoring system for backlog items. Category scores (0-10) are
 * supplied by agents; weights and phase adjustments are configurable in
 * project.yaml. The final score (0-100) maps to P0-P3 via thresholds.
 */

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

export const DEFAULT_WEIGHTS = {
  severity: 25,
  impact: 20,
  urgency: 15,
  effort: -10,
  alignment: 15,
  risk: 15,
};

export const PHASE_ADJUSTMENTS = {
  greenfield: { severity: 0.8, alignment: 1.5 },
  active: { severity: 1.0, impact: 1.2 },
  maintenance: { severity: 1.3, risk: 1.5 },
  legacy: { severity: 1.5, risk: 2.0 },
};

export const DEFAULT_THRESHOLDS = {
  P0: 80,
  P1: 60,
  P2: 40,
  P3: 0,
};

// ---------------------------------------------------------------------------
// Core scoring
// ---------------------------------------------------------------------------

/**
 * Calculate a weighted priority score from category scores.
 *
 * @param {Record<string, number>} categoryScores - Scores per category (0-10).
 *   Expected keys: severity, impact, urgency, effort, alignment, risk.
 *   Missing categories default to 5 (neutral). Values are clamped to [0, 10].
 * @param {object} [opts={}]
 * @param {Record<string, number>} [opts.weights] - Custom weights (must sum to 100 in absolute values)
 * @param {string} [opts.phase] - Project phase for adjustment multipliers
 * @param {Record<string, Record<string, number>>} [opts.phaseAdjustments] - Custom phase adjustments
 * @param {Record<string, number>} [opts.thresholds] - Custom priority thresholds
 * @returns {{ score: number, priority: string, breakdown: Record<string, number> }}
 */
export function calculateScore(categoryScores, opts = {}) {
  const weights = opts.weights || DEFAULT_WEIGHTS;
  const phase = opts.phase || null;
  const phaseAdj = opts.phaseAdjustments || PHASE_ADJUSTMENTS;
  const thresholds = opts.thresholds || DEFAULT_THRESHOLDS;

  // Apply phase adjustments to weights
  const adjustedWeights = { ...weights };
  if (phase && phaseAdj[phase]) {
    const multipliers = phaseAdj[phase];
    for (const [category, multiplier] of Object.entries(multipliers)) {
      if (category in adjustedWeights) {
        adjustedWeights[category] = adjustedWeights[category] * multiplier;
      }
    }
  }

  // Calculate the sum of absolute weight values for normalization
  const absWeightSum = Object.values(adjustedWeights).reduce(
    (sum, w) => sum + Math.abs(w),
    0
  );

  if (absWeightSum === 0) {
    return { score: 0, priority: 'P3', breakdown: {} };
  }

  // Calculate weighted score
  const breakdown = {};
  let rawScore = 0;

  for (const [category, weight] of Object.entries(adjustedWeights)) {
    // Clamp input score to [0, 10], default to 5 if missing
    const inputScore = Math.max(0, Math.min(10, categoryScores[category] ?? 5));
    // For negative weights (e.g. effort), higher input = lower contribution
    const contribution = (weight / absWeightSum) * inputScore * 10;
    breakdown[category] = Math.round(contribution * 100) / 100;
    rawScore += contribution;
  }

  // Clamp final score to [0, 100]
  const score = Math.round(Math.max(0, Math.min(100, rawScore)) * 100) / 100;

  // Map score to priority
  const priority = scoreToPriority(score, thresholds);

  return { score, priority, breakdown };
}

/**
 * Map a numeric score to a priority label using thresholds.
 * @param {number} score
 * @param {Record<string, number>} thresholds
 * @returns {string}
 */
function scoreToPriority(score, thresholds) {
  const sorted = Object.entries(thresholds).sort(([, a], [, b]) => b - a);
  for (const [priority, threshold] of sorted) {
    if (score >= threshold) return priority;
  }
  return sorted[sorted.length - 1]?.[0] || 'P3';
}

/**
 * Validate that weights sum to 100 (absolute values).
 * @param {Record<string, number>} weights
 * @returns {{ valid: boolean, sum: number }}
 */
export function validateWeights(weights) {
  const sum = Object.values(weights).reduce((s, w) => s + Math.abs(w), 0);
  return { valid: Math.abs(sum - 100) < 0.01, sum };
}
