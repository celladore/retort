import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { syncUnknownSkillsReport } from '../platform-syncer.mjs';

describe('syncUnknownSkillsReport', () => {
  let tmpDir;
  let projectRoot;
  let logs;
  const log = (msg) => logs.push(msg);

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sync-unknown-tmp-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'sync-unknown-proj-'));
    logs = [];
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function makeLocalSkill(...segments) {
    mkdirSync(join(projectRoot, '.agents', 'skills', ...segments), { recursive: true });
  }

  it('flags top-level dirs not in skills.yaml under the flat layout', async () => {
    makeLocalSkill('alpha');
    makeLocalSkill('beta');

    await syncUnknownSkillsReport(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'alpha' }] },
      '2026-05-09',
      log
    );

    const report = readFileSync(
      join(tmpDir, '.agents', 'skills', '_unknown', 'report.md'),
      'utf-8'
    );
    expect(report).toContain('| `beta` |');
    expect(report).not.toContain('| `alpha` |');
  });

  it('does not classify category folders as unknown skills under the categorised layout', async () => {
    makeLocalSkill('engineering', 'alpha');
    makeLocalSkill('meta', 'gamma');

    await syncUnknownSkillsReport(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'alpha' }, { name: 'gamma' }] },
      '2026-05-09',
      log,
      { categorised: true }
    );

    // No unknown skills — both alpha and gamma are known, just nested under categories.
    expect(existsSync(join(tmpDir, '.agents', 'skills', '_unknown', 'report.md'))).toBe(false);
  });

  it('reports nested skill names (not their parent category) under the categorised layout', async () => {
    makeLocalSkill('engineering', 'alpha'); // known
    makeLocalSkill('engineering', 'newcomer'); // unknown
    makeLocalSkill('meta', 'wildcard'); // unknown

    await syncUnknownSkillsReport(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'alpha' }] },
      '2026-05-09',
      log,
      { categorised: true }
    );

    const report = readFileSync(
      join(tmpDir, '.agents', 'skills', '_unknown', 'report.md'),
      'utf-8'
    );
    expect(report).toContain('| `newcomer` |');
    expect(report).toContain('| `wildcard` |');
    // Category folders themselves must not be reported as skills.
    expect(report).not.toContain('| `engineering` |');
    expect(report).not.toContain('| `meta` |');
  });

  it('flags stale flat skill dirs (top-level SKILL.md) under the categorised layout', async () => {
    // Stale flat skill left over from before categorisation: a top-level dir
    // that contains SKILL.md directly. The scanner should report it instead of
    // descending into it as if it were a category bucket.
    makeLocalSkill('legacyflat');
    writeFileSync(join(projectRoot, '.agents', 'skills', 'legacyflat', 'SKILL.md'), '# Stale\n');
    makeLocalSkill('engineering', 'newcomer');

    await syncUnknownSkillsReport(tmpDir, projectRoot, { skills: [] }, '2026-05-09', log, {
      categorised: true,
    });

    const report = readFileSync(
      join(tmpDir, '.agents', 'skills', '_unknown', 'report.md'),
      'utf-8'
    );
    expect(report).toContain('| `legacyflat` |');
    expect(report).toContain('| `newcomer` |');
  });
});
