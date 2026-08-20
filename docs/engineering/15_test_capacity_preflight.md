# Test Capacity Preflight

If the full suite is failing and the failing set **moves between runs**, check host capacity
before you read a single stack trace. Two host limits produce failures that look exactly like
flaky application code, and neither says so in its own error message.

```bash
pnpm preflight:capacity
```

That is the whole check. It runs automatically as part of `pnpm test` and
`pnpm test:coverage`, and advisorily in CI.

---

## The two limits

### 1. Disk — ENOSPC presents as total breakage

The suite's fixture trees are a **steady-state working set of about 27 GiB**. Sampling free
space every 30 seconds through a full run shows it drop ~27 GiB below idle and then hold flat:
trees are created and reclaimed continuously, so this is not a leak and waiting does not help.

A run started with 17.4 GiB free produced `ENOSPC` ("No space left on device"), and the symptom
was that **every test file failed to load**. That reads as catastrophic breakage — a repository
that has somehow stopped compiling — rather than as a full disk. A run starting below roughly
30 GiB free cannot produce a valid result, so failure counts from such a run describe disk
state, not code state.

The related cleanup defect is recorded in [ADR-12](../architecture/decisions/12-test-suite-reliability.md):
`sync-integration.test.mjs` once stranded 126 full output trees in `%TEMP%` because a bare
`rmSync` threw on the first undeletable tree. That is fixed; the disk floor remains, because
the working set is inherent to the fixtures.

### 2. Memory commit — dead forks, with RAM apparently free

A full run forks a worker per test file. Committed memory across that fleet can exceed
**physical RAM plus the page file** even while physical RAM still looks free — Windows charges
commit at reservation time, not at first touch. When the commit limit is reached, forks die.

Observed symptoms:

- `ERR_DLOPEN_FAILED` loading `@rollup/rollup-win32-x64-msvc`, caused by
  "The paging file is too small for this operation to complete"
- `Worker exited unexpectedly` (a separate run)

Neither mentions memory pressure, and both point at a dependency or at Vitest.

### The two limits are coupled

A Windows page file configured with `InitialSize` below `MaximumSize` **grows on demand**, so
the commit limit is not static — it rises as Windows expands the file. Two consequences:

- Available commit read on its own **understates** headroom on a host whose page file has not
  grown yet. The preflight therefore counts pending growth
  (`MaximumSize - AllocatedBaseSize`) as available commit.
- That growth is paid for in **disk**, on the same volume the fixtures need. Measured on the
  development host in a single session: the page file expanded 8 → 24 GiB under commit
  pressure and free disk fell 19.9 → 8.4 GiB in step with it, then both recovered when it
  shrank back.

So a low-disk host cannot grow its way out of commit pressure, and a host that passes the disk
check at the start can fail it mid-run because the page file grew underneath it. The preflight
caps credited page-file growth at the **free disk headroom remaining above the 30 GiB fixture
floor** — growth is only usable to the extent the disk can absorb the larger file while still
leaving room for the fixture working set.

## Thresholds

| Check               | `full` profile | `ci` profile | Provenance                                                                       |
| ------------------- | -------------- | ------------ | -------------------------------------------------------------------------------- |
| Free disk           | 30 GiB         | 8 GiB        | Measured — 27 GiB steady-state working set plus margin                           |
| Available commit    | 12 GiB         | 4 GiB        | **Provisional** — no sampled peak-commit figure exists; see below                |
| Page-file max < RAM | advisory       | advisory     | Structural — the configured maximum, not the current size, caps the commit limit |

"Available commit" is measured as free commit **plus** whatever the page file can still grow
into, capped by **free disk headroom remaining above the 30 GiB fixture floor** (since growth
consumes the same volume the fixtures need). Judging it on the instantaneous `FreeVirtualMemory`
alone produces false alarms: a page file sitting at its initial size reports almost no headroom
right up until Windows expands it.

The disk floor is empirical and can be trusted. The commit floor is not measured the same way:
there is no equivalent sampled figure for peak commit during a run. 12 GiB is chosen as the
smallest value that still passes on an idle host with a reasonable page file while failing fast
on a host already carrying a large committed load. **Tighten it when a real peak-commit sample
exists** — and record the sample here when you take one.

Profiles are selected automatically: `ci` when `$CI` is set, `full` otherwise. The `ci` profile
reports but never blocks, because hosted runners have far less disk, no Windows commit limit to
speak of, and the suite is green there.

### Overrides

| Variable                            | Effect                                    |
| ----------------------------------- | ----------------------------------------- |
| `RETORT_PREFLIGHT_SKIP=1`           | Skip the check entirely                   |
| `RETORT_PREFLIGHT_ENFORCE=1`        | Make the `ci` profile blocking            |
| `RETORT_PREFLIGHT_MIN_FREE_DISK_GB` | Override the free-disk floor (GiB)        |
| `RETORT_PREFLIGHT_MIN_COMMIT_GB`    | Override the available-commit floor (GiB) |

Flags: `--profile=full|ci`, `--json`, `--warn-only`, `--help`.

## Diagnostic commands

All PowerShell 7 (`pwsh`). The preflight runs these for you — reach for them when you want the
raw numbers or are diagnosing a host the preflight cannot read.

**Free disk, and whether it is still draining:**

```powershell
Get-PSDrive C | Select-Object Used, Free
# Sample through a run — free space should drop ~27 GiB and then hold flat.
while ($true) { "{0:u} {1:N1} GiB" -f (Get-Date), ((Get-PSDrive C).Free / 1GB); Start-Sleep 30 }
```

