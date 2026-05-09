import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { syncOrgMetaSkills } from '../platform-syncer.mjs';

describe('syncOrgMetaSkills', () => {
  let tmpDir;
  let projectRoot;
  let orgMetaRoot;
  let originalOrgMetaPath;
  let logs;
  const log = (msg) => logs.push(msg);

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sync-orgmeta-tmp-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'sync-orgmeta-proj-'));
    orgMetaRoot = mkdtempSync(join(tmpdir(), 'sync-orgmeta-src-'));
    originalOrgMetaPath = process.env.ORG_META_PATH;
    process.env.ORG_META_PATH = orgMetaRoot;
    logs = [];
    mkdirSync(join(orgMetaRoot, 'skills'), { recursive: true });
  });

  afterEach(() => {
    if (originalOrgMetaPath === undefined) {
      delete process.env.ORG_META_PATH;
    } else {
      process.env.ORG_META_PATH = originalOrgMetaPath;
    }
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(orgMetaRoot, { recursive: true, force: true });
  });

  function writeSrc(skillName, fileName, content) {
    const dir = join(orgMetaRoot, 'skills', skillName);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, fileName), content, 'utf-8');
  }

  it('copies SKILL.md to flat layout when categorised flag is off', async () => {
    writeSrc('alpha', 'SKILL.md', '# alpha');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'alpha', source: 'org-meta' }] },
      log
    );

    const out = join(tmpDir, '.agents', 'skills', 'alpha', 'SKILL.md');
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out, 'utf-8')).toBe('# alpha');
  });

  it('routes to <category>/ when categorised flag is on', async () => {
    writeSrc('alpha', 'SKILL.md', '# alpha');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'alpha', source: 'org-meta', category: 'engineering' }] },
      log,
      { categorised: true }
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'engineering', 'alpha', 'SKILL.md'))).toBe(
      true
    );
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'alpha', 'SKILL.md'))).toBe(false);
  });

  it('defaults to category "meta" when categorised but no category declared', async () => {
    writeSrc('alpha', 'SKILL.md', '# alpha');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'alpha', source: 'org-meta' }] },
      log,
      { categorised: true }
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'meta', 'alpha', 'SKILL.md'))).toBe(true);
  });

  it('copies declared companion files alongside SKILL.md', async () => {
    writeSrc('tdd', 'SKILL.md', '# tdd');
    writeSrc('tdd', 'tests.md', '# tests');
    writeSrc('tdd', 'mocking.md', '# mocking');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      {
        skills: [{ name: 'tdd', source: 'org-meta', companions: ['tests.md', 'mocking.md'] }],
      },
      log
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'tdd', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'tdd', 'tests.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'tdd', 'mocking.md'))).toBe(true);
  });

  it('logs and skips companions whose path escapes the skill directory', async () => {
    writeSrc('tdd', 'SKILL.md', '# tdd');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'tdd', source: 'org-meta', companions: ['../escape.md'] }] },
      log
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'tdd', 'SKILL.md'))).toBe(true);
    expect(logs.some((m) => m.includes('rejected (path escapes skill dir)'))).toBe(true);
  });

  it('skips emission entirely for lifecycle: deprecated', async () => {
    writeSrc('legacy', 'SKILL.md', '# legacy');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'legacy', source: 'org-meta', lifecycle: 'deprecated' }] },
      log
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'legacy', 'SKILL.md'))).toBe(false);
    expect(logs.some((m) => m.includes("'legacy' is deprecated"))).toBe(true);
  });

  it('emits with warning log for lifecycle: in-progress', async () => {
    writeSrc('wip', 'SKILL.md', '# wip');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'wip', source: 'org-meta', lifecycle: 'in-progress' }] },
      log
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'wip', 'SKILL.md'))).toBe(true);
    expect(logs.some((m) => m.includes("'wip' is in-progress"))).toBe(true);
  });

  it('preserves a divergent local SKILL.md (non-destructive contract)', async () => {
    writeSrc('alpha', 'SKILL.md', '# upstream');
    const localPath = join(projectRoot, '.agents', 'skills', 'alpha', 'SKILL.md');
    mkdirSync(join(projectRoot, '.agents', 'skills', 'alpha'), { recursive: true });
    writeFileSync(localPath, '# locally edited', 'utf-8');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'alpha', source: 'org-meta' }] },
      log
    );

    // tmpDir output is suppressed when local diverges
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'alpha', 'SKILL.md'))).toBe(false);
    expect(logs.some((m) => m.includes('differs from local'))).toBe(true);
  });
});
