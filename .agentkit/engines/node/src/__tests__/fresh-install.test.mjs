import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const AGENTKIT_SRC = resolve(import.meta.dirname, '..', '..', '..', '..');

function makeTmpProject() {
  const dir = resolve(
    tmpdir(),
    `agentkit-fresh-install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function copyAgentkitWithoutNodeModules(dest) {
  mkdirSync(dest, { recursive: true });
  const sourceStack = [AGENTKIT_SRC];
  while (sourceStack.length > 0) {
    const currentSource = sourceStack.pop();
    let entries = [];
    try {
      entries = readdirSync(currentSource, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.tmp') continue;

      const sourcePath = join(currentSource, entry.name);
      const rel = relative(AGENTKIT_SRC, sourcePath);
      const destPath = join(dest, rel);

      if (entry.isDirectory()) {
        mkdirSync(destPath, { recursive: true });
        sourceStack.push(sourcePath);
        continue;
      }

      mkdirSync(dirname(destPath), { recursive: true });
      try {
        cpSync(sourcePath, destPath, { force: true });
      } catch (error) {
        if (error?.code === 'ENOENT') continue;
        throw error;
      }
    }
  }
}

function hasNestedNodeModules(root) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules') return true;
      stack.push(join(current, entry.name));
    }
  }
  return false;
}

describe('fresh install (no node_modules)', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = makeTmpProject();
    mkdirSync(join(projectRoot, '.agentkit'), { recursive: true });
    copyAgentkitWithoutNodeModules(join(projectRoot, '.agentkit'));
    if (hasNestedNodeModules(join(projectRoot, '.agentkit'))) {
      throw new Error('Unexpected nested node_modules found in test fixture setup');
    }
  });

  afterEach(() => {
    if (projectRoot && existsSync(projectRoot)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
    projectRoot = undefined;
  });

  it(
    'auto-installs dependencies and runs sync --dry-run',
    { skip: process.platform === 'win32', timeout: 130_000 },
    () => {
      const cliPath = join(projectRoot, '.agentkit', 'engines', 'node', 'src', 'cli.mjs');
      const result = execFileSync('node', [cliPath, 'sync', '--dry-run', '--diff'], {
        encoding: 'utf-8',
        cwd: projectRoot,
        timeout: 120_000,
      });
      expect(result).toContain('[retort:sync]');
      expect(result).toContain('Dry-run');
      expect(
        existsSync(join(projectRoot, '.agentkit', 'node_modules', 'js-yaml', 'package.json'))
      ).toBe(true);
      expect(
        existsSync(join(projectRoot, '.agentkit', 'node_modules', 'ajv', 'package.json'))
      ).toBe(true);
      expect(
        existsSync(join(projectRoot, '.agentkit', 'node_modules', 'ajv-formats', 'package.json'))
      ).toBe(true);
    }
  );
});
