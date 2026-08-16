import { describe, it, expect } from 'vitest';

import {
  PROFILES,
  parseArgs,
  resolveConfig,
  probeDisk,
  probeCommit,
  evaluateCapacity,
  formatHuman,
  main,
} from '../preflight-capacity.mjs';

const GIB = 1024 ** 3;

/** statfs stub returning `freeGb` free of `totalGb` total, in 4 KiB blocks. */
function makeStatfs(freeGb, totalGb = 500) {
  const bsize = 4096;
  return () => ({
    bsize,
    blocks: Math.round((totalGb * GIB) / bsize),
    bfree: Math.round((freeGb * GIB) / bsize),
    bavail: Math.round((freeGb * GIB) / bsize),
  });
}

/** Facts fixture with everything comfortably above the `full` floors. */
function makeFacts(overrides = {}) {
  return {
    platform: 'win32',
    workers: 16,
    disk: [
      { key: 'C:\\', labels: ['fixtures (TEMP)'], dir: 'C:\\Temp', freeGb: 120, totalGb: 500 },
    ],
    commit: {
      supported: true,
      commitLimitGb: 64,
      commitAvailableGb: 30,
      physicalGb: 32,
      automaticManagedPageFile: true,
      pageFiles: [{ name: 'C:\\pagefile.sys', allocatedGb: 32, currentGb: 2, peakGb: 3 }],
      pageFileAllocatedGb: 32,
      pageFileMaximumGb: 32,
      pageFileGrowthGb: 0,
      pageFilePeakGb: 3,
    },
    ...overrides,
  };
}

/** Facts with a commit shortfall, closed by `growthGb` of page-file growth. */
function makeGrowableFacts({ availableGb, growthGb, freeDiskGb }) {
  return makeFacts({
    disk: [{ key: 'C:\\', labels: ['repository'], dir: 'C:\\r', freeDiskGb, freeGb: freeDiskGb }],
    commit: {
      ...makeFacts().commit,
      automaticManagedPageFile: false,
      commitAvailableGb: availableGb,
      pageFileAllocatedGb: 8,
      pageFileMaximumGb: 8 + growthGb,
      pageFileGrowthGb: growthGb,
    },
  });
}

const findCheck = (result, id) => result.checks.find((check) => check.id === id);

describe('parseArgs', () => {
  it('should default every flag to off when no arguments are given', () => {
    // Arrange / Act
    const opts = parseArgs([]);

    // Assert
    expect(opts).toEqual({ profile: null, json: false, warnOnly: false, help: false });
  });

  it('should read the profile name and boolean flags from argv', () => {
    // Arrange / Act
    const opts = parseArgs(['--profile=ci', '--json', '--warn-only']);

    // Assert
    expect(opts).toEqual({ profile: 'ci', json: true, warnOnly: true, help: false });
  });
});

describe('resolveConfig', () => {
  it('should select the ci profile when CI is set in the environment', () => {
    // Arrange / Act
    const config = resolveConfig({}, { CI: 'true' });

    // Assert
    expect(config.profile).toBe('ci');
    expect(config.minFreeDiskGb).toBe(PROFILES.ci.minFreeDiskGb);
  });

  it('should select the full profile outside CI', () => {
    // Arrange / Act
    const config = resolveConfig({}, {});

    // Assert
    expect(config.profile).toBe('full');
    expect(config.minFreeDiskGb).toBe(PROFILES.full.minFreeDiskGb);
    expect(config.blocking).toBe(true);
  });

  it('should let an explicit profile flag override the CI environment', () => {
    // Arrange / Act
    const config = resolveConfig({ profile: 'full' }, { CI: 'true' });

    // Assert
    expect(config.profile).toBe('full');
  });

  it('should fall back to the full profile and report an unknown profile name', () => {
    // Arrange / Act
    const config = resolveConfig({ profile: 'enormous' }, {});

    // Assert
    expect(config.profile).toBe('full');
    expect(config.unknownProfile).toBe('enormous');
  });

  it('should apply numeric threshold overrides from the environment', () => {
    // Arrange / Act
    const config = resolveConfig(
      {},
      { RETORT_PREFLIGHT_MIN_FREE_DISK_GB: '45', RETORT_PREFLIGHT_MIN_COMMIT_GB: '20' }
    );

    // Assert
    expect(config.minFreeDiskGb).toBe(45);
    expect(config.minCommitGb).toBe(20);
  });

  it('should ignore an unparseable threshold override rather than disabling the floor', () => {
    // Arrange / Act
    const config = resolveConfig({}, { RETORT_PREFLIGHT_MIN_FREE_DISK_GB: 'plenty' });

    // Assert
    expect(config.minFreeDiskGb).toBe(PROFILES.full.minFreeDiskGb);
  });

  it('should make the ci profile blocking only when enforcement is requested', () => {
    // Arrange / Act
    const advisory = resolveConfig({}, { CI: '1' });
    const enforced = resolveConfig({}, { CI: '1', RETORT_PREFLIGHT_ENFORCE: '1' });

    // Assert
    expect(advisory.blocking).toBe(false);
    expect(enforced.blocking).toBe(true);
  });

  it('should downgrade the full profile to non-blocking with --warn-only', () => {
    // Arrange / Act
    const config = resolveConfig({ warnOnly: true }, {});

    // Assert
    expect(config.blocking).toBe(false);
  });
});

