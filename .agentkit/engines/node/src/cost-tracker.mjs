/**
 * AgentKit Forge — Cost Tracker
 * Session-level tracking via hooks: tracks session start/end, commands invoked,
 * files changed, and durations. Logs to JSONL files for reporting.
 *
 * Note: AgentKit cannot intercept AI API calls directly, so actual token counts
 * are not available. This tracks operational metrics (session duration, commands
 * run, files modified) which are useful for understanding usage patterns.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync, renameSync } from 'fs';
import { resolve, basename } from 'path';
import { execFileSync } from 'child_process';
import { formatTimestamp } from './runner.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a period string like '7d', '30d', '365d' into a number of days.
 * Accepts formats: '<number>d' for days, or a bare number (treated as days).
 * Returns 7 as default for invalid input.
 * @param {string} period
 * @returns {number}
 */
function parsePeriodDays(period) {
  if (typeof period === 'number') return period > 0 ? Math.floor(period) : 7;
  if (typeof period !== 'string') return 7;
  const match = /^(\d+)d?$/i.exec(period.trim());
  if (!match) {
    console.warn(`[agentkit:cost] Invalid period format "${period}", defaulting to 7d`);
    return 7;
  }
  const days = parseInt(match[1], 10);
  return days > 0 ? days : 7;
}

/**
 * Run a git command safely using execFileSync (avoids shell injection).
 * @param {string[]} args - Git arguments
 * @param {string} cwd - Working directory
 * @returns {string} - Command output (stdout)
 * @throws {Error} if command fails
 */
function runGitCommand(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function logsDir(agentkitRoot) {
  return resolve(agentkitRoot, 'logs');
}

function sessionsDir(agentkitRoot) {
  return resolve(agentkitRoot, 'logs', 'sessions');
}

function latestSessionPath(agentkitRoot) {
  return resolve(sessionsDir(agentkitRoot), 'latest-session.txt');
}

function usageLogPath(agentkitRoot, date) {
  const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
  return resolve(logsDir(agentkitRoot), `usage-${dateStr}.jsonl`);
}

function sessionFilePath(agentkitRoot, sessionId) {
  return resolve(sessionsDir(agentkitRoot), `session-${sessionId}.json`);
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

/**
 * Generate a unique session ID.
 * @returns {string}
 */
export function generateSessionId() {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const random = Math.random().toString(16).slice(2, 8);
  return `${dateStr}-${random}`;
}

/**
 * Initialize a new session.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @returns {object} session record
 */
export function initSession({ agentkitRoot, projectRoot }) {
  const sessionId = generateSessionId();
  const now = new Date();

  let branch = 'unknown';
  let user = 'unknown';
  try {
    branch = runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], projectRoot).trim();
  } catch { /* git not available — using default branch */ }
  try {
    user = runGitCommand(['config', 'user.email'], projectRoot).trim() || 'unknown';
  } catch { /* git not available — using default user */ }

  let repoName = basename(projectRoot);
  const markerPath = resolve(projectRoot, '.agentkit-repo');
  if (existsSync(markerPath)) {
    repoName = readFileSync(markerPath, 'utf-8').trim();
  }

  const session = {
    sessionId,
    startTime: now.toISOString(),
    endTime: null,
    durationMs: null,
    user,
    repo: repoName,
    branch,
    commandsRun: [],
    filesModified: 0,
    status: 'active',
  };

  // Write session file
  const dir = sessionsDir(agentkitRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(sessionFilePath(agentkitRoot, sessionId), JSON.stringify(session, null, 2) + '\n', 'utf-8');

  // Update latest session pointer
  writeFileSync(latestSessionPath(agentkitRoot), sessionId, 'utf-8');

  // Log event
  logEvent(agentkitRoot, {
    sessionId,
    event: 'session_start',
    user,
    repo: repoName,
    branch,
  });

  return session;
}

/**
 * End a session and record summary.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {string} opts.sessionId
 * @returns {object} finalized session
 */
export function endSession({ agentkitRoot, projectRoot, sessionId }) {
  const path = sessionFilePath(agentkitRoot, sessionId);
  if (!existsSync(path)) {
    return null;
  }

  let session;
  try {
    session = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    console.warn(`[agentkit:cost] Corrupted session file for ${sessionId}, skipping`);
    return null;
  }
  const now = new Date();
  const startTime = new Date(session.startTime);

  // Count files modified via git
  let filesModified = 0;
  try {
    const result = runGitCommand(['diff', '--name-only', 'HEAD'], projectRoot);
    filesModified = result.trim().split('\n').filter(Boolean).length;
  } catch (error) { console.warn('[agentkit:cost] git diff failed:', error.message); /* git not available — filesModified stays 0 */ }

  session.endTime = now.toISOString();
  session.durationMs = now.getTime() - startTime.getTime();
  session.filesModified = filesModified;
  session.status = 'completed';

  writeFileSync(path, JSON.stringify(session, null, 2) + '\n', 'utf-8');

  // Log event
  logEvent(agentkitRoot, {
    sessionId,
    event: 'session_end',
    durationMs: session.durationMs,
    filesModified,
  });

  return session;
}

// ---------------------------------------------------------------------------
// Command tracking
// ---------------------------------------------------------------------------

/**
 * Record a command invocation on the most recent active session.
 * @param {string} agentkitRoot
 * @param {string} command - The command name (e.g. 'check', 'discover')
 */
export async function recordCommand(agentkitRoot, command) {
  const dir = sessionsDir(agentkitRoot);
  if (!existsSync(dir)) return;

  const tryUpdateSession = (filePath, session) => {
    if (session.status === 'active') {
      session.commandsRun = session.commandsRun || [];
      session.commandsRun.push({ command, timestamp: new Date().toISOString() });
      // Atomic write: temp file + rename to prevent partial reads
      const tmpPath = filePath + '.tmp';
      writeFileSync(tmpPath, JSON.stringify(session, null, 2) + '\n', 'utf-8');
      renameSync(tmpPath, filePath);

      logEvent(agentkitRoot, { event: 'command_run', command, sessionId: session.sessionId });
      return true;
    }
    return false;
  };

  // Optimization: Check latest-session pointer first
  const pointerPath = latestSessionPath(agentkitRoot);
  if (existsSync(pointerPath)) {
    try {
      const latestId = readFileSync(pointerPath, 'utf-8').trim();
      const filePath = sessionFilePath(agentkitRoot, latestId);
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, 'utf-8');
        const session = JSON.parse(raw);
        if (tryUpdateSession(filePath, session)) {
          return;
        }
      }
    } catch { /* ignore pointer errors, fall back to scan */ }
  }

  // Fallback: Find the most recent active session file
  const files = readdirSync(dir)
    .filter(f => f.startsWith('session-') && f.endsWith('.json'))
    .sort()
    .reverse();

  for (const file of files) {
    try {
      const filePath = resolve(dir, file);
      const raw = readFileSync(filePath, 'utf-8');
      const session = JSON.parse(raw);
      if (tryUpdateSession(filePath, session)) {
        // Opportunistically update pointer
        try {
          writeFileSync(pointerPath, session.sessionId, 'utf-8');
        } catch {}
        return;
      }
    } catch { /* skip corrupted session files */ }
  }
}

