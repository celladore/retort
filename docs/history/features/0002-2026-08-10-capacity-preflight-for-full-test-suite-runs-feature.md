# Capacity preflight for full test-suite runs Launch - Historical Summary

**Launched**: 2026-08-10
**PR**: [#607](https://github.com/JustAGhosT/retort/pull/607)
**Feature Type**: New Feature

## Feature Overview

A preflight check that measures free disk and memory-commit headroom before a full test-suite
run and refuses to start when either is below a floor, naming the shortfall explicitly.

## User Problem Solved

Two host limits produced failures indistinguishable from flaky application code, and neither
named itself in its own error output:

- **Disk.** The suite's fixture trees are a steady-state working set of ~27 GiB, created and
  reclaimed continuously. A run started with 17.4 GiB free hit `ENOSPC`, and the symptom was
  that _every_ test file failed to load — which reads as catastrophic breakage rather than as a
  full disk.
- **Memory commit.** A full run forks a worker per test file; committed memory across that
  fleet can exceed physical RAM plus the page file even while physical RAM still looks free.
  Forks then die with `ERR_DLOPEN_FAILED` ("The paging file is too small for this operation to
  complete") or `Worker exited unexpectedly`.

Both invalidate the run rather than degrading it: failure counts from such a run describe host
state, not code state. The practical cost was developer time spent debugging application code
for a host condition.

## Implementation Details

### Architecture

A single cross-platform Node script. Platform probing is isolated in two functions
(`probeDisk`, `probeCommit`) so that threshold evaluation (`evaluateCapacity`) stays pure and
testable against synthetic host facts. Node rather than PowerShell keeps one implementation for
Windows, Linux and macOS, and sidesteps the UTF-8 BOM requirement that generated `.ps1` files
in this repo carry for Windows PowerShell 5.1.

### Components

- **`scripts/preflight-capacity.mjs`**: probes, threshold evaluation, human and `--json`
  reporting, exit code. Two profiles — `full` (developer host, blocking) and `ci` (hosted
  runner, advisory) — selected automatically from `$CI` or forced with `--profile=`.
- **`scripts/__tests__/preflight-capacity.test.mjs`**: 29 tests covering argument parsing,
  profile and threshold resolution, volume de-duplication, CIM unit conversion, and each check
  outcome. Run by the root Vitest config (`pnpm test:start`).
- **Windows commit probe**: `Win32_OperatingSystem` supplies the commit limit
  (`TotalVirtualMemorySize`) and remaining commit (`FreeVirtualMemory`) in KiB;
  `Win32_PageFileUsage` and `Win32_ComputerSystem` supply page-file size, peak use, and whether
  it is system-managed; `Win32_PageFileSetting` supplies the configured `InitialSize`/
  `MaximumSize` range. Queried through `pwsh`, falling back to `powershell`.

A page file with `InitialSize` below `MaximumSize` grows on demand, so the commit limit is not
static. The probe credits unclaimed growth toward available commit — capped by free disk
**headroom remaining above the fixture floor** (since page-file growth consumes the same volume
the fixtures need) — and judges page-file configuration by its maximum rather than its current
allocation. An earlier revision read only `AllocatedBaseSize` and raised a false failure on a
host with 16 GiB of unclaimed growth.

### API Changes

New scripts: `pnpm preflight:capacity`, `pnpm test:coverage`. `pnpm test` now runs the
preflight before delegating to the engine suite.

Environment overrides: `RETORT_PREFLIGHT_SKIP`, `RETORT_PREFLIGHT_ENFORCE`,
`RETORT_PREFLIGHT_MIN_FREE_DISK_GB`, `RETORT_PREFLIGHT_MIN_COMMIT_GB`.

### Database Changes

None.

## User Experience

`pnpm test` either proceeds as before or stops with a report naming the shortfall, the
mechanism behind it, and what to free. Failures are actionable rather than diagnostic puzzles.

### UI Changes

CLI output only. Each check reports pass / fail / unknown, with a remedy block on failure. A
page file whose configured **maximum** is below physical RAM raises an advisory that never fails
the run.

### Documentation

- `docs/engineering/15_test_capacity_preflight.md` — thresholds, their provenance, PowerShell
  diagnostic commands, page-file recommendation, and a symptom-to-cause table.
- ADR-12 revision (2026-08-10) — the two headroom limits recorded as decision 7.

## Rollout Plan

Wired into the local full-suite entry points immediately; advisory in CI from the same commit.

### Phasing

- **Phase 1**: blocking locally under the `full` profile; advisory in CI under `ci`.
- **Phase 2**: tighten the commit floor once a sampled peak-commit figure exists, and decide
  whether CI enforcement is worth turning on (`RETORT_PREFLIGHT_ENFORCE=1`).

### Monitoring

The CI step prints runner capacity on every `Test` job, which builds a record of hosted-runner
headroom over time without blocking anything.

## Results

The check correctly refuses to start on the development host where the original failures were
traced, which currently sits below both floors.

### Usage Statistics

Not tracked — a local developer tool.

### User Feedback

None yet.

## Future Enhancements

- Sample peak commit through a full run and replace the provisional 12 GiB floor with a
  measured one.
- Consider sampling free disk during the run to distinguish the steady-state working set from
  a genuine leak automatically, rather than by manual inspection.

## Related Work

- [ADR-12 — Restore Test Suite Reliability](../../architecture/decisions/12-test-suite-reliability.md)
- [ADR-11 — Eliminate Sync Churn](../../architecture/decisions/11-eliminate-sync-churn.md)
- The 2026-08-08 ADR-12 revision, which fixed the cleanup defect that stranded 126 fixture
  trees in `%TEMP%`. This feature addresses the working set that remains after that fix.

---

**Product Manager**: JustAGhosT
**Tech Lead**: JustAGhosT
**Status**: Live
