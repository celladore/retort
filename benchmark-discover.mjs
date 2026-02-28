import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { runDiscover } from './.agentkit/engines/node/src/discover.mjs';

const BENCH_DIR = 'bench-temp';
const DEPTH = 5;
const DIRS_PER_LEVEL = 3;
const FILES_PER_DIR = 10;

function createTree(dir, depth) {
  if (depth === 0) return;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  for (let i = 0; i < FILES_PER_DIR; i++) {
    writeFileSync(join(dir, `file-${i}.ts`), 'content');
  }

  for (let i = 0; i < DIRS_PER_LEVEL; i++) {
    createTree(join(dir, `dir-${i}`), depth - 1);
  }
}

console.log('Generating benchmark files...');
if (existsSync(BENCH_DIR)) rmSync(BENCH_DIR, { recursive: true, force: true });
createTree(BENCH_DIR, DEPTH);
console.log('Files generated.');

async function runBenchmark() {
  const start = performance.now();
  // Mock console.log to avoid noise
  const originalLog = console.log;
  console.log = () => {};

  try {
    await runDiscover({
      agentkitRoot: process.cwd(),
      projectRoot: BENCH_DIR,
      flags: { output: 'json' }
    });
  } finally {
    console.log = originalLog;
  }

  const end = performance.now();
  console.log(`Execution time: ${(end - start).toFixed(2)}ms`);
}

runBenchmark().then(() => {
  rmSync(BENCH_DIR, { recursive: true, force: true });
}).catch(err => {
  console.error(err);
  rmSync(BENCH_DIR, { recursive: true, force: true });
});
