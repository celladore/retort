/**
 * AgentKit Forge — Issue Normalizer
 * Transforms raw tracker issues into canonical BacklogItem schema.
 */
import { createHash } from 'crypto';

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
const DEFAULT_PRIORITY = 'P2';
const DEFAULT_STATUS = 'open';

/**
 * Generate a deterministic backlog item ID from source and external ID.
 * @param {string} source
 * @param {string} externalId
 * @returns {string}
 */
function generateId(source, externalId) {
  const hash = createHash('sha256').update(`${source}:${externalId}`).digest('hex').slice(0, 8);
  return `bi-${source}-${hash}`;
}

/**
 * Infer priority from issue labels using the configured label map.
 * Returns the highest priority found (lowest P-number).
 * @param {string[]} labels - Issue labels (name strings)
 * @param {object} importLabelsMap - Label-to-priority mapping
 * @returns {string} Priority (P0–P3)
 */
function inferPriority(labels, importLabelsMap) {
  if (!labels?.length || !importLabelsMap) return DEFAULT_PRIORITY;

  let best = DEFAULT_PRIORITY;
  for (const label of labels) {
    const lowerLabel = label.toLowerCase();
    for (const [mapLabel, priority] of Object.entries(importLabelsMap)) {
      if (lowerLabel === mapLabel.toLowerCase()) {
        if ((PRIORITY_ORDER[priority] ?? 99) < (PRIORITY_ORDER[best] ?? 99)) {
          best = priority;
        }
      }
    }
  }
  return best;
}

/**
 * Infer team assignment from issue labels using the configured team map.
 * @param {string[]} labels
 * @param {object} importTeamMap
 * @param {string} fallbackTeam
 * @returns {string}
 */
function inferTeam(labels, importTeamMap, fallbackTeam) {
  if (!labels?.length || !importTeamMap) return fallbackTeam;

  for (const label of labels) {
    const lowerLabel = label.toLowerCase();
    for (const [mapLabel, team] of Object.entries(importTeamMap)) {
      if (lowerLabel === mapLabel.toLowerCase()) {
        return team;
      }
    }
  }
  return fallbackTeam;
}

/**
 * Map issue state to backlog status.
 * @param {string} state
 * @param {object} importStateMap
 * @returns {string}
 */
function mapStatus(state, importStateMap) {
  if (!state || !importStateMap) return DEFAULT_STATUS;
  const lowerState = state.toLowerCase();
  return importStateMap[lowerState] || DEFAULT_STATUS;
}

/**
 * Extract acceptance criteria from issue body (checkbox lists).
 * @param {string|null} body
 * @returns {string[]}
 */
function extractAcceptanceCriteria(body) {
  if (!body) return [];
  const criteria = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*-\s*\[[ x]\]\s*(.+)/i);
    if (match) {
      criteria.push(match[1].trim());
    }
  }
  return criteria;
}

/**
 * Extract file paths mentioned in issue body.
 * @param {string|null} body
 * @returns {string[]}
 */
function extractFilePaths(body) {
  if (!body) return [];
  const paths = new Set();
  // Match common file path patterns
  const patterns = [
    /`([a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,10})`/g,
    /(?:^|\s)((?:src|lib|app|packages|components|pages|api|tests?)\/[a-zA-Z0-9_\-./]+)/gm,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const candidate = match[1];
      // Filter out URLs and overly short matches
      if (!candidate.startsWith('http') && candidate.length > 3) {
        paths.add(candidate);
      }
    }
  }
  return [...paths];
}

/**
 * Extract "what" description from issue body (first paragraph).
 * @param {string|null} body
 * @returns {string}
 */
function extractWhat(body) {
  if (!body) return '';
  const lines = body.split('\n');
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length) {
        paragraphs.push(current.join(' '));
        current = [];
      }
    } else if (!line.startsWith('#') && !line.match(/^\s*-\s*\[/)) {
      current.push(line.trim());
    }
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs[0]?.slice(0, 500) || '';
}

/**
 * Normalize a single raw GitHub issue to canonical BacklogItem.
 * @param {object} rawIssue - Raw issue from GitHub adapter
 * @param {object} config - Import configuration
 * @param {object} [config.importLabelsMap]
 * @param {object} [config.importStateMap]
 * @param {object} [config.importTeamMap]
 * @param {string} [config.ownerTeam]
 * @param {string} [config.source='github']
 * @returns {object} Canonical BacklogItem
 */
