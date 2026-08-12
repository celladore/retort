#!/usr/bin/env node
/**
 * Capacity preflight for full test-suite runs.
 *
 * Two host limits produce failures that look like flaky application code:
 *
 *   1. Disk. The suite's fixture trees are a steady-state working set of about
 *      27 GiB (created and reclaimed continuously — not a leak). A run started
 *      below ~30 GiB free hits ENOSPC, and the symptom is that *every* test file
 *      fails to load, which reads as catastrophic breakage rather than a full
 *      disk.
 *   2. Memory commit. A full run forks a worker per test file. Committed memory
 *      across that fleet can exceed physical RAM plus the page file even while
 *      physical RAM still looks free. When it does, forks die — observed as
 *      ERR_DLOPEN_FAILED ("The paging file is too small for this operation to
 *      complete") or "Worker exited unexpectedly".
 *
 * Both are invisible in the failure output, so this check runs first and names
 * the shortfall explicitly. See docs/engineering/15_test_capacity_preflight.md
 * and ADR-12 (docs/architecture/decisions/12-test-suite-reliability.md).
 *
 * Usage:
 *   node scripts/preflight-capacity.mjs [--profile=full|ci] [--json] [--warn-only]
 *
 * Environment:
 *   RETORT_PREFLIGHT_SKIP=1              skip entirely (exit 0)
 *   RETORT_PREFLIGHT_ENFORCE=1           make the ci profile fail instead of warn
 *   RETORT_PREFLIGHT_MIN_FREE_DISK_GB=n  override the free-disk floor
 *   RETORT_PREFLIGHT_MIN_COMMIT_GB=n     override the available-commit floor
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GIB = 1024 ** 3;

/**
 * Thresholds are GiB and deliberately per-profile.
 *
 * `full` targets a developer host running the whole suite. The disk floor is
 * measured: sampling free space every 30s through a full run shows it dropping
 * ~27 GiB below idle and then holding flat, so 30 GiB is that working set plus
 * a small margin.
 *
 * The commit floor is *not* measured the same way — there is no equivalent
 * sampled figure for peak commit. 12 GiB is chosen as the smallest value that
 * still passes on an idle host with a reasonable page file while failing fast
 * on a host already carrying a large committed load. Treat it as provisional
 * and tighten it when a real peak-commit sample exists.
 *
 * `ci` is a lighter variant: hosted runners have far less disk, no Windows
 * commit limit to speak of, and the suite is green there. It reports but does
 * not block unless RETORT_PREFLIGHT_ENFORCE=1.
 */
export const PROFILES = {
  full: { minFreeDiskGb: 30, minCommitGb: 12, blocking: true },
  ci: { minFreeDiskGb: 8, minCommitGb: 4, blocking: false },
};

export function parseArgs(argv = []) {
  const opts = { profile: null, json: false, warnOnly: false, help: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--warn-only') opts.warnOnly = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--profile=')) opts.profile = arg.slice('--profile='.length);
  }
  return opts;
}

/** Positive finite number, or `fallback` when the value is absent or unusable. */
function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function resolveConfig(opts = {}, env = process.env) {
  const requested = opts.profile ?? (env.CI ? 'ci' : 'full');
  const profileName = requested in PROFILES ? requested : 'full';
  const profile = PROFILES[profileName];

  return {
    profile: profileName,
    unknownProfile: !(requested in PROFILES) ? requested : null,
    minFreeDiskGb: numberOr(env.RETORT_PREFLIGHT_MIN_FREE_DISK_GB, profile.minFreeDiskGb),
    minCommitGb: numberOr(env.RETORT_PREFLIGHT_MIN_COMMIT_GB, profile.minCommitGb),
    // A non-blocking profile only fails when explicitly told to; a blocking
    // profile can still be downgraded with --warn-only.
    blocking: profile.blocking ? !opts.warnOnly : env.RETORT_PREFLIGHT_ENFORCE === '1',
  };
}

// -- Probes -------------------------------------------------------------------

/**
 * Free space on every distinct volume the suite writes to: the OS temp
 * directory (fixture trees) and the repository itself (sync output, coverage).
 */
