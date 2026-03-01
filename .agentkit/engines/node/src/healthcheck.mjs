/**
 * AgentKit Forge — Healthcheck Command
 * Pre-flight validation: checks tooling availability, dependency installation,
 * and runs build/test/lint to report overall repo health.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { execCommand, commandExists, formatDuration, isValidCommand } from './runner.mjs';
import { appendEvent, loadState, saveState } from './orchestrator.mjs';

// ---------------------------------------------------------------------------
// Tooling checks
// ---------------------------------------------------------------------------

const TOOL_CHECKS = [
  { name: 'node', cmd: 'node --version' },
  { name: 'npm', cmd: 'npm --version' },
  { name: 'pnpm', cmd: 'pnpm --version' },
  { name: 'git', cmd: 'git --version' },
  { name: 'dotnet', cmd: 'dotnet --version' },
  { name: 'cargo', cmd: 'cargo --version' },
  { name: 'python', cmd: 'python3 --version' },
  { name: 'go', cmd: 'go version' },
  { name: 'docker', cmd: 'docker --version' },
  { name: 'terraform', cmd: 'terraform version' },
  { name: 'gh', cmd: 'gh --version' },
];

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Run repo healthcheck.
 * @param {object} opts
 * @param {string} opts.agentkitRoot
 * @param {string} opts.projectRoot
 * @param {object} opts.flags
 * @returns {object}
 */
export async function runHealthcheck({ agentkitRoot, projectRoot, flags = {} }) {
  console.log('[agentkit:healthcheck] Running pre-flight validation...');
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    tools: [],
    stacks: [],
    agentkit: {},
    overallHealth: 'HEALTHY',
  };

  // --- Step 1: Check installed tools ---
  console.log('--- Installed Tools ---');
  for (const tool of TOOL_CHECKS) {
    const found = commandExists(tool.name);
    let version = '';
    if (found) {
      const r = execCommand(tool.cmd, { cwd: projectRoot, timeout: 10_000 });
      version = r.stdout.trim().split('\n')[0];
    }
    const status = found ? '✓' : '·';
    if (found) {
      console.log(`  ${status} ${tool.name.padEnd(12)} ${version}`);
    }
    results.tools.push({ name: tool.name, found, version });
  }
  console.log('');

  // --- Step 2: Check AgentKit setup ---
  console.log('--- AgentKit Setup ---');
  const hasMarker = existsSync(resolve(projectRoot, '.agentkit-repo'));
  const hasState = existsSync(resolve(projectRoot, '.claude', 'state', 'orchestrator.json'));
  const hasCommands = existsSync(resolve(projectRoot, '.claude', 'commands'));
  const hasHooks = existsSync(resolve(projectRoot, '.claude', 'hooks'));

  results.agentkit = { hasMarker, hasState, hasCommands, hasHooks };

  console.log(`  ${hasMarker ? '✓' : '✗'} .agentkit-repo marker`);
  console.log(`  ${hasState ? '✓' : '✗'} orchestrator state`);
  console.log(`  ${hasCommands ? '✓' : '✗'} slash commands`);
  console.log(`  ${hasHooks ? '✓' : '✗'} lifecycle hooks`);
  console.log('');

  // --- Step 3: Detect and check tech stacks ---
  const teamsPath = resolve(agentkitRoot, 'spec', 'teams.yaml');
  if (existsSync(teamsPath)) {
    const spec = yaml.load(readFileSync(teamsPath, 'utf-8'));
    const stacks = spec.techStacks || [];

    for (const stack of stacks) {
      const detected = (stack.detect || []).some(marker => {
        if (marker.startsWith('*')) {
          try { return readdirSync(projectRoot).some(f => f.endsWith(marker.replace('*', ''))); }
          catch { return false; }
        }
        return existsSync(resolve(projectRoot, marker));
      });

      if (!detected) continue;

      console.log(`--- Stack: ${stack.name} ---`);
      const stackResult = { name: stack.name, checks: [] };

      // Try each command
      const checks = [
        { name: 'build', cmd: stack.buildCommand },
        { name: 'test', cmd: stack.testCommand },
        { name: 'lint', cmd: stack.linter ? `${stack.linter} .` : null },
      ];

      for (const check of checks) {
        if (!check.cmd) continue;
        if (!isValidCommand(check.cmd)) {
          console.warn(`  ${check.name.padEnd(12)} SKIP (invalid command rejected)`);
          stackResult.checks.push({ name: check.name, command: check.cmd, status: 'SKIP', exitCode: -1, durationMs: 0 });
          continue;
        }
        process.stdout.write(`  ${check.name.padEnd(12)} `);
        const r = execCommand(check.cmd, { cwd: projectRoot, timeout: 120_000 });
        const status = r.exitCode === 0 ? 'PASS' : 'FAIL';
        console.log(`${status}  (${formatDuration(r.durationMs)})`);

        if (status === 'FAIL') results.overallHealth = 'UNHEALTHY';

        stackResult.checks.push({
          name: check.name,
          command: check.cmd,
          status,
          exitCode: r.exitCode,
          durationMs: r.durationMs,
        });
      }

      results.stacks.push(stackResult);
      console.log('');
    }
  }

  // --- Summary ---
  console.log(`=== Health: ${results.overallHealth} ===`);

  // Update orchestrator state
  try {
    const state = await loadState(projectRoot);
    state.lastHealthcheck = results.timestamp;
    state.healthStatus = results.overallHealth;
    await saveState(projectRoot, state);
    await appendEvent(projectRoot, 'healthcheck_completed', {
      overallHealth: results.overallHealth,
      toolsFound: results.tools.filter(t => t.found).length,
      stacksChecked: results.stacks.length,
    });
  } catch (err) { console.warn(`[agentkit:healthcheck] State update failed: ${err?.message ?? String(err)}`); }

  return results;
}
