/**
 * Phase 6 — Domain filtering tests
 *
 * Tests that filterDomainsByStack correctly filters rule domains based on:
 *  1. js-only project (mode: configured, languages: [javascript])
 *  2. fullstack project (typescript + dotnet + rust + solidity)
 *  3. explicit domains.rules override (only listed domains regardless of stack)
 *  4. heuristic mode (all domains — backward compat)
 */
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { dirname, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { filterDomainsByStack, filterTechStacks } from '../template-utils.mjs';

const FIXTURES_DIR = resolve(import.meta.dirname, '__fixtures__');
const AGENTKIT_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name) {
  return yaml.load(readFileSync(resolve(FIXTURES_DIR, name), 'utf-8'));
}

function loadRulesSpec() {
  return yaml.load(readFileSync(resolve(AGENTKIT_ROOT, 'spec', 'rules.yaml'), 'utf-8'));
}

/**
 * Build a minimal vars object matching what flattenProjectYaml + language inference
 * produces for a given project.yaml fixture.
 * Only the fields used by filterDomainsByStack are populated.
 */
function buildVarsFromFixture(project) {
  const langs = (project?.stack?.languages || []).map((l) => l.trim().toLowerCase());
  const mode = project?.automation?.languageProfile?.mode || 'hybrid';

  const hasLanguageTypeScript = langs.some((l) => l === 'typescript' || l === 'ts');
  const hasLanguageJavaScript = langs.some((l) => l === 'javascript' || l === 'js');
  const hasLanguageJsLike = hasLanguageTypeScript || hasLanguageJavaScript;
  const hasLanguageRust = langs.includes('rust');
  const hasLanguagePython = langs.includes('python');
  const hasLanguageDotnet = langs.some((l) => ['csharp', 'c#', 'dotnet', '.net'].includes(l));
  const hasLanguageBlockchain = langs.some((l) => ['solidity', 'blockchain'].includes(l));

  const hasConfiguredLanguages = langs.length > 0;

  let hasLanguageJsLikeEffective;
  let hasLanguagePythonEffective;
  let hasLanguageDotnetEffective;
  let hasLanguageRustEffective;

  if (mode === 'configured') {
    hasLanguageJsLikeEffective = hasConfiguredLanguages && hasLanguageJsLike;
    hasLanguagePythonEffective = hasConfiguredLanguages && hasLanguagePython;
    hasLanguageDotnetEffective = hasConfiguredLanguages && hasLanguageDotnet;
    hasLanguageRustEffective = hasConfiguredLanguages && hasLanguageRust;
  } else if (mode === 'heuristic') {
    // heuristic: inferred from frameworks/tests (we set to false for these unit tests
    // since we have no framework/test signals in fixtures — real engine would infer)
    hasLanguageJsLikeEffective = hasLanguageJsLike;
    hasLanguagePythonEffective = hasLanguagePython;
    hasLanguageDotnetEffective = hasLanguageDotnet;
    hasLanguageRustEffective = hasLanguageRust;
  } else {
    // hybrid: use configured if present, else inferred
    hasLanguageJsLikeEffective = hasConfiguredLanguages ? hasLanguageJsLike : false;
    hasLanguagePythonEffective = hasConfiguredLanguages ? hasLanguagePython : false;
    hasLanguageDotnetEffective = hasConfiguredLanguages ? hasLanguageDotnet : false;
    hasLanguageRustEffective = hasConfiguredLanguages ? hasLanguageRust : false;
  }

  return {
    languageProfileMode: mode,
    hasLanguageJsLikeEffective,
    hasLanguagePythonEffective,
    hasLanguageDotnetEffective,
    hasLanguageRustEffective,
    hasLanguageBlockchain,
    hasInfra: false,
  };
}

function domainNames(rules) {
  return new Set(rules.map((r) => r.domain));
}

// Universal domains that must always be present
const UNIVERSAL_DOMAINS = [
  'security',
  'testing',
  'git-workflow',
  'documentation',
  'ci-cd',
  'dependency-management',
  'agent-conduct',
  'template-protection',
];

