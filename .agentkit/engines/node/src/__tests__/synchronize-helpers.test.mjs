import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// These helpers are exported from synchronize.mjs (and re-exported from
// spec-loader.mjs). Importing from synchronize.mjs ensures the synchronize.mjs
// copy of each helper is exercised by the coverage reporter.
import { readYaml, readText, loadAgentsSpec, loadSpecDefaults } from '../synchronize.mjs';

let tmp;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sync-helpers-test-'));
});

afterEach(() => {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* Windows may briefly hold locks */
  }
});

function writeYaml(path, content) {
  mkdirSync(join(tmp, ...path.slice(0, -1)), { recursive: true });
  writeFileSync(join(tmp, ...path), content, 'utf-8');
}

// ---------------------------------------------------------------------------
// readYaml / readText
// ---------------------------------------------------------------------------

describe('readYaml (re-exported from synchronize.mjs)', () => {
  it('returns null when file does not exist', () => {
    expect(readYaml(join(tmp, 'missing.yaml'))).toBeNull();
  });

  it('parses a valid YAML file', () => {
    writeYaml(['cfg.yaml'], 'name: demo\nvalue: 42\n');
    const result = readYaml(join(tmp, 'cfg.yaml'));
    expect(result).toEqual({ name: 'demo', value: 42 });
  });

  it('returns undefined-equivalent for an empty YAML file', () => {
    writeYaml(['empty.yaml'], '');
    // js-yaml.load on '' returns undefined
    expect(readYaml(join(tmp, 'empty.yaml'))).toBeUndefined();
  });
});

describe('readText (re-exported from synchronize.mjs)', () => {
  it('returns null when file does not exist', () => {
    expect(readText(join(tmp, 'missing.txt'))).toBeNull();
  });

  it('returns the file contents as a string', () => {
    writeYaml(['hello.txt'], 'hello world\n');
    expect(readText(join(tmp, 'hello.txt'))).toBe('hello world\n');
  });

  it('returns empty string for an empty file', () => {
    writeYaml(['empty.txt'], '');
    expect(readText(join(tmp, 'empty.txt'))).toBe('');
  });
});

// ---------------------------------------------------------------------------
// loadAgentsSpec — directory and fallback
// ---------------------------------------------------------------------------

describe('loadAgentsSpec (re-exported from synchronize.mjs)', () => {
  it('returns empty object when neither agents/ dir nor agents.yaml exists', () => {
    expect(loadAgentsSpec(tmp)).toEqual({});
  });

  it('loads from spec/agents.yaml fallback', () => {
    writeYaml(
      ['spec', 'agents.yaml'],
      `agents:\n  engineering:\n    - id: be\n      name: Backend\n`
    );
    const result = loadAgentsSpec(tmp);
    expect(result.agents.engineering[0].id).toBe('be');
  });

  it('loads from spec/agents/ directory of per-category YAML files', () => {
    writeYaml(['spec', 'agents', 'engineering.yaml'], `engineering:\n  - id: be\n    name: BE\n`);
    writeYaml(['spec', 'agents', 'testing.yaml'], `testing:\n  - id: qa\n    name: QA\n`);

    const result = loadAgentsSpec(tmp);
    expect(result.agents.engineering[0].id).toBe('be');
    expect(result.agents.testing[0].id).toBe('qa');
  });

  it('skips non-yaml files in the agents directory', () => {
    writeYaml(['spec', 'agents', 'engineering.yaml'], `engineering:\n  - id: be\n    name: BE\n`);
    writeYaml(['spec', 'agents', 'README.md'], '# readme');
    writeYaml(['spec', 'agents', '.gitkeep'], '');

    const result = loadAgentsSpec(tmp);
    expect(Object.keys(result.agents)).toEqual(['engineering']);
  });

  it('skips files that parse to non-object', () => {
    writeYaml(['spec', 'agents', 'good.yaml'], `engineering:\n  - id: be\n    name: BE\n`);
    writeYaml(['spec', 'agents', 'scalar.yaml'], 'just-a-scalar-string\n');

    const result = loadAgentsSpec(tmp);
    expect(result.agents.engineering[0].id).toBe('be');
  });

  it('skips non-array category values within a YAML file', () => {
    writeYaml(
      ['spec', 'agents', 'mixed.yaml'],
      `engineering:\n  - id: be\n    name: BE\nbad: not-array\n`
    );
    const result = loadAgentsSpec(tmp);
    expect(result.agents.engineering[0].id).toBe('be');
    expect(result.agents.bad).toBeUndefined();
  });

  it('concatenates multiple YAML files that contribute to the same category', () => {
    writeYaml(['spec', 'agents', 'a.yaml'], `engineering:\n  - id: be1\n    name: BE1\n`);
    writeYaml(['spec', 'agents', 'b.yaml'], `engineering:\n  - id: be2\n    name: BE2\n`);

    const result = loadAgentsSpec(tmp);
    const ids = result.agents.engineering.map((a) => a.id).sort();
    expect(ids).toEqual(['be1', 'be2']);
  });

  it('also accepts .yml extension', () => {
    writeYaml(['spec', 'agents', 'engineering.yml'], `engineering:\n  - id: be\n    name: BE\n`);
    const result = loadAgentsSpec(tmp);
    expect(result.agents.engineering[0].id).toBe('be');
  });
});

