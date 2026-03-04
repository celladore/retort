/**
 * AgentKit Forge — Sync-Backlog Runner
 * Orchestrated backlog sync combining external tracker + local sources.
 * Runtime handler for the /sync-backlog command and `agentkit sync-backlog` CLI.
 */
import { existsSync, readFileSync } from 'fs';
import { appendFile, mkdir } from 'fs/promises';
import yaml from 'js-yaml';
import { resolve } from 'path';
import {
  readBacklogJson,
  writeBacklogJson,
  writeBacklogMarkdown,
  sortItems,
} from './backlog-store.mjs';
import { normalizeIssue, deduplicateItems } from './issue-normalizer.mjs';
import { createAdapter } from './tracker-adapter.mjs';

/**
 * Collect items from the orchestrator state (healthcheck, risks).
 * @param {string} projectRoot
 * @returns {object[]}
 */
function collectOrchestratorItems(projectRoot) {
  const items = [];
  const orchPath = resolve(projectRoot, '.claude', 'state', 'orchestrator.json');
  if (!existsSync(orchPath)) return items;

  try {
    const orch = JSON.parse(readFileSync(orchPath, 'utf-8'));

    // Risks
    if (Array.isArray(orch.risks)) {
      for (const risk of orch.risks) {
        items.push({
          id: null,
          externalId: null,
          externalUrl: null,
          title: risk.title || risk.description || 'Risk item',
          priority: risk.severity === 'critical' ? 'P0' : risk.severity === 'high' ? 'P1' : 'P2',
          status: 'open',
          phase: 'Planning',
          team: risk.team || 'quality',
          assignee: null,
          source: 'healthcheck',
          what: risk.description || '',
          why: risk.impact || '',
          acceptance: [],
          files: [],
          labels: [],
          milestone: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          closedAt: null,
          lastSyncedAt: new Date().toISOString(),
          dirty: false,
        });
      }
    }
  } catch {
    /* best-effort */
  }

  return items;
}

/**
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags
 */
export async function runSyncBacklog({ agentkitRoot, projectRoot, flags }) {
  // Load project config
  const projectPath = resolve(agentkitRoot, 'spec', 'project.yaml');
  let project = {};
  if (existsSync(projectPath)) {
    project = yaml.load(readFileSync(projectPath, 'utf-8')) || {};
  }

  const intake = project?.process?.intake || {};
  const tracker = flags.tracker || project?.process?.issueTracker || 'none';
  const direction = flags.direction || 'pull';

  console.log(`[agentkit:sync-backlog] Starting backlog sync (tracker: ${tracker}, direction: ${direction})...`);

  // 1. Read existing backlog
  const existing = readBacklogJson(projectRoot);
  let allIncoming = [];

  // 2. Pull from external tracker (if direction includes pull)
  if (direction !== 'push' && tracker !== 'none') {
    try {
      const adapter = await createAdapter(tracker, projectRoot);
      const rawIssues = adapter.fetchIssues({
        state: flags.state || 'open',
        labels: flags.labels || null,
      });

      const config = {
        importLabelsMap: intake.importLabelsMap || {},
        importStateMap: intake.importStateMap || {},
        importTeamMap: intake.importTeamMap || {},
        ownerTeam: flags['owner-team'] || intake.ownerTeam || 'product',
        source: tracker,
      };
      const normalized = rawIssues.map((issue) => normalizeIssue(issue, config));
      allIncoming.push(...normalized);
      console.log(`  External tracker: ${normalized.length} issues`);
    } catch (err) {
      console.warn(`  External tracker failed: ${err.message}`);
    }
  }

  // 3. Collect orchestrator/healthcheck items
  const orchItems = collectOrchestratorItems(projectRoot);
  if (orchItems.length) {
    allIncoming.push(...orchItems);
    console.log(`  Orchestrator/healthcheck: ${orchItems.length} items`);
  }

  // 4. Merge
  const { merged, added, updated, preserved } = deduplicateItems(existing, allIncoming);

  // Apply team filter if requested
  let result = merged;
  if (flags.team) {
    const teamFilter = flags.team.toLowerCase();
    result = merged.filter(
      (i) => i.team?.toLowerCase() === teamFilter || !i.team
    );
  }

  const sorted = sortItems(result, 'priority');

  // 5. Write
  await writeBacklogJson(projectRoot, sorted);
  const repoName = project?.name || '';
  await writeBacklogMarkdown(projectRoot, sorted, repoName);

  // 6. Events log
  const eventsDir = resolve(projectRoot, '.claude', 'state');
  await mkdir(eventsDir, { recursive: true });
  const eventsPath = resolve(eventsDir, 'events.log');
  const timestamp = new Date().toISOString();
  const p0 = sorted.filter((i) => i.priority === 'P0').length;
  const p1 = sorted.filter((i) => i.priority === 'P1').length;
  const logEntry = `[${timestamp}] [BACKLOG] [SYNC] Synced backlog. Total: ${sorted.length}. P0: ${p0}. P1: ${p1}. New: ${added}. Updated: ${updated}. Manual: ${preserved}.\n`;
  await appendFile(eventsPath, logEntry, 'utf-8');

  console.log(`[agentkit:sync-backlog] Done.`);
  console.log(`  Total: ${sorted.length} | Added: ${added} | Updated: ${updated} | Manual: ${preserved}`);
}
