/**
 * Retort — Agent/Team Relationship Analysis Engine
 *
 * Loads agent and team specs, builds a relationship graph, and renders
 * 8 cross-reference matrices plus supplementary analyses (orphans,
 * cycles, coverage gaps, coupling, bottlenecks, reachability).
 */
import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'path';
import { loadAgentsSpec } from './synchronize.mjs';

// ---------------------------------------------------------------------------
// Core data loader
// ---------------------------------------------------------------------------

/**
 * Load the full agent/team relationship graph from spec files.
 * @param {string} agentkitRoot - Path to .agentkit directory
 * @returns {{ agents: object[], teams: object[], categories: string[], teamMap: Map, agentMap: Map, relationships: object }}
 */
export function loadFullAgentGraph(agentkitRoot) {
  const teamsPath = resolve(agentkitRoot, 'spec', 'teams.yaml');

  const agents = [];
  const categories = [];
  const agentMap = new Map(); // agentId → agent
  const categoryMap = new Map(); // category → agentId[]

  const spec = loadAgentsSpec(agentkitRoot);
  if (spec?.agents && typeof spec.agents === 'object') {
    for (const [category, agentList] of Object.entries(spec.agents)) {
      if (!Array.isArray(agentList)) continue;
      categories.push(category);
      categoryMap.set(category, []);
      for (const agent of agentList) {
        if (!agent?.id) continue;
        const enriched = { ...agent, _category: category };
        agents.push(enriched);
        agentMap.set(agent.id, enriched);
        categoryMap.get(category).push(agent.id);
      }
    }
  }

  const teams = [];
  const teamMap = new Map(); // teamId → team

  if (existsSync(teamsPath)) {
    const spec = yaml.load(readFileSync(teamsPath, 'utf-8'));
    if (Array.isArray(spec?.teams)) {
      for (const team of spec.teams) {
        if (!team?.id) continue;
        teams.push(team);
        teamMap.set(team.id, team);
      }
    }
  }

  // Build relationships
  const relationships = {
    dependsOn: new Map(), // agentId → Set<agentId>
    dependedOnBy: new Map(), // agentId → Set<agentId>
    notifies: new Map(), // agentId → Set<agentId>
    notifiedBy: new Map(), // agentId → Set<agentId>
    teamHandoffs: new Map(), // teamId → string[] (handoff-chain)
    agentToTeam: new Map(), // agentId → teamId
    teamToAgents: new Map(), // teamId → agentId[]
  };

  // Map agents to teams
  for (const team of teams) {
    const teamAgentIds = [];

    // Explicit agents list takes priority
    if (Array.isArray(team.agents) && team.agents.length > 0) {
      for (const agentId of team.agents) {
        if (agentMap.has(agentId)) {
          teamAgentIds.push(agentId);
          relationships.agentToTeam.set(agentId, team.id);
        }
      }
    } else {
      // Fallback: match by category name === team id
      const catAgents = categoryMap.get(team.id) || [];
      for (const agentId of catAgents) {
        teamAgentIds.push(agentId);
        relationships.agentToTeam.set(agentId, team.id);
      }
    }

    relationships.teamToAgents.set(team.id, teamAgentIds);

    // Handoff chains
    if (Array.isArray(team['handoff-chain'])) {
      relationships.teamHandoffs.set(team.id, [...team['handoff-chain']]);
    }
  }

  // Build agent dependency and notification graphs
  for (const agent of agents) {
    const deps = Array.isArray(agent['depends-on']) ? agent['depends-on'] : [];
    const notifs = Array.isArray(agent.notifies) ? agent.notifies : [];

    relationships.dependsOn.set(agent.id, new Set(deps));
    for (const dep of deps) {
      if (!relationships.dependedOnBy.has(dep)) {
        relationships.dependedOnBy.set(dep, new Set());
      }
      relationships.dependedOnBy.get(dep).add(agent.id);
    }

    relationships.notifies.set(agent.id, new Set(notifs));
    for (const target of notifs) {
      if (!relationships.notifiedBy.has(target)) {
        relationships.notifiedBy.set(target, new Set());
      }
      relationships.notifiedBy.get(target).add(agent.id);
    }
  }

  return { agents, teams, categories, teamMap, agentMap, categoryMap, relationships };
}