A figure that keeps falling instead of flattening is a leak. Note that the page file growing
also consumes free space (see above), so check that before concluding the suite is leaking.

**Where the space actually goes.** Do not assume — measure. Sizing the top-level entries of a
directory on Windows:

```powershell
$root = $env:TEMP   # or a repo path
Get-ChildItem -LiteralPath $root -Force | ForEach-Object {
  $b = if ($_.PSIsContainer) {
    (Get-ChildItem -LiteralPath $_.FullName -Force -Recurse -File -EA SilentlyContinue |
      Measure-Object Length -Sum).Sum
  } else { $_.Length }
  [pscustomobject]@{ MiB = [math]::Round($b / 1MB, 1); Name = $_.Name }
} | Sort-Object MiB -Descending | Select-Object -First 20
```

Baseline measured on the development host (2026-08-10), for scale:

| Location                                | Size                               |
| --------------------------------------- | ---------------------------------- |
| `%TEMP%` total                          | 11.6 GiB (3,619 top-level entries) |
| — of which agent/tooling scratch        | 5.6 GiB                            |
| — of which **Retort fixture trees**     | **0.02 GiB** (26 trees)            |
| `repos\retort` checkout (all worktrees) | 0.8 GiB                            |
| `repos\retort-worktrees`                | 0.3 GiB                            |
| all `node_modules` under both           | 0.9 GiB                            |

**This project is a small part of any large shortfall.** Stranded fixture roots were the cause
once ([ADR-12](../architecture/decisions/12-test-suite-reliability.md), 126 trees in `%TEMP%`),
but that cleanup defect is fixed and they no longer accumulate — reaching for them again wastes
the search. A double-digit GiB gap is almost certainly something else on the volume.

**Commit limit and remaining commit** (KiB — `TotalVirtualMemorySize` _is_ the commit limit,
physical plus page file):

```powershell
Get-CimInstance Win32_OperatingSystem |
  Select-Object TotalVirtualMemorySize, FreeVirtualMemory, TotalVisibleMemorySize
```

**Page file: configured range, current size, and actual peak use** (MiB):

```powershell
# What it is configured to do. No rows here means the page file is system-managed.
Get-CimInstance Win32_PageFileSetting | Select-Object Name, InitialSize, MaximumSize
# What it is doing right now.
Get-CimInstance Win32_PageFileUsage | Select-Object Name, AllocatedBaseSize, CurrentUsage, PeakUsage
Get-CimInstance Win32_ComputerSystem | Select-Object AutomaticManagedPagefile, TotalPhysicalMemory
```

Read these together — they answer different questions, and the trap is treating one as the
other:

- `AllocatedBaseSize` is the page file's size **right now**, not its configuration. It moves.
  On the development host it was observed at 8, 17.1 and 24 GiB within a single session.
- `MaximumSize` is what actually caps the commit limit. `AutomaticManagedPagefile: false` means
  "not system-managed" — it does **not** mean fixed. A file with `InitialSize` 8192 and
  `MaximumSize` 24576 is a growable file, and calling it fixed at 8 GiB is wrong.
- A **peak far below the allocation** — 160 MiB against 8 GiB, on the host where this was first
  traced — means the ceiling being hit is the **commit limit**, not the page file's working
  size. The file looks idle because processes died at reservation time, before touching pages.
  Raising the maximum therefore buys real headroom even though it appears unused; shrinking it
  because "nothing uses it" makes the failure more frequent.

## Recommended page file configuration

On a Windows development host running this suite, set the page file to **system-managed**, or
set its **maximum** to no less than physical RAM — and leave disk free for it to grow into,
since growth and fixtures compete for the same volume.

The host where these failures were first traced had 32 GiB of RAM behind an 8 GiB page file: a
40 GiB commit limit for a workload that forks one worker per test file alongside a browser and
an editor. It has since been reconfigured to 8 GiB initial / 24 GiB maximum, which is why
`AllocatedBaseSize` now varies between runs.

Set it under: **System Properties → Advanced → Performance → Settings → Advanced → Virtual
memory**. Changing it requires a reboot.

The preflight raises this as an advisory (never a failure) whenever the page file's **maximum**
is below RAM, since the right value depends on the host and on what else runs there. A file that
simply has not grown yet is not flagged.

## Symptom → cause table

| Symptom                                                         | Likely cause                         | First check                               |
| --------------------------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| Every test file fails to load; suite looks completely broken    | `ENOSPC` — disk exhausted            | `Get-PSDrive C`, then size the volume     |
| `ERR_DLOPEN_FAILED` on a native module; "paging file too small" | Commit limit reached                 | `Win32_OperatingSystem.FreeVirtualMemory` |
| `Worker exited unexpectedly`                                    | Commit limit reached                 | `Win32_OperatingSystem.FreeVirtualMemory` |
| Failing **set** changes between runs of identical code          | Capacity, or I/O-contention timeouts | `pnpm preflight:capacity`, then ADR-12    |

A moving failure set is the signature shared by all of these. Establish capacity first;
only then is a red result worth reading.

## Related

- [ADR-12 — Restore Test Suite Reliability](../architecture/decisions/12-test-suite-reliability.md)
- [ADR-11 — Eliminate Sync Churn](../architecture/decisions/11-eliminate-sync-churn.md)
- `scripts/preflight-capacity.mjs` — implementation
- `scripts/__tests__/preflight-capacity.test.mjs` — tests (`pnpm test:start`)
