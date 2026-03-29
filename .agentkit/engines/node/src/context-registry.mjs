/**
 * Retort — ContextRegistry
 * DI facade composing SpecAccessor, RuntimeStateManager, and EventEmitter.
 *
 * Production entry point:  ContextRegistry.create(projectRoot)
 * Test entry point:        ContextRegistry.createForTest(overrides)
 */
import { EventEmitter } from 'events';
import { join } from 'path';
import { SpecAccessor } from './spec-accessor.mjs';
import { RuntimeStateManager } from './runtime-state-manager.mjs';

// ---------------------------------------------------------------------------
// ContextRegistry
// ---------------------------------------------------------------------------

export class ContextRegistry {
  /**
   * @param {string} projectRoot  - Absolute path to the project root
   * @param {object} [options]
   * @param {SpecAccessor}          [options.spec]    - Override for testing
   * @param {RuntimeStateManager}   [options.state]   - Override for testing
   * @param {EventEmitter}          [options.events]  - Override for testing
   * @param {string}                [options.agentkitRoot] - Override for testing
   */
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.agentkitRoot = options.agentkitRoot ?? join(projectRoot, '.agentkit');

    this.events = options.events != null ? options.events : new EventEmitter();

    this.spec = options.spec != null ? options.spec : new SpecAccessor(this.agentkitRoot);

    this.state =
      options.state != null ? options.state : new RuntimeStateManager(projectRoot, this.events);
  }

  // -------------------------------------------------------------------------
  // Spec convenience methods
  // -------------------------------------------------------------------------

  /**
   * Returns all team definitions from teams.yaml with their scope patterns.
   * @returns {object[]|null}
   */
  teams() {
    return this.spec.teams();
  }

  /**
   * Returns all agent definitions from the agents spec.
   * @returns {object|null}
   */
  agents() {
    return this.spec.agents();
  }

  // -------------------------------------------------------------------------
  // Static factory methods
  // -------------------------------------------------------------------------

  /**
   * Production factory. Creates a ContextRegistry, runs spec validation,
   * and emits `context:ready` on the shared EventEmitter.
   *
   * Rejects if spec validation returns errors (unless `options.skipValidation` is set).
   *
   * @param {string} projectRoot
   * @param {{ skipValidation?: boolean, agentkitRoot?: string, events?: EventEmitter }} [options]
   * @returns {Promise<ContextRegistry>}
   */
  static async create(projectRoot, options = {}) {
    const registry = new ContextRegistry(projectRoot, options);

    if (!options.skipValidation) {
      const errors = registry.spec.validate();
      if (errors.length > 0) {
        throw new Error(`ContextRegistry: spec validation failed:\n${errors.join('\n')}`);
      }
    }

    registry.events.emit('context:ready', { projectRoot, agentkitRoot: registry.agentkitRoot });
    return registry;
  }

  /**
   * Test factory. Accepts plain-object overrides for spec/state/events so tests
   * can inject fakes without touching the filesystem.
   *
   * Accepts any projectRoot (defaults to '/test/project') and does NOT
   * run spec validation.
   *
   * @param {{ projectRoot?: string, agentkitRoot?: string, spec?: object, state?: object, events?: EventEmitter }} [overrides]
   * @returns {ContextRegistry}
   */
  static createForTest(overrides = {}) {
    const projectRoot = overrides.projectRoot ?? '/test/project';
    return new ContextRegistry(projectRoot, {
      agentkitRoot: overrides.agentkitRoot ?? join(projectRoot, '.agentkit'),
      spec: overrides.spec,
      state: overrides.state,
      events: overrides.events,
    });
  }
}
