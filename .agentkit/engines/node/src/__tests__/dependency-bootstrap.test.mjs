import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { findMissingRuntimeDependencies } from '../dependency-bootstrap.mjs';

describe('runtime dependency bootstrap', () => {
  const roots = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(installed = []) {
    const root = join(
      tmpdir(),
      `retort-dependency-bootstrap-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    roots.push(root);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        dependencies: { 'js-yaml': '^4.2.0', ajv: '8.20.0', 'ajv-formats': '3.0.1' },
      })
    );
    for (const name of installed) {
      const packageRoot = join(root, 'node_modules', name);
      mkdirSync(packageRoot, { recursive: true });
      writeFileSync(join(packageRoot, 'package.json'), '{}');
    }
    return root;
  }

  it('detects dependencies added after an existing installation', () => {
    const root = fixture(['js-yaml']);

    expect(findMissingRuntimeDependencies(root)).toEqual(['ajv', 'ajv-formats']);
  });

  it('returns no missing dependencies when the runtime installation is current', () => {
    const root = fixture(['js-yaml', 'ajv', 'ajv-formats']);

    expect(findMissingRuntimeDependencies(root)).toEqual([]);
  });
});
