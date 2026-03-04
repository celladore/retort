/**
 * AgentKit Forge — Suggestion Store (Phase 1)
 * In-memory suggestion management with YAML serialization for Phase 1.
 * Phase 2 will add persistent file-based storage in .claude/state/suggestions/.
 *
 * Tracks suggestion lifecycle: pending_review → approved | rejected | deferred
 */
import { existsSync, promises as fsPromises } from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'node:path';

const { mkdir, readFile, readdir, writeFile } = fsPromises;

// ---------------------------------------------------------------------------
// Suggestion states
// ---------------------------------------------------------------------------

export const SUGGESTION_STATES = [
  'pending_review',
  'approved',
  'rejected',
  'deferred',
];

export const TERMINAL_SUGGESTION_STATES = ['approved', 'rejected'];

// ---------------------------------------------------------------------------
// Store directory
// ---------------------------------------------------------------------------

function suggestionsDir(projectRoot) {
  return resolve(projectRoot, '.claude', 'state', 'suggestions');
}

function rejectedDir(projectRoot) {
  return resolve(suggestionsDir(projectRoot), 'rejected');
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Save an analysis report's suggestions to the store.
 * Each suggestion is saved as a separate YAML file.
 */
export async function saveSuggestions(projectRoot, report) {
  const dir = suggestionsDir(projectRoot);
  await mkdir(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Save the full report as a run record
  const runFile = resolve(dir, `run-${timestamp}.yaml`);
  await writeFile(runFile, yaml.dump(report, { lineWidth: 100, noRefs: true }), 'utf-8');

  // Save each suggestion individually for future lifecycle management
  for (const suggestion of report.suggestions) {
    const suggestionFile = resolve(dir, `${suggestion.id}.yaml`);
    const record = {
      ...suggestion,
      status: 'pending_review',
      createdAt: report.generatedAt,
      runTimestamp: timestamp,
    };
    await writeFile(
      suggestionFile,
      yaml.dump(record, { lineWidth: 100, noRefs: true }),
      'utf-8',
    );
  }

  return { runFile, suggestionsDir: dir, count: report.suggestions.length };
}

/**
 * Load a single suggestion by ID.
 */
export async function loadSuggestion(projectRoot, suggestionId) {
  const filePath = resolve(suggestionsDir(projectRoot), `${suggestionId}.yaml`);
  if (!existsSync(filePath)) return null;

  try {
    const raw = await readFile(filePath, 'utf-8');
    return yaml.load(raw);
  } catch {
    return null;
  }
}

/**
 * List all suggestion files in the store.
 */
export async function listSuggestions(projectRoot) {
  const dir = suggestionsDir(projectRoot);
  if (!existsSync(dir)) return [];

  try {
    const entries = await readdir(dir);
    return entries
      .filter((e) => e.startsWith('SUG-') && e.endsWith('.yaml'))
      .map((e) => e.replace('.yaml', ''));
  } catch {
    return [];
  }
}

/**
 * Update a suggestion's status.
 */
export async function updateSuggestionStatus(projectRoot, suggestionId, newStatus, reason) {
  if (!SUGGESTION_STATES.includes(newStatus)) {
    throw new Error(`Invalid suggestion status: ${newStatus}. Must be one of: ${SUGGESTION_STATES.join(', ')}`);
  }

  const suggestion = await loadSuggestion(projectRoot, suggestionId);
  if (!suggestion) {
    throw new Error(`Suggestion not found: ${suggestionId}`);
  }

  if (TERMINAL_SUGGESTION_STATES.includes(suggestion.status)) {
    throw new Error(
      `Suggestion ${suggestionId} is in terminal state "${suggestion.status}" and cannot be updated.`,
    );
  }

  suggestion.status = newStatus;
  suggestion.statusUpdatedAt = new Date().toISOString();
  if (reason) {
    suggestion.statusReason = reason;
  }

  const filePath = resolve(suggestionsDir(projectRoot), `${suggestionId}.yaml`);
  await writeFile(filePath, yaml.dump(suggestion, { lineWidth: 100, noRefs: true }), 'utf-8');

  // If rejected, also save a fingerprint for rejection memory
  if (newStatus === 'rejected') {
    await saveRejectionFingerprint(projectRoot, suggestion);
  }

  return suggestion;
}

/**
 * Check if a suggestion title was previously rejected.
 */
export async function wasRejected(projectRoot, title) {
  const dir = rejectedDir(projectRoot);
  if (!existsSync(dir)) return false;

  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const filePath = resolve(dir, entry);
      const raw = await readFile(filePath, 'utf-8');
      const record = yaml.load(raw);
      if (record?.titleFingerprint === normalizeTitle(title)) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }

  return false;
}

// ---------------------------------------------------------------------------
// Rejection memory
// ---------------------------------------------------------------------------

async function saveRejectionFingerprint(projectRoot, suggestion) {
  const dir = rejectedDir(projectRoot);
  await mkdir(dir, { recursive: true });

  const fingerprint = {
    suggestionId: suggestion.id,
    title: suggestion.title,
    titleFingerprint: normalizeTitle(suggestion.title),
    category: suggestion.category,
    rejectedAt: new Date().toISOString(),
    reason: suggestion.statusReason || 'No reason provided',
  };

  const filePath = resolve(dir, `${suggestion.id}.yaml`);
  await writeFile(
    filePath,
    yaml.dump(fingerprint, { lineWidth: 100, noRefs: true }),
    'utf-8',
  );
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