export function probeDisk(targets, { platform = process.platform, statfs = fs.statfsSync } = {}) {
  const volumes = [];
  const seen = new Map();

  for (const { label, dir } of targets) {
    let stats;
    try {
      stats = statfs(dir);
    } catch (err) {
      volumes.push({ label, dir, error: err.message });
      continue;
    }

    // statfs gives no mount point, so identify the volume by drive letter on
    // Windows and by size fingerprint elsewhere. A false merge only collapses
    // two identical-size filesystems into one line of output.
    const key =
      platform === 'win32'
        ? path.parse(path.resolve(dir)).root.toUpperCase()
        : `${stats.blocks}:${stats.bsize}`;

    const existing = seen.get(key);
    if (existing) {
      existing.labels.push(label);
      continue;
    }

    const volume = {
      key,
      labels: [label],
      dir,
      freeGb: (stats.bavail * stats.bsize) / GIB,
      totalGb: (stats.blocks * stats.bsize) / GIB,
    };
    seen.set(key, volume);
    volumes.push(volume);
  }

  return volumes;
}

function runPowerShell(script, { spawn = spawnSync } = {}) {
  for (const shell of ['pwsh', 'powershell']) {
    const result = spawn(shell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      timeout: 20_000,
      windowsHide: true,
    });
    if (result.error || result.status !== 0 || !result.stdout?.trim()) continue;
    try {
      return JSON.parse(result.stdout);
    } catch {
      // Try the next shell rather than failing the whole preflight on a
      // malformed payload from one of them.
    }
  }
  return null;
}

const CIM_QUERY = [
  '$ErrorActionPreference = "Stop";',
  '@{',
  '  os = (Get-CimInstance Win32_OperatingSystem |',
  '    Select-Object TotalVirtualMemorySize, FreeVirtualMemory, TotalVisibleMemorySize);',
  '  pageFiles = @(Get-CimInstance Win32_PageFileUsage |',
  '    Select-Object Name, AllocatedBaseSize, CurrentUsage, PeakUsage);',
  '  pageFileSettings = @(Get-CimInstance Win32_PageFileSetting |',
  '    Select-Object Name, InitialSize, MaximumSize);',
  '  system = (Get-CimInstance Win32_ComputerSystem |',
  '    Select-Object AutomaticManagedPagefile, TotalPhysicalMemory)',
  '} | ConvertTo-Json -Depth 4 -Compress',
].join(' ');

/**
 * Windows commit accounting. Win32_OperatingSystem reports the commit limit
 * (physical + page file) as TotalVirtualMemorySize and the remaining commit as
 * FreeVirtualMemory, both in KiB. Win32_PageFileUsage reports MiB.
 *
 * `AllocatedBaseSize` is the page file's size *right now*, not its configuration.
 * A page file with InitialSize < MaximumSize grows on demand, so the commit
 * limit is not static: it rises as Windows expands the file, and the amount it
 * can still rise is (MaximumSize - AllocatedBaseSize). Reading only the
 * allocation makes a growable page file look like a hard ceiling, which is
 * wrong in both directions — it understates real headroom, and it misreports a
 * correctly configured host as misconfigured. Win32_PageFileSetting supplies the
 * configured range; a system-managed page file has no entry there.
 */
export function probeCommit({ platform = process.platform, query = runPowerShell } = {}) {
  if (platform !== 'win32') {
    return {
      supported: false,
      reason: `commit accounting is Windows-specific (platform: ${platform})`,
    };
  }

  const raw = query(CIM_QUERY);
  if (!raw?.os) {
    return { supported: false, reason: 'could not read Win32_OperatingSystem via pwsh/powershell' };
  }

  const kib = (value) => (Number(value) * 1024) / GIB;
  const mib = (value) => (Number(value) * 1024 * 1024) / GIB;
  const settings = new Map(
    (raw.pageFileSettings ?? []).map((s) => [
      s.Name,
      { initialGb: mib(s.InitialSize), maximumGb: mib(s.MaximumSize) },
    ])
  );

  const pageFiles = (raw.pageFiles ?? []).map((pf) => {
    const setting = settings.get(pf.Name);
    const allocatedGb = mib(pf.AllocatedBaseSize);
    return {
      name: pf.Name,
      allocatedGb,
      currentGb: mib(pf.CurrentUsage),
      peakGb: mib(pf.PeakUsage),
      initialGb: setting?.initialGb ?? null,
      // No setting entry means system-managed: treat the current allocation as
      // the maximum rather than inventing a growth allowance we cannot verify.
      maximumGb: setting?.maximumGb ?? allocatedGb,
      growable: setting ? setting.maximumGb > allocatedGb : false,
    };
  });

  const sum = (key) => pageFiles.reduce((total, pf) => total + pf[key], 0);
  const pageFileAllocatedGb = sum('allocatedGb');
  const pageFileMaximumGb = sum('maximumGb');

  return {
    supported: true,
    commitLimitGb: kib(raw.os.TotalVirtualMemorySize),
    commitAvailableGb: kib(raw.os.FreeVirtualMemory),
    physicalGb: kib(raw.os.TotalVisibleMemorySize),
    automaticManagedPageFile: raw.system?.AutomaticManagedPagefile === true,
    pageFiles,
    pageFileAllocatedGb,
    pageFileMaximumGb,
    // How much the commit limit can still rise by growing the page file.
    pageFileGrowthGb: Math.max(0, pageFileMaximumGb - pageFileAllocatedGb),
    pageFilePeakGb: pageFiles.reduce((max, pf) => Math.max(max, pf.peakGb), 0),
  };
}

