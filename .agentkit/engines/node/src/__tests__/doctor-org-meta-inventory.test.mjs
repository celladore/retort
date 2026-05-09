import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { inventoryOrgMetaSkills } from '../doctor.mjs';

describe('inventoryOrgMetaSkills', () => {
  let projectRoot;
  let orgMetaRoot;
  let originalEnv;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'doctor-inv-project-'));
    orgMetaRoot = mkdtempSync(join(tmpdir(), 'doctor-inv-orgmeta-'));
    // Snapshot + replace process.env so any env mutation in this suite is
    // scoped to the test (matches the pattern in resolveWindowsExecutable.test.mjs).
    originalEnv = process.env;
    process.env = { ...originalEnv, ORG_META_PATH: orgMetaRoot };

    mkdirSync(join(projectRoot, '.agentkit', 'spec'), { recursive: true });
    mkdirSync(join(orgMetaRoot, 'skills'), { recursive: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(orgMetaRoot, { recursive: true, force: true });
  });

  function writeSpec(content) {
    writeFileSync(join(projectRoot, '.agentkit', 'spec', 'skills.yaml'), content, 'utf-8');
  }

  function writeOrgMetaSkill(name, content) {
    const dir = join(orgMetaRoot, 'skills', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), content, 'utf-8');
  }

  function writeLocalSkill(name, content) {
    const dir = join(projectRoot, '.agents', 'skills', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), content, 'utf-8');
  }

  function writeLocalSkillCategorised(category, name, content) {
    const dir = join(projectRoot, '.agents', 'skills', category, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), content, 'utf-8');
  }

  it('returns empty results when skills.yaml has no org-meta-sourced skills', () => {
    writeSpec('skills:\n  - name: foo\n    source: retort\n');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.error).toBeNull();
    expect(result.results).toEqual([]);
  });

  it('marks present when org-meta has the skill and no local copy exists', () => {
    writeSpec('skills:\n  - name: alpha\n    source: org-meta\n');
    writeOrgMetaSkill('alpha', '# alpha');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.error).toBeNull();
    expect(result.results).toEqual([expect.objectContaining({ name: 'alpha', status: 'present' })]);
  });

  it('marks missing when org-meta does not contain the skill', () => {
    writeSpec('skills:\n  - name: beta\n    source: org-meta\n');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.results).toEqual([expect.objectContaining({ name: 'beta', status: 'missing' })]);
  });

  it('marks local-divergent when org-meta and local copy differ', () => {
    writeSpec('skills:\n  - name: gamma\n    source: org-meta\n');
    writeOrgMetaSkill('gamma', '# upstream gamma');
    writeLocalSkill('gamma', '# locally edited gamma');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.results).toEqual([
      expect.objectContaining({ name: 'gamma', status: 'local-divergent' }),
    ]);
  });

  it('marks present when org-meta and local copy match exactly', () => {
    writeSpec('skills:\n  - name: delta\n    source: org-meta\n');
    writeOrgMetaSkill('delta', '# same content');
    writeLocalSkill('delta', '# same content');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.results).toEqual([expect.objectContaining({ name: 'delta', status: 'present' })]);
  });

  it('returns an error when skills.yaml is missing', () => {
    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.error).toMatch(/skills\.yaml not found/);
    expect(result.results).toEqual([]);
  });

  it('returns an error when skills.yaml is malformed', () => {
    writeSpec(': this is not valid yaml :\n  oops:\n');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.error).toMatch(/Failed to parse skills\.yaml/);
  });

  it('returns empty results when skills.yaml has skills as a non-array (e.g. {})', () => {
    // Parseable YAML but the wrong shape — must not crash doctor.
    writeSpec('skills: {}\n');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.error).toBeNull();
    expect(result.results).toEqual([]);
  });

  it('skips entries whose name is missing or non-string', () => {
    writeSpec(
      'skills:\n  - source: org-meta\n  - name: ""\n    source: org-meta\n  - name: valid\n    source: org-meta\n'
    );
    writeOrgMetaSkill('valid', '# valid');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.error).toBeNull();
    expect(result.results).toEqual([expect.objectContaining({ name: 'valid', status: 'present' })]);
  });

  it('detects local-divergent under the categorised layout (.agents/skills/<category>/<name>/)', () => {
    writeSpec('skills:\n  - name: omega\n    source: org-meta\n    category: engineering\n');
    writeOrgMetaSkill('omega', '# upstream omega');
    writeLocalSkillCategorised('engineering', 'omega', '# locally edited omega');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.results).toEqual([
      expect.objectContaining({ name: 'omega', status: 'local-divergent' }),
    ]);
  });

  it('defaults to category "meta" when checking the categorised layout', () => {
    writeSpec('skills:\n  - name: zeta\n    source: org-meta\n');
    writeOrgMetaSkill('zeta', '# upstream zeta');
    writeLocalSkillCategorised('meta', 'zeta', '# diverged');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.results).toEqual([
      expect.objectContaining({ name: 'zeta', status: 'local-divergent' }),
    ]);
  });
});
