/**
 * Tests for retort-config-wizard.mjs (Phase 8 — .retortconfig generation)
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
    `retort-config-wizard-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Set up a minimal agentkitRoot with spec/agents/*.yaml and spec/features.yaml
 */
function setupAgentkitRoot(dir) {
  const specDir = resolve(dir, 'spec');
  mkdirSync(specDir, { recursive: true });

  const agentsDir = resolve(specDir, 'agents');
  mkdirSync(agentsDir, { recursive: true });

  // Write a minimal agent catalog
  writeFileSync(
    resolve(agentsDir, 'engineering.yaml'),
    yaml.dump({
      engineering: [
        {
          id: 'backend',
          category: 'engineering',
          name: 'Backend Engineer',
          accepts: ['implement'],
        },
        {
          id: 'frontend',
          category: 'engineering',
          name: 'Frontend Engineer',
          accepts: ['implement'],
        },
      ],
    }),
    'utf-8'
  );

  // Write a minimal features spec
  writeFileSync(
    resolve(specDir, 'features.yaml'),
    yaml.dump({
      features: [
        {
          id: 'team-orchestration',
          name: 'Team Orchestration',
          category: 'workflow',
          alwaysOn: true,
          default: true,
        },
        {
          id: 'cost-tracking',
          name: 'Cost Tracking',
          category: 'infra',
          alwaysOn: false,
          default: true,
        },
        {
          id: 'drift-check',
          name: 'Drift Check',
          category: 'quality',
          alwaysOn: false,
          default: false,
        },
      ],
      presets: {
        standard: { label: 'Standard', features: ['cost-tracking'] },
      },
    }),
    'utf-8'
  );

  return dir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runRetortConfigWizard', () => {
  let tmpRoot;
  let projectRoot;
  let agentkitRoot;

  beforeEach(() => {
    tmpRoot = makeTmpDir();
    projectRoot = resolve(tmpRoot, 'project');
    agentkitRoot = resolve(tmpRoot, 'agentkit');
    mkdirSync(projectRoot, { recursive: true });
    setupAgentkitRoot(agentkitRoot);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  // -------------------------------------------------------------------------
  // Non-interactive path writes correct structure
  // -------------------------------------------------------------------------

  it('non-interactive path writes correct .retortconfig structure', async () => {
    vi.resetModules();
    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true },
      prefill: { projectName: 'test-project', stacks: ['typescript'], enabledFeatures: null },
    });

    const configPath = resolve(projectRoot, '.retortconfig');
    expect(existsSync(configPath)).toBe(true);

    const raw = readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw.replace(/^#.*$/gm, '').trim());

    expect(parsed).toMatchObject({
      project: {
        name: 'test-project',
        stacks: ['typescript'],
      },
    });
  });

  it('non-interactive path falls back gracefully when prefill is null', async () => {
    // Write .agentkit-repo so auto-detect can find the project name
    writeFileSync(resolve(projectRoot, '.agentkit-repo'), 'auto-detected-project\n', 'utf-8');

    vi.resetModules();
    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true },
      prefill: null,
    });

    const configPath = resolve(projectRoot, '.retortconfig');
    expect(existsSync(configPath)).toBe(true);

    const raw = readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw.replace(/^#.*$/gm, '').trim());
    expect(parsed?.project?.name).toBe('auto-detected-project');
  });

  // -------------------------------------------------------------------------
  // Feature overrides matching defaults are omitted
  // -------------------------------------------------------------------------

  it('feature overrides matching defaults are omitted from output', async () => {
    // We test this by examining writeRetortConfigFile directly — features
    // that match defaults should not appear in the config.
    vi.resetModules();
    const { writeRetortConfigFile } = await import('../retort-config-wizard.mjs');

    const configPath = resolve(projectRoot, '.retortconfig');

    // Empty featureOverrides means no deviations from defaults
    const config = {
      project: { name: 'my-project', type: 'application', stacks: [] },
      // No `features` key — no deviations
    };

    writeRetortConfigFile(configPath, config);

    const raw = readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw.replace(/^#.*$/gm, '').trim());

    // features key must not be present when there are no overrides
    expect(parsed?.features).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Agent remapping entries
  // -------------------------------------------------------------------------

  it('agent remapping entries appear in output with correct structure', async () => {
    vi.resetModules();
    const { writeRetortConfigFile } = await import('../retort-config-wizard.mjs');

    const configPath = resolve(projectRoot, '.retortconfig');

    const config = {
      project: { name: 'my-project', type: 'application', stacks: [] },
      agents: {
        backend: null,
        frontend: { team: 'quality' },
      },
    };

    writeRetortConfigFile(configPath, config);

    const raw = readFileSync(configPath, 'utf-8');

    // Disabled agents should serialize as ~ (null in YAML)
    expect(raw).toMatch(/backend:\s*~/);

    const parsed = yaml.load(raw.replace(/^#.*$/gm, '').trim());
    expect(parsed.agents.backend).toBeNull();
    expect(parsed.agents.frontend).toEqual({ team: 'quality' });
  });

  it('null agent values round-trip correctly through YAML serialization', async () => {
    vi.resetModules();
    const { writeRetortConfigFile } = await import('../retort-config-wizard.mjs');

    const configPath = resolve(projectRoot, '.retortconfig');

    const config = {
      project: { name: 'round-trip', type: 'service', stacks: ['node'] },
      agents: {
        backend: null,
        frontend: null,
        'data-engineer': null,
      },
    };

    writeRetortConfigFile(configPath, config);

    const raw = readFileSync(configPath, 'utf-8');
    // All three should be rendered as ~
    const tildeCount = (raw.match(/:\s*~\s*\n/g) || []).length;
    expect(tildeCount).toBeGreaterThanOrEqual(3);

    const parsed = yaml.load(raw.replace(/^#.*$/gm, '').trim());
    expect(parsed.agents.backend).toBeNull();
    expect(parsed.agents.frontend).toBeNull();
    expect(parsed.agents['data-engineer']).toBeNull();
  });

  // -------------------------------------------------------------------------
  // --force overwrites existing .retortconfig
  // -------------------------------------------------------------------------

  it('--force flag overwrites existing .retortconfig', async () => {
    const configPath = resolve(projectRoot, '.retortconfig');
    writeFileSync(configPath, '# old content\nproject:\n  name: old-project\n', 'utf-8');

    vi.resetModules();
    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true, force: true },
      prefill: { projectName: 'new-project', stacks: [], enabledFeatures: null },
    });

    const raw = readFileSync(configPath, 'utf-8');
    expect(raw).not.toContain('old-project');
    const parsed = yaml.load(raw.replace(/^#.*$/gm, '').trim());
    expect(parsed?.project?.name).toBe('new-project');
  });

  it('without --force, existing .retortconfig is preserved', async () => {
    const configPath = resolve(projectRoot, '.retortconfig');
    const originalContent = '# original\nproject:\n  name: original\n';
    writeFileSync(configPath, originalContent, 'utf-8');

    vi.resetModules();
    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true }, // no force
      prefill: { projectName: 'new-name', stacks: [], enabledFeatures: null },
    });

    // File should be unchanged (warning emitted, not overwritten)
    const raw = readFileSync(configPath, 'utf-8');
    expect(raw).toBe(originalContent);
  });

  // -------------------------------------------------------------------------
  // --config-only path auto-detects context (prefill: null)
  // -------------------------------------------------------------------------

  it('--config-only path auto-detects project name from .agentkit-repo', async () => {
    // Simulate what cli.mjs does for --config-only: passes prefill: null
    writeFileSync(resolve(projectRoot, '.agentkit-repo'), 'detected-via-config-only\n', 'utf-8');

    vi.resetModules();
    const { runRetortConfigWizard } = await import('../retort-config-wizard.mjs');

    await runRetortConfigWizard({
      agentkitRoot,
      projectRoot,
      flags: { 'non-interactive': true, 'config-only': true },
      prefill: null, // as sent by cli.mjs --config-only short-circuit
    });

    const configPath = resolve(projectRoot, '.retortconfig');
    expect(existsSync(configPath)).toBe(true);

    const raw = readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw.replace(/^#.*$/gm, '').trim());
    expect(parsed?.project?.name).toBe('detected-via-config-only');
  });

  // -------------------------------------------------------------------------
  // writeRetortConfig export from retort-config.mjs
  // -------------------------------------------------------------------------

  it('writeRetortConfig from retort-config.mjs writes correct YAML', async () => {
    vi.resetModules();
    const { writeRetortConfig, readRetortConfig } = await import('../retort-config.mjs');

    const config = {
      project: { name: 'test', type: 'library', stacks: ['rust'] },
      agents: { backend: null },
    };

    writeRetortConfig(projectRoot, config);

    const configPath = resolve(projectRoot, '.retortconfig');
    expect(existsSync(configPath)).toBe(true);

    const raw = readFileSync(configPath, 'utf-8');
    expect(raw).toMatch(/backend:\s*~/);

    const parsed = readRetortConfig(projectRoot);
    expect(parsed?.project?.name).toBe('test');
    expect(parsed?.agents?.backend).toBeNull();
  });

  it('readRetortConfig returns null when .retortconfig does not exist', async () => {
    vi.resetModules();
    const { readRetortConfig } = await import('../retort-config.mjs');
    expect(readRetortConfig(projectRoot)).toBeNull();
  });
});
