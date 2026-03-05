/**
 * AgentKit Forge — Budget Guard
 * Enforcement layer for cost management. Checks session-level budgets
 * (duration, command count, file modifications) and triggers warnings
 * or hard stops when thresholds are exceeded.
 *
 * Designed to prevent runaway agent sessions by acting as a circuit breaker.
 * Integrates as a PreToolUse hook and via CLI checks.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs';
import { createRequire } from 'module';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Default policy — used when settings.yaml has no budgetPolicy section
// ---------------------------------------------------------------------------

const DEFAULT_POLICY = {
  session: {
    maxDurationMinutes: 120,
    maxCommands: 200,
    maxFilesModified: 100,
    warnAtPercent: 80,
  },
  daily: {
    maxSessions: 50,
    maxTotalDurationMinutes: 480,
    maxTotalCommands: 1000,
    warnAtPercent: 80,
  },
  enforcement: 'warn', // 'warn' | 'enforce' | 'off'
};

// ---------------------------------------------------------------------------
// Policy loading
// ---------------------------------------------------------------------------

/**
 * Load the budget policy from settings.yaml or return defaults.
 * @param {string} agentkitRoot
 * @returns {object} merged policy
 */
export function loadPolicy(agentkitRoot) {
  const settingsPath = resolve(agentkitRoot, 'spec', 'settings.yaml');
  if (!existsSync(settingsPath)) return DEFAULT_POLICY;

  try {
    const raw = readFileSync(settingsPath, 'utf-8');
    // Simple YAML extraction for budgetPolicy block — avoids requiring js-yaml
    // at module level (it may not be installed in all environments).
    // For production use the full YAML parser is preferred; this is a fallback.
    const parsed = parseYamlBudgetPolicy(raw);
    if (!parsed) return DEFAULT_POLICY;

    return deepMerge(DEFAULT_POLICY, parsed);
  } catch {
    return DEFAULT_POLICY;
  }
}

/**
 * Extract budgetPolicy from YAML content using js-yaml if available,
 * falling back to regex extraction.
 */
function parseYamlBudgetPolicy(yamlContent) {
  try {
    const yaml = tryLoadYaml();
    if (yaml) {
      const doc = yaml.load(yamlContent);
      return doc?.budgetPolicy || null;
    }
  } catch {
    /* fall through to regex */
  }

  // Regex fallback for simple flat YAML values
  return extractBudgetPolicyRegex(yamlContent);
}

/** @returns {object|null} js-yaml module or null */
function tryLoadYaml() {
  try {
    const require = createRequire(import.meta.url);
    return require('js-yaml');
  } catch {
    return null;
  }
}

function extractBudgetPolicyRegex(content) {
  // Check if budgetPolicy section exists at all
  if (!/^budgetPolicy:/m.test(content)) return null;

  const getNum = (key) => {
    const m = content.match(new RegExp(`${key}:\\s*(\\d+)`));
    return m ? parseInt(m[1], 10) : undefined;
  };
  const getStr = (key) => {
    const m = content.match(new RegExp(`${key}:\\s*([\\w]+)`));
    return m ? m[1] : undefined;
  };

  return {
    session: {
      maxDurationMinutes: getNum('maxDurationMinutes'),
      maxCommands: getNum('maxCommands'),
      maxFilesModified: getNum('maxFilesModified'),
      warnAtPercent: getNum('warnAtPercent'),
    },
    daily: {
      maxSessions: getNum('maxSessions'),
      maxTotalDurationMinutes: getNum('maxTotalDurationMinutes'),
      maxTotalCommands: getNum('maxTotalCommands'),
      warnAtPercent: getNum('warnAtPercent'),
    },
    enforcement: getStr('enforcement'),
  };
}

