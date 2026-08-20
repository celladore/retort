import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import { validateHarnessValue } from '../harness-contract.mjs';
import {
  buildHarnessManifest,
  createLineDiff,
  generateHarnessManifest,
} from '../harness-onboarding.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const temporaryDirectories = [];

function temporaryDirectory(prefix) {
  const directory = mkdtempSync(resolve(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function fixture() {
  const projectRoot = temporaryDirectory('retort-harness-onboarding-');
  const agentkitRoot = resolve(projectRoot, '.agentkit');
  cpSync(resolve(REAL_AGENTKIT_ROOT, 'contracts'), resolve(agentkitRoot, 'contracts'), {
    recursive: true,
  });
  mkdirSync(resolve(agentkitRoot, 'spec', 'agents'), { recursive: true });
  writeFileSync(
    resolve(agentkitRoot, 'spec', 'project.yaml'),
    'name: sample-repo\ngithubSlug: example/sample-repo\n',
    'utf-8'
  );
  writeFileSync(
    resolve(agentkitRoot, 'spec', 'agents', 'quality.yaml'),
    [
      'quality:',
      '  - id: spec-compliance-auditor',
      '    name: Spec Compliance Auditor',
      '    role: Validate repository specifications without changing the workspace.',
      '    accepts: [review, investigate]',
      '',
    ].join('\n'),
    'utf-8'
  );
  return { projectRoot, agentkitRoot };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('HarnessManifest onboarding', () => {
  it('builds a schema-valid read-only manifest from the real Retort specs', () => {
    const { manifest, provenance } = buildHarnessManifest({
      agentkitRoot: REAL_AGENTKIT_ROOT,
      now: '2026-08-10T00:00:00Z',
    });

    const validation = validateHarnessValue(REAL_AGENTKIT_ROOT, manifest);
    expect(validation.ok, validation.errors.join('\n')).toBe(true);
    expect(manifest.roles.length).toBeGreaterThan(1);
    expect(manifest.roles.every((role) => role.authority.ceiling === 'read-only')).toBe(true);
    expect(manifest.roles.every((role) => role.authority.mergePolicy === 'deny')).toBe(true);
    expect(provenance.authorityPromotion).toBe(false);
  });

  it('supports dry-run, writes a valid manifest, and is byte-idempotent', () => {
    const { projectRoot, agentkitRoot } = fixture();
    const outputPath = resolve(projectRoot, '.agentkit', 'harness', 'manifest.json');

    const preview = generateHarnessManifest({
      agentkitRoot,
      projectRoot,
      flags: { 'dry-run': true, diff: true },
      now: '2026-08-10T00:00:00Z',
    });
    expect(preview.ok, preview.errors?.join('\n')).toBe(true);
    expect(preview).toMatchObject({ changed: true, written: false });
    expect(preview.diff).toContain('+++ generated');
    expect(existsSync(outputPath)).toBe(false);

    const written = generateHarnessManifest({
      agentkitRoot,
      projectRoot,
      flags: {},
      now: '2026-08-10T00:00:00Z',
    });
    expect(written).toMatchObject({ ok: true, changed: true, written: true });
    const firstBytes = readFileSync(outputPath, 'utf-8');

    const repeated = generateHarnessManifest({
      agentkitRoot,
      projectRoot,
      flags: {},
      now: '2026-08-10T01:00:00Z',
    });
    expect(repeated).toMatchObject({ ok: true, changed: false, written: false });
    expect(readFileSync(outputPath, 'utf-8')).toBe(firstBytes);
  });

  it('preserves manifest, role, and workflow extension namespaces on update', () => {
    const { projectRoot, agentkitRoot } = fixture();
    const first = generateHarnessManifest({
      agentkitRoot,
      projectRoot,
      flags: {},
      now: '2026-08-10T00:00:00Z',
    });
    const manifest = JSON.parse(readFileSync(first.outputPath, 'utf-8'));
    manifest.extensions['example.local/config'] = { enabled: true };
    manifest.roles[0].extensions = { 'anthropic.claude/model': 'sonnet' };
    manifest.workflows[0].extensions = { 'example.local/workflow': { owner: 'quality' } };
    writeFileSync(first.outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
    writeFileSync(
      resolve(agentkitRoot, 'spec', 'project.yaml'),
      'name: sample-repo\ngithubSlug: example/sample-repo\ndescription: Updated project spec.\n',
      'utf-8'
    );

    const updated = generateHarnessManifest({
      agentkitRoot,
      projectRoot,
      flags: {},
      now: '2026-08-10T02:00:00Z',
    });
    expect(updated.ok, updated.errors?.join('\n')).toBe(true);
    expect(updated.preservedExtensionKeys).toEqual(['example.local/config']);
    const result = JSON.parse(readFileSync(first.outputPath, 'utf-8'));
    expect(result.extensions['example.local/config']).toEqual({ enabled: true });
    expect(result.extensions['retort.neuralliquid.dev/provenance'].authorityPromotion).toBe(false);
    expect(result.roles[0].extensions).toEqual({ 'anthropic.claude/model': 'sonnet' });
    expect(result.workflows[0].extensions).toEqual({
      'example.local/workflow': { owner: 'quality' },
    });
    expect(result.metadata.updatedAt).toBe('2026-08-10T02:00:00Z');
  });

  it('refuses path escape and invalid existing content without overwriting it', () => {
    const { projectRoot, agentkitRoot } = fixture();
    const escaped = generateHarnessManifest({
      agentkitRoot,
      projectRoot,
      flags: { output: '../outside.json' },
    });
    expect(escaped.ok).toBe(false);
    expect(escaped.errors.join('\n')).toContain('escapes project root');

    const outputPath = resolve(projectRoot, '.agentkit', 'harness', 'manifest.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, '{broken', 'utf-8');
    const invalid = generateHarnessManifest({ agentkitRoot, projectRoot, flags: {} });
    expect(invalid.ok).toBe(false);
    expect(readFileSync(outputPath, 'utf-8')).toBe('{broken');
  });

  it('returns no diff for equal content', () => {
    expect(createLineDiff('{\n}\n', '{\n}\n')).toBe('');
  });
});
