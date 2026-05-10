/**
 * Retort — Variable Builders
 * Template variable construction helpers for teams, agents, rules, commands, and branch protection.
 * Extracted from synchronize.mjs (Step 5 of modularization).
 */
import { isUnsafePathSegment } from './platform-syncer.mjs';
import { formatCommandFlags } from './template-utils.mjs';

// ---------------------------------------------------------------------------
// Heuristic defaults — infer sensible values from project/team context
// ---------------------------------------------------------------------------

/**
 * Infers maxTaskTurns based on team size from project spec.
 * Larger teams tend to have broader tasks requiring more turns.
 */
export function inferMaxTaskTurns(teamSize) {
  switch (teamSize) {
    case 'solo':
      return 15;
    case 'small':
      return 25;
    case 'medium':
    case 'large':
      return 35;
    default:
      return 25;
  }
}

/**
 * Infers maxHandoffChainDepth based on the number of teams.
 * More teams = more legitimate handoff paths.
 */
export function inferMaxHandoffChainDepth(teamCount) {
  if (teamCount <= 3) return 3;
  if (teamCount <= 6) return 5;
  return 7;
}

/**
 * Infers maxStagnationTurns based on project phase.
 * Greenfield work involves more exploration; maintenance should be tighter.
 */
export function inferMaxStagnationTurns(projectPhase) {
  switch (projectPhase) {
    case 'greenfield':
      return 15;
    case 'active':
      return 10;
    case 'maintenance':
    case 'legacy':
      return 5;
    default:
      return 10;
  }
}

/**
 * Infers testingCoverage target based on project phase.
 */
export function inferTestingCoverage(projectPhase) {
  switch (projectPhase) {
    case 'greenfield':
      return '60';
    case 'active':
      return '80';
    case 'maintenance':
    case 'legacy':
      return '90';
    default:
      return '80';
  }
}

/**
 * Derives browser/crawler MCP server flags from the project spec's testing.e2e array.
 *
 * - usesPlaywright: true when 'playwright' appears in testing.e2e
 * - usesBrowser:   true when any browser-based e2e tool (cypress, puppeteer, webdriverio)
 *                  appears in testing.e2e AND playwright is NOT already selected
 *                  (playwright takes precedence and has its own MCP server)
 *
 * These flags control which MCP server entries are rendered in templates/mcp/servers.json.
 */
export function buildBrowserTestingVars(projectSpec) {
  const e2eTools = projectSpec?.testing?.e2e;
  const tools = Array.isArray(e2eTools)
    ? e2eTools.map((t) => (typeof t === 'string' ? t.toLowerCase() : ''))
    : [];

  const usesPlaywright = tools.includes('playwright');
  const browserTools = ['cypress', 'puppeteer', 'webdriverio'];
  const usesBrowser = !usesPlaywright && tools.some((t) => browserTools.includes(t));

  return { usesPlaywright, usesBrowser };
}

// ---------------------------------------------------------------------------
// Command path helpers
// ---------------------------------------------------------------------------

export function getTeamCommandStem(teamId) {
  return teamId.startsWith('team-') ? teamId : `team-${teamId}`;
}

/**
 * Resolves the output path components for a command, applying the optional
 * command prefix. Two strategies:
 *  - 'subdirectory': puts commands in a prefix-named subfolder (Claude Code)
 *  - 'filename':     prepends prefix with hyphen to the filename (all others)
 *
 * @param {string} cmdName - Original command name (e.g. 'check')
 * @param {string|null} prefix - Command prefix (e.g. 'kits') or null/undefined
 * @param {'subdirectory'|'filename'} [strategy='filename'] - Platform strategy
 * @returns {{ dir: string, stem: string }}
 */
export function resolveCommandPath(cmdName, prefix, strategy = 'filename') {
  if (!prefix) return { dir: '', stem: cmdName };
  if (strategy === 'subdirectory') return { dir: prefix, stem: cmdName };
  return { dir: '', stem: `${prefix}-${cmdName}` };
}

// ---------------------------------------------------------------------------
// Feature helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if a feature is enabled (or if feature vars are not loaded).
 * Uses the canonical `feature_<id>` var. Missing vars default to enabled
 * (graceful degradation for repos without features.yaml).
 */
export function isFeatureEnabled(featureId, vars) {
  const featureVar = `feature_${featureId.replace(/-/g, '_')}`;
  return vars[featureVar] !== false;
}

