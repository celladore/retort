/**
 * Retort — Spec Loader
 * YAML/text reading, agents spec loading, and spec-defaults resolution.
 * Extracted from synchronize.mjs (Step 3 of modularization).
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { readFile } from 'fs/promises';
import yaml from 'js-yaml';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

export function readYaml(filePath) {
  if (!existsSync(filePath)) return null;
  return yaml.load(readFileSync(filePath, 'utf-8'));
}

export function readText(filePath) {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf-8');
}

// ---------------------------------------------------------------------------
// Agents spec loader
// ---------------------------------------------------------------------------

/**
 * Loads the agents spec from either a directory of per-category YAML files
 * (.agentkit/spec/agents/) or the monolithic agents.yaml fallback.
 *
 * Directory format: each file is a map { <categoryKey>: [...agents] }.
 * The filename stem is used as the category key and must match the top-level key.
 */
export function loadAgentsSpec(agentkitRoot) {
  const agentsDir = resolve(agentkitRoot, 'spec', 'agents');
  if (existsSync(agentsDir)) {
    const merged = { agents: {} };
    const files = readdirSync(agentsDir)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
      .sort();
    for (const file of files) {
      const parsed = readYaml(resolve(agentsDir, file));
      if (!parsed || typeof parsed !== 'object') continue;
      for (const [category, agents] of Object.entries(parsed)) {
        if (!Array.isArray(agents)) continue;
        merged.agents[category] = (merged.agents[category] || []).concat(agents);
      }
    }
    return merged;
  }
  return readYaml(resolve(agentkitRoot, 'spec', 'agents.yaml')) || {};
}

// ---------------------------------------------------------------------------
// Spec defaults loader
// ---------------------------------------------------------------------------

/**
 * Loads spec-defaults.yaml from the given agentkit root and returns a merged
 * defaults object based on the current phase and teamSize.
 *
 * Merge precedence within spec-defaults (highest → lowest):
 *   teamSize block > phase block > static defaults
 *
 * Returns an empty object when spec-defaults.yaml is not present (backward-compatible).
 *
 * @param {string} agentkitRoot
 * @param {{ phase?: string, teamSize?: string }} context
 * @returns {Record<string, unknown>}
 */
export function loadSpecDefaults(agentkitRoot, context = {}) {
  const specDefaultsPath = resolve(agentkitRoot, 'spec', 'spec-defaults.yaml');
  const raw = readYaml(specDefaultsPath);
  if (!raw) return {};

  // Start with static defaults (omit the conditional blocks)
  const { phase: phaseBlock, teamSize: teamSizeBlock, ...staticDefaults } = raw;

  let merged = { ...staticDefaults };

  // Apply phase-conditional overrides
  const phase = context.phase;
  if (phase && phaseBlock?.[phase]) {
    merged = { ...merged, ...phaseBlock[phase] };
  }

  // Apply teamSize-conditional overrides (highest priority within spec-defaults)
  const teamSize = context.teamSize;
  if (teamSize && teamSizeBlock?.[teamSize]) {
    merged = { ...merged, ...teamSizeBlock[teamSize] };
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Template text cache (internal)
// ---------------------------------------------------------------------------

const templateTextCache = new Map();

export async function readTemplateText(filePath) {
  if (templateTextCache.has(filePath)) {
    return templateTextCache.get(filePath);
  }
  const content = await readFile(filePath, 'utf-8');
  templateTextCache.set(filePath, content);
  return content;
}

/**
 * Clears the template text cache. Call between test runs or sync invocations.
 */
export function clearTemplateTextCache() {
  templateTextCache.clear();
}
