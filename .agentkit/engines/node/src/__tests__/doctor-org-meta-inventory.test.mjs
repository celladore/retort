import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { inventoryOrgMetaSkills } from '../doctor.mjs';

describe('inventoryOrgMetaSkills', () => {
  let projectRoot;
  let orgMetaRoot;
  let originalOrgMetaPath;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'doctor-inv-project-'));
    orgMetaRoot = mkdtempSync(join(tmpdir(), 'doctor-inv-orgmeta-'));
    originalOrgMetaPath = process.env.ORG_META_PATH;
    process.env.ORG_META_PATH = orgMetaRoot;

    mkdirSync(join(projectRoot, '.agentkit', 'spec'), { recursive: true });
    mkdirSync(join(orgMetaRoot, 'skills'), { recursive: true });
  });

  afterEach(() => {
    if (originalOrgMetaPath === undefined) {
      delete process.env.ORG_META_PATH;
    } else {
      process.env.ORG_META_PATH = originalOrgMetaPath;
    }
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
    expect(result.results).toEqual([
      expect.objectContaining({ name: 'alpha', status: 'present' }),
    ]);
  });

  it('marks missing when org-meta does not contain the skill', () => {
    writeSpec('skills:\n  - name: beta\n    source: org-meta\n');

    const result = inventoryOrgMetaSkills(join(projectRoot, '.agentkit'), projectRoot);

    expect(result.results).toEqual([
      expect.objectContaining({ name: 'beta', status: 'missing' }),
    ]);
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

    expect(result.results).toEqual([
      expect.objectContaining({ name: 'delta', status: 'present' }),
    ]);
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
});
