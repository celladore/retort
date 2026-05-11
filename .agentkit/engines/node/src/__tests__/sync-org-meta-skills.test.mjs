import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { syncOrgMetaSkills } from '../platform-syncer.mjs';

describe('syncOrgMetaSkills', () => {
  let tmpDir;
  let projectRoot;
  let orgMetaRoot;
  let originalEnv;
  let logs;
  const log = (msg) => logs.push(msg);

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sync-orgmeta-tmp-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'sync-orgmeta-proj-'));
    orgMetaRoot = mkdtempSync(join(tmpdir(), 'sync-orgmeta-src-'));
    // Snapshot + replace process.env so any env mutation in this suite is
    // scoped to the test (matches the pattern in resolveWindowsExecutable.test.mjs).
    originalEnv = process.env;
    process.env = { ...originalEnv, ORG_META_PATH: orgMetaRoot };
    logs = [];
    mkdirSync(join(orgMetaRoot, 'skills'), { recursive: true });
  });

  afterEach(() => {
    process.env = originalEnv;
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
    // Rejection may fire at the .md/no-subdirectory check OR the path-escape
    // check, depending on the form of the input — either way the companion is
    // skipped.
    expect(logs.some((m) => m.includes('rejected'))).toBe(true);
  });

  it('rejects POSIX-absolute companion paths', async () => {
    writeSrc('tdd', 'SKILL.md', '# tdd');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'tdd', source: 'org-meta', companions: ['/etc/passwd'] }] },
      log
    );

    expect(logs.some((m) => m.includes('rejected'))).toBe(true);
  });

  it('rejects Windows drive-letter absolute companion paths', async () => {
    writeSrc('tdd', 'SKILL.md', '# tdd');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'tdd', source: 'org-meta', companions: ['C:\\Windows\\evil.md'] }] },
      log
    );

    expect(logs.some((m) => m.includes('rejected'))).toBe(true);
  });

  it('rejects companions that are not .md files', async () => {
    writeSrc('tdd', 'SKILL.md', '# tdd');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'tdd', source: 'org-meta', companions: ['notes.txt'] }] },
      log
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'tdd', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'tdd', 'notes.txt'))).toBe(false);
    expect(logs.some((m) => m.includes('must be a .md filename'))).toBe(true);
  });

  it('rejects companions with subdirectory paths', async () => {
    writeSrc('tdd', 'SKILL.md', '# tdd');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'tdd', source: 'org-meta', companions: ['nested/foo.md'] }] },
      log
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'tdd', 'nested', 'foo.md'))).toBe(false);
    expect(logs.some((m) => m.includes('no subdirectories'))).toBe(true);
  });

  it('falls back to category "meta" when category contains path separators', async () => {
    writeSrc('alpha', 'SKILL.md', '# alpha');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'alpha', source: 'org-meta', category: '../escape' }] },
      log,
      { categorised: true }
    );

    // Emitted under safe fallback path, never under the attacker-controlled value.
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'meta', 'alpha', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', '..', 'escape', 'alpha', 'SKILL.md'))).toBe(
      false
    );
    expect(logs.some((m) => m.includes("unsafe category '../escape'"))).toBe(true);
  });

  it('falls back to category "meta" when category is an absolute path', async () => {
    writeSrc('alpha', 'SKILL.md', '# alpha');

    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'alpha', source: 'org-meta', category: '/etc' }] },
      log,
      { categorised: true }
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'meta', 'alpha', 'SKILL.md'))).toBe(true);
    expect(logs.some((m) => m.includes('unsafe category'))).toBe(true);
  });

  it('skips skills whose name contains path traversal sequences', async () => {
    // A crafted skills.yaml entry like name: "../evil" must NOT make the syncer
    // traverse out of .agents/skills/. The entire skill is dropped (vs. category
    // which falls back to 'meta') because the name IS the skill identifier.
    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: '../evil', source: 'org-meta' }] },
      log
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', '..', 'evil', 'SKILL.md'))).toBe(false);
    expect(existsSync(join(tmpDir, '.agents', 'evil', 'SKILL.md'))).toBe(false);
    expect(logs.some((m) => m.includes("name '../evil' is unsafe"))).toBe(true);
  });

  it('skips skills whose name contains a path separator', async () => {
    await syncOrgMetaSkills(
      tmpDir,
      projectRoot,
      { skills: [{ name: 'foo/bar', source: 'org-meta' }] },
      log
    );

    expect(existsSync(join(tmpDir, '.agents', 'skills', 'foo', 'bar', 'SKILL.md'))).toBe(false);
    expect(logs.some((m) => m.includes("name 'foo/bar' is unsafe"))).toBe(true);
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

  it('preserves a divergent local SKILL.md by routing LOCAL content through tmpDir (non-destructive contract)', async () => {
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

    // When local diverges, the file MUST still appear in tmpDir — otherwise
    // newManifestFiles omits it and cleanStaleFiles deletes the local copy
    // as a stale orphan, immediately undoing the "preserve" decision. The
    // content written to tmpDir is the LOCAL content (not src), so the
    // post-sync write-back is a no-op for the local file.
    const tmpOut = join(tmpDir, '.agents', 'skills', 'alpha', 'SKILL.md');
    expect(existsSync(tmpOut)).toBe(true);
    expect(readFileSync(tmpOut, 'utf-8')).toBe('# locally edited');
    expect(logs.some((m) => m.includes('differs from local'))).toBe(true);
  });
});