// ---------------------------------------------------------------------------
// Event Logging
// ---------------------------------------------------------------------------

/**
 * Log an event to the daily JSONL file.
 * @param {string} agentkitRoot
 * @param {object} data - Event data
 */
export function logEvent(agentkitRoot, data) {
  const dir = logsDir(agentkitRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    ...data,
  };

  const logPath = usageLogPath(agentkitRoot, new Date());
  appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Query & Reporting
// ---------------------------------------------------------------------------

/**
 * Get recent sessions.
 * @param {string} agentkitRoot
 * @param {object} opts
 * @param {string} opts.last - Time period (e.g. '7d', '30d')
 * @returns {object[]}
 */
export function getSessions(agentkitRoot, { last = '7d' } = {}) {
  const dir = sessionsDir(agentkitRoot);
  if (!existsSync(dir)) return [];

  const days = parsePeriodDays(last);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const files = readdirSync(dir).filter(f => f.startsWith('session-') && f.endsWith('.json'));
  const sessions = [];

  for (const file of files) {
    try {
      const session = JSON.parse(readFileSync(resolve(dir, file), 'utf-8'));
      if (new Date(session.startTime) >= cutoff) {
        sessions.push(session);
      }
    } catch { /* skip invalid files */ }
  }

  return sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

/**
 * Read usage log entries for a specific month.
 * @param {string} agentkitRoot
 * @param {string} month - YYYY-MM format
 * @returns {object[]}
 */
function readMonthlyLogs(agentkitRoot, month) {
  const dir = logsDir(agentkitRoot);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter(f =>
    f.startsWith(`usage-${month}`) && f.endsWith('.jsonl')
  );

  const entries = [];
  for (const file of files) {
    const content = readFileSync(resolve(dir, file), 'utf-8');
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        entries.push(JSON.parse(line));
      } catch { /* skip invalid */ }
    }
  }

  return entries;
}

/**
 * Generate a monthly report.
 * @param {string} agentkitRoot
 * @param {string} month - YYYY-MM format
 * @param {string} format - 'table', 'json', 'csv'
 * @returns {object}
 */
export function generateReport(agentkitRoot, month, format = 'table') {
  const entries = readMonthlyLogs(agentkitRoot, month);
  const sessions = getSessions(agentkitRoot, { last: '365d' }).filter(s =>
    s.startTime.startsWith(month)
  );

  const report = {
    month,
    totalSessions: sessions.length,
    totalDurationMs: sessions.reduce((sum, s) => sum + (s.durationMs || 0), 0),
    totalFilesModified: sessions.reduce((sum, s) => sum + (s.filesModified || 0), 0),
    totalEvents: entries.length,
    byUser: {},
    byCommand: {},
  };

  // Aggregate by user
  for (const session of sessions) {
    const user = session.user || 'unknown';
    if (!report.byUser[user]) {
      report.byUser[user] = { sessions: 0, durationMs: 0, filesModified: 0 };
    }
    report.byUser[user].sessions++;
    report.byUser[user].durationMs += session.durationMs || 0;
    report.byUser[user].filesModified += session.filesModified || 0;
  }

  // Aggregate by command from events
  for (const entry of entries) {
    if (entry.command) {
      if (!report.byCommand[entry.command]) {
        report.byCommand[entry.command] = { count: 0 };
      }
      report.byCommand[entry.command].count++;
    }
  }

  return report;
}

