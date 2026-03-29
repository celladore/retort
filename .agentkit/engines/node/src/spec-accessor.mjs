/**
 * Retort — SpecAccessor
 * Typed, lazily-loaded, cached access to all .agentkit/spec/*.yaml files.
 * Parsed results are frozen on first read and cached until reload() is called.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'path';
import { validateSpec } from './spec-validator.mjs';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Reads and parses a YAML file. Returns null if the file does not exist or
 * cannot be parsed — never throws.
 * @param {string} filePath
 * @returns {unknown|null}
 */
function readYamlSafe(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return yaml.load(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Deep-freezes a value so callers cannot accidentally mutate cached data.
 * Handles null/undefined, primitives, arrays, and plain objects.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

// ---------------------------------------------------------------------------
// SpecAccessor
// ---------------------------------------------------------------------------

export class SpecAccessor {
  /**
   * @param {string} agentkitRoot — absolute path to the `.agentkit/` directory
   */
  constructor(agentkitRoot) {
    this._root = agentkitRoot;
    this._specDir = resolve(agentkitRoot, 'spec');
    /** @type {Map<string, unknown>} */
    this._cache = new Map();
  }

  // -------------------------------------------------------------------------
  // Private: cache-aware YAML loader
  // -------------------------------------------------------------------------

  /**
   * Returns the cached parsed value for `filename`, loading from disk on the
   * first call. Result is deep-frozen before being stored.
   * @param {string} filename — relative to spec/ (e.g. 'project.yaml')
   * @returns {unknown|null}
   */
  _load(filename) {
    if (this._cache.has(filename)) {
      return this._cache.get(filename);
    }
    const filePath = resolve(this._specDir, filename);
    const parsed = readYamlSafe(filePath);
    const frozen = parsed !== null ? deepFreeze(parsed) : null;
    this._cache.set(filename, frozen);
    return frozen;
  }

  /**
   * Loads the agents spec using the directory-first strategy from spec-loader,
   * then caches and freezes the result.
   * @returns {unknown|null}
   */
  _loadAgents() {
    const key = '__agents__';
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    // Try spec/agents/ directory first (multi-file), fall back to agents.yaml
    const agentsDir = resolve(this._root, 'spec', 'agents');
    const agentsFile = resolve(this._root, 'spec', 'agents.yaml');
    let parsed;
    if (existsSync(agentsDir)) {
      try {
        const files = readdirSync(agentsDir).filter(f => f.endsWith('.yaml'));
        const agents = {};
        for (const f of files) {
          const category = f.replace('.yaml', '');
          const raw = readYamlSafe(resolve(agentsDir, f));
          // Files may wrap content under the category key (e.g. `engineering: [...]`)
          agents[category] = Array.isArray(raw?.[category]) ? raw[category]
            : Array.isArray(raw) ? raw : [];
        }
        parsed = { agents };
      } catch {
        parsed = readYamlSafe(agentsFile);
      }
    } else {
      parsed = readYamlSafe(agentsFile);
    }
    const frozen = parsed !== null ? deepFreeze(parsed) : null;
    this._cache.set(key, frozen);
    return frozen;
  }

  // -------------------------------------------------------------------------
  // Public API — spec accessors
  // -------------------------------------------------------------------------

  /** @returns {object|null} parsed project.yaml */
  project() {
    return this._load('project.yaml');
  }

  /**
   * @returns {object[]|null} teams array from teams.yaml, or null if file missing
   */
  teams() {
    const raw = this._load('teams.yaml');
    if (!raw || typeof raw !== 'object') return null;
    return raw.teams ?? null;
  }

  /**
   * Returns a single team object by its `id` field.
   * @param {string} id
   * @returns {object|null}
   */
  team(id) {
    const list = this.teams();
    if (!Array.isArray(list)) return null;
    return list.find((t) => t.id === id) ?? null;
  }

  /**
   * @returns {object[]|null} rules array from rules.yaml, or null if file missing
   */
  rules() {
    const raw = this._load('rules.yaml');
    if (!raw || typeof raw !== 'object') return null;
    return raw.rules ?? null;
  }

  /**
   * Returns all rule conventions for a given domain name.
   * @param {string} domain
   * @returns {object|null} the matching domain rule object, or null
   */
  rule(domain) {
    const list = this.rules();
    if (!Array.isArray(list)) return null;
    return list.find((r) => r.domain === domain) ?? null;
  }

  /** @returns {object|null} parsed commands.yaml */
  commands() {
    return this._load('commands.yaml');
  }

  /**
   * @returns {object|null} parsed agents spec (directory-first, then agents.yaml fallback)
   */
  agents() {
    return this._loadAgents();
  }

  /** @returns {object|null} parsed settings.yaml */
  settings() {
    return this._load('settings.yaml');
  }

  /** @returns {object|null} parsed brand.yaml */
  brand() {
    return this._load('brand.yaml');
  }

  // -------------------------------------------------------------------------
  // Shorthand helpers
  // -------------------------------------------------------------------------

  /**
   * Shorthand for `project().stack`.
   * @returns {object|null}
   */
  stack() {
    const proj = this.project();
    if (!proj || typeof proj !== 'object') return null;
    return proj.stack ?? null;
  }

  /**
   * Shorthand for `project().testing.coverage`.
   * @returns {number|null}
   */
  coverage() {
    const proj = this.project();
    if (!proj || typeof proj !== 'object') return null;
    const testing = proj.testing;
    if (!testing || typeof testing !== 'object') return null;
    return testing.coverage ?? null;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Runs the full spec-validator checks against the agentkit root.
   * @returns {string[]} array of error strings (empty = valid)
   */
  validate() {
    try {
      const result = validateSpec(this._root);
      return result.errors ?? [];
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Cache management
  // -------------------------------------------------------------------------

  /**
   * Clears all cached spec data. Next access to any spec will re-read from disk.
   */
  reload() {
    this._cache.clear();
  }
}