/**
 * Returns true if the item's requiredFeature is enabled (or if it has no requiredFeature).
 * Items without a requiredFeature are always enabled.
 */
export function isItemFeatureEnabled(item, vars) {
  if (!item.requiredFeature) return true;
  return isFeatureEnabled(item.requiredFeature, vars);
}

// ---------------------------------------------------------------------------
// Teams builders
// ---------------------------------------------------------------------------

/**
 * Maps raw team objects from teams.yaml into display-ready objects for templates.
 */
export function buildTeamsList(rawTeams) {
  return (rawTeams || []).map((t) => ({
    id: t.id || '',
    name: t.name || '',
    focus: t.focus || '',
    scopeDisplay: Array.isArray(t.scope) ? t.scope.map((s) => `\`${s}\``).join(', ') : '',
    acceptsDisplay: Array.isArray(t.accepts) ? t.accepts.join(', ') : '',
    handoffDisplay:
      Array.isArray(t['handoff-chain']) && t['handoff-chain'].length > 0
        ? t['handoff-chain'].join(' → ')
        : '—',
  }));
}

/**
 * Resolves which agent personas should be loaded for a given team.
 * Priority: 1) explicit `agents` list in teams.yaml, 2) category match.
 * Returns an array of { id, name, role, category } objects.
 */
export function resolveTeamAgents(teamId, team, agentsSpec) {
  const allAgents = agentsSpec?.agents || {};
  const result = [];

  // If the team has an explicit agents list, use it
  if (Array.isArray(team.agents) && team.agents.length > 0) {
    for (const agentId of team.agents) {
      // Search across all categories for this agent ID
      for (const [category, agents] of Object.entries(allAgents)) {
        if (!Array.isArray(agents)) continue;
        const found = agents.find((a) => a.id === agentId);
        if (found) {
          result.push({ id: found.id, name: found.name, role: found.role, category });
          break;
        }
      }
    }
    return result;
  }

  // Fallback: match agents whose category === teamId
  if (Array.isArray(allAgents[teamId])) {
    for (const agent of allAgents[teamId]) {
      result.push({ id: agent.id, name: agent.name, role: agent.role, category: teamId });
    }
  }

  return result;
}

export function buildTeamVars(team, vars, teamsSpec, agentsSpec) {
  // Resolve agent personas for this team
  const teamAgents = resolveTeamAgents(team.id, team, agentsSpec);
  const teamHasAgents = teamAgents.length > 0;
  const teamAgentSummaries = teamHasAgents
    ? teamAgents
        .map(
          (a) =>
            `### ${a.name}\n\n**Role:** ${typeof a.role === 'string' ? a.role.trim() : a.role || 'N/A'}\n`
        )
        .join('\n')
    : '';

  return {
    ...vars,
    teamName: team.name || team.id,
    teamId: team.id,
    teamFocus: team.focus || '',
    teamScope: Array.isArray(team.scope) ? team.scope.join(', ') : team.scope || '',
    teamAccepts: Array.isArray(team.accepts) ? team.accepts.join(', ') : team.accepts || '',
    teamHandoffChain: Array.isArray(team['handoff-chain'])
      ? team['handoff-chain'].join(' → ')
      : team['handoff-chain'] || '',
    maxTaskTurns: team['max-task-turns'] ?? inferMaxTaskTurns(vars.teamSize),
    maxHandoffChainDepth:
      team['max-handoff-chain-depth'] ?? inferMaxHandoffChainDepth(teamsSpec?.teams?.length || 5),
    maxStagnationTurns: team['max-stagnation-turns'] ?? inferMaxStagnationTurns(vars.projectPhase),
    teamHasAgents,
    teamAgentSummaries,
  };
}

// ---------------------------------------------------------------------------
// Area routing table
// ---------------------------------------------------------------------------

/**
 * Build a compact area→team routing string from teams.yaml intake config.
 * Used as a template variable so all platform templates share the same routing.
 */
