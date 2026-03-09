/**
 * AgentKit Forge — Sync-Backlog Runner
 * Orchestrated backlog sync combining external tracker + local sources.
 * Runtime handler for the /sync-backlog command and `agentkit sync-backlog` CLI.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'path';
import {
  readBacklogJson,
  readBacklogMarkdown,
  sortItems,
  writeBacklogJson,
  writeBacklogMarkdown,
} from './backlog-store.mjs';
import { emitEvent } from './event-emitter.mjs';
import { deduplicateItems, inferCategoryScores, normalizeIssue } from './issue-normalizer.mjs';
import { createAdapter } from './tracker-adapter.mjs';
import { calculateScore } from './weighted-scorer.mjs';

/**
 * Collect items from the orchestrator state (healthcheck, risks).
 * @param {string} projectRoot
 * @returns {object[]}
 */
function collectOrchestratorItems(projectRoot) {
  const items = [];
  const orchPath = resolve(projectRoot, '.agentkit', 'state', 'orchestrator.json');
  if (!existsSync(orchPath)) return items;

  try {
    const orch = JSON.parse(readFileSync(orchPath, 'utf-8'));

    // Risks
    if (Array.isArray(orch.risks)) {
      const now = new Date().toISOString();
      for (const risk of orch.risks) {
        const riskKey = risk.title || risk.description || 'risk';
        const hash = createHash('sha256')
          .update(`healthcheck:${riskKey}`)
          .digest('hex')
          .slice(0, 8);
        items.push({
          id: `bi-healthcheck-${hash}`,
          externalId: `HC-${hash}`,
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
          createdAt: now,
          updatedAt: now,
          closedAt: null,
          lastSyncedAt: now,
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
  const userContext =
    Array.isArray(flags?._args) && flags._args.length > 0 ? flags._args.join(' ') : null;
  if (userContext) {
    console.log(`[agentkit:sync-backlog] Context: ${userContext}`);
  }
  // Load project config
  const projectPath = resolve(agentkitRoot, 'spec', 'project.yaml');
  let project = {};
  if (existsSync(projectPath)) {
    project = yaml.load(readFileSync(projectPath, 'utf-8')) || {};
  }

  const intake = project?.process?.intake || {};
  const tracker = flags.tracker || project?.process?.issueTracker || 'none';
  const direction = flags.direction || 'pull';

  console.log(
    `[agentkit:sync-backlog] Starting backlog sync (tracker: ${tracker}, direction: ${direction})...`
  );

  if (direction === 'push') {
    console.warn(
      '[agentkit:sync-backlog] Warning: --direction push is not yet implemented. ' +
        'Only local sources will be collected. Use --direction pull (default) to fetch from tracker.'
    );
  }

  // 1. Read existing backlog (fall back to markdown if JSON store is empty/missing)
  let existing = readBacklogJson(projectRoot);
  if (!existing.length) {
    existing = readBacklogMarkdown(projectRoot);
    if (existing.length) {
      console.warn(
        '  [agentkit:sync-backlog] Warning: JSON store empty, fell back to markdown parse.'
      );
    }
  }
  let allIncoming = [];

  // 2. Pull from external tracker (if direction includes pull and autoImport is enabled or --force)
  const autoImport = intake.autoImport ?? false;
  if (direction !== 'push' && tracker !== 'none' && (autoImport || flags.force)) {
    try {
      const adapter = await createAdapter(tracker, projectRoot);
      const rawIssues = await adapter.fetchIssues({
        state: flags.state || 'open',
        labels: flags.labels || null,
        since: flags.since || null,
        limit: flags.limit && Number.isFinite(Number(flags.limit)) ? Number(flags.limit) : 100,
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

  // 3b. Enrich with weighted scoring when enabled
  const scoringEnabled = intake.scoring?.enabled ?? false;
  if (scoringEnabled && allIncoming.length) {
    const phase = project?.phase || undefined;
    for (const item of allIncoming) {
      const result = calculateScore(inferCategoryScores(item), { phase });
      item.priority = result.priority;
      item.score = result.score;
    }
    console.log(`  Scoring applied to ${allIncoming.length} items (phase: ${phase || 'default'}).`);
  }

  // 4. Merge
  const { merged, added, updated, preserved } = deduplicateItems(existing, allIncoming);

  const sorted = sortItems(merged, 'priority');

  // 5. Write full backlog (never filter before persisting)
  await writeBacklogJson(projectRoot, sorted);
  const repoName = project?.name || '';
  await writeBacklogMarkdown(projectRoot, sorted, repoName);

  // 6. Emit structured event
  const p0 = sorted.filter((i) => i.priority === 'P0').length;
  const p1 = sorted.filter((i) => i.priority === 'P1').length;
  await emitEvent(
    projectRoot,
    'backlog_sync',
    {
      total: sorted.length,
      p0,
      p1,
      added,
      updated,
      preserved,
      ...(userContext ? { userContext } : {}),
    },
    { source: 'sync-backlog' }
  );

  // Apply team filter for display only (does not affect persisted data)
  let displayItems = sorted;
  if (flags.team) {
    const teamFilter = flags.team.toLowerCase();
    displayItems = sorted.filter((i) => i.team?.toLowerCase() === teamFilter);
  }

  console.log(`[agentkit:sync-backlog] Done.`);
  console.log(
    `  Total: ${sorted.length} | Added: ${added} | Updated: ${updated} | Manual: ${preserved}`
  );
  if (flags.team) {
    console.log(`  Showing: ${displayItems.length} items for team "${flags.team}"`);
  }
}