// ---------------------------------------------------------------------------
// Matrix 1: Agent → Team Membership
// ---------------------------------------------------------------------------

export function renderAgentTeamMembership(graph) {
  const lines = ['## Matrix 1: Agent → Team Membership', ''];
  lines.push('| Agent | Category | Team |');
  lines.push('|-------|----------|------|');

  const mapped = [];
  const unmapped = [];

  for (const agent of graph.agents) {
    const teamId = graph.relationships.agentToTeam.get(agent.id);
    if (teamId) {
      const team = graph.teamMap.get(teamId);
      mapped.push({ agent: agent.id, category: agent._category, team: team?.name || teamId });
    } else {
      unmapped.push({ agent: agent.id, category: agent._category });
    }
  }

  for (const row of mapped) {
    lines.push(`| ${row.agent} | ${row.category} | ${row.team} |`);
  }

  if (unmapped.length > 0) {
    lines.push('');
    lines.push('**Agents with no team mapping:**');
    lines.push('');
    for (const row of unmapped) {
      lines.push(`- \`${row.agent}\` (category: ${row.category})`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Matrix 2: Team → Team Handoff (Incoming)
// ---------------------------------------------------------------------------

export function renderTeamHandoffIncoming(graph) {
  const lines = ['## Matrix 2: Team Handoff — Incoming', ''];
  lines.push('| Receiving Team | Receives Handoffs From |');
  lines.push('|----------------|------------------------|');

  // Build incoming map: for each team, who hands off TO it?
  const incoming = new Map();
  for (const team of graph.teams) {
    incoming.set(team.id, []);
  }

  for (const [teamId, chain] of graph.relationships.teamHandoffs) {
    for (const target of chain) {
      if (incoming.has(target)) {
        incoming.get(target).push(teamId);
      }
    }
  }

  for (const [teamId, sources] of incoming) {
    if (sources.length === 0) continue;
    const team = graph.teamMap.get(teamId);
    lines.push(`| ${team?.name || teamId} | ${sources.join(', ')} |`);
  }

  // Teams with no incoming handoffs
  const noIncoming = [...incoming.entries()].filter(([, s]) => s.length === 0).map(([id]) => id);
  if (noIncoming.length > 0) {
    lines.push('');
    lines.push(`**No incoming handoffs:** ${noIncoming.join(', ')}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Matrix 3: Team → Team Handoff (Outgoing)
// ---------------------------------------------------------------------------

export function renderTeamHandoffOutgoing(graph) {
  const lines = ['## Matrix 3: Team Handoff — Outgoing', ''];
  lines.push('| Sending Team | Hands Off To |');
  lines.push('|--------------|--------------|');

  for (const team of graph.teams) {
    const chain = graph.relationships.teamHandoffs.get(team.id) || [];
    const display = chain.length > 0 ? chain.join(' → ') : '∅ (endpoint)';
    lines.push(`| ${team.name || team.id} | ${display} |`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Matrix 4: Agent → Agent Dependencies (Incoming)
// ---------------------------------------------------------------------------

export function renderAgentDependencyIncoming(graph) {
  const lines = ['## Matrix 4: Agent Dependencies — Incoming (depended-on by)', ''];
  lines.push('| Agent | Depended-On By |');
  lines.push('|-------|----------------|');

  for (const agent of graph.agents) {
    const deps = graph.relationships.dependedOnBy.get(agent.id);
    if (deps && deps.size > 0) {
      lines.push(`| ${agent.id} | ${[...deps].join(', ')} |`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Matrix 5: Agent → Agent Dependencies (Outgoing)
// ---------------------------------------------------------------------------

export function renderAgentDependencyOutgoing(graph) {
  const lines = ['## Matrix 5: Agent Dependencies — Outgoing (depends-on)', ''];
  lines.push('| Agent | Depends On |');
  lines.push('|-------|------------|');

  for (const agent of graph.agents) {
    const deps = graph.relationships.dependsOn.get(agent.id);
    if (deps && deps.size > 0) {
      lines.push(`| ${agent.id} | ${[...deps].join(', ')} |`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Matrix 6: Agent → Agent Notifications (Incoming)
// ---------------------------------------------------------------------------

export function renderAgentNotificationIncoming(graph) {
  const lines = ['## Matrix 6: Agent Notifications — Incoming (notified by)', ''];
  lines.push('| Agent | Notified By |');
  lines.push('|-------|-------------|');

  for (const agent of graph.agents) {
    const sources = graph.relationships.notifiedBy.get(agent.id);
    if (sources && sources.size > 0) {
      lines.push(`| ${agent.id} | ${[...sources].join(', ')} |`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Matrix 7: Agent → Agent Notifications (Outgoing)
// ---------------------------------------------------------------------------

export function renderAgentNotificationOutgoing(graph) {
  const lines = ['## Matrix 7: Agent Notifications — Outgoing (notifies)', ''];
  lines.push('| Agent | Notifies |');
  lines.push('|-------|----------|');

  for (const agent of graph.agents) {
    const targets = graph.relationships.notifies.get(agent.id);
    if (targets && targets.size > 0) {
      lines.push(`| ${agent.id} | ${[...targets].join(', ')} |`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Matrix 8: Cross-Team Agent Interactions
// ---------------------------------------------------------------------------

export function renderAgentTeamCrossBoundary(graph) {
  const lines = ['## Matrix 8: Cross-Team Agent Interactions', ''];
  lines.push('| Agent | Team | Relationship | Target Agent | Target Team |');
  lines.push('|-------|------|--------------|--------------|-------------|');

  for (const agent of graph.agents) {
    const agentTeam = graph.relationships.agentToTeam.get(agent.id);

    // Check depends-on
    const deps = graph.relationships.dependsOn.get(agent.id) || new Set();
    for (const dep of deps) {
      const depTeam = graph.relationships.agentToTeam.get(dep);
      if (depTeam && depTeam !== agentTeam) {
        lines.push(`| ${agent.id} | ${agentTeam || '?'} | depends-on | ${dep} | ${depTeam} |`);
      }
    }

    // Check notifies
    const notifs = graph.relationships.notifies.get(agent.id) || new Set();
    for (const target of notifs) {
      const targetTeam = graph.relationships.agentToTeam.get(target);
      if (targetTeam && targetTeam !== agentTeam) {
        lines.push(`| ${agent.id} | ${agentTeam || '?'} | notifies | ${target} | ${targetTeam} |`);
      }
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Supplementary Analyses
// ---------------------------------------------------------------------------

/** Agents with no depends-on AND no notifies (isolated). */
export function detectOrphans(graph) {
  const orphans = [];
  for (const agent of graph.agents) {
    const deps = graph.relationships.dependsOn.get(agent.id) || new Set();
    const depBy = graph.relationships.dependedOnBy.get(agent.id) || new Set();
    const notifs = graph.relationships.notifies.get(agent.id) || new Set();
    const notifBy = graph.relationships.notifiedBy.get(agent.id) || new Set();

    if (deps.size === 0 && depBy.size === 0 && notifs.size === 0 && notifBy.size === 0) {
      orphans.push(agent.id);
    }
  }
  return orphans;
}

/** Detect cycles in depends-on graph using DFS. */
export function detectCircularDeps(graph) {
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();

  function dfs(agentId, path) {
    if (inStack.has(agentId)) {
      const cycleStart = path.indexOf(agentId);
      cycles.push(path.slice(cycleStart).concat(agentId));
      return;
    }
    if (visited.has(agentId)) return;

    visited.add(agentId);
    inStack.add(agentId);

    const deps = graph.relationships.dependsOn.get(agentId) || new Set();
    for (const dep of deps) {
      dfs(dep, [...path, agentId]);
    }

    inStack.delete(agentId);
  }

  for (const agent of graph.agents) {
    if (!visited.has(agent.id)) {
      dfs(agent.id, []);
    }
  }

  return cycles;
}

/** Teams with no agents / categories with no team. */
export function findTeamCoverageGaps(graph) {
  const teamsWithNoAgents = [];
  const categoriesWithNoTeam = [];

  for (const team of graph.teams) {
    const teamAgents = graph.relationships.teamToAgents.get(team.id) || [];
    if (teamAgents.length === 0) {
      teamsWithNoAgents.push(team.id);
    }
  }

  const teamIds = new Set(graph.teams.map((t) => t.id));
  for (const category of graph.categories) {
    // Check if any team maps to this category (via explicit agents or category match)
    let hasCoverage = false;
    if (teamIds.has(category)) {
      hasCoverage = true;
    } else {
      // Check if any team has explicit agents from this category
      for (const [, agentIds] of graph.relationships.teamToAgents) {
        const catAgents = graph.categoryMap.get(category) || [];
        if (catAgents.some((a) => agentIds.includes(a))) {
          hasCoverage = true;
          break;
        }
      }
    }
    if (!hasCoverage) {
      categoriesWithNoTeam.push(category);
    }
  }

  return { teamsWithNoAgents, categoriesWithNoTeam };
}

/** Coupling metrics per team pair. */
export function computeCrossteamCoupling(graph) {
  const coupling = new Map(); // "teamA↔teamB" → { dependsOn: N, notifies: N }

  for (const agent of graph.agents) {
    const agentTeam = graph.relationships.agentToTeam.get(agent.id);
    if (!agentTeam) continue;

    const deps = graph.relationships.dependsOn.get(agent.id) || new Set();
    for (const dep of deps) {
      const depTeam = graph.relationships.agentToTeam.get(dep);
      if (depTeam && depTeam !== agentTeam) {
        const key = [agentTeam, depTeam].sort().join('↔');
        if (!coupling.has(key)) coupling.set(key, { dependsOn: 0, notifies: 0 });
        coupling.get(key).dependsOn++;
      }
    }

    const notifs = graph.relationships.notifies.get(agent.id) || new Set();
    for (const target of notifs) {
      const targetTeam = graph.relationships.agentToTeam.get(target);
      if (targetTeam && targetTeam !== agentTeam) {
        const key = [agentTeam, targetTeam].sort().join('↔');
        if (!coupling.has(key)) coupling.set(key, { dependsOn: 0, notifies: 0 });
        coupling.get(key).notifies++;
      }
    }
  }

  return coupling;
}

/** Overlapping scope between teams. */
export function findConsolidationOpps(graph) {
  const opps = [];

  for (let i = 0; i < graph.teams.length; i++) {
    for (let j = i + 1; j < graph.teams.length; j++) {
      const a = graph.teams[i];
      const b = graph.teams[j];
      const scopeA = new Set(Array.isArray(a.scope) ? a.scope : []);
      const scopeB = new Set(Array.isArray(b.scope) ? b.scope : []);
      const overlap = [...scopeA].filter((s) => scopeB.has(s));
      if (overlap.length > 0) {
        opps.push({
          teamA: a.id,
          teamB: b.id,
          overlappingScopes: overlap,
          overlapRatio: overlap.length / Math.min(scopeA.size, scopeB.size),
        });
      }
    }
  }

  return opps.sort((a, b) => b.overlapRatio - a.overlapRatio);
}

/** Most-connected agents (depends-on + notifies, in+out). */
export function rankHubAgents(graph) {
  const scores = [];

  for (const agent of graph.agents) {
    const depsOut = (graph.relationships.dependsOn.get(agent.id) || new Set()).size;
    const depsIn = (graph.relationships.dependedOnBy.get(agent.id) || new Set()).size;
    const notifsOut = (graph.relationships.notifies.get(agent.id) || new Set()).size;
    const notifsIn = (graph.relationships.notifiedBy.get(agent.id) || new Set()).size;
    const total = depsOut + depsIn + notifsOut + notifsIn;

    if (total > 0) {
      scores.push({ id: agent.id, total, depsOut, depsIn, notifsOut, notifsIn });
    }
  }

  return scores.sort((a, b) => b.total - a.total);
}

/** Most-depended-on agents (single points of failure). */
export function rankBottleneckAgents(graph) {
  const scores = [];

  for (const agent of graph.agents) {
    const depsIn = (graph.relationships.dependedOnBy.get(agent.id) || new Set()).size;
    if (depsIn > 0) {
      scores.push({ id: agent.id, dependedOnBy: depsIn });
    }
  }

  return scores.sort((a, b) => b.dependedOnBy - a.dependedOnBy);
}

/** Teams that receive the most handoffs. */
export function computeTeamFanIn(graph) {
  const fanIn = new Map();
  for (const team of graph.teams) {
    fanIn.set(team.id, 0);
  }

  for (const [, chain] of graph.relationships.teamHandoffs) {
    for (const target of chain) {
      fanIn.set(target, (fanIn.get(target) || 0) + 1);
    }
  }

  return [...fanIn.entries()]
    .map(([id, count]) => ({ id, fanIn: count }))
    .sort((a, b) => b.fanIn - a.fanIn);
}

/** Teams that send the most handoffs. */
export function computeTeamFanOut(graph) {
  return graph.teams
    .map((t) => ({
      id: t.id,
      fanOut: (graph.relationships.teamHandoffs.get(t.id) || []).length,
    }))
    .sort((a, b) => b.fanOut - a.fanOut);
}

/** Transitive closure: who can reach whom via depends-on. */
export function computeAgentReachability(graph) {
  const reachable = new Map(); // agentId → Set<agentId>

  function getReachable(agentId, visited = new Set()) {
    if (reachable.has(agentId)) return reachable.get(agentId);
    if (visited.has(agentId)) return new Set(); // cycle protection

    visited.add(agentId);
    const result = new Set();
    const deps = graph.relationships.dependsOn.get(agentId) || new Set();

    for (const dep of deps) {
      result.add(dep);
      const transitive = getReachable(dep, visited);
      for (const t of transitive) {
        result.add(t);
      }
    }

    reachable.set(agentId, result);
    return result;
  }

  for (const agent of graph.agents) {
    getReachable(agent.id);
  }

  return reachable;
}

/** Find longest dependency chain (critical path). */
export function findCriticalPath(graph) {
  const memo = new Map();

  function longestPath(agentId, visited = new Set()) {
    if (memo.has(agentId)) return memo.get(agentId);
    if (visited.has(agentId)) return [agentId]; // cycle

    visited.add(agentId);
    const deps = graph.relationships.dependsOn.get(agentId) || new Set();
    let longest = [agentId];

    for (const dep of deps) {
      const path = longestPath(dep, new Set(visited));
      if (path.length + 1 > longest.length) {
        longest = [agentId, ...path];
      }
    }

    memo.set(agentId, longest);
    return longest;
  }

  let criticalPath = [];
  for (const agent of graph.agents) {
    const path = longestPath(agent.id);
    if (path.length > criticalPath.length) {
      criticalPath = path;
    }
  }

  return criticalPath;
}

/** Agents whose changes trigger the most downstream notifications (transitive). */
export function findNotificationAmplifiers(graph) {
  const reachable = new Map();

  function getNotifReachable(agentId, visited = new Set()) {
    if (reachable.has(agentId)) return reachable.get(agentId);
    if (visited.has(agentId)) return new Set();

    visited.add(agentId);
    const result = new Set();
    const targets = graph.relationships.notifies.get(agentId) || new Set();

    for (const target of targets) {
      result.add(target);
      const transitive = getNotifReachable(target, visited);
      for (const t of transitive) {
        result.add(t);
      }
    }

    reachable.set(agentId, result);
    return result;
  }

  const scores = [];
  for (const agent of graph.agents) {
    const reach = getNotifReachable(agent.id);
    if (reach.size > 0) {
      scores.push({ id: agent.id, reach: reach.size, targets: [...reach] });
    }
  }

  return scores.sort((a, b) => b.reach - a.reach);
}

// ---------------------------------------------------------------------------
// Full render
// ---------------------------------------------------------------------------

export function renderSupplementaryAnalyses(graph) {
  const lines = ['## Supplementary Analyses', ''];

  // Orphans
  const orphans = detectOrphans(graph);
  lines.push('### Orphan Agents (no connections)');
  lines.push('');
  if (orphans.length === 0) {
    lines.push('None detected.');
  } else {
    for (const id of orphans) {
      const agent = graph.agentMap.get(id);
      lines.push(`- \`${id}\` (category: ${agent?._category || '?'})`);
    }
  }
  lines.push('');

  // Circular dependencies
  const cycles = detectCircularDeps(graph);
  lines.push('### Circular Dependencies');
  lines.push('');
  if (cycles.length === 0) {
    lines.push('None detected.');
  } else {
    for (const cycle of cycles) {
      lines.push(`- ${cycle.join(' → ')}`);
    }
  }
  lines.push('');

  // Coverage gaps
  const gaps = findTeamCoverageGaps(graph);
  lines.push('### Team Coverage Gaps');
  lines.push('');
  if (gaps.teamsWithNoAgents.length > 0) {
    lines.push(`**Teams with no agents:** ${gaps.teamsWithNoAgents.join(', ')}`);
  }
  if (gaps.categoriesWithNoTeam.length > 0) {
    lines.push(`**Categories with no team:** ${gaps.categoriesWithNoTeam.join(', ')}`);
  }
  if (gaps.teamsWithNoAgents.length === 0 && gaps.categoriesWithNoTeam.length === 0) {
    lines.push('Full coverage — every team has agents and every category has a team.');
  }
  lines.push('');

  // Hub agents
  const hubs = rankHubAgents(graph);
  lines.push('### Hub Agents (most connections)');
  lines.push('');
  lines.push('| Agent | Total | Deps Out | Deps In | Notifs Out | Notifs In |');
  lines.push('|-------|-------|----------|---------|------------|-----------|');
  for (const hub of hubs.slice(0, 10)) {
    lines.push(
      `| ${hub.id} | ${hub.total} | ${hub.depsOut} | ${hub.depsIn} | ${hub.notifsOut} | ${hub.notifsIn} |`
    );
  }
  lines.push('');

  // Bottleneck agents
  const bottlenecks = rankBottleneckAgents(graph);
  lines.push('### Bottleneck Agents (most depended-on)');
  lines.push('');
  if (bottlenecks.length === 0) {
    lines.push('No agents with incoming dependencies.');
  } else {
    lines.push('| Agent | Depended-On By Count |');
    lines.push('|-------|----------------------|');
    for (const b of bottlenecks.slice(0, 10)) {
      lines.push(`| ${b.id} | ${b.dependedOnBy} |`);
    }
  }
  lines.push('');

  // Team fan-in/fan-out
  const fanIn = computeTeamFanIn(graph);
  const fanOut = computeTeamFanOut(graph);
  lines.push('### Team Fan-In / Fan-Out');
  lines.push('');
  lines.push('| Team | Fan-In (receives) | Fan-Out (sends) |');
  lines.push('|------|-------------------|-----------------|');
  const fanMap = new Map();
  for (const f of fanIn) fanMap.set(f.id, { fanIn: f.fanIn, fanOut: 0 });
  for (const f of fanOut) {
    if (fanMap.has(f.id)) fanMap.get(f.id).fanOut = f.fanOut;
    else fanMap.set(f.id, { fanIn: 0, fanOut: f.fanOut });
  }
  for (const [id, vals] of fanMap) {
    lines.push(`| ${id} | ${vals.fanIn} | ${vals.fanOut} |`);
  }
  lines.push('');

  // Consolidation opportunities
  const opps = findConsolidationOpps(graph);
  lines.push('### Consolidation Opportunities (overlapping scope)');
  lines.push('');
  if (opps.length === 0) {
    lines.push('No overlapping scopes detected.');
  } else {
    lines.push('| Team A | Team B | Overlap Ratio | Overlapping Scopes |');
    lines.push('|--------|--------|---------------|--------------------|');
    for (const opp of opps.slice(0, 15)) {
      lines.push(
        `| ${opp.teamA} | ${opp.teamB} | ${(opp.overlapRatio * 100).toFixed(0)}% | ${opp.overlappingScopes.join(', ')} |`
      );
    }
  }
  lines.push('');

  // Critical path
  const criticalPath = findCriticalPath(graph);
  lines.push('### Critical Path (longest dependency chain)');
  lines.push('');
  if (criticalPath.length <= 1) {
    lines.push('No dependency chains detected.');
  } else {
    lines.push(`**Length:** ${criticalPath.length} agents`);
    lines.push('');
    lines.push(`**Path:** ${criticalPath.join(' → ')}`);
  }
  lines.push('');

  // Notification amplification
  const amplifiers = findNotificationAmplifiers(graph);
  lines.push('### Notification Amplification');
  lines.push('');
  if (amplifiers.length === 0) {
    lines.push('No notification chains detected.');
  } else {
    lines.push('| Agent | Transitive Reach | Targets |');
    lines.push('|-------|------------------|---------|');
    for (const amp of amplifiers.slice(0, 10)) {
      lines.push(`| ${amp.id} | ${amp.reach} | ${amp.targets.join(', ')} |`);
    }
  }
  lines.push('');

  // Cross-team coupling
  const coupling = computeCrossteamCoupling(graph);
  lines.push('### Cross-Team Coupling');
  lines.push('');
  if (coupling.size === 0) {
    lines.push('No cross-team coupling detected.');
  } else {
    lines.push('| Team Pair | Dependencies | Notifications | Total |');
    lines.push('|-----------|-------------|---------------|-------|');
    const sorted = [...coupling.entries()].sort(
      (a, b) => b[1].dependsOn + b[1].notifies - (a[1].dependsOn + a[1].notifies)
    );
    for (const [pair, vals] of sorted) {
      lines.push(
        `| ${pair} | ${vals.dependsOn} | ${vals.notifies} | ${vals.dependsOn + vals.notifies} |`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Render all matrices and analyses into a single markdown document.
 * @param {object} graph - Output from loadFullAgentGraph
 * @returns {string}
 */
export function renderAllMatrices(graph) {
  const header = [
    '# Agent/Team Relationship Matrix',
    '',
    `> Auto-generated by Retort analysis engine.`,
    `> ${graph.agents.length} agents across ${graph.categories.length} categories, ${graph.teams.length} teams.`,
    '',
    '---',
    '',
  ];

  const sections = [
    header.join('\n'),
    renderAgentTeamMembership(graph),
    '',
    '---',
    '',
    renderTeamHandoffIncoming(graph),
    '',
    '---',
    '',
    renderTeamHandoffOutgoing(graph),
    '',
    '---',
    '',
    renderAgentDependencyIncoming(graph),
    '',
    '---',
    '',
    renderAgentDependencyOutgoing(graph),
    '',
    '---',
    '',
    renderAgentNotificationIncoming(graph),
    '',
    '---',
    '',
    renderAgentNotificationOutgoing(graph),
    '',
    '---',
    '',
    renderAgentTeamCrossBoundary(graph),
    '',
    '---',
    '',
    renderSupplementaryAnalyses(graph),
  ];

  return sections.join('\n');
}

/**
 * Render a specific matrix by number (1-8) or "supplementary".
 * @param {object} graph
 * @param {string|number} matrix - "1"-"8", "supplementary", or "all"
 * @returns {string}
 */
export function renderMatrix(graph, matrix) {
  const renderers = {
    1: renderAgentTeamMembership,
    2: renderTeamHandoffIncoming,
    3: renderTeamHandoffOutgoing,
    4: renderAgentDependencyIncoming,
    5: renderAgentDependencyOutgoing,
    6: renderAgentNotificationIncoming,
    7: renderAgentNotificationOutgoing,
    8: renderAgentTeamCrossBoundary,
    supplementary: renderSupplementaryAnalyses,
  };

  if (matrix === 'all') return renderAllMatrices(graph);

  const renderer = renderers[String(matrix)];
  if (!renderer) {
    return `Unknown matrix: ${matrix}. Valid values: 1-8, supplementary, all`;
  }

  return renderer(graph);
}

/**
 * Render all matrices as a JSON object instead of markdown.
 * @param {object} graph
 * @returns {object}
 */
export function renderAllAsJson(graph) {
  return {
    meta: {
      agentCount: graph.agents.length,
      teamCount: graph.teams.length,
      categoryCount: graph.categories.length,
    },
    membership: graph.agents.map((a) => ({
      agent: a.id,
      category: a._category,
      team: graph.relationships.agentToTeam.get(a.id) || null,
    })),
    teamHandoffs: Object.fromEntries(graph.relationships.teamHandoffs),
    agentDependencies: Object.fromEntries(
      [...graph.relationships.dependsOn.entries()].map(([k, v]) => [k, [...v]])
    ),
    agentNotifications: Object.fromEntries(
      [...graph.relationships.notifies.entries()].map(([k, v]) => [k, [...v]])
    ),
    orphans: detectOrphans(graph),
    cycles: detectCircularDeps(graph),
    coverageGaps: findTeamCoverageGaps(graph),
    hubs: rankHubAgents(graph).slice(0, 10),
    bottlenecks: rankBottleneckAgents(graph).slice(0, 10),
    teamFanIn: computeTeamFanIn(graph),
    teamFanOut: computeTeamFanOut(graph),
    consolidationOpps: findConsolidationOpps(graph).slice(0, 15),
    criticalPath: findCriticalPath(graph),
    notificationAmplifiers: findNotificationAmplifiers(graph).slice(0, 10),
    crossTeamCoupling: Object.fromEntries(computeCrossteamCoupling(graph)),
  };
}
