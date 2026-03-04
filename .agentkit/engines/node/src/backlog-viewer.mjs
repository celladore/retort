/**
 * AgentKit Forge — Backlog Viewer
 * Displays a consolidated backlog view with filtering and output format options.
 */
import yaml from 'js-yaml';
import {
  readBacklogJson,
  readBacklogMarkdown,
  filterItems,
  sortItems,
} from './backlog-store.mjs';

/**
 * Format items as an ASCII table.
 * @param {object[]} items
 * @returns {string}
 */
function formatTable(items) {
  if (!items.length) return 'No backlog items found.\n';

  const cols = [
    { key: 'priority', header: 'Priority', width: 8 },
    { key: 'team', header: 'Team', width: 12 },
    { key: 'title', header: 'Title', width: 50 },
    { key: 'status', header: 'Status', width: 12 },
    { key: 'source', header: 'Source', width: 10 },
    { key: 'externalId', header: 'Ext ID', width: 10 },
  ];

  const header = cols.map((c) => c.header.padEnd(c.width)).join(' | ');
  const sep = cols.map((c) => '-'.repeat(c.width)).join('-+-');
  const rows = items.map((item) =>
    cols
      .map((c) => {
        const val = String(item[c.key] || '');
        return val.length > c.width ? val.slice(0, c.width - 1) + '…' : val.padEnd(c.width);
      })
      .join(' | ')
  );

  return [header, sep, ...rows].join('\n') + '\n';
}

/**
 * Format items as CSV.
 * @param {object[]} items
 * @returns {string}
 */
function formatCsv(items) {
  const fields = [
    'id',
    'externalId',
    'title',
    'priority',
    'status',
    'phase',
    'team',
    'source',
    'assignee',
    'labels',
    'milestone',
    'createdAt',
    'updatedAt',
  ];
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = fields.join(',');
  const rows = items.map((item) =>
    fields
      .map((f) => {
        const val = item[f];
        return escape(Array.isArray(val) ? val.join(';') : val);
      })
      .join(',')
  );
  return [header, ...rows].join('\n') + '\n';
}

/**
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags
 */
export async function runBacklogViewer({ agentkitRoot, projectRoot, flags }) {
  // Read from JSON store first, fall back to markdown parse
  let items = readBacklogJson(projectRoot);
  if (!items.length) {
    items = readBacklogMarkdown(projectRoot);
  }

  // Apply filters
  items = filterItems(items, {
    team: flags.team || null,
    priority: flags.priority || null,
    source: flags.source || null,
    status: flags.status || null,
  });

  // Sort
  items = sortItems(items, flags.sort || 'priority');

  // Format output
  const format = flags.format || 'table';
  let output;

  switch (format) {
    case 'json':
      output = JSON.stringify(items, null, 2) + '\n';
      break;
    case 'yaml':
      output = yaml.dump(items, { lineWidth: 120 });
      break;
    case 'csv':
      output = formatCsv(items);
      break;
    case 'table':
    default:
      output = formatTable(items);
      break;
  }

  console.log(`[agentkit:backlog] ${items.length} items (format: ${format})\n`);
  process.stdout.write(output);
}
