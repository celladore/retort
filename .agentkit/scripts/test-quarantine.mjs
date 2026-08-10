/**
 * Quarantine registry for intermittently failing tests (ADR-12 decision 5).
 *
 * A confirmed flake is moved out of the blocking suite rather than left to fail
 * at random: its file is listed in `test-quarantine.json`, excluded from the
 * required `Test` job, and run separately by the non-blocking
 * `Quarantined Tests` job. Every entry must carry a tracking issue, so a
 * quarantine is a scheduled repair rather than a permanent hiding place.
 *
 * Two layers of checking, deliberately separated:
 *
 * - `parseQuarantineRegistry` enforces *structure* and throws. It runs inside
 *   `vitest.config.mjs`, where a malformed registry must fail loudly — silently
 *   falling back to an empty list would run quarantined files in the blocking
 *   suite, which is exactly the failure this registry exists to prevent.
 * - `validateQuarantineRegistry` enforces *policy* (tracking issue present,
 *   file still exists, sane date) and returns problems. It runs from
 *   `reconcile-test-results.mjs` so a stale or undocumented entry fails CI
 *   without breaking every local test run.
 */

import { readFileSync } from 'node:fs';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISSUE_REF = /^(https?:\/\/\S+|#\d+)$/;

/** Minimum characters for a quarantine reason to count as an explanation. */
const MIN_REASON_LENGTH = 10;

/**
 * Parse and structurally validate the registry. Throws on anything malformed.
 *
 * @param {string} raw Raw file contents.
 * @param {{ source?: string }} [options]
 * @returns {{ description?: string, entries: Array<Record<string, unknown>> }}
 */
export function parseQuarantineRegistry(raw, options = {}) {
  const source = options.source ?? 'test-quarantine.json';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${source} is not valid JSON: ${error.message}`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${source} must contain a JSON object`);
  }

  const { entries } = parsed;
  if (!Array.isArray(entries)) {
    throw new Error(`${source} must have an "entries" array`);
  }

  entries.forEach((entry, index) => {
    const at = `${source} entries[${index}]`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${at} must be an object`);
    }
    if (typeof entry.file !== 'string' || entry.file.trim() === '') {
      throw new Error(`${at}.file must be a non-empty string`);
    }
    const file = entry.file.replaceAll('\\', '/');
    if (file.startsWith('/') || /^[A-Za-z]:/.test(file)) {
      throw new Error(`${at}.file must be relative to .agentkit, got "${entry.file}"`);
    }
    if (file.split('/').includes('..')) {
      throw new Error(`${at}.file must not escape .agentkit, got "${entry.file}"`);
    }
  });

  return { description: parsed.description, entries };
}

/**
 * Load the registry from disk. A missing file means nothing is quarantined —
 * that is the normal, healthy state and must not break the test run.
 *
 * @param {string} filePath
 * @returns {{ description?: string, entries: Array<Record<string, unknown>> }}
 */
export function loadQuarantineRegistry(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { entries: [] };
    throw error;
  }
  return parseQuarantineRegistry(raw, { source: filePath });
}

/**
 * Glob patterns for every quarantined file, for use as a Vitest `exclude`.
 *
 * @param {{ entries: Array<Record<string, unknown>> }} registry
 * @returns {string[]}
 */
export function quarantinedFiles(registry) {
  return registry.entries.map((entry) => String(entry.file).replaceAll('\\', '/'));
}

/**
 * Policy validation: every entry needs a tracking issue, a reason, a date, and
 * a file that still exists.
 *
 * @param {{ entries: Array<Record<string, unknown>> }} registry
 * @param {{ fileExists?: (file: string) => boolean, today?: string }} [options]
 * @returns {{ ok: boolean, problems: Array<{ code: string, message: string }> }}
 */
export function validateQuarantineRegistry(registry, options = {}) {
  const fileExists = options.fileExists ?? (() => true);
  const today = options.today;
  const problems = [];
  const seen = new Map();

  registry.entries.forEach((entry, index) => {
    const at = `entries[${index}] (${entry.file})`;

    const previous = seen.get(entry.file);
    if (previous !== undefined) {
      problems.push({
        code: 'quarantine-duplicate',
        message: `${at} duplicates entries[${previous}] — one entry per file`,
      });
    } else {
      seen.set(entry.file, index);
    }

    if (typeof entry.issue !== 'string' || !ISSUE_REF.test(entry.issue)) {
      problems.push({
        code: 'quarantine-untracked',
        message: `${at} needs an "issue" tracking reference (a URL or #123) — a quarantine without an owner never gets fixed`,
      });
    }

    if (typeof entry.reason !== 'string' || entry.reason.trim().length < MIN_REASON_LENGTH) {
      problems.push({
        code: 'quarantine-unexplained',
        message: `${at} needs a "reason" of at least ${MIN_REASON_LENGTH} characters describing the observed flake`,
      });
    }

    if (typeof entry.quarantinedOn !== 'string' || !ISO_DATE.test(entry.quarantinedOn)) {
      problems.push({
        code: 'quarantine-undated',
        message: `${at} needs a "quarantinedOn" date in YYYY-MM-DD form`,
      });
    } else if (today !== undefined && entry.quarantinedOn > today) {
      problems.push({
        code: 'quarantine-undated',
        message: `${at} has a "quarantinedOn" date in the future (${entry.quarantinedOn} > ${today})`,
      });
    }

    if (!fileExists(String(entry.file))) {
      problems.push({
        code: 'quarantine-stale',
        message: `${at} points at a file that no longer exists — remove the entry or fix the path`,
      });
    }
  });

  return { ok: problems.length === 0, problems };
}
