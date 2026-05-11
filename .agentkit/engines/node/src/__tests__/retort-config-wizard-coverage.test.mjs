/**
 * Coverage tests for retort-config-wizard.mjs (#520 phase 3).
 *
 * Covers branches not exercised by retort-config-wizard.test.mjs:
 *   - loadAgentCatalog edge cases (missing dir, malformed yaml, non-object docs,
 *     non-array categories, agents without id)
 *   - loadFeatureList edge cases (missing file, malformed yaml, no features key)
 *   - detectContextFromRepo edge cases (missing marker, unreadable marker,
 *     missing project.yaml, malformed project.yaml)
 *   - serializeConfig list-null path
 *   - Full interactive wizard path with all branches, using the
 *     flags.__clackPrompts injection point (matches init.mjs pattern).
 *   - Cancellation at each prompt
 *   - Agent management opt-in + remap workflow
 *   - Feature override opt-in (deviation tracking)
 *   - clack import failure → non-interactive fallback
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = resolve(
    tmpdir(),
    `retort-config-wizard-cov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Build a clack mock that returns the queued answers in order.
 * Returns the mock factory plus a `prompts` array for assertions.
 */
function makeClackMock(answers) {
  const queue = [...answers];
  const next = () => {
    if (queue.length === 0) throw new Error('clack mock answer queue exhausted');
    return queue.shift();
  };
  const cancelMarker = Symbol('cancel');
  return {
    cancelMarker,
    factory: () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      isCancel: (v) => v === cancelMarker,
      text: vi.fn(async () => next()),
      select: vi.fn(async () => next()),
      multiselect: vi.fn(async () => next()),
      confirm: vi.fn(async () => next()),
      group: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    }),
  };
}

// ---------------------------------------------------------------------------
// loadAgentCatalog / loadFeatureList / detectContextFromRepo edge cases
// (exercised indirectly via the wizard's non-interactive path)
// ---------------------------------------------------------------------------

describe('retort-config-wizard.mjs — spec loaders edge cases', () => {
  let tmpRoot;
  let projectRoot;
  let agentkitRoot;

  beforeEach(() => {
    tmpRoot = makeTmpDir();
    projectRoot = resolve(tmpRoot, 'project');
    agentkitRoot = resolve(tmpRoot, 'agentkit');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(agentkitRoot, { recursive: true });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('handles missing spec/agents and spec/features.yaml gracefully', async () => {
    // No spec/ directory at all
    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true },
      prefill: { projectName: 'no-spec', stacks: [], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed?.project?.name).toBe('no-spec');
  });

  it('skips malformed agent yaml files', async () => {
    const agentsDir = resolve(agentkitRoot, 'spec', 'agents');
    mkdirSync(agentsDir, { recursive: true });
    // Mix of malformed, non-object, non-array category, and agent missing id
    writeFileSync(resolve(agentsDir, 'broken.yaml'), '%%%not yaml%%%', 'utf-8');
    writeFileSync(resolve(agentsDir, 'null.yaml'), 'null\n', 'utf-8');
    writeFileSync(
      resolve(agentsDir, 'scalar.yaml'),
      yaml.dump({ engineering: 'not-an-array' }),
      'utf-8'
    );
    writeFileSync(
      resolve(agentsDir, 'no-id.yaml'),
      yaml.dump({ engineering: [{ name: 'no-id-agent' }] }),
      'utf-8'
    );
    // Non-yaml extension — should be filtered out by readdir filter
    writeFileSync(resolve(agentsDir, 'readme.md'), '# not yaml', 'utf-8');

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true },
      prefill: { projectName: 'malformed-specs', stacks: [], enabledFeatures: null },
    });

    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(true);
  });

  it('handles malformed features.yaml', async () => {
    const specDir = resolve(agentkitRoot, 'spec');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(resolve(specDir, 'features.yaml'), '%%%not yaml%%%', 'utf-8');

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true },
      prefill: { projectName: 'bad-features', stacks: [], enabledFeatures: null },
    });

    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(true);
  });

  it('handles features.yaml without features key', async () => {
    const specDir = resolve(agentkitRoot, 'spec');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(resolve(specDir, 'features.yaml'), yaml.dump({ presets: {} }), 'utf-8');

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true },
      prefill: { projectName: 'no-features-key', stacks: [], enabledFeatures: null },
    });

    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(true);
  });

  it('detectContextFromRepo: marker present, project.yaml malformed', async () => {
    // Marker present, project.yaml malformed → stacks default to []
    writeFileSync(resolve(projectRoot, '.agentkit-repo'), 'my-detected\n', 'utf-8');
    const specDir = resolve(agentkitRoot, 'spec');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(resolve(specDir, 'project.yaml'), '%%%not yaml%%%', 'utf-8');

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true },
      // No prefill — exercises detectContextFromRepo
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed?.project?.name).toBe('my-detected');
  });

  it('detectContextFromRepo: marker present but empty', async () => {
    writeFileSync(resolve(projectRoot, '.agentkit-repo'), '   \n', 'utf-8');

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    // Falls back to basename(projectRoot) when marker is whitespace-only
    expect(parsed?.project?.name).toBeTruthy();
  });

  it('detectContextFromRepo: project.yaml present with stacks + features', async () => {
    const specDir = resolve(agentkitRoot, 'spec');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(
      resolve(specDir, 'project.yaml'),
      yaml.dump({
        stack: { languages: ['typescript', 'python'] },
        features: { 'team-orchestration': true, 'cost-tracking': false },
      }),
      'utf-8'
    );

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed?.project?.stacks).toEqual(['typescript', 'python']);
  });
});

