/**
 * Lints the GitHub Actions workflow templates and the generated output for
 * expression mistakes that GitHub rejects at the *file* level.
 *
 * A workflow with an invalid expression does not fail a job — GitHub refuses to
 * load the file and reports "This run likely failed because of a workflow file
 * issue" with no annotations, no job log, and a 0s duration. `coverage-report`
 * and `dependency-audit` shipped that way and failed 40/40 runs across every
 * branch before anyone noticed, because a non-blocking check that never runs
 * looks a lot like a non-blocking check that passed.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PROJECT_ROOT = resolve(AGENTKIT_ROOT, '..');

/** Every `.yml` directly inside a workflows directory, as `{ label, path }`. */
function workflowsIn(root, relDir) {
  const dir = resolve(root, relDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => ({ label: `${relDir}/${name}`, path: resolve(dir, name) }));
}

const TEMPLATE_WORKFLOWS = workflowsIn(AGENTKIT_ROOT, 'templates/github/workflows');
const GENERATED_WORKFLOWS = workflowsIn(PROJECT_ROOT, '.github/workflows');

/**
 * Returns the `if:` lines that sit at job level (4-space indent) — where the
 * available contexts are github/needs/vars/inputs only. Step-level `if:` keys
 * are indented 8 spaces and may use the full function set.
 */
function jobLevelIfLines(content) {
  return content
    .split('\n')
    .map((line, i) => ({ line, number: i + 1 }))
    .filter(({ line }) => /^ {4}if:/.test(line));
}

/**
 * Functions that need a checked-out workspace and are therefore only valid in a
 * step-level `if:`. At job level GitHub rejects the entire workflow file.
 */
const WORKSPACE_ONLY_FUNCTIONS = ['hashFiles'];

describe('workflow templates', () => {
  it('finds workflow templates to lint', () => {
    expect(TEMPLATE_WORKFLOWS.length).toBeGreaterThan(0);
  });

  it.each(TEMPLATE_WORKFLOWS)(
    'does not call a workspace-only function in a job-level if: — $label',
    ({ path, label }) => {
      const offenders = jobLevelIfLines(readFileSync(path, 'utf-8')).filter(({ line }) =>
        WORKSPACE_ONLY_FUNCTIONS.some((fn) => line.includes(`${fn}(`))
      );

      expect(
        offenders,
        `${label} uses a workspace-only function in a job-level if:. GitHub rejects the ` +
          `whole file with "Unrecognized function", so the workflow never runs. Move the ` +
          `guard to a step-level if:, or gate the job at generation time.\n` +
          offenders.map(({ number, line }) => `  line ${number}: ${line.trim()}`).join('\n')
      ).toEqual([]);
    }
  );
});

describe('generated workflows', () => {
  it('finds generated workflows to lint', () => {
    expect(GENERATED_WORKFLOWS.length).toBeGreaterThan(0);
  });

  it.each(GENERATED_WORKFLOWS)(
    'does not call a workspace-only function in a job-level if: — $label',
    ({ path, label }) => {
      const offenders = jobLevelIfLines(readFileSync(path, 'utf-8')).filter(({ line }) =>
        WORKSPACE_ONLY_FUNCTIONS.some((fn) => line.includes(`${fn}(`))
      );

      expect(offenders, `${label} would be rejected by GitHub at load time`).toEqual([]);
    }
  );

  it.each(GENERATED_WORKFLOWS)('parses as YAML with jobs and a trigger — $label', ({ path }) => {
    const parsed = yaml.load(readFileSync(path, 'utf-8'));

    expect(parsed).toBeTypeOf('object');
    expect(Object.keys(parsed.jobs || {}).length).toBeGreaterThan(0);
    // `on:` parses to the boolean true under YAML 1.1 — check the key, not the value
    expect(Object.keys(parsed).some((key) => key === 'on' || key === true)).toBe(true);
  });

  it.each(GENERATED_WORKFLOWS)(
    'names only jobs that exist in every needs: list — $label',
    ({ path, label }) => {
      const jobs = yaml.load(readFileSync(path, 'utf-8')).jobs || {};
      const defined = new Set(Object.keys(jobs));

      const dangling = [];
      for (const [jobId, job] of Object.entries(jobs)) {
        const needs = Array.isArray(job?.needs) ? job.needs : job?.needs ? [job.needs] : [];
        for (const need of needs) {
          if (!defined.has(need)) dangling.push(`${jobId} needs ${need}`);
        }
      }

      // A needs: entry pointing at a conditionally-generated job that was not
      // emitted is the other way a workflow file becomes unloadable
      expect(dangling, `${label} has dangling needs: references`).toEqual([]);
    }
  );
});