// ---------------------------------------------------------------------------
// Scenario 1 — JS-only project (mode: configured, languages: [javascript])
// ---------------------------------------------------------------------------
describe('filterDomainsByStack — js-only project', () => {
  const project = loadFixture('js-only-project.yaml');
  const rulesSpec = loadRulesSpec();
  const vars = buildVarsFromFixture(project);
  const filtered = filterDomainsByStack(rulesSpec.rules, vars, project);
  const names = domainNames(filtered);

  it('includes the typescript domain for a javascript project', () => {
    expect(names.has('typescript')).toBe(true);
  });

  it('includes all universal domains', () => {
    for (const d of UNIVERSAL_DOMAINS) {
      expect(names.has(d), `expected universal domain "${d}" to be present`).toBe(true);
    }
  });

  it('excludes dotnet — not in stack', () => {
    expect(names.has('dotnet')).toBe(false);
  });

  it('excludes rust — not in stack', () => {
    expect(names.has('rust')).toBe(false);
  });

  it('excludes python — not in stack', () => {
    expect(names.has('python')).toBe(false);
  });

  it('excludes blockchain — not in stack', () => {
    expect(names.has('blockchain')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — Fullstack project (typescript + dotnet + rust + solidity)
// ---------------------------------------------------------------------------
describe('filterDomainsByStack — fullstack project', () => {
  const project = loadFixture('fullstack-project.yaml');
  const rulesSpec = loadRulesSpec();
  const vars = buildVarsFromFixture(project);
  const filtered = filterDomainsByStack(rulesSpec.rules, vars, project);
  const names = domainNames(filtered);

  it('includes typescript', () => {
    expect(names.has('typescript')).toBe(true);
  });

  it('includes dotnet', () => {
    expect(names.has('dotnet')).toBe(true);
  });

  it('includes rust', () => {
    expect(names.has('rust')).toBe(true);
  });

  it('includes blockchain', () => {
    expect(names.has('blockchain')).toBe(true);
  });

  it('includes all universal domains', () => {
    for (const d of UNIVERSAL_DOMAINS) {
      expect(names.has(d), `expected universal domain "${d}" to be present`).toBe(true);
    }
  });

  it('excludes python — not in stack', () => {
    expect(names.has('python')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — Explicit domains.rules override (only [typescript, security])
// ---------------------------------------------------------------------------
describe('filterDomainsByStack — explicit domains.rules override', () => {
  const project = loadFixture('explicit-domains-project.yaml');
  const rulesSpec = loadRulesSpec();
  const vars = buildVarsFromFixture(project);
  const filtered = filterDomainsByStack(rulesSpec.rules, vars, project);
  const names = domainNames(filtered);

  it('includes typescript — in explicit list', () => {
    expect(names.has('typescript')).toBe(true);
  });

  it('includes security — in explicit list', () => {
    expect(names.has('security')).toBe(true);
  });

  it('excludes testing — not in explicit list even though universal', () => {
    expect(names.has('testing')).toBe(false);
  });

  it('excludes dotnet — not in explicit list despite being in stack', () => {
    expect(names.has('dotnet')).toBe(false);
  });

  it('excludes rust — not in explicit list despite being in stack', () => {
    expect(names.has('rust')).toBe(false);
  });

  it('has exactly 2 domains', () => {
    expect(filtered.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — Heuristic mode (backward compat: all domains included)
// ---------------------------------------------------------------------------
describe('filterDomainsByStack — heuristic mode (backward compat)', () => {
  const project = loadFixture('heuristic-project.yaml');
  const rulesSpec = loadRulesSpec();
  const vars = buildVarsFromFixture(project);
  const filtered = filterDomainsByStack(rulesSpec.rules, vars, project);
  const names = domainNames(filtered);

  it('returns all domains from rules.yaml (no filtering)', () => {
    expect(filtered.length).toBe(rulesSpec.rules.length);
  });

  it('includes typescript', () => {
    expect(names.has('typescript')).toBe(true);
  });

  it('includes rust (even though not in stack)', () => {
    expect(names.has('rust')).toBe(true);
  });

  it('includes python (even though not in stack)', () => {
    expect(names.has('python')).toBe(true);
  });

  it('includes dotnet (even though not in stack)', () => {
    expect(names.has('dotnet')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterTechStacks — basic coverage
// ---------------------------------------------------------------------------
describe('filterTechStacks', () => {
  const stacks = [
    { name: 'node' },
    { name: 'dotnet' },
    { name: 'rust' },
    { name: 'python' },
    { name: 'custom-tool' }, // unknown — always kept
  ];

  it('keeps only node stack for a JS-only project', () => {
    const vars = {
      languageProfileMode: 'configured',
      hasLanguageJsLikeEffective: true,
      hasLanguageDotnetEffective: false,
      hasLanguageRustEffective: false,
      hasLanguagePythonEffective: false,
    };
    const result = filterTechStacks(stacks, vars);
    const names = result.map((s) => s.name);
    expect(names).toContain('node');
    expect(names).not.toContain('dotnet');
    expect(names).not.toContain('rust');
    expect(names).not.toContain('python');
    expect(names).toContain('custom-tool'); // unknown always kept
  });

  it('keeps all stacks in heuristic mode', () => {
    const vars = { languageProfileMode: 'heuristic' };
    const result = filterTechStacks(stacks, vars);
    expect(result.length).toBe(stacks.length);
  });

  it('keeps dotnet and node for a fullstack JS+dotnet project', () => {
    const vars = {
      languageProfileMode: 'configured',
      hasLanguageJsLikeEffective: true,
      hasLanguageDotnetEffective: true,
      hasLanguageRustEffective: false,
      hasLanguagePythonEffective: false,
    };
    const result = filterTechStacks(stacks, vars);
    const names = result.map((s) => s.name);
    expect(names).toContain('node');
    expect(names).toContain('dotnet');
    expect(names).not.toContain('rust');
    expect(names).not.toContain('python');
  });

  it('returns empty array when stacks is null', () => {
    const vars = { languageProfileMode: 'configured' };
    expect(filterTechStacks(null, vars)).toEqual([]);
  });
});
