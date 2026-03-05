import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');
const PRETTIER_BIN = resolve(AGENTKIT_ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

// ---------------------------------------------------------------------------
// Prettier formatting — verify project files pass prettier check
//
// Extracted to its own file to prevent linter auto-organizers from stripping
// the child_process import when it appears alongside unrelated validate tests.
// ---------------------------------------------------------------------------
describe('prettier check', () => {
  it('all project files pass prettier formatting', { timeout: 90_000 }, () => {
    // Retry once on transient failures (exit code 2 = prettier internal error,
    // can occur when parallel tests create/delete files mid-scan)
    let prettierResult;
    for (let attempt = 0; attempt < 2; attempt++) {
      prettierResult = spawnSync(process.execPath, [PRETTIER_BIN, '--check', '.'], {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
      });
      if (prettierResult.status === 0 || prettierResult.status === 1) break;
    }
    const output = prettierResult.stdout + prettierResult.stderr;
    const unformatted = output
      .split('\n')
      .filter((l) => l.includes('[warn]'))
      .join('\n');
    expect(
      prettierResult.status,
      `Prettier check failed (exit ${prettierResult.status}). Files needing formatting:\n${unformatted}\nFull output:\n${output.slice(0, 500)}`
    ).toBe(0);
  });
});
