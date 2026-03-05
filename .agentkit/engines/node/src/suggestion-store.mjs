/**
 * AgentKit Forge — Suggestion Store
 * File-backed suggestion management with YAML serialization.
 * Stores suggestions in .agentkit/state/suggestions/ as individual YAML files.
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

export const SUGGESTION_STATES = ['pending_review', 'approved', 'rejected', 'deferred'];

export const TERMINAL_SUGGESTION_STATES = ['approved', 'rejected'];

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const SUGGESTION_ID_PATTERN = /^SUG-\d{3,}$/;

function validateSuggestionId(suggestionId) {
  if (!SUGGESTION_ID_PATTERN.test(suggestionId)) {
    throw new Error(
      `Invalid suggestion ID: "${suggestionId}". Must match pattern SUG-NNN (e.g., SUG-001).`
    );
  }
}

// ---------------------------------------------------------------------------
// Store directory
// ---------------------------------------------------------------------------

function suggestionsDir(projectRoot) {
  return resolve(projectRoot, '.agentkit', 'state', 'suggestions');
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

  // Save each suggestion individually for future lifecycle management.
  // Namespace by run timestamp to avoid ID collisions across runs
  // (the analyzer resets IDs to SUG-001 each execution).
  for (const suggestion of report.suggestions) {
    const namespacedId = `${timestamp}_${suggestion.id}`;
    const suggestionFile = resolve(dir, `${namespacedId}.yaml`);
    const record = {
      ...suggestion,
      namespacedId,
      status: 'pending_review',
      createdAt: report.generatedAt,
      runTimestamp: timestamp,
    };
    await writeFile(suggestionFile, yaml.dump(record, { lineWidth: 100, noRefs: true }), 'utf-8');
  }

  return { runFile, suggestionsDir: dir, count: report.suggestions.length };
}

/**
 * Load a single suggestion by namespaced ID (e.g., "2026-03-04T00-00-00-000Z_SUG-001").
 * Also accepts a bare suggestion ID (e.g., "SUG-001") and returns the most recent match.
 */
export async function loadSuggestion(projectRoot, suggestionId) {
  // If it's a namespaced ID, load directly
  const namespacedPattern = /^\d{4}-\d{2}-\d{2}T[\d-]+Z_SUG-\d{3,}$/;
  if (!namespacedPattern.test(suggestionId)) {
    // Bare ID — validate before any filesystem access
    validateSuggestionId(suggestionId);
  }

  const dir = suggestionsDir(projectRoot);
  if (!existsSync(dir)) return null;

  if (namespacedPattern.test(suggestionId)) {
    const filePath = resolve(dir, `${suggestionId}.yaml`);
    if (!existsSync(filePath)) return null;
    try {
      const raw = await readFile(filePath, 'utf-8');
      return yaml.load(raw);
    } catch {
      return null;
    }
  }

  // Bare ID — find the most recent match
  try {
    const entries = await readdir(dir);
    const matches = entries
      .filter((e) => e.endsWith(`_${suggestionId}.yaml`))
      .sort()
      .reverse();
    if (matches.length === 0) return null;

    const raw = await readFile(resolve(dir, matches[0]), 'utf-8');
    return yaml.load(raw);
  } catch {
    return null;
  }
}

/**
 * List all suggestion files in the store.
 * Returns namespaced IDs (e.g., "2026-03-04T00-00-00-000Z_SUG-001").
 */
export async function listSuggestions(projectRoot) {
  const dir = suggestionsDir(projectRoot);
  if (!existsSync(dir)) return [];

  try {
    const entries = await readdir(dir);
    return entries
      .filter((e) => e.includes('_SUG-') && e.endsWith('.yaml'))
      .map((e) => e.replace('.yaml', ''));
  } catch {
    return [];
  }
}

/**
 * Update a suggestion's status.
 */
export async function updateSuggestionStatus(projectRoot, suggestionId, newStatus, reason) {
  validateSuggestionId(suggestionId);

  if (!SUGGESTION_STATES.includes(newStatus)) {
    throw new Error(
      `Invalid suggestion status: ${newStatus}. Must be one of: ${SUGGESTION_STATES.join(', ')}`
    );
  }

  const suggestion = await loadSuggestion(projectRoot, suggestionId);
  if (!suggestion) {
    throw new Error(`Suggestion not found: ${suggestionId}`);
  }

  if (TERMINAL_SUGGESTION_STATES.includes(suggestion.status)) {
    throw new Error(
      `Suggestion ${suggestionId} is in terminal state "${suggestion.status}" and cannot be updated.`
    );
  }

  suggestion.status = newStatus;
  suggestion.statusUpdatedAt = new Date().toISOString();
  if (reason) {
    suggestion.statusReason = reason;
  }

  // Write back to the namespaced file path
  const namespacedId = suggestion.namespacedId || suggestionId;
  const filePath = resolve(suggestionsDir(projectRoot), `${namespacedId}.yaml`);
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
  await writeFile(filePath, yaml.dump(fingerprint, { lineWidth: 100, noRefs: true }), 'utf-8');
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
