import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { listTasks } from './.agentkit/engines/node/src/task-protocol.mjs';

const BENCH_ROOT = '.bench-list-tasks';
const TASKS_DIR = join(BENCH_ROOT, '.claude', 'state', 'tasks');
const TOTAL_TASKS = 1000;

function setupTasks() {
  if (existsSync(BENCH_ROOT)) {
    rmSync(BENCH_ROOT, { recursive: true, force: true });
  }
  mkdirSync(TASKS_DIR, { recursive: true });

  for (let i = 0; i < TOTAL_TASKS; i++) {
    const task = {
      id: `task-bench-${String(i).padStart(4, '0')}`,
      title: `Bench task ${i}`,
      status: i % 7 === 0 ? 'completed' : 'working',
      priority: ['P0', 'P1', 'P2', 'P3'][i % 4],
      delegator: 'benchmark',
      assignees: ['team-quality'],
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      updatedAt: new Date(Date.now() - i * 500).toISOString(),
      messages: [],
      artifacts: [],
      blockedBy: [],
      dependsOn: [],
    };

    writeFileSync(
      join(TASKS_DIR, `${task.id}.json`),
      JSON.stringify(task, null, 2) + '\n',
      'utf-8'
    );
  }
}

async function runBenchmark() {
  setupTasks();

  const start = performance.now();
  const result = await listTasks(BENCH_ROOT);
  const end = performance.now();

  const durationMs = end - start;
  const perTaskMs = durationMs / Math.max(result.tasks.length, 1);

  console.log(`Tasks read: ${result.tasks.length}`);
  console.log(`Total time: ${durationMs.toFixed(2)}ms`);
  console.log(`Avg per task: ${perTaskMs.toFixed(4)}ms`);

  rmSync(BENCH_ROOT, { recursive: true, force: true });
}

runBenchmark().catch((error) => {
  console.error(error);
  rmSync(BENCH_ROOT, { recursive: true, force: true });
  process.exitCode = 1;
});
