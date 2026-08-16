#!/usr/bin/env node
/**
 * Run the quarantined test files (ADR-12 decision 5).
 *
 * Quarantined files are excluded from the blocking `Test` job. They still have
 * to run somewhere, or a quarantine becomes deletion by another name — this is
 * that somewhere, invoked by the non-blocking `Quarantined Tests` CI job.
 *
 * An empty registry is the healthy state and exits 0 without invoking Vitest,
 * which would otherwise fail with "No test files found".
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadQuarantineRegistry, quarantinedFiles } from './test-quarantine.mjs';

const agentkitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Decide what, if anything, to run.
 *
 * @param {{ entries: Array<Record<string, unknown>> }} registry
 * @returns {{ shouldRun: boolean, files: string[], argv: string[] }}
 */
export function quarantineRunPlan(registry) {
  const files = quarantinedFiles(registry);
  return {
    shouldRun: files.length > 0,
    files,
    // Reporters are left at the config defaults so the quarantine run produces
    // its own artifact alongside the main one.
    argv: ['run', ...files],
  };
}

function main() {
  const registry = loadQuarantineRegistry(path.join(agentkitRoot, 'test-quarantine.json'));
  const plan = quarantineRunPlan(registry);

  if (!plan.shouldRun) {
    process.stdout.write('No quarantined tests — nothing to run.\n');
    return 0;
  }

  process.stdout.write(`Running ${plan.files.length} quarantined test file(s):\n`);
  for (const file of plan.files) process.stdout.write(`  - ${file}\n`);

  const vitest = path.join(agentkitRoot, 'node_modules', 'vitest', 'vitest.mjs');
  const result = spawnSync(process.execPath, [vitest, ...plan.argv], {
    cwd: agentkitRoot,
    stdio: 'inherit',
    // Without this the config would exclude the very files we are trying to run.
    env: { ...process.env, RETORT_TEST_QUARANTINE: 'off' },
  });

  return result.status ?? 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
