/**
 * Retort — .retortconfig Loader and Validator
 *
 * Loads per-repo agent remapping and opt-in feature flags from a `.retortconfig`
 * file at the project root. This file is optional — its absence is backwards-
 * compatible and treated the same as an empty config.
 *
 * Schema (YAML):
 *   retort_version: "3.x"          # optional; reserved for future migration checks
 *   project:                        # optional metadata block
 *     name: string
 *     type: string
 *     compliance: string[]
 *     stacks: string[]
 *   agents:                         # optional agent remapping
 *     <agent-id>: <target-name>     # remap — agent file includes a routing note
 *     <agent-id>: ~                 # disable — agent file is not generated
 *   features:                       # optional feature flag overrides
 *     <feature-id>:
 *       enabled: true | false       # overrides overlay enabledFeatures/disabledFeatures
 */
import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Known top-level keys — anything else is rejected
// ---------------------------------------------------------------------------

const KNOWN_TOP_LEVEL_KEYS = new Set(['retort_version', 'project', 'agents', 'features']);
const KNOWN_PROJECT_KEYS = new Set(['name', 'type', 'compliance', 'stacks']);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads and validates `.retortconfig` from the repo root (projectRoot).
 * Returns null when no file exists (backwards compatible).
 *
 * @param {string} projectRoot - Absolute path to the consuming repo's root
 * @returns {object|null} Parsed and validated config, or null if absent
 * @throws {Error} On invalid YAML syntax or unknown schema keys
 */
export function loadRetortConfig(projectRoot) {
  const configPath = join(projectRoot, '.retortconfig');
  if (!existsSync(configPath)) {
    return null;
  }

  let raw;
  try {
    const text = readFileSync(configPath, 'utf-8');
    raw = yaml.load(text);
  } catch (err) {
    throw new Error(
      `[retort] Failed to parse .retortconfig: ${err.message}\n` + `  File: ${configPath}`
    );
  }

  // An empty file is fine — treat as no config
  if (raw == null) {
    return {};
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `[retort] .retortconfig must be a YAML mapping, got ${Array.isArray(raw) ? 'array' : typeof raw}`
    );
  }

  // Reject unknown top-level keys
  const unknownKeys = Object.keys(raw).filter((k) => !KNOWN_TOP_LEVEL_KEYS.has(k));
  if (unknownKeys.length > 0) {
    throw new Error(
      `[retort] .retortconfig contains unknown keys: ${unknownKeys.join(', ')}\n` +
        `  Allowed keys: ${[...KNOWN_TOP_LEVEL_KEYS].join(', ')}`
    );
  }

  // Validate project block (optional)
  if (raw.project != null) {
    if (typeof raw.project !== 'object' || Array.isArray(raw.project)) {
      throw new Error(`[retort] .retortconfig 'project' must be a mapping`);
    }
    const unknownProjectKeys = Object.keys(raw.project).filter((k) => !KNOWN_PROJECT_KEYS.has(k));
    if (unknownProjectKeys.length > 0) {
      throw new Error(
        `[retort] .retortconfig 'project' contains unknown keys: ${unknownProjectKeys.join(', ')}\n` +
          `  Allowed keys: ${[...KNOWN_PROJECT_KEYS].join(', ')}`
      );
    }
  }

  // Validate agents block (optional)
  if (raw.agents != null) {
    if (typeof raw.agents !== 'object' || Array.isArray(raw.agents)) {
      throw new Error(`[retort] .retortconfig 'agents' must be a mapping`);
    }
    for (const [agentId, value] of Object.entries(raw.agents)) {
      if (value !== null && typeof value !== 'string') {
        throw new Error(
          `[retort] .retortconfig 'agents.${agentId}' must be a string (remap target) or ~ (null, to disable)`
        );
      }
    }
  }

  // Validate features block (optional)
  if (raw.features != null) {
    if (typeof raw.features !== 'object' || Array.isArray(raw.features)) {
      throw new Error(`[retort] .retortconfig 'features' must be a mapping`);
    }
    for (const [featureId, featureConfig] of Object.entries(raw.features)) {
      if (
        featureConfig == null ||
        typeof featureConfig !== 'object' ||
        Array.isArray(featureConfig)
      ) {
        throw new Error(
          `[retort] .retortconfig 'features.${featureId}' must be a mapping with an 'enabled' key`
        );
      }
      const unknownFeatureKeys = Object.keys(featureConfig).filter((k) => k !== 'enabled');
      if (unknownFeatureKeys.length > 0) {
        throw new Error(
          `[retort] .retortconfig 'features.${featureId}' contains unknown keys: ${unknownFeatureKeys.join(', ')}\n` +
            `  Only 'enabled' is supported`
        );
      }
      if (typeof featureConfig.enabled !== 'boolean') {
        throw new Error(
          `[retort] .retortconfig 'features.${featureId}.enabled' must be a boolean (true or false)`
        );
      }
    }
  }

  return raw;
}

