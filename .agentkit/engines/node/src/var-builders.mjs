/**
 * Retort — Variable Builders
 * Template variable construction helpers for teams, agents, rules, commands, and branch protection.
 * Extracted from synchronize.mjs (Step 5 of modularization).
 */
import { isUnsafePathSegment } from './fs-utils.mjs';
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
 *
 * Priority: 1) explicit `agents` list in teams.yaml, 2) category match,
 * 3) a single agent whose id equals the team id.
 *
 * Step 3 exists because agent categories and team ids are different
 * vocabularies. The `testing` team matches the `testing` category, but the
 * `backend` team's agent lives under the `engineering` category with the id
 * `backend` — so category matching alone left 8 of 13 teams with no personas at
 * all, and no way to name a `subagent_type` for native dispatch.
 *
 * Returns an array of { id, name, role, category } objects.
 */
export function resolveTeamAgents(teamId, team, agentsSpec) {
  const allAgents = agentsSpec?.agents || {};
  const result = [];

  // If the team has an explicit agents list, use it
  if (Array.isArray(team?.agents) && team.agents.length > 0) {
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
    return result;
  }

  // Last resort: the agent named after the team, wherever it is categorised
  for (const [category, agents] of Object.entries(allAgents)) {
    if (!Array.isArray(agents)) continue;
    const found = agents.find((a) => a.id === teamId);
    if (found) {
      result.push({ id: found.id, name: found.name, role: found.role, category });
      break;
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

// ---------------------------------------------------------------------------
// Agent dispatch derivation (ADR-11 — native agent dispatch)
// ---------------------------------------------------------------------------

/**
 * Task types implying the agent produces file changes of any kind.
 * An agent accepting none of these is structurally read-only.
 */
export const WRITE_TASK_TYPES = Object.freeze([
  'implement',
  'fix',
  'refactor',
  'migration',
  'test',
  'document',
]);

/**
 * Task types implying the agent writes source code, which is what makes worktree
 * isolation worthwhile (see .claude/rules/worktree-isolation.md). Strict subset of
 * WRITE_TASK_TYPES — `document` writes prose, which does not need a branch.
 */
export const CODE_WRITING_TASK_TYPES = Object.freeze([
  'implement',
  'fix',
  'refactor',
  'migration',
  'test',
]);

/**
 * Categories whose agents coordinate other agents. Leaf executors default to
 * non-dispatching so a specialist cannot fan out and multiply the token budget.
 */
export const DISPATCH_CAPABLE_CATEGORIES = Object.freeze([
  'team-creation',
  'strategic-operations',
  'project-management',
]);

/** Tools withheld from an agent whose `accepts` contains no write-capable type. */
export const READ_ONLY_DENIED_TOOLS = Object.freeze(['Write', 'Edit', 'NotebookEdit']);

/** Accepted values for `dispatch.tools-mode`. */
export const AGENT_TOOLS_MODES = Object.freeze(['inherit', 'allowlist']);

/** Accepted values for `dispatch.isolation`. */
export const AGENT_ISOLATION_MODES = Object.freeze(['auto', 'worktree', 'none']);

/**
 * Bounds for `max-subagent-spawn-depth` (teams.yaml) → the
 * `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` env var in settings.json.
 *
 * Default 2 covers orchestrator → team agent → specialist, which is every
 * fan-out pattern retort models. This is deliberately NOT derived from
 * `max-handoff-chain-depth` (ADR-11 §4): a handoff chain is sequential and
 * additive, a spawn tree nests and multiplies. Deriving it would emit 7 for a
 * 13-team repo, which blows the `aicost-token-budget` rule on the first run.
 */
export const DEFAULT_SUBAGENT_SPAWN_DEPTH = 2;
export const MIN_SUBAGENT_SPAWN_DEPTH = 1;
export const MAX_SUBAGENT_SPAWN_DEPTH = 3;

/** Claude Code subagent accent colour per agent category. */
export const AGENT_CATEGORY_COLORS = Object.freeze({
  engineering: 'blue',
  testing: 'green',
  operations: 'orange',
  product: 'purple',
  design: 'pink',
  marketing: 'yellow',
  'cost-operations': 'cyan',
  'feature-management': 'cyan',
  'project-management': 'yellow',
  'strategic-operations': 'red',
  'team-creation': 'purple',
});

/**
 * Claude Code refuses to register a subagent whose `name` breaks this pattern
 * (notably any name containing `:`), and logs the rejection only to the debug log.
 */
export const AGENT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Claude Code truncates longer descriptions; do it here so output stays predictable. */
export const MAX_AGENT_DESCRIPTION_LENGTH = 500;

function normalizeWhitespace(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function truncateDescription(text) {
  if (text.length <= MAX_AGENT_DESCRIPTION_LENGTH) return text;
  return text.slice(0, MAX_AGENT_DESCRIPTION_LENGTH - 3).trimEnd() + '...';
}

/** First sentence of a role statement, normalised to one line and terminated. */
function firstRoleSentence(role) {
  const normalized = normalizeWhitespace(role);
  if (!normalized) return '';
  const head = normalized.split(/\.\s+/)[0].trim();
  if (!head) return '';
  return head.endsWith('.') ? head : `${head}.`;
}

/**
 * Resolves the `description:` frontmatter value — the field Claude matches against
 * when selecting a subagent, so it must read as a trigger, not a capability statement.
 *
 * 1. `dispatch.when-to-use` verbatim when authored.
 * 2. Otherwise derived from `accepts`, the first three `focus` globs, and the first
 *    sentence of `role`.
 *
 * Always returns a non-empty single-line string — an agent without a description is
 * silently unregistered.
 */
export function deriveAgentDescription(agent) {
  const spec = agent || {};
  const dispatch = spec.dispatch || {};

  const whenToUse = normalizeWhitespace(dispatch['when-to-use']);
  if (whenToUse) return truncateDescription(whenToUse);

  const accepts = (Array.isArray(spec.accepts) ? spec.accepts : []).filter(Boolean);
  const focus = (Array.isArray(spec.focus) ? spec.focus : []).filter(Boolean);
  const sentence = firstRoleSentence(spec.role);

  let lead = '';
  if (accepts.length > 0 && focus.length > 0) {
    lead = `Use for ${accepts.join(', ')} work in ${focus.slice(0, 3).join(', ')}.`;
  } else if (accepts.length > 0) {
    lead = `Use for ${accepts.join(', ')} work.`;
  } else if (focus.length > 0) {
    lead = `Use for work in ${focus.slice(0, 3).join(', ')}.`;
  }

  const derived = [lead, sentence].filter(Boolean).join(' ');
  if (derived) return truncateDescription(derived);

  return truncateDescription(`Retort ${spec.name || spec.id || 'agent'} persona.`);
}

/**
 * Derives `isolation:` from `accepts`. Code-writing agents get their own git
 * worktree, turning .claude/rules/worktree-isolation.md from an instruction the
 * caller must remember into a property of the agent definition.
 *
 * `dispatch.isolation` overrides: `worktree` forces it on, `none` forces it off,
 * `auto` (or absent) derives. An unrecognised value falls through to derivation —
 * the spec validator is where a typo is reported, not here.
 *
 * Returns '' (not 'none') when isolation should be omitted, so the template
 * conditional drops the key rather than emitting an empty value.
 */
export function deriveAgentIsolation(accepts, dispatch) {
  const override = dispatch ? dispatch.isolation : undefined;
  if (override === 'worktree') return 'worktree';
  if (override === 'none') return '';

  const list = Array.isArray(accepts) ? accepts : [];
  return list.some((type) => CODE_WRITING_TASK_TYPES.includes(type)) ? 'worktree' : '';
}

/**
 * Derives `disallowedTools:` from `accepts`. Restriction is subtractive — agents
 * inherit the full subagent toolset and lose capability explicitly, rather than
 * being allowlisted into a tool set that would silently drop Agent/Skill/MCP tools.
 *
 * `canDispatch` defaults to true so a caller that has not resolved dispatch
 * capability never accidentally withholds the `Agent` tool.
 */
export function deriveDisallowedTools(accepts, canDispatch = true) {
  const list = Array.isArray(accepts) ? accepts : [];
  const denied = [];
  if (!list.some((type) => WRITE_TASK_TYPES.includes(type))) {
    denied.push(...READ_ONLY_DENIED_TOOLS);
  }
  if (canDispatch === false) denied.push('Agent');
  return denied.join(', ');
}

/**
 * Resolves whether an agent may spawn other agents. Defaults by category; a
 * per-agent `dispatch.can-dispatch` boolean overrides in either direction.
 */
export function deriveCanDispatch(category, dispatch) {
  const explicit = dispatch ? dispatch['can-dispatch'] : undefined;
  if (typeof explicit === 'boolean') return explicit;
  return DISPATCH_CAPABLE_CATEGORIES.includes(category);
}

/**
 * Derives `tools:` for agents that opt into `dispatch.tools-mode: allowlist`.
 *
 * Returns '' for the default `inherit` mode, where the key is omitted entirely
 * and capability is removed subtractively via `disallowedTools` instead.
 *
 * In allowlist mode `tools:` is authoritative, so the read-only guardrail is
 * applied by *subtraction from the list* rather than by also emitting
 * `disallowedTools` — one key, one description of what the agent may do.
 * `Agent` is appended only when the agent may dispatch.
 *
 * An allowlist that resolves to nothing returns '' and warns: an empty `tools:`
 * launches a subagent with no tools at all, which fails at the first tool call
 * rather than at sync time. Falling back to `inherit` keeps the agent usable and
 * leaves the hard error to the spec validator.
 */
export function deriveAgentTools(agent, canDispatch) {
  const spec = agent || {};
  const dispatch = spec.dispatch || {};
  if (dispatch['tools-mode'] !== 'allowlist') return '';

  const accepts = Array.isArray(spec.accepts) ? spec.accepts : [];
  const readOnly = !accepts.some((type) => WRITE_TASK_TYPES.includes(type));

  const allowed = (spec['preferred-tools'] || spec.tools || [])
    .filter((tool) => typeof tool === 'string' && tool.trim() !== '')
    .map((tool) => tool.trim())
    .filter((tool) => !(readOnly && READ_ONLY_DENIED_TOOLS.includes(tool)));

  if (canDispatch && !allowed.includes('Agent')) allowed.push('Agent');

  if (allowed.length === 0) {
    console.warn(
      `[agentkit:sync] Warning: agent '${spec.id || spec.name || 'unknown'}' sets ` +
        "dispatch.tools-mode: allowlist but resolves to no tools — falling back to 'inherit'. " +
        'Populate preferred-tools or drop tools-mode.'
    );
    return '';
  }

  return allowed.join(', ');
}

/**
 * Resolves `max-subagent-spawn-depth` from teams.yaml into the value emitted as
 * `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`.
 *
 * An out-of-range value falls back to the default with a warning rather than
 * being clamped. Clamping 7 to 3 would emit a plausible-looking number nobody
 * asked for; the spec validator reports the real error.
 */
export function resolveMaxSubagentSpawnDepth(teamsSpec) {
  const raw = teamsSpec ? teamsSpec['max-subagent-spawn-depth'] : undefined;
  if (raw === undefined || raw === null) return DEFAULT_SUBAGENT_SPAWN_DEPTH;

  if (!Number.isInteger(raw) || raw < MIN_SUBAGENT_SPAWN_DEPTH || raw > MAX_SUBAGENT_SPAWN_DEPTH) {
    console.warn(
      `[agentkit:sync] Warning: teams.yaml max-subagent-spawn-depth must be an integer ` +
        `between ${MIN_SUBAGENT_SPAWN_DEPTH} and ${MAX_SUBAGENT_SPAWN_DEPTH}, got ${JSON.stringify(raw)} — ` +
        `using ${DEFAULT_SUBAGENT_SPAWN_DEPTH}`
    );
    return DEFAULT_SUBAGENT_SPAWN_DEPTH;
  }

  return raw;
}

/** Accepted values for the delegation backend (ADR-11 §6). */
export const DISPATCH_MODES = Object.freeze(['native', 'task-file']);
export const DEFAULT_DISPATCH_MODE = 'native';

/**
 * Resolves which delegation backend the generated commands describe.
 *
 * `native` writes the task file and then dispatches a subagent with the taskId;
 * `task-file` writes the task file only and is the behaviour of every tool
 * without registrable subagents. The overlay wins over the shared spec so a repo
 * can opt out without forking settings.yaml.
 */
export function resolveDispatchMode(overlaySettings, settingsSpec) {
  const raw = overlaySettings?.dispatchMode ?? settingsSpec?.dispatch?.mode;
  if (raw === undefined || raw === null || raw === '') return DEFAULT_DISPATCH_MODE;

  if (!DISPATCH_MODES.includes(raw)) {
    console.warn(
      `[agentkit:sync] Warning: dispatch mode must be one of [${DISPATCH_MODES.join(', ')}], ` +
        `got ${JSON.stringify(raw)} — using '${DEFAULT_DISPATCH_MODE}'`
    );
    return DEFAULT_DISPATCH_MODE;
  }

  return raw;
}

/**
 * Builds the team → `subagent_type` routing table the orchestrator needs in
 * order to dispatch natively.
 *
 * Without this the orchestrator has to guess an agent id from a team id, which
 * only coincidentally works (`backend` team → `backend` agent) and silently
 * fails everywhere else (`testing` team → `test-lead`, not `testing`).
 *
 * The lead is the team's first resolved agent — teams.yaml lists them in
 * priority order. `isolation` is deliberately not included: it is a property of
 * the agent definition now, not something the caller passes.
 */
export function buildTeamDispatchTable(teamsSpec, agentsSpec) {
  const teams = teamsSpec?.teams || [];
  const rows = [];

  for (const team of teams) {
    const agents = resolveTeamAgents(team.id, team, agentsSpec);
    if (agents.length === 0) continue;
    rows.push(
      `| \`${team.id}\` | \`${agents[0].id}\` | ${agents.map((a) => `\`${a.id}\``).join(', ')} |`
    );
  }

  return rows.join('\n');
}

export function buildAgentVars(agent, category, vars, registry = new Map()) {
  const focus = agent.focus || [];
  const responsibilities = agent.responsibilities || [];
  const tools = agent['preferred-tools'] || agent.tools || [];
  const conventions = agent.conventions || [];
  const examples = agent.examples || [];
  const antiPatterns = agent['anti-patterns'] || [];
  const domainRules = agent['domain-rules'] || [];
  const accepts = Array.isArray(agent.accepts) ? agent.accepts : [];
  const dispatch = agent.dispatch || {};

  if (agent.id && !AGENT_NAME_PATTERN.test(agent.id)) {
    console.warn(
      `[agentkit:sync] Warning: agent id '${agent.id}' does not match ${AGENT_NAME_PATTERN} — ` +
        'Claude Code will skip this file instead of registering a subagent'
    );
  }

  const canDispatch = deriveCanDispatch(category, dispatch);
  // `preferred-tools` is prose by default — promoting it to an allowlist would strip
  // Agent/Skill/WebSearch/MCP tools from every agent. Only `tools-mode: allowlist`
  // opts in, and when it does `tools:` becomes the single authority, so the
  // subtractive `disallowedTools` is dropped to avoid describing the same
  // restriction twice in two languages.
  const agentTools = deriveAgentTools(agent, canDispatch);

  return {
    ...vars,
    agentName: agent.name,
    agentId: agent.id,
    // --- Dispatch frontmatter (ADR-11) ---
    agentDispatchName: agent.id || '',
    agentDescription: deriveAgentDescription(agent),
    agentModel: normalizeWhitespace(dispatch.model) || 'inherit',
    agentTools,
    agentDisallowedTools: agentTools ? '' : deriveDisallowedTools(accepts, canDispatch),
    agentIsolation: deriveAgentIsolation(accepts, dispatch),
    // Background subagents keep a fixed subset of built-in tools regardless of
    // frontmatter, so this is opt-in per agent rather than derived.
    agentBackground: dispatch.background === true ? 'true' : '',
    agentColor: normalizeWhitespace(dispatch.color) || AGENT_CATEGORY_COLORS[category] || '',
    agentCanDispatch: canDispatch,
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
  // Conventions without an explicit type default to advisory (see ADR-14)
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