export function buildAreaRoutingTable(teamsIntake) {
  const defaultRouting = {
    backend: 'backend',
    frontend: 'frontend',
    data: 'data',
    infra: 'infra',
    devops: 'devops',
    testing: 'testing',
    security: 'security',
    docs: 'docs',
    product: 'product',
    quality: 'quality',
    cli: 'backend',
    'sync-engine': 'devops',
  };
  const routing = teamsIntake?.routing || {};
  const merged = { ...defaultRouting };
  for (const [area, team] of Object.entries(routing)) {
    merged[area] = team; // Use bare team IDs consistently
  }
  return Object.entries(merged)
    .map(([area, team]) => `\`${area}\`→${team}`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// Command variable builder
// ---------------------------------------------------------------------------

export function buildCommandVars(cmd, vars, stateDir = '.claude/state') {
  let prompt = typeof cmd.prompt === 'string' ? cmd.prompt.trim() : '';
  if (prompt) {
    prompt = prompt.replaceAll('{{stateDir}}', stateDir);
  }
  const prefix = vars.commandPrefix || null;
  const prefixedName = prefix ? `${prefix}-${cmd.name}` : cmd.name;
  // disableModelInvocation is a Claude-specific frontmatter hint for skills
  // that should only fire when explicitly invoked (e.g. zoom-out, caveman).
  // Templates that emit non-Claude output should ignore the variable.
  const disableModelInvocation = cmd.disableModelInvocation === true;
  // Category drives the optional categorised skills layout. Defaults to 'meta'
  // so legacy commands without an explicit category still group sensibly.
  // commands.yaml IS schema-validated (allowed values are an enum), but the
  // schema only runs in spec-validate, NOT in runSync. Apply a runtime
  // path-segment guard so a hand-edited spec or partial validate cannot make
  // commandCategory escape the .agents/skills/ tree at sync time.
  const rawCommandCategory =
    typeof cmd.category === 'string' && cmd.category.length > 0 ? cmd.category : 'meta';
  const commandCategory = isUnsafePathSegment(rawCommandCategory) ? 'meta' : rawCommandCategory;
  return {
    ...vars,
    commandName: cmd.name,
    commandPrefixedName: prefixedName,
    isSyncBacklog: cmd.name === 'sync-backlog',
    commandDescription:
      typeof cmd.description === 'string' ? cmd.description.trim() : cmd.description || '',
    commandFlags: formatCommandFlags(cmd.flags),
    commandPrompt: prompt,
    disableModelInvocation,
    commandCategory,
  };
}

// ---------------------------------------------------------------------------
// Agent registry and collaborators
// ---------------------------------------------------------------------------

/**
 * Builds a flat registry Map of agentId → compact summary for all agents in the spec.
 * Used by buildCollaboratorsSection to render peer context without loading full specs.
 */
export function buildAgentRegistry(agentsSpec) {
  const registry = new Map();
  for (const [category, agents] of Object.entries(agentsSpec.agents || {})) {
    for (const agent of agents) {
      const role = typeof agent.role === 'string' ? agent.role.trim() : '';
      // First sentence — split on '. ' or end of string, cap at 120 chars
      const firstSentence = role.split(/\.\s+/)[0].replace(/\s+/g, ' ').trim();
      const roleSummary =
        firstSentence.length > 120 ? firstSentence.slice(0, 117) + '...' : firstSentence;
      registry.set(agent.id, {
        id: agent.id,
        name: agent.name || agent.id,
        category,
        roleSummary,
        accepts: Array.isArray(agent.accepts) ? agent.accepts : [],
      });
    }
  }
  return registry;
}

/**
 * Builds a compact markdown list of agents this agent collaborates with,
 * drawn from depends-on, notifies, and negotiation.can-negotiate-with.
 * Only includes agents present in the registry (unknown IDs are skipped with a warning).
 */
export function buildCollaboratorsSection(agent, registry, { warn = () => {} } = {}) {
  const raw = [
    ...(agent['depends-on'] || []),
    ...(agent.notifies || []),
    ...((agent.negotiation || {})['can-negotiate-with'] || []),
  ];
  const seen = new Set();
  const peers = [];
  for (const id of raw) {
    if (seen.has(id) || id === agent.id) continue;
    seen.add(id);
    const entry = registry.get(id);
    if (!entry) {
      warn(`[collaborators] agent '${agent.id}' references unknown peer '${id}' — skipping`);
      continue;
    }
    peers.push(entry);
  }
  if (peers.length === 0) return '';
  return peers
    .map(
      (p) =>
        `- **[${p.id}]** ${p.name} *(${p.category})* — ${p.roleSummary}` +
        (p.accepts.length > 0 ? ` · accepts: ${p.accepts.join(', ')}` : '')
    )
    .join('\n');
}

// ---------------------------------------------------------------------------
// Agent subsection builders (internal, but exported for platform-syncer)
// ---------------------------------------------------------------------------

function buildAgentDecisionModelSection(dm) {
  if (!dm) return '';
  const lines = [];
  if (dm.type) lines.push(`- **Type:** ${dm.type}`);
  if (dm['hybrid-of'] && dm['hybrid-of'].length > 0)
    lines.push(`- **Hybrid of:** ${dm['hybrid-of'].join(', ')}`);
  if (dm.description) lines.push(`- **Rationale:** ${dm.description.trim()}`);
  return lines.join('\n');
}

function buildAgentRetryPolicySection(rp) {
  if (!rp) return '';
  const lines = [];
  if (rp['max-retries'] !== undefined) lines.push(`- **Max retries:** ${rp['max-retries']}`);
  const fc = rp['failure-classification'];
  if (fc) {
    const parts = [];
    if (fc.transient) parts.push(`transient→${fc.transient}`);
    if (fc.logic) parts.push(`logic→${fc.logic}`);
    if (fc.permanent) parts.push(`permanent→${fc.permanent}`);
    if (parts.length > 0) lines.push(`- **Failure handling:** ${parts.join(', ')}`);
  }
  if (rp.backoff && rp.backoff !== 'none') lines.push(`- **Backoff:** ${rp.backoff}`);
  if (rp['escalate-to']) lines.push(`- **Escalate to:** ${rp['escalate-to']}`);
  return lines.join('\n');
}

function buildAgentBeliefSystemSection(bs) {
  if (!bs) return '';
  const lines = [];
  const reads = bs['state-reads'];
  if (reads && reads.length > 0) lines.push(`- **State reads:** ${reads.join(', ')}`);
  if (bs['task-reads'] !== undefined) lines.push(`- **Task reads:** ${bs['task-reads']}`);
  const updateOn = bs['update-on'];
  if (updateOn && updateOn.length > 0) lines.push(`- **Update on:** ${updateOn.join(', ')}`);
  if (bs['revision-strategy']) lines.push(`- **Revision strategy:** ${bs['revision-strategy']}`);
  return lines.join('\n');
}

function buildAgentConfidenceSection(conf) {
  if (!conf) return '';
  const lines = [];
  if (conf['output-threshold'] !== undefined)
    lines.push(`- **Output threshold:** ${conf['output-threshold']}`);
  if (conf['requires-validation'] !== undefined)
    lines.push(`- **Requires validation:** ${conf['requires-validation']}`);
  if (conf['validation-agent']) lines.push(`- **Validation agent:** ${conf['validation-agent']}`);
  if (conf['low-confidence-action'])
    lines.push(`- **Low confidence action:** ${conf['low-confidence-action']}`);
  return lines.join('\n');
}

function buildAgentNegotiationSection(neg) {
  if (!neg) return '';
  const lines = [];
  if (neg['conflict-scope']) lines.push(`- **Conflict scope:** ${neg['conflict-scope']}`);
  if (neg['resolution-strategy'])
    lines.push(`- **Resolution strategy:** ${neg['resolution-strategy']}`);
  const peers = neg['can-negotiate-with'];
  if (peers && peers.length > 0) lines.push(`- **Can negotiate with:** ${peers.join(', ')}`);
  return lines.join('\n');
}

function buildAgentLookaheadSection(la) {
  if (!la || !la.enabled) return '';
  const lines = [`- **Enabled:** ${la.enabled}`];
  if (la.depth !== undefined && la.depth > 0) lines.push(`- **Depth:** ${la.depth}`);
  if (la['simulation-budget'] !== undefined && la['simulation-budget'] > 0)
    lines.push(`- **Simulation budget:** ${la['simulation-budget']} tool calls`);
  return lines.join('\n');
}

export function buildAgentVars(agent, category, vars, registry = new Map()) {
  const focus = agent.focus || [];
  const responsibilities = agent.responsibilities || [];
  const tools = agent['preferred-tools'] || agent.tools || [];
  const conventions = agent.conventions || [];
  const examples = agent.examples || [];
  const antiPatterns = agent['anti-patterns'] || [];
  const domainRules = agent['domain-rules'] || [];

  return {
    ...vars,
    agentName: agent.name,
    agentId: agent.id,
    agentCategory: category,
    agentRole: typeof agent.role === 'string' ? agent.role.trim() : agent.role || '',
    agentFocusList: focus.map((f) => `- ${f}`).join('\n'),
    agentResponsibilitiesList: responsibilities.map((r) => `- ${r}`).join('\n'),
    agentToolsList: tools.map((t) => `- ${t}`).join('\n'),
    agentConventions: conventions.length > 0 ? conventions.map((c) => `- ${c}`).join('\n') : '',
    agentExamples:
      examples.length > 0
        ? examples
            .map((e) => `### ${e.title || 'Example'}\n\`\`\`\n${(e.code || '').trim()}\n\`\`\``)
            .join('\n\n')
        : '',
    agentAntiPatterns: antiPatterns.length > 0 ? antiPatterns.map((a) => `- ${a}`).join('\n') : '',
    agentDomainRules: domainRules.length > 0 ? domainRules.map((r) => `- ${r}`).join('\n') : '',
    agentDecisionModel: buildAgentDecisionModelSection(agent['decision-model']),
    agentRetryPolicy: buildAgentRetryPolicySection(agent['retry-policy']),
    agentBeliefSystem: buildAgentBeliefSystemSection(agent['belief-system']),
    agentConfidence: buildAgentConfidenceSection(agent.confidence),
    agentNegotiation: buildAgentNegotiationSection(agent.negotiation),
    agentLookahead: buildAgentLookaheadSection(agent.lookahead),
    agentCollaborators: buildCollaboratorsSection(agent, registry),
  };
}

// ---------------------------------------------------------------------------
// Branch protection JSON builder
// ---------------------------------------------------------------------------

/**
 * Builds precomputed JSON strings for branch protection template variables.
 * Filters invalid entries and returns valid JSON array literals for use in
 * heredoc payloads sent to the GitHub API.
 */
export function buildBranchProtectionJson(vars) {
  const statusChecks = vars.bpRequiredStatusChecks ?? [];
  const statusChecksJson = JSON.stringify(
    Array.isArray(statusChecks) ? statusChecks.filter((s) => typeof s === 'string') : []
  );
  const scanningToolsRaw = vars.bpCodeScanningTools ?? [];
  const scanningTools = Array.isArray(scanningToolsRaw)
    ? scanningToolsRaw.filter(
        (t) => t && typeof t === 'object' && typeof t.name === 'string' && t.name.trim() !== ''
      )
    : [];
  const scanningToolsJson = JSON.stringify(
    scanningTools.map((t) => ({
      tool: t.name.trim(),
      security_alerts_threshold:
        typeof t.securityAlertThreshold === 'string' ? t.securityAlertThreshold : 'none',
      alerts_threshold: typeof t.alertThreshold === 'string' ? t.alertThreshold : 'none',
    }))
  );
  return { statusChecksJson, scanningToolsJson };
}

// ---------------------------------------------------------------------------
// Rule variable builder
// ---------------------------------------------------------------------------

export function formatConventionLine(c) {
  if (typeof c === 'string') return `- ${c}`;
  const id = c.id || '';
  const rule = c.rule || '';
  const badges = [];
  if (c.type) badges.push(c.type);
  if (c.phase) {
    const phases = Array.isArray(c.phase) ? c.phase : [c.phase];
    badges.push(`phase: ${phases.join(', ')}`);
  }
  const suffix = badges.length > 0 ? ` _(${badges.join(' · ')})_` : '';
  return `- **[${id}]** ${rule}${suffix}`;
}

export function buildRuleVars(rule, vars) {
  const appliesTo = rule['applies-to'] || [];
  const conventions = rule.conventions || [];
  const enforcement = conventions.filter((c) => c.type === 'enforcement');
  // Conventions without an explicit type default to advisory (see ADR-08)
  const advisory = conventions.filter((c) => c.type !== 'enforcement');
  return {
    ...vars,
    ruleDomain: rule.domain,
    ruleDescription:
      typeof rule.description === 'string' ? rule.description.trim() : rule.description || '',
    ruleAppliesTo: appliesTo.join('\n'),
    ruleConventions: conventions.map(formatConventionLine).join('\n'),
    ruleEnforcementConventions: enforcement.map(formatConventionLine).join('\n'),
    ruleAdvisoryConventions: advisory.map(formatConventionLine).join('\n'),
    ruleHasEnforcement: enforcement.length > 0 ? 'true' : '',
    ruleHasAdvisory: advisory.length > 0 ? 'true' : '',
  };
}