describe('probeDisk', () => {
  it('should collapse two directories on the same Windows volume into one entry', () => {
    // Arrange
    const targets = [
      { label: 'fixtures (TEMP)', dir: 'C:\\Users\\dev\\AppData\\Local\\Temp' },
      { label: 'repository', dir: 'C:\\repos\\retort' },
    ];

    // Act
    const volumes = probeDisk(targets, { platform: 'win32', statfs: makeStatfs(40) });

    // Assert
    expect(volumes).toHaveLength(1);
    expect(volumes[0].labels).toEqual(['fixtures (TEMP)', 'repository']);
    expect(volumes[0].freeGb).toBeCloseTo(40, 1);
  });

  it('should keep directories on different Windows volumes separate', () => {
    // Arrange
    const targets = [
      { label: 'fixtures (TEMP)', dir: 'D:\\Temp' },
      { label: 'repository', dir: 'C:\\repos\\retort' },
    ];

    // Act
    const volumes = probeDisk(targets, { platform: 'win32', statfs: makeStatfs(40) });

    // Assert
    expect(volumes).toHaveLength(2);
  });

  it('should record the error instead of throwing when a path cannot be stat-ed', () => {
    // Arrange
    const statfs = () => {
      throw new Error('ENOENT: no such file or directory');
    };

    // Act
    const volumes = probeDisk([{ label: 'repository', dir: '/gone' }], {
      platform: 'linux',
      statfs,
    });

    // Assert
    expect(volumes[0].error).toMatch(/ENOENT/);
  });
});

describe('probeCommit', () => {
  it('should report commit accounting as unsupported on non-Windows platforms', () => {
    // Arrange / Act
    const commit = probeCommit({ platform: 'linux' });

    // Assert
    expect(commit.supported).toBe(false);
    expect(commit.reason).toMatch(/Windows-specific/);
  });

  it('should convert CIM units into GiB', () => {
    // Arrange — Win32_OperatingSystem reports KiB, Win32_PageFileUsage MiB.
    const query = () => ({
      os: {
        TotalVirtualMemorySize: 51_173_024,
        FreeVirtualMemory: 9_607_512,
        TotalVisibleMemorySize: 33_231_568,
      },
      pageFiles: [
        { Name: 'C:\\pagefile.sys', AllocatedBaseSize: 8192, CurrentUsage: 160, PeakUsage: 160 },
      ],
      pageFileSettings: [{ Name: 'C:\\pagefile.sys', InitialSize: 8192, MaximumSize: 24_576 }],
      system: { AutomaticManagedPagefile: false, TotalPhysicalMemory: 34_029_125_632 },
    });

    // Act
    const commit = probeCommit({ platform: 'win32', query });

    // Assert
    expect(commit.supported).toBe(true);
    expect(commit.commitLimitGb).toBeCloseTo(48.8, 1);
    expect(commit.commitAvailableGb).toBeCloseTo(9.16, 1);
    expect(commit.physicalGb).toBeCloseTo(31.69, 1);
    expect(commit.pageFileAllocatedGb).toBeCloseTo(8, 2);
    expect(commit.pageFilePeakGb).toBeCloseTo(0.156, 2);
    expect(commit.automaticManagedPageFile).toBe(false);
  });

  it('should read the growth range from the page-file setting, not the allocation', () => {
    // Arrange — allocated 8 GiB now, configured to grow to 24 GiB.
    const query = () => ({
      os: {
        TotalVirtualMemorySize: 41_600_000,
        FreeVirtualMemory: 600_000,
        TotalVisibleMemorySize: 33_231_568,
      },
      pageFiles: [
        { Name: 'C:\\pagefile.sys', AllocatedBaseSize: 8192, CurrentUsage: 0, PeakUsage: 0 },
      ],
      pageFileSettings: [{ Name: 'C:\\pagefile.sys', InitialSize: 8192, MaximumSize: 24_576 }],
      system: { AutomaticManagedPagefile: false },
    });

    // Act
    const commit = probeCommit({ platform: 'win32', query });

    // Assert
    expect(commit.pageFileMaximumGb).toBeCloseTo(24, 1);
    expect(commit.pageFileGrowthGb).toBeCloseTo(16, 1);
    expect(commit.pageFiles[0].growable).toBe(true);
  });

  it('should treat a page file with no setting entry as already at its maximum', () => {
    // Arrange — system-managed page files have no Win32_PageFileSetting row.
    const query = () => ({
      os: {
        TotalVirtualMemorySize: 41_600_000,
        FreeVirtualMemory: 600_000,
        TotalVisibleMemorySize: 33_231_568,
      },
      pageFiles: [
        { Name: 'C:\\pagefile.sys', AllocatedBaseSize: 8192, CurrentUsage: 0, PeakUsage: 0 },
      ],
      pageFileSettings: [],
      system: { AutomaticManagedPagefile: true },
    });

    // Act
    const commit = probeCommit({ platform: 'win32', query });

    // Assert — no invented growth allowance we cannot verify.
    expect(commit.pageFileMaximumGb).toBeCloseTo(8, 2);
    expect(commit.pageFileGrowthGb).toBe(0);
    expect(commit.pageFiles[0].growable).toBe(false);
  });

  it('should degrade to unsupported when the shell query yields nothing', () => {
    // Arrange / Act
    const commit = probeCommit({ platform: 'win32', query: () => null });

    // Assert
    expect(commit.supported).toBe(false);
    expect(commit.reason).toMatch(/pwsh|powershell/);
  });
});