export function collectFacts({ platform = process.platform, repoRoot, tmpdir = os.tmpdir() } = {}) {
  const root = repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  return {
    platform,
    workers: os.availableParallelism?.() ?? os.cpus().length,
    disk: probeDisk(
      [
        { label: 'fixtures (TEMP)', dir: tmpdir },
        { label: 'repository', dir: root },
      ],
      { platform }
    ),
    commit: probeCommit({ platform }),
  };
}

// -- Evaluation ---------------------------------------------------------------

const gb = (value) => `${value.toFixed(1)} GiB`;

/**
 * Turn raw facts into check results. Pure — the probes above are the only
 * platform-dependent part, which keeps this testable with synthetic facts.
 */
export function evaluateCapacity(facts, config) {
  const checks = [];

  for (const volume of facts.disk) {
    const where = volume.labels ? volume.labels.join(' + ') : volume.label;
    if (volume.error) {
      checks.push({
        id: 'disk',
        status: 'unknown',
        title: `Free disk — ${where}`,
        detail: `could not read ${volume.dir}: ${volume.error}`,
      });
      continue;
    }

    const short = config.minFreeDiskGb - volume.freeGb;
    checks.push({
      id: 'disk',
      status: short > 0 ? 'fail' : 'pass',
      title: `Free disk — ${where}`,
      detail:
        short > 0
          ? `${gb(volume.freeGb)} free on ${volume.dir}, need ${gb(config.minFreeDiskGb)} — short by ${gb(short)}`
          : `${gb(volume.freeGb)} free on ${volume.dir} (floor ${gb(config.minFreeDiskGb)})`,
      remedy:
        short > 0
          ? [
              'The suite creates ~27 GiB of fixture trees and reclaims them continuously.',
              'Below the floor a run hits ENOSPC and EVERY test file fails to load — that is',
              'a full disk, not broken code.',
              '',
              'Measure before deleting. This project is a small part of any large shortfall:',
              'the checkout, every worktree and all node_modules together measured ~2 GiB, and',
              'fixture roots are transient (26 trees / 0.02 GiB when last sampled). Stranded',
              'fixtures were the cause once, but that cleanup defect is fixed — assuming them',
              'again wastes the search. A big gap is usually something else on the volume.',
              'Sizing commands: docs/engineering/15_test_capacity_preflight.md',
            ].join('\n')
          : null,
    });
  }

  const { commit } = facts;
  if (!commit.supported) {
    checks.push({
      id: 'commit',
      status: 'unknown',
      title: 'Memory commit headroom',
      detail: commit.reason,
    });
  } else {
    // Growing the page file raises the commit limit, so pending growth is real
    // headroom — but only to the extent the disk can absorb the larger file.
    // The two limits are coupled: a low-disk host cannot grow its way out of
    // commit pressure, and a growing page file eats the space the fixtures need.
    const freeDiskGb = Math.min(
      ...facts.disk.filter((volume) => !volume.error).map((volume) => volume.freeGb),
      Infinity
    );
    const usableGrowthGb = Math.min(commit.pageFileGrowthGb, freeDiskGb);
    const effectiveGb = commit.commitAvailableGb + usableGrowthGb;
    const short = config.minCommitGb - effectiveGb;

    checks.push({
      id: 'commit',
      status: short > 0 ? 'fail' : 'pass',
      title: 'Memory commit headroom',
      detail:
        `${gb(commit.commitAvailableGb)} available of a ${gb(commit.commitLimitGb)} commit limit ` +
        `(${gb(commit.physicalGb)} RAM + ${gb(commit.pageFileAllocatedGb)} page file)` +
        (usableGrowthGb > 0.05
          ? `, plus ${gb(usableGrowthGb)} the page file can still grow into = ${gb(effectiveGb)} effective`
          : commit.pageFileGrowthGb > 0.05
            ? `; its ${gb(commit.pageFileGrowthGb)} of configured growth is unusable — only ${gb(freeDiskGb)} of disk left`
            : ' and the page file is at its configured maximum') +
        `, floor ${gb(config.minCommitGb)}` +
        (short > 0 ? ` — short by ${gb(short)}` : ''),
      remedy:
        short > 0
          ? [
              `A full run forks up to ${facts.workers} workers. When committed memory across the`,
              'fleet exceeds the commit limit, forks die with ERR_DLOPEN_FAILED ("The paging file',
              'is too small for this operation to complete") or "Worker exited unexpectedly" —',
              'even while physical RAM still looks free. Close committed-memory consumers',
              '(browsers, containers, IDEs), or raise the page file maximum — but note that',
              'growing it consumes the same volume the fixtures need.',
            ].join('\n')
          : null,
    });

    // Structural advisory: what caps the commit limit is the page file's
    // configured MAXIMUM, not its current size. A file that has not grown yet is
    // not misconfigured. A peak far below the allocation is the tell that the
    // ceiling being hit is the commit limit, not the page file's working size.
    if (!commit.automaticManagedPageFile && commit.pageFileMaximumGb < commit.physicalGb) {
      const shape = commit.pageFileGrowthGb > 0.05 ? 'grows to at most' : 'is fixed at';
      checks.push({
        id: 'pagefile',
        status: 'advice',
        title: 'Page file maximum is smaller than RAM',
        detail:
          `${shape} ${gb(commit.pageFileMaximumGb)} against ${gb(commit.physicalGb)} of RAM ` +
          `(currently ${gb(commit.pageFileAllocatedGb)}, peak use ${gb(commit.pageFilePeakGb)})`,
        remedy: [
          'A peak far below the allocation means the ceiling being hit is the commit limit,',
          'not the page file working size — so raising the maximum buys real headroom even',
          'though the file looks underused. Set it to system-managed, or set the maximum to',
          'at least RAM size, leaving disk for it to grow into:',
          '  System Properties > Advanced > Performance > Settings > Advanced > Virtual memory',
        ].join('\n'),
      });
    }
  }

  const failed = checks.filter((check) => check.status === 'fail');
  return { checks, failed, ok: failed.length === 0 };
}

