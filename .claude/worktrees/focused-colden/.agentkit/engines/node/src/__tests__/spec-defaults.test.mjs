import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSpecDefaults } from '../synchronize.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = join(
    tmpdir(),
    `agentkit-spec-defaults-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

const MINIMAL_SPEC_DEFAULTS = `
issueTracker: github
testingCoverage: 80
maxTaskTurns: 25
maxStagnationTurns: 20

phase:
  greenfield:
    testingCoverage: 60
    maxStagnationTurns: 15
  active:
    testingCoverage: 80
    maxStagnationTurns: 20
  maintenance:
    testingCoverage: 90
    maxStagnationTurns: 25
  legacy:
    testingCoverage: 70
    maxStagnationTurns: 30

teamSize:
  solo:
    maxTaskTurns: 15
    maxStagnationTurns: 10
  small:
    maxTaskTurns: 20
    maxStagnationTurns: 15
  medium:
    maxTaskTurns: 25
    maxStagnationTurns: 20
  large:
    maxTaskTurns: 35
    maxStagnationTurns: 25
`.trimStart();

describe('loadSpecDefaults()', () => {
  let agentkitRoot;

  beforeEach(() => {
    agentkitRoot = makeTmpDir();
  });

  afterEach(() => {
    rmSync(agentkitRoot, { recursive: true, force: true });
  });

  it('returns empty object when spec-defaults.yaml is missing (backward-compatible)', () => {
    const result = loadSpecDefaults(agentkitRoot);
    expect(result).toEqual({});
  });

  it('returns static defaults when no context is provided', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    const result = loadSpecDefaults(agentkitRoot);
    expect(result.issueTracker).toBe('github');
    expect(result.testingCoverage).toBe(80);
    expect(result.maxTaskTurns).toBe(25);
    expect(result.maxStagnationTurns).toBe(20);
    // Conditional blocks should not leak into the result
    expect(result.phase).toBeUndefined();
    expect(result.teamSize).toBeUndefined();
  });

  it('applies phase-conditional defaults for greenfield', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    const result = loadSpecDefaults(agentkitRoot, { phase: 'greenfield' });
    expect(result.testingCoverage).toBe(60);
    expect(result.maxStagnationTurns).toBe(15);
    // Static-only values still present
    expect(result.issueTracker).toBe('github');
  });

  it('applies phase-conditional defaults for maintenance', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    const result = loadSpecDefaults(agentkitRoot, { phase: 'maintenance' });
    expect(result.testingCoverage).toBe(90);
    expect(result.maxStagnationTurns).toBe(25);
  });

  it('applies phase-conditional defaults for legacy', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    const result = loadSpecDefaults(agentkitRoot, { phase: 'legacy' });
    expect(result.testingCoverage).toBe(70);
    expect(result.maxStagnationTurns).toBe(30);
  });

  it('applies teamSize-conditional defaults for solo', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    const result = loadSpecDefaults(agentkitRoot, { teamSize: 'solo' });
    expect(result.maxTaskTurns).toBe(15);
    expect(result.maxStagnationTurns).toBe(10);
  });

  it('applies teamSize-conditional defaults for large', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    const result = loadSpecDefaults(agentkitRoot, { teamSize: 'large' });
    expect(result.maxTaskTurns).toBe(35);
    expect(result.maxStagnationTurns).toBe(25);
  });

  it('teamSize overrides phase when both are set (teamSize wins within spec-defaults)', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    // greenfield sets maxStagnationTurns: 15, solo sets maxStagnationTurns: 10
    const result = loadSpecDefaults(agentkitRoot, { phase: 'greenfield', teamSize: 'solo' });
    expect(result.maxStagnationTurns).toBe(10); // teamSize wins
    expect(result.testingCoverage).toBe(60); // phase-only key preserved
  });

  it('ignores unknown phase keys gracefully', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    const result = loadSpecDefaults(agentkitRoot, { phase: 'unknown-phase' });
    expect(result.testingCoverage).toBe(80); // falls back to static
  });

  it('ignores unknown teamSize keys gracefully', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    const result = loadSpecDefaults(agentkitRoot, { teamSize: 'unknown-size' });
    expect(result.maxTaskTurns).toBe(25); // falls back to static
  });

  it('active phase returns same as static defaults', () => {
    writeFile(resolve(agentkitRoot, 'spec', 'spec-defaults.yaml'), MINIMAL_SPEC_DEFAULTS);
    const result = loadSpecDefaults(agentkitRoot, { phase: 'active' });
    expect(result.testingCoverage).toBe(80);
    expect(result.maxStagnationTurns).toBe(20);
  });
});