describe('evaluateCapacity', () => {
  const fullConfig = resolveConfig({}, {});

  it('should pass when disk and commit are both above the floors', () => {
    // Arrange / Act
    const result = evaluateCapacity(makeFacts(), fullConfig);

    // Assert
    expect(result.ok).toBe(true);
    expect(result.failed).toHaveLength(0);
  });

  it('should fail and name the disk shortfall when free space is below the floor', () => {
    // Arrange
    const facts = makeFacts({
      disk: [
        { key: 'C:\\', labels: ['fixtures (TEMP)'], dir: 'C:\\Temp', freeGb: 17.4, totalGb: 500 },
      ],
    });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(result.ok).toBe(false);
    expect(findCheck(result, 'disk').status).toBe('fail');
    expect(findCheck(result, 'disk').detail).toContain('short by 12.6 GiB');
    expect(findCheck(result, 'disk').remedy).toContain('ENOSPC');
  });

  it('should fail and name the commit shortfall when available commit is below the floor', () => {
    // Arrange
    const facts = makeFacts({
      commit: { ...makeFacts().commit, commitAvailableGb: 3 },
    });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(result.ok).toBe(false);
    expect(findCheck(result, 'commit').status).toBe('fail');
    expect(findCheck(result, 'commit').detail).toContain('short by 9.0 GiB');
    expect(findCheck(result, 'commit').remedy).toContain('ERR_DLOPEN_FAILED');
  });

  it('should advise on a page-file maximum smaller than RAM without failing the run', () => {
    // Arrange — the originally reported host: 8 GiB cap, 160 MiB peak, 32 GiB RAM.
    const facts = makeFacts({
      commit: {
        ...makeFacts().commit,
        automaticManagedPageFile: false,
        pageFileAllocatedGb: 8,
        pageFileMaximumGb: 8,
        pageFileGrowthGb: 0,
        pageFilePeakGb: 0.156,
      },
    });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(result.ok).toBe(true);
    expect(findCheck(result, 'pagefile').status).toBe('advice');
    expect(findCheck(result, 'pagefile').detail).toContain('is fixed at');
    expect(findCheck(result, 'pagefile').remedy).toContain('system-managed');
  });

  it('should judge the page file by its maximum, not its current allocation', () => {
    // Arrange — only 8 GiB allocated right now, but configured to reach 40 GiB,
    // which is above RAM. A file that has not grown yet is not misconfigured.
    const facts = makeFacts({
      commit: {
        ...makeFacts().commit,
        automaticManagedPageFile: false,
        pageFileAllocatedGb: 8,
        pageFileMaximumGb: 40,
        pageFileGrowthGb: 32,
      },
    });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(findCheck(result, 'pagefile')).toBeUndefined();
  });

  it('should describe a growable page file as growing rather than fixed', () => {
    // Arrange
    const facts = makeFacts({
      commit: {
        ...makeFacts().commit,
        automaticManagedPageFile: false,
        pageFileAllocatedGb: 8,
        pageFileMaximumGb: 24,
        pageFileGrowthGb: 16,
      },
    });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(findCheck(result, 'pagefile').detail).toContain('grows to at most');
  });

  it('should not raise the page-file advisory when the page file is system-managed', () => {
    // Arrange
    const facts = makeFacts({
      commit: {
        ...makeFacts().commit,
        automaticManagedPageFile: true,
        pageFileAllocatedGb: 8,
        pageFileMaximumGb: 8,
      },
    });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(findCheck(result, 'pagefile')).toBeUndefined();
  });

  it('should count pending page-file growth as available commit', () => {
    // Arrange — 2.5 GiB free commit is below the floor on its own, but the page
    // file can still grow 16 GiB and the disk can absorb it.
    const facts = makeGrowableFacts({ availableGb: 2.5, growthGb: 16, freeDiskGb: 120 });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(findCheck(result, 'commit').status).toBe('pass');
    expect(findCheck(result, 'commit').detail).toContain('18.5 GiB effective');
  });

  it('should not credit page-file growth the disk cannot absorb', () => {
    // Arrange — same commit position, but only 3 GiB of disk to grow into.
    const facts = makeGrowableFacts({ availableGb: 2.5, growthGb: 16, freeDiskGb: 3 });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert — the two limits are coupled; a low-disk host cannot grow out of
    // commit pressure.
    expect(findCheck(result, 'commit').status).toBe('fail');
    expect(findCheck(result, 'commit').detail).toContain('5.5 GiB effective');
  });

  it('should say so when a page file is already at its configured maximum', () => {
    // Arrange
    const facts = makeGrowableFacts({ availableGb: 0.6, growthGb: 0, freeDiskGb: 120 });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(findCheck(result, 'commit').status).toBe('fail');
    expect(findCheck(result, 'commit').detail).toContain('at its configured maximum');
  });

  it('should mark commit as unknown rather than failing when it cannot be measured', () => {
    // Arrange
    const facts = makeFacts({ commit: { supported: false, reason: 'not Windows' } });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(findCheck(result, 'commit').status).toBe('unknown');
    expect(result.ok).toBe(true);
  });

  it('should mark disk as unknown rather than failing when the volume cannot be read', () => {
    // Arrange
    const facts = makeFacts({ disk: [{ label: 'repository', dir: '/gone', error: 'EACCES' }] });

    // Act
    const result = evaluateCapacity(facts, fullConfig);

    // Assert
    expect(findCheck(result, 'disk').status).toBe('unknown');
    expect(result.ok).toBe(true);
  });

  it('should pass the same facts under the ci profile that fail under full', () => {
    // Arrange
    const facts = makeFacts({
      disk: [{ key: '/', labels: ['repository'], dir: '/home/runner', freeGb: 20, totalGb: 70 }],
    });

    // Act
    const underFull = evaluateCapacity(facts, resolveConfig({}, {}));
    const underCi = evaluateCapacity(facts, resolveConfig({}, { CI: '1' }));

    // Assert
    expect(underFull.ok).toBe(false);
    expect(underCi.ok).toBe(true);
  });
});