// ---------------------------------------------------------------------------
// Interactive wizard — full happy path + branches
// ---------------------------------------------------------------------------

describe('runRetortConfigWizard — interactive path', () => {
  let tmpRoot;
  let projectRoot;
  let agentkitRoot;
  let originalIsTTY;

  beforeEach(() => {
    tmpRoot = makeTmpDir();
    projectRoot = resolve(tmpRoot, 'project');
    agentkitRoot = resolve(tmpRoot, 'agentkit');
    mkdirSync(projectRoot, { recursive: true });

    // Set up a minimal agentkitRoot with one agent and one non-core feature
    const specDir = resolve(agentkitRoot, 'spec');
    const agentsDir = resolve(specDir, 'agents');
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      resolve(agentsDir, 'engineering.yaml'),
      yaml.dump({
        engineering: [
          { id: 'backend', name: 'Backend Engineer', accepts: ['implement'] },
          { id: 'frontend', name: 'Frontend Engineer', accepts: ['implement'] },
        ],
      }),
      'utf-8'
    );
    writeFileSync(
      resolve(specDir, 'features.yaml'),
      yaml.dump({
        features: [
          {
            id: 'team-orchestration',
            name: 'Orch',
            category: 'core',
            alwaysOn: true,
            default: true,
          },
          { id: 'cost-tracking', name: 'Cost', category: 'infra', alwaysOn: false, default: true },
          {
            id: 'drift-check',
            name: 'Drift',
            category: 'quality',
            alwaysOn: false,
            default: false,
          },
        ],
      }),
      'utf-8'
    );

    // Force interactive path
    originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY;
    rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('full happy path: prompts → write config with all sections', async () => {
    const mock = makeClackMock([
      'my-interactive-project', // projectName text
      'service', // projectType text
      ['typescript', 'node'], // stacks multiselect
      ['gdpr', 'none', 'soc2'], // compliance multiselect (none filtered)
      true, // configureAgents confirm
      ['backend'], // disabledAgents multiselect
      true, // wantRemap confirm
      ['frontend'], // remapChoices multiselect
      'quality', // remap team text
      true, // configureFeatures confirm
      ['drift-check'], // selectedFeatures multiselect (drift-check is off by default, cost-tracking on by default)
    ]);

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: ['typescript'], enabledFeatures: null },
    });

    const raw = readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8');
    const parsed = yaml.load(raw.replace(/^#.*$/gm, '').trim());

    expect(parsed.project.name).toBe('my-interactive-project');
    expect(parsed.project.type).toBe('service');
    expect(parsed.project.stacks).toEqual(['typescript', 'node']);
    // 'none' filtered out of compliance
    expect(parsed.project.compliance).toEqual(['gdpr', 'soc2']);
    // Disabled agent is null
    expect(parsed.agents.backend).toBeNull();
    // Remapped agent has team
    expect(parsed.agents.frontend).toEqual({ team: 'quality' });
    // drift-check is OFF by default but user enabled it → recorded as true
    expect(parsed.features['drift-check']).toBe(true);
    // cost-tracking is ON by default and user disabled it (not in selectedFeatures) → recorded as false
    expect(parsed.features['cost-tracking']).toBe(false);
  });

  it('cancel at projectName prompt aborts', async () => {
    const mock = makeClackMock([]);
    mock.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      isCancel: () => true,
      text: vi.fn(async () => mock.cancelMarker),
      select: vi.fn(async () => mock.cancelMarker),
      multiselect: vi.fn(async () => mock.cancelMarker),
      confirm: vi.fn(async () => mock.cancelMarker),
    });

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });

    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(false);
  });

  it('cancel at projectType prompt aborts', async () => {
    const mock = makeClackMock([
      'my-project',
      // next prompt (type) returns the cancel marker
    ]);
    // Override to return cancel after first text answer
    const origFactory = mock.factory;
    let callCount = 0;
    mock.factory = () => {
      const base = origFactory();
      base.text = vi.fn(async () => {
        callCount++;
        if (callCount === 1) return 'my-project';
        return mock.cancelMarker;
      });
      return base;
    };

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });

    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(false);
  });

  it('cancel at stacks multiselect aborts', async () => {
    const mock = makeClackMock([]);
    let mCount = 0;
    mock.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      isCancel: (v) => v === mock.cancelMarker,
      text: vi.fn(async () => 'ok'),
      select: vi.fn(async () => 'ok'),
      multiselect: vi.fn(async () => {
        mCount++;
        if (mCount === 1) return mock.cancelMarker; // first multiselect (stacks)
        return [];
      }),
      confirm: vi.fn(async () => false),
    });

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });
    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(false);
  });

  it('cancel at compliance multiselect aborts', async () => {
    const mock = makeClackMock([]);
    let mCount = 0;
    mock.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      isCancel: (v) => v === mock.cancelMarker,
      text: vi.fn(async () => 'ok'),
      multiselect: vi.fn(async () => {
        mCount++;
        if (mCount === 1) return [];
        if (mCount === 2) return mock.cancelMarker; // compliance
        return [];
      }),
      confirm: vi.fn(async () => false),
    });

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });
    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(false);
  });

  it('cancel at configureAgents confirm aborts', async () => {
    const mock = makeClackMock([]);
    mock.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      isCancel: (v) => v === mock.cancelMarker,
      text: vi.fn(async () => 'ok'),
      multiselect: vi.fn(async () => []),
      confirm: vi.fn(async () => mock.cancelMarker), // first confirm = configureAgents
    });

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });
    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(false);
  });

  it('cancel at disabledAgents multiselect aborts', async () => {
    const mock = makeClackMock([]);
    let mCount = 0;
    mock.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      isCancel: (v) => v === mock.cancelMarker,
      text: vi.fn(async () => 'ok'),
      multiselect: vi.fn(async () => {
        mCount++;
        if (mCount === 1) return []; // stacks
        if (mCount === 2) return []; // compliance
        if (mCount === 3) return mock.cancelMarker; // disabledAgents
        return [];
      }),
      confirm: vi.fn(async () => true), // configureAgents = true
    });

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });
    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(false);
  });

  it('cancel at configureFeatures confirm aborts', async () => {
    const mock = makeClackMock([]);
    let confirmCount = 0;
    mock.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      isCancel: (v) => v === mock.cancelMarker,
      text: vi.fn(async () => 'ok'),
      multiselect: vi.fn(async () => []),
      confirm: vi.fn(async () => {
        confirmCount++;
        if (confirmCount === 1) return false; // configureAgents = false
        return mock.cancelMarker; // configureFeatures = cancel
      }),
    });

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });
    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(false);
  });

  it('cancel at selectedFeatures multiselect aborts', async () => {
    const mock = makeClackMock([]);
    let mCount = 0;
    let confirmCount = 0;
    mock.factory = () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      isCancel: (v) => v === mock.cancelMarker,
      text: vi.fn(async () => 'ok'),
      multiselect: vi.fn(async () => {
        mCount++;
        if (mCount === 1 || mCount === 2) return []; // stacks, compliance
        return mock.cancelMarker; // features multiselect = cancel
      }),
      confirm: vi.fn(async () => {
        confirmCount++;
        return confirmCount === 1 ? false : true; // skip agents, configure features
      }),
    });

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });
    expect(existsSync(resolve(projectRoot, '.retortconfig'))).toBe(false);
  });

  it('agent step skipped when catalog is empty', async () => {
    // Remove agents to make catalog empty
    rmSync(resolve(agentkitRoot, 'spec', 'agents'), { recursive: true, force: true });

    const mock = makeClackMock([
      'p',
      's',
      [],
      [],
      false, // configureFeatures = no
    ]);

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.agents).toBeUndefined();
  });

  it('features step skipped when no non-core features exist', async () => {
    // Replace features with only alwaysOn ones
    writeFileSync(
      resolve(agentkitRoot, 'spec', 'features.yaml'),
      yaml.dump({
        features: [
          { id: 'core-only', name: 'Core', category: 'core', alwaysOn: true, default: true },
        ],
      }),
      'utf-8'
    );

    const mock = makeClackMock([
      'p',
      's',
      [],
      [],
      false, // configureAgents = no
    ]);

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.features).toBeUndefined();
  });

  it('feature deviations from defaults are recorded; matches are omitted', async () => {
    // Defaults: cost-tracking=on, drift-check=off
    // User selects only drift-check → cost-tracking off (deviation), drift-check on (deviation)
    const mock = makeClackMock([
      'p',
      's',
      [],
      [],
      false, // configureAgents = no
      true, // configureFeatures = yes
      ['drift-check'], // user wants only drift-check
    ]);

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.features['drift-check']).toBe(true);
    expect(parsed.features['cost-tracking']).toBe(false);
  });

  it('no agent overrides written when configureAgents = no', async () => {
    const mock = makeClackMock([
      'p',
      's',
      [],
      [],
      false, // configureAgents = no
      false, // configureFeatures = no
    ]);

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.agents).toBeUndefined();
    expect(parsed.features).toBeUndefined();
  });

  it('remap step skipped when wantRemap = no', async () => {
    const mock = makeClackMock([
      'p',
      's',
      [],
      [],
      true, // configureAgents = yes
      ['backend'], // disable backend
      false, // wantRemap = no
      false, // configureFeatures = no
    ]);

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.agents).toEqual({ backend: null });
  });

  it('clack import failure falls back to non-interactive', async () => {
    const failFactory = () => {
      throw new Error('clack unavailable');
    };

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: failFactory },
      prefill: { projectName: 'fallback-project', stacks: ['rust'], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.project.name).toBe('fallback-project');
    expect(parsed.project.stacks).toEqual(['rust']);
  });

  it('prefill enabledFeatures filters features that exist in spec', async () => {
    const mock = makeClackMock([
      'p',
      's',
      [],
      [],
      false, // skip agents
      true, // configure features
      ['drift-check'], // user picks only drift-check
    ]);

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      // enabledFeatures includes a feature not in spec — should be filtered
      prefill: { projectName: 'seed', stacks: [], enabledFeatures: ['drift-check', 'nonexistent'] },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.features['drift-check']).toBe(true);
  });

  it('initialStacks filters out unknown stacks from prefill', async () => {
    const mock = makeClackMock([
      'p',
      's',
      ['typescript'], // user keeps typescript
      [],
      false,
      false,
    ]);

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { __clackPrompts: mock.factory },
      // 'foobar' is not in stackOptions → filtered out of initialStacks
      prefill: { projectName: 'seed', stacks: ['typescript', 'foobar'], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.project.stacks).toEqual(['typescript']);
  });

  it('falls back to non-interactive when isTTY is false', async () => {
    process.stdout.isTTY = false;

    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: {},
      prefill: { projectName: 'tty-off', stacks: [], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.project.name).toBe('tty-off');
  });

  it('falls back to non-interactive when ci flag is set', async () => {
    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');
    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { ci: true },
      prefill: { projectName: 'ci-mode', stacks: [], enabledFeatures: null },
    });

    const parsed = yaml.load(
      readFileSync(resolve(projectRoot, '.retortconfig'), 'utf-8').replace(/^#.*$/gm, '').trim()
    );
    expect(parsed.project.name).toBe('ci-mode');
  });
});
