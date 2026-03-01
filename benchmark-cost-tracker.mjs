import { mkdirSync, writeFileSync, rmSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { recordCommand, initSession } from './.agentkit/engines/node/src/cost-tracker.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_ROOT = resolve(__dirname, '.benchmark-test');

// Safety assertion: never delete an unexpected path
if (!TEST_ROOT.endsWith('.benchmark-test')) {
  throw new Error(`Unexpected TEST_ROOT path: ${TEST_ROOT}`);
}

const AGENTKIT_ROOT = resolve(TEST_ROOT, '.agentkit');
const PROJECT_ROOT = resolve(TEST_ROOT, 'project');

// Setup
if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
mkdirSync(resolve(AGENTKIT_ROOT, 'logs', 'sessions'), { recursive: true });
mkdirSync(PROJECT_ROOT, { recursive: true });
writeFileSync(resolve(PROJECT_ROOT, '.agentkit-repo'), 'bench-repo');

console.log('Generating 1000 closed sessions...');
for (let i = 0; i < 1000; i++) {
  const session = initSession({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT });
  // Manually close it by writing a completed session object that matches production shape/format.
  const path = resolve(AGENTKIT_ROOT, 'logs', 'sessions', `session-${session.sessionId}.json`);
  const data = JSON.parse(JSON.stringify(session));
  data.status = 'completed';
  const endTime = new Date();
  data.endTime = endTime.toISOString();
  if (session.startTime) {
    const startTime = new Date(session.startTime);
    if (!Number.isNaN(startTime.getTime())) {
      data.durationMs = endTime.getTime() - startTime.getTime();
    }
  }
  if (data.durationMs == null) {
    data.durationMs = 0;
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

// --- Benchmark 1: Worst case — no active session (O(N) full scan) ---
console.log('\nBenchmarking recordCommand with 1000 closed sessions (Worst Case — O(N) scan)...');

// Clear any stale pointer so every iteration exercises the full O(N) scan path
const pointerPath = resolve(AGENTKIT_ROOT, 'logs', 'active-session-id');
if (existsSync(pointerPath)) {
  try { unlinkSync(pointerPath); } catch (err) { console.warn(`[benchmark] Failed to remove stale pointer: ${err.message}`); }
}

let start = process.hrtime.bigint();
const ITERATIONS = 100;

for (let i = 0; i < ITERATIONS; i++) {
  // No active session; triggers full directory scan
  recordCommand(AGENTKIT_ROOT, 'bench-cmd');
}

let end = process.hrtime.bigint();
let duration = Number(end - start) / 1e6; // ms
let avg = duration / ITERATIONS;

console.log(`Total time for ${ITERATIONS} iterations: ${duration.toFixed(2)}ms`);
console.log(`Average time per call: ${avg.toFixed(2)}ms`);

// --- Benchmark 2: Common case — 1 active session via pointer file (O(1) lookup) ---
console.log('\nBenchmarking recordCommand with 1 active session + pointer file (Common Case — O(1) lookup)...');

const activeSession = initSession({ agentkitRoot: AGENTKIT_ROOT, projectRoot: PROJECT_ROOT });

start = process.hrtime.bigint();

for (let i = 0; i < ITERATIONS; i++) {
  recordCommand(AGENTKIT_ROOT, 'bench-cmd');
}

end = process.hrtime.bigint();
duration = Number(end - start) / 1e6;
avg = duration / ITERATIONS;

console.log(`Total time for ${ITERATIONS} iterations: ${duration.toFixed(2)}ms`);
console.log(`Average time per call: ${avg.toFixed(2)}ms`);

// Log the active session ID for reference
console.log(`\nActive session used: ${activeSession.sessionId}`);

// Cleanup
rmSync(TEST_ROOT, { recursive: true, force: true });