function formatReportTable(report) {
  const lines = [
    `=== Cost & Usage Report: ${report.month} ===`,
    ``,
    `Sessions:        ${report.totalSessions}`,
    `Total Duration:  ${formatMs(report.totalDurationMs)}`,
    `Files Modified:  ${report.totalFilesModified}`,
    `Events Logged:   ${report.totalEvents}`,
    ``,
  ];

  const users = Object.entries(report.byUser);
  if (users.length > 0) {
    lines.push('--- By User ---');
    lines.push('User                     Sessions  Duration     Files');
    lines.push('───────────────────────  ────────  ───────────  ─────');
    for (const [user, data] of users) {
      lines.push(
        `${user.padEnd(23)}  ${String(data.sessions).padStart(8)}  ${formatMs(data.durationMs).padStart(11)}  ${String(data.filesModified).padStart(5)}`
      );
    }
    lines.push('');
  }

  const commands = Object.entries(report.byCommand);
  if (commands.length > 0) {
    lines.push('--- By Command ---');
    lines.push('Command          Count');
    lines.push('───────────────  ─────');
    for (const [cmd, data] of commands.sort((a, b) => b[1].count - a[1].count)) {
      lines.push(`${cmd.padEnd(15)}  ${String(data.count).padStart(5)}`);
    }
  }

  return lines.join('\n');
}

function formatMs(ms) {
  if (!ms) return '0s';
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  const secs = Math.floor(ms / 1000);
  return `${secs}s`;
}

// ---------------------------------------------------------------------------
// CLI Handler
// ---------------------------------------------------------------------------

/**
 * Run cost tracking commands.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags
 */
export async function runCost({ agentkitRoot, projectRoot, flags = {} }) {
  if (flags.summary) {
    console.log('[agentkit:cost] Recent session summary');
    console.log('');
    const sessions = getSessions(agentkitRoot, { last: flags.last || '7d' });
    if (sessions.length === 0) {
      console.log('No sessions found in the specified period.');
      console.log('Sessions are recorded automatically via lifecycle hooks.');
      return;
    }
    console.log(`Sessions (last ${flags.last || '7d'}):`);
    console.log('');
    console.log('Session ID               Start                Duration    Files  Status');
    console.log('───────────────────────  ───────────────────  ──────────  ─────  ────────');
    for (const s of sessions.slice(0, 20)) {
      const start = formatTimestamp(s.startTime);
      const dur = s.durationMs ? formatMs(s.durationMs) : 'active';
      console.log(
        `${(s.sessionId || '').padEnd(23)}  ${start.padEnd(19)}  ${dur.padStart(10)}  ${String(s.filesModified || 0).padStart(5)}  ${s.status}`
      );
    }
    return;
  }

  if (flags.sessions) {
    const sessions = getSessions(agentkitRoot, { last: flags.last || '7d' });
    if (flags.format === 'json') {
      console.log(JSON.stringify(sessions, null, 2));
    } else {
      console.log(`[agentkit:cost] ${sessions.length} session(s) found`);
      for (const s of sessions) {
        console.log(`  ${s.sessionId}  ${s.startTime}  ${s.status}  ${s.user}`);
      }
    }
    return;
  }

  if (flags.report) {
    const month = flags.month || new Date().toISOString().slice(0, 7);
    const report = generateReport(agentkitRoot, month, flags.format || 'table');

    if (flags.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else if (flags.format === 'csv') {
      console.log('user,sessions,duration_ms,files_modified');
      for (const [user, data] of Object.entries(report.byUser)) {
        console.log(`${user},${data.sessions},${data.durationMs},${data.filesModified}`);
      }
    } else {
      console.log(formatReportTable(report));
    }
    return;
  }

  // Default: show a quick summary
  console.log('[agentkit:cost] Usage tracking');
  console.log('');
  console.log('Commands:');
  console.log('  cost --summary          Recent session overview');
  console.log('  cost --sessions         List sessions');
  console.log('  cost --report           Monthly aggregate report');
  console.log('  cost --report --month YYYY-MM --format json');
  console.log('');

  const sessions = getSessions(agentkitRoot, { last: '30d' });
  console.log(`Sessions (last 30 days): ${sessions.length}`);
  if (sessions.length > 0) {
    const totalMs = sessions.reduce((s, x) => s + (x.durationMs || 0), 0);
    const totalFiles = sessions.reduce((s, x) => s + (x.filesModified || 0), 0);
    console.log(`Total duration: ${formatMs(totalMs)}`);
    console.log(`Total files modified: ${totalFiles}`);
  }
}