/**
 * Merges `.retortconfig` overrides into the template context vars.
 *
 * Effects:
 *   - features.<id>.enabled=false  → appended to vars.disabledFeatures (Set)
 *   - features.<id>.enabled=true   → appended to vars.enabledFeatures (Set, if present)
 *   - agents.<id> = 'name'         → vars.retortAgentMap[id] = 'name'
 *   - agents.<id> = null           → vars.retortDisabledAgents.add(id)
 *
 * Warns (to stderr) for agent IDs in retortConfig.agents that have no
 * corresponding entry in vars.agentIds (when provided).
 *
 * @param {object} specVars - Mutable template context vars object
 * @param {object|null} retortConfig - Parsed config from loadRetortConfig(), or null
 * @param {{ log?: Function, warn?: Function, agentIds?: string[] }} [options]
 * @returns {void}
 */
export function applyRetortConfig(specVars, retortConfig, options = {}) {
  if (!retortConfig) return;

  const warn = options.warn || ((msg) => console.warn(msg));
  const knownAgentIds = new Set(options.agentIds || []);
  const hasKnownAgents = knownAgentIds.size > 0;

  // Initialise the agent remapping structures if not already present
  if (!specVars.retortAgentMap) {
    specVars.retortAgentMap = {};
  }
  if (!specVars.retortDisabledAgents) {
    specVars.retortDisabledAgents = new Set();
  }

  // -------------------------------------------------------------------------
  // Apply feature flag overrides
  // -------------------------------------------------------------------------
  const features = retortConfig.features || {};
  for (const [featureId, featureConfig] of Object.entries(features)) {
    const enabled = featureConfig.enabled;

    if (enabled === false) {
      // Add to disabledFeatures — features disabled via .retortconfig
      if (!specVars.retortDisabledFeatures) {
        specVars.retortDisabledFeatures = new Set();
      }
      specVars.retortDisabledFeatures.add(featureId);
    } else if (enabled === true) {
      // Add to retortEnabledFeatures — features force-enabled via .retortconfig
      if (!specVars.retortEnabledFeatures) {
        specVars.retortEnabledFeatures = new Set();
      }
      specVars.retortEnabledFeatures.add(featureId);
    }
  }

  // -------------------------------------------------------------------------
  // Apply agent remapping
  // -------------------------------------------------------------------------
  const agents = retortConfig.agents || {};
  for (const [agentId, target] of Object.entries(agents)) {
    // Warn on unmapped agent IDs (only when we have a known agent list)
    if (hasKnownAgents && !knownAgentIds.has(agentId)) {
      warn(
        `[retort] .retortconfig 'agents.${agentId}' does not match any known agent ID. ` +
          `This entry will have no effect.`
      );
    }

    if (target === null) {
      // null (YAML ~) → disable the agent
      specVars.retortDisabledAgents.add(agentId);
    } else {
      // string → remap to named agent
      specVars.retortAgentMap[agentId] = target;
    }
  }
}