function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (overrides[key] === undefined || overrides[key] === null) continue;
    if (
      typeof defaults[key] === 'object' &&
      !Array.isArray(defaults[key]) &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key])
    ) {
      result[key] = deepMerge(defaults[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Session budget check
// ---------------------------------------------------------------------------

/**
 * @typedef {object} BudgetCheckResult
 * @property {'ok'|'warn'|'deny'} status
 * @property {string[]} reasons
 * @property {object} metrics - Current usage metrics
 */

/**
 * Check whether the current session is within budget.
 * @param {string} agentkitRoot
 * @param {object} [policyOverride] - Optional policy override for testing
 * @returns {BudgetCheckResult}
 */
export function checkSessionBudget(agentkitRoot, policyOverride) {
  const policy = policyOverride || loadPolicy(agentkitRoot);

  if (policy.enforcement === 'off') {
    return { status: 'ok', reasons: [], metrics: {} };
  }

  const session = getActiveSession(agentkitRoot);
  if (!session) {
    return { status: 'ok', reasons: ['No active session found'], metrics: {} };
  }

  const reasons = [];
  let status = 'ok';
  const warnPct = (policy.session?.warnAtPercent || 80) / 100;
  const enforce = policy.enforcement === 'enforce';

  const metrics = {
    durationMinutes: 0,
    commandCount: 0,
    filesModified: session.filesModified || 0,
  };

  // Duration check
  if (session.startTime) {
    const elapsed = Date.now() - new Date(session.startTime).getTime();
    metrics.durationMinutes = Math.round(elapsed / 60_000);
    const maxMin = policy.session?.maxDurationMinutes || DEFAULT_POLICY.session.maxDurationMinutes;

    if (metrics.durationMinutes >= maxMin) {
      reasons.push(`Session duration (${metrics.durationMinutes}m) exceeds limit (${maxMin}m)`);
      status = enforce ? 'deny' : 'warn';
    } else if (metrics.durationMinutes >= maxMin * warnPct) {
      reasons.push(
        `Session duration (${metrics.durationMinutes}m) at ${Math.round((metrics.durationMinutes / maxMin) * 100)}% of limit (${maxMin}m)`
      );
      if (status === 'ok') status = 'warn';
    }
  }

  // Command count check
  metrics.commandCount = Array.isArray(session.commandsRun) ? session.commandsRun.length : 0;
  const maxCmds = policy.session?.maxCommands || DEFAULT_POLICY.session.maxCommands;

  if (metrics.commandCount >= maxCmds) {
    reasons.push(`Command count (${metrics.commandCount}) exceeds limit (${maxCmds})`);
    status = enforce ? 'deny' : status === 'deny' ? 'deny' : 'warn';
  } else if (metrics.commandCount >= maxCmds * warnPct) {
    reasons.push(
      `Command count (${metrics.commandCount}) at ${Math.round((metrics.commandCount / maxCmds) * 100)}% of limit (${maxCmds})`
    );
    if (status === 'ok') status = 'warn';
  }

  // Files modified check
  const maxFiles = policy.session?.maxFilesModified || DEFAULT_POLICY.session.maxFilesModified;
  if (metrics.filesModified >= maxFiles) {
    reasons.push(`Files modified (${metrics.filesModified}) exceeds limit (${maxFiles})`);
    status = enforce ? 'deny' : status === 'deny' ? 'deny' : 'warn';
  } else if (metrics.filesModified >= maxFiles * warnPct) {
    reasons.push(
      `Files modified (${metrics.filesModified}) at ${Math.round((metrics.filesModified / maxFiles) * 100)}% of limit (${maxFiles})`
    );
    if (status === 'ok') status = 'warn';
  }

  return { status, reasons, metrics };
}

// ---------------------------------------------------------------------------
// Daily budget check
// ---------------------------------------------------------------------------

/**
 * Check whether daily usage is within budget.
 * @param {string} agentkitRoot
 * @param {object} [policyOverride]
 * @returns {BudgetCheckResult}
 */
export function checkDailyBudget(agentkitRoot, policyOverride) {
  const policy = policyOverride || loadPolicy(agentkitRoot);

  if (policy.enforcement === 'off') {
    return { status: 'ok', reasons: [], metrics: {} };
  }

  const todaySessions = getTodaySessions(agentkitRoot);
  const reasons = [];
  let status = 'ok';
  const warnPct = (policy.daily?.warnAtPercent || 80) / 100;
  const enforce = policy.enforcement === 'enforce';

  const metrics = {
    sessionCount: todaySessions.length,
    totalDurationMinutes: 0,
    totalCommands: 0,
  };

  for (const s of todaySessions) {
    if (s.durationMs) {
      metrics.totalDurationMinutes += Math.round(s.durationMs / 60_000);
    } else if (s.startTime && s.status === 'active') {
      metrics.totalDurationMinutes += Math.round(
        (Date.now() - new Date(s.startTime).getTime()) / 60_000
      );
    }
    metrics.totalCommands += Array.isArray(s.commandsRun) ? s.commandsRun.length : 0;
  }

  // Session count
  const maxSessions = policy.daily?.maxSessions || DEFAULT_POLICY.daily.maxSessions;
  if (metrics.sessionCount >= maxSessions) {
    reasons.push(`Daily sessions (${metrics.sessionCount}) exceeds limit (${maxSessions})`);
    status = enforce ? 'deny' : 'warn';
  } else if (metrics.sessionCount >= maxSessions * warnPct) {
    reasons.push(
      `Daily sessions (${metrics.sessionCount}) at ${Math.round((metrics.sessionCount / maxSessions) * 100)}% of limit (${maxSessions})`
    );
    if (status === 'ok') status = 'warn';
  }

  // Total duration
  const maxDur =
    policy.daily?.maxTotalDurationMinutes || DEFAULT_POLICY.daily.maxTotalDurationMinutes;
  if (metrics.totalDurationMinutes >= maxDur) {
    reasons.push(`Daily duration (${metrics.totalDurationMinutes}m) exceeds limit (${maxDur}m)`);
    status = enforce ? 'deny' : status === 'deny' ? 'deny' : 'warn';
  } else if (metrics.totalDurationMinutes >= maxDur * warnPct) {
    reasons.push(
      `Daily duration (${metrics.totalDurationMinutes}m) at ${Math.round((metrics.totalDurationMinutes / maxDur) * 100)}% of limit (${maxDur}m)`
    );
    if (status === 'ok') status = 'warn';
  }

  // Total commands
  const maxCmds = policy.daily?.maxTotalCommands || DEFAULT_POLICY.daily.maxTotalCommands;
  if (metrics.totalCommands >= maxCmds) {
    reasons.push(`Daily commands (${metrics.totalCommands}) exceeds limit (${maxCmds})`);
    status = enforce ? 'deny' : status === 'deny' ? 'deny' : 'warn';
  } else if (metrics.totalCommands >= maxCmds * warnPct) {
    reasons.push(
      `Daily commands (${metrics.totalCommands}) at ${Math.round((metrics.totalCommands / maxCmds) * 100)}% of limit (${maxCmds})`
    );
    if (status === 'ok') status = 'warn';
  }

  return { status, reasons, metrics };
}

// ---------------------------------------------------------------------------
// Combined check (session + daily)
// ---------------------------------------------------------------------------

/**
 * Run both session and daily budget checks. Returns the most restrictive result.
 * @param {string} agentkitRoot
 * @param {object} [policyOverride]
 * @returns {BudgetCheckResult}
 */
export function checkBudget(agentkitRoot, policyOverride) {
  const session = checkSessionBudget(agentkitRoot, policyOverride);
  const daily = checkDailyBudget(agentkitRoot, policyOverride);

  const allReasons = [...session.reasons, ...daily.reasons];
  const metrics = { session: session.metrics, daily: daily.metrics };

  // Most restrictive status wins
  let status = 'ok';
  if (session.status === 'deny' || daily.status === 'deny') {
    status = 'deny';
  } else if (session.status === 'warn' || daily.status === 'warn') {
    status = 'warn';
  }

  return { status, reasons: allReasons, metrics };
}

// ---------------------------------------------------------------------------
// Hook entry point — for PreToolUse integration
// ---------------------------------------------------------------------------

/**
 * Evaluate budget for a pre-tool-use hook call.
 * Returns a hook-compatible JSON response.
 * @param {string} agentkitRoot
 * @returns {{ decision: 'allow'|'deny', reason?: string, warning?: string }}
 */
export function evaluateForHook(agentkitRoot) {
  const result = checkBudget(agentkitRoot);

  if (result.status === 'deny') {
    return {
      decision: 'deny',
      reason: `Budget exceeded: ${result.reasons.join('; ')}`,
    };
  }

  if (result.status === 'warn') {
    return {
      decision: 'allow',
      warning: `Budget warning: ${result.reasons.join('; ')}`,
    };
  }

  return { decision: 'allow' };
}

// ---------------------------------------------------------------------------
// CLI handler
// ---------------------------------------------------------------------------

/**
 * Run budget status from CLI.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 */
export function runBudgetStatus({ agentkitRoot }) {
  const policy = loadPolicy(agentkitRoot);
  const result = checkBudget(agentkitRoot, policy);

  console.log('[agentkit:budget] Budget Status');
  console.log('');
  console.log(`Enforcement: ${policy.enforcement}`);
  console.log('');

  if (result.status === 'ok' && result.reasons.length === 0) {
    console.log('Status: OK — all usage within limits');
  } else {
    console.log(`Status: ${result.status.toUpperCase()}`);
    for (const r of result.reasons) {
      console.log(`  - ${r}`);
    }
  }

  console.log('');
  console.log('Session metrics:');
  if (result.metrics.session) {
    const s = result.metrics.session;
    console.log(
      `  Duration:       ${s.durationMinutes ?? 0}m / ${policy.session.maxDurationMinutes}m`
    );
    console.log(`  Commands:       ${s.commandCount ?? 0} / ${policy.session.maxCommands}`);
    console.log(`  Files modified: ${s.filesModified ?? 0} / ${policy.session.maxFilesModified}`);
  }

  console.log('');
  console.log('Daily metrics:');
  if (result.metrics.daily) {
    const d = result.metrics.daily;
    console.log(`  Sessions:       ${d.sessionCount ?? 0} / ${policy.daily.maxSessions}`);
    console.log(
      `  Total duration: ${d.totalDurationMinutes ?? 0}m / ${policy.daily.maxTotalDurationMinutes}m`
    );
    console.log(`  Total commands: ${d.totalCommands ?? 0} / ${policy.daily.maxTotalCommands}`);
  }

  // Log the check event
  logBudgetEvent(agentkitRoot, {
    event: 'budget_check',
    status: result.status,
    reasons: result.reasons,
    metrics: result.metrics,
  });
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function getActiveSession(agentkitRoot) {
  const sessDir = resolve(agentkitRoot, 'logs', 'sessions');
  if (!existsSync(sessDir)) return null;

  // O(1): check pointer file first
  const pointerPath = resolve(agentkitRoot, 'logs', 'active-session-id');
  if (existsSync(pointerPath)) {
    try {
      const id = readFileSync(pointerPath, 'utf-8').trim();
      if (id && /^[A-Za-z0-9_-]+$/.test(id)) {
        const filePath = resolve(sessDir, `session-${id}.json`);
        if (existsSync(filePath)) {
          const session = JSON.parse(readFileSync(filePath, 'utf-8'));
          if (session.status === 'active') return session;
        }
      }
    } catch {
      /* fall through */
    }
  }

  // O(N) fallback: scan for active session
  const files = readdirSync(sessDir)
    .filter((f) => f.startsWith('session-') && f.endsWith('.json'))
    .sort()
    .reverse();

  for (const file of files) {
    try {
      const session = JSON.parse(readFileSync(resolve(sessDir, file), 'utf-8'));
      if (session.status === 'active') return session;
    } catch {
      /* skip */
    }
  }

  return null;
}

function getTodaySessions(agentkitRoot) {
  const sessDir = resolve(agentkitRoot, 'logs', 'sessions');
  if (!existsSync(sessDir)) return [];

  const todayPrefix = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const files = readdirSync(sessDir).filter((f) => f.startsWith('session-') && f.endsWith('.json'));

  const sessions = [];
  for (const file of files) {
    try {
      const session = JSON.parse(readFileSync(resolve(sessDir, file), 'utf-8'));
      // Session IDs start with YYYYMMDD — match today's date
      if (session.sessionId && session.sessionId.startsWith(todayPrefix)) {
        sessions.push(session);
      } else if (
        session.startTime &&
        session.startTime.startsWith(new Date().toISOString().split('T')[0])
      ) {
        sessions.push(session);
      }
    } catch {
      /* skip */
    }
  }

  return sessions;
}

// ---------------------------------------------------------------------------
// Event logging
// ---------------------------------------------------------------------------

function logBudgetEvent(agentkitRoot, data) {
  const dir = resolve(agentkitRoot, 'logs');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    ...data,
  };

  const dateStr = new Date().toISOString().split('T')[0];
  const logPath = resolve(dir, `usage-${dateStr}.jsonl`);

  try {
    appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    /* logging is best-effort */
  }
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export { DEFAULT_POLICY, deepMerge, extractBudgetPolicyRegex };