// -- Reporting ----------------------------------------------------------------

const ICONS = { pass: '  ok  ', fail: ' FAIL ', unknown: '  ??  ', advice: ' note ' };

export function formatHuman(result, config) {
  const lines = [`Capacity preflight (profile: ${config.profile})`, ''];

  for (const check of result.checks) {
    lines.push(`[${ICONS[check.status]}] ${check.title}`);
    lines.push(`         ${check.detail}`);
    if (check.remedy) {
      for (const line of check.remedy.split('\n')) lines.push(`         ${line}`);
    }
    lines.push('');
  }

  if (result.ok) {
    lines.push('Capacity is sufficient for a full suite run.');
  } else if (config.blocking) {
    lines.push(
      'Refusing to start the full suite: a run below these floors cannot produce a valid',
      'result — it fails in a way that looks like flaky tests. Set RETORT_PREFLIGHT_SKIP=1',
      'to override.'
    );
  } else {
    lines.push('Capacity is below the floor; continuing because this profile is advisory.');
  }

  return lines.join('\n');
}

// -- Entry point --------------------------------------------------------------

const HELP = `Capacity preflight for full test-suite runs.

  node scripts/preflight-capacity.mjs [options]

Options:
  --profile=full|ci   Threshold set (default: ci when $CI is set, else full)
  --json              Emit machine-readable output
  --warn-only         Report but never fail
  -h, --help          Show this help

Environment:
  RETORT_PREFLIGHT_SKIP=1              Skip the check entirely
  RETORT_PREFLIGHT_ENFORCE=1           Make the ci profile blocking
  RETORT_PREFLIGHT_MIN_FREE_DISK_GB=n  Override the free-disk floor (GiB)
  RETORT_PREFLIGHT_MIN_COMMIT_GB=n     Override the available-commit floor (GiB)
`;

export function main(argv = process.argv.slice(2), env = process.env) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (env.RETORT_PREFLIGHT_SKIP === '1') {
    process.stdout.write('Capacity preflight skipped (RETORT_PREFLIGHT_SKIP=1).\n');
    return 0;
  }

  const config = resolveConfig(opts, env);
  if (config.unknownProfile) {
    process.stderr.write(`Unknown profile "${config.unknownProfile}" — falling back to "full".\n`);
  }

  const facts = collectFacts();
  const result = evaluateCapacity(facts, config);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ config, facts, ...result }, null, 2)}\n`);
  } else {
    const write = result.ok ? process.stdout : process.stderr;
    write.write(`${formatHuman(result, config)}\n`);
  }

  return result.ok || !config.blocking ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  process.exitCode = main();
}