// ---------------------------------------------------------------------------
// loadSpecDefaults — base / phase / teamSize layered
// ---------------------------------------------------------------------------

describe('loadSpecDefaults (re-exported from synchronize.mjs)', () => {
  it('returns empty object when spec-defaults.yaml is missing', () => {
    expect(loadSpecDefaults(tmp, {})).toEqual({});
    expect(loadSpecDefaults(tmp)).toEqual({});
  });

  it('returns static defaults only when no phase/teamSize is supplied', () => {
    writeYaml(
      ['spec', 'spec-defaults.yaml'],
      `staticA: 1\nstaticB: 'x'\nphase:\n  greenfield:\n    staticA: 99\n`
    );
    const result = loadSpecDefaults(tmp, {});
    expect(result).toEqual({ staticA: 1, staticB: 'x' });
  });

  it('applies phase-conditional overrides on top of static defaults', () => {
    writeYaml(
      ['spec', 'spec-defaults.yaml'],
      `staticA: 1\nphase:\n  greenfield:\n    staticA: 99\n    extra: 'g'\n`
    );
    const result = loadSpecDefaults(tmp, { phase: 'greenfield' });
    expect(result.staticA).toBe(99);
    expect(result.extra).toBe('g');
  });

  it('does not apply phase block when phase is unknown', () => {
    writeYaml(
      ['spec', 'spec-defaults.yaml'],
      `staticA: 1\nphase:\n  greenfield:\n    staticA: 99\n`
    );
    const result = loadSpecDefaults(tmp, { phase: 'unknown' });
    expect(result.staticA).toBe(1);
  });

  it('applies teamSize-conditional overrides with priority over phase', () => {
    writeYaml(
      ['spec', 'spec-defaults.yaml'],
      [
        'staticA: 1',
        'phase:',
        '  active:',
        '    staticA: 50',
        '    fromPhase: true',
        'teamSize:',
        '  large:',
        '    staticA: 200',
      ].join('\n') + '\n'
    );
    const result = loadSpecDefaults(tmp, { phase: 'active', teamSize: 'large' });
    expect(result.staticA).toBe(200); // teamSize wins
    expect(result.fromPhase).toBe(true); // phase still applied
  });

  it('returns empty object when YAML is empty/falsy', () => {
    writeYaml(['spec', 'spec-defaults.yaml'], '');
    expect(loadSpecDefaults(tmp, {})).toEqual({});
  });

  it('handles missing teamSize/phase blocks gracefully', () => {
    writeYaml(['spec', 'spec-defaults.yaml'], `staticA: 1\n`);
    const result = loadSpecDefaults(tmp, { phase: 'active', teamSize: 'large' });
    expect(result).toEqual({ staticA: 1 });
  });
});
