<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Copilot domain-specific instructions. -->
<!-- Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot -->

# Copilot Instructions — Performance Testing

Apply these rules when writing performance tests, benchmarks, or load tests
in **{{projectName}}**.

## When to Write Performance Tests

Write a performance test when:

- A feature touches a hot code path (rendering, data processing, network I/O).
- A PR introduces a new algorithm or data structure with non-trivial complexity.
- A database query is added or modified that may affect response times.
- A change is made to caching, pagination, or batching logic.

## Benchmark Organisation

- Keep benchmarks in a dedicated `benchmarks/` or `bench/` directory.
- Name benchmark files `<module>.bench.ts` / `<module>.bench.js` (TypeScript/JavaScript),
  `<module>.bench.rs` (Rust), or `<module>.perf.test.<ext>`.
- Never mix benchmarks with unit tests — run them separately.

## Writing Benchmarks

{{#if hasLanguageTypeScript}}

### TypeScript / JavaScript

```typescript
// Using Vitest bench or tinybench
bench('process 1000 items', () => {
  processItems(dataset);
});
```

Include a baseline comparison (`bench.todo` or commented reference) so
regressions are visible in the diff.
{{/if}}
{{#if hasLanguageRust}}

### Rust

```rust
use criterion::{criterion_group, criterion_main, Criterion};

fn bench_process_items(c: &mut Criterion) {
    let dataset = make_dataset(1000);
    c.bench_function("process 1000 items", |b| {
        b.iter(|| process_items(&dataset));
    });
}

criterion_group!(benches, bench_process_items);
criterion_main!(benches);
```

Use [Criterion.rs](https://github.com/bheisler/criterion.rs) for stable, statistically rigorous benchmarks.
{{/if}}
{{#if hasLanguagePython}}

### Python

```python
# Using pytest-benchmark
def test_process_items_perf(benchmark):
    benchmark(process_items, dataset)
```

{{/if}}

## Performance Budgets

{{#if testingCoverage}}Performance regression thresholds must be defined alongside coverage targets.{{/if}}

- Define acceptable latency/throughput targets in the benchmark file as a
  comment or configuration constant.
- Set `--ci` mode thresholds so CI fails on regressions exceeding 10%.
- Document the hardware/environment in which benchmarks were recorded.

## Load Testing

{{#if hasPerformanceTesting}}- Load testing tool: **{{testingPerformanceTesting}}**.{{/if}}
{{#unless hasPerformanceTesting}}- Use `k6`, `artillery`, or equivalent for HTTP load testing.{{/unless}}

- Load tests live in `tests/load/` or `load-tests/`.
- Define realistic scenarios based on actual production traffic patterns.
- Include ramp-up, steady-state, and spike scenarios.
- Record and compare results — do not discard baseline data.

## Profiling

- Profile before optimising — never optimise speculatively.
- Use the language's native profiler:
  - Node.js: `--prof` + `node --prof-process`
  - Rust: `cargo flamegraph`
  - Python: `cProfile` + `snakeviz`
- Include a brief profiling summary in the PR description for performance PRs.

## CI Integration

- Run benchmarks on a dedicated CI runner with consistent hardware.
- Compare against the `main` branch baseline and fail if regression exceeds
  threshold.
- Store benchmark results as CI artefacts for historical comparison.