describe('formatHuman', () => {
  it('should state that capacity is sufficient when every check passes', () => {
    // Arrange
    const config = resolveConfig({}, {});
    const result = evaluateCapacity(makeFacts(), config);

    // Act
    const output = formatHuman(result, config);

    // Assert
    expect(output).toContain('Capacity is sufficient');
    expect(output).toContain('profile: full');
  });

  it('should explain the refusal and the override when a blocking profile fails', () => {
    // Arrange
    const config = resolveConfig({}, {});
    const result = evaluateCapacity(
      makeFacts({
        disk: [{ key: 'C:\\', labels: ['repository'], dir: 'C:\\r', freeGb: 5, totalGb: 500 }],
      }),
      config
    );

    // Act
    const output = formatHuman(result, config);

    // Assert
    expect(output).toContain('Refusing to start the full suite');
    expect(output).toContain('RETORT_PREFLIGHT_SKIP=1');
  });

  it('should say it is continuing when an advisory profile fails', () => {
    // Arrange
    const config = resolveConfig({}, { CI: '1' });
    const result = evaluateCapacity(
      makeFacts({
        disk: [{ key: '/', labels: ['repository'], dir: '/r', freeGb: 1, totalGb: 70 }],
      }),
      config
    );

    // Act
    const output = formatHuman(result, config);

    // Assert
    expect(output).toContain('continuing because this profile is advisory');
  });
});

describe('main', () => {
  it('should exit zero without probing when the skip flag is set', () => {
    // Arrange / Act
    const code = main([], { RETORT_PREFLIGHT_SKIP: '1' });

    // Assert
    expect(code).toBe(0);
  });

  it('should exit zero for --help', () => {
    // Arrange / Act
    const code = main(['--help'], {});

    // Assert
    expect(code).toBe(0);
  });
});
