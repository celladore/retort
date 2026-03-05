/**
 * AgentKit Forge — Import Issues
 * Fetches issues from an external tracker, normalizes, deduplicates, and
 * merges into the local backlog.
 */
import { existsSync, readFileSync } from 'fs';
import { appendFile, mkdir } from 'fs/promises';
import yaml from 'js-yaml';
import { resolve } from 'path';
import {
  readBacklogJson,
  readBacklogMarkdown,
  writeBacklogJson,
  writeBacklogMarkdown,
  sortItems,
} from './backlog-store.mjs';
import { normalizeIssue, deduplicateItems } from './issue-normalizer.mjs';
import { createAdapter } from './tracker-adapter.mjs';

/**
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags
 */
export async function runImportIssues({ agentkitRoot, projectRoot, flags }) {
  // Load project config
  const projectPath = resolve(agentkitRoot, 'spec', 'project.yaml');
  let project = {};
  if (existsSync(projectPath)) {
    project = yaml.load(readFileSync(projectPath, 'utf-8')) || {};
  }

  const intake = project?.process?.intake || {};
  const tracker = flags.tracker || project?.process?.issueTracker || 'none';
  const autoImport = intake.autoImport ?? false;

  // Gate check
  if (!autoImport && !flags.force) {
    console.log(
      '[agentkit:import-issues] Auto-import is disabled. Use --force to override, ' +
        'or set process.intake.autoImport: true in project.yaml.'
    );
    return { imported: 0, skipped: 0 };
  }

  if (tracker === 'none') {
    console.log('[agentkit:import-issues] Issue tracker is "none". Nothing to import.');
    return { imported: 0, skipped: 0 };
  }

  console.log(`[agentkit:import-issues] Importing from ${tracker}...`);

  // Create adapter and fetch
  const adapter = await createAdapter(tracker, projectRoot);
  const rawIssues = await adapter.fetchIssues({
    state: flags.state || 'open',
    labels: flags.labels || null,
    since: flags.since || null,
    limit: flags.limit ? Number(flags.limit) : 100,
  });

  console.log(`[agentkit:import-issues] Fetched ${rawIssues.length} issues from ${tracker}.`);

  // Normalize
  const config = {
    importLabelsMap: intake.importLabelsMap || {},
    importStateMap: intake.importStateMap || {},
    importTeamMap: intake.importTeamMap || {},
    ownerTeam: intake.ownerTeam || 'product',
    source: tracker,
  };
  const normalized = rawIssues.map((issue) => normalizeIssue(issue, config));

  // Dry-run
  if (flags['dry-run']) {
    console.log(`\n[agentkit:import-issues] DRY RUN — ${normalized.length} items would be imported:\n`);
    for (const item of normalized) {
      console.log(
        `  ${item.priority} | ${item.team} | ${item.title} [${item.externalId}]`
      );
    }
    return { imported: normalized.length, skipped: 0, dryRun: true };
  }

  // Merge with existing backlog (fall back to markdown if JSON store is empty/missing)
  let existing = readBacklogJson(projectRoot);
  if (!existing.length) {
    existing = readBacklogMarkdown(projectRoot);
  }
  const { merged, added, updated, preserved } = deduplicateItems(existing, normalized);
  const sorted = sortItems(merged, 'priority');

  // Write both stores
  await writeBacklogJson(projectRoot, sorted);
  const repoName = project?.name || '';
  await writeBacklogMarkdown(projectRoot, sorted, repoName);

  // Append to events.log
  const eventsDir = resolve(projectRoot, '.claude', 'state');
  await mkdir(eventsDir, { recursive: true });
  const eventsPath = resolve(eventsDir, 'events.log');
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [IMPORT] [${tracker.toUpperCase()}] Imported ${added} new, updated ${updated}, preserved ${preserved} manual items. Total: ${sorted.length}.\n`;
  await appendFile(eventsPath, logEntry, 'utf-8');

  console.log(`[agentkit:import-issues] Done.`);
  console.log(`  Added:     ${added}`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Preserved: ${preserved} manual items`);
  console.log(`  Total:     ${sorted.length}`);

  return { imported: added, updated, preserved, total: sorted.length };
}