export function normalizeIssue(rawIssue, config = {}) {
  const {
    importLabelsMap = {},
    importStateMap = {},
    importTeamMap = {},
    ownerTeam = 'product',
    source = 'github',
  } = config;

  const labelNames = (rawIssue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || ''));

  const prefixMap = { github: 'GH', linear: 'LIN', jira: 'JIRA' };
  const prefix = prefixMap[source] || source.toUpperCase();
  const ref = rawIssue.number ?? rawIssue.id ?? 'unknown';
  const externalId = `${prefix}#${ref}`;

  return {
    id: generateId(source, externalId),
    externalId,
    externalUrl: rawIssue.url || null,
    title: rawIssue.title || 'Untitled',
    priority: inferPriority(labelNames, importLabelsMap),
    status: mapStatus(rawIssue.state, importStateMap),
    phase: 'Planning',
    team: inferTeam(labelNames, importTeamMap, ownerTeam),
    assignee: rawIssue.assignees?.[0]?.login || null,
    source,
    what: extractWhat(rawIssue.body),
    why: '',
    acceptance: extractAcceptanceCriteria(rawIssue.body),
    files: extractFilePaths(rawIssue.body),
    labels: labelNames,
    milestone: rawIssue.milestone?.title || null,
    createdAt: rawIssue.createdAt || null,
    updatedAt: rawIssue.updatedAt || null,
    closedAt: rawIssue.closedAt || null,
    lastSyncedAt: new Date().toISOString(),
    dirty: false,
  };
}

/**
 * Deduplicate incoming items against existing backlog.
 * Items with matching externalId are updated; others are added.
 * Manual items (no externalId) are always preserved.
 * @param {object[]} existing - Current backlog items
 * @param {object[]} incoming - Newly imported items
 * @returns {{ merged: object[], added: number, updated: number, preserved: number }}
 */
export function deduplicateItems(existing, incoming) {
  const existingByExtId = new Map();
  const manualItems = [];
  // Track manual items by title to prevent duplication on repeated imports
  const manualTitles = new Set();

  for (const item of existing) {
    if (item.externalId) {
      existingByExtId.set(item.externalId, item);
    } else {
      manualItems.push(item);
      if (item.title) manualTitles.add(item.title);
    }
  }

  let added = 0;
  let updated = 0;

  let incomingWithoutExtId = 0;
  for (const item of incoming) {
    // Items without externalId are treated as local/manual
    if (!item.externalId) {
      // Deduplicate manual items by title to prevent re-appending on repeated imports
      if (item.title && manualTitles.has(item.title)) {
        // Skip — already exists as a manual item
        continue;
      }
      manualItems.push(item);
      if (item.title) manualTitles.add(item.title);
      incomingWithoutExtId++;
      added++;
      continue;
    }
    if (existingByExtId.has(item.externalId)) {
      // Update existing — preserve local overrides for team/priority if dirty
      const prev = existingByExtId.get(item.externalId);
      if (prev.dirty) {
        existingByExtId.set(item.externalId, {
          ...item,
          team: prev.team,
          priority: prev.priority,
          dirty: true,
        });
      } else {
        existingByExtId.set(item.externalId, item);
      }
      updated++;
    } else {
      existingByExtId.set(item.externalId, item);
      added++;
    }
  }

  return {
    merged: [...existingByExtId.values(), ...manualItems],
    added,
    updated,
    preserved: manualItems.length - incomingWithoutExtId,
  };
}

/**
 * Infer category scores (0-10) from a normalized backlog item's metadata.
 * Used as input to calculateScore() from weighted-scorer.mjs.
 * @param {object} item - Normalized BacklogItem
 * @returns {object} Category scores { severity, impact, urgency, effort, alignment, risk }
 */
export function inferCategoryScores(item) {
  const priorityScores = { P0: 10, P1: 7, P2: 5, P3: 3 };
  const labels = (item.labels || []).map((l) => l.toLowerCase());

  return {
    severity: priorityScores[item.priority] ?? 5,
    impact: labels.some((l) => l.includes('breaking') || l.includes('blocker')) ? 9 : 5,
    urgency: labels.some((l) => l.includes('urgent') || l.includes('critical')) ? 9 : 5,
    effort: 5,
    alignment: 5,
    risk: labels.some((l) => l.includes('security') || l.includes('vulnerability')) ? 8 : 5,
  };
}

export { inferPriority, inferTeam, mapStatus, extractAcceptanceCriteria, extractFilePaths };
