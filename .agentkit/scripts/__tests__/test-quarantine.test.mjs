import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { quarantineRunPlan } from '../run-quarantined-tests.mjs';
import {
  loadQuarantineRegistry,
  parseQuarantineRegistry,
  quarantinedFiles,
  validateQuarantineRegistry,
} from '../test-quarantine.mjs';

const agentkitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registryPath = path.join(agentkitRoot, 'test-quarantine.json');

function makeEntry(overrides = {}) {
  return {
    file: 'engines/node/src/__tests__/example.test.mjs',
    reason: 'Times out intermittently under parallel load on Windows',
    issue: 'https://github.com/phoenixvc/retort/issues/999',
    quarantinedOn: '2026-08-10',
    ...overrides,
  };
}

describe('parseQuarantineRegistry', () => {
  it('should parse a registry with no quarantined files', () => {
    // Act
    const registry = parseQuarantineRegistry('{"entries": []}');

    // Assert
    expect(registry.entries).toEqual([]);
  });

  it('should throw on malformed JSON rather than degrading to an empty list', () => {
    // Assert — degrading would run quarantined files in the blocking suite.
    expect(() => parseQuarantineRegistry('{not json')).toThrow(/not valid JSON/);
  });

  it('should require an entries array', () => {
    // Assert
    expect(() => parseQuarantineRegistry('{}')).toThrow(/"entries" array/);
    expect(() => parseQuarantineRegistry('[]')).toThrow(/must contain a JSON object/);
  });

  it('should reject an entry without a usable file path', () => {
    // Assert
    expect(() => parseQuarantineRegistry('{"entries":[{}]}')).toThrow(/\.file must be a non-empty/);
    expect(() => parseQuarantineRegistry('{"entries":[{"file":"  "}]}')).toThrow(
      /\.file must be a non-empty/
    );
  });

  it('should reject absolute paths and paths escaping .agentkit', () => {
    // Assert
    expect(() => parseQuarantineRegistry('{"entries":[{"file":"/etc/a.test.mjs"}]}')).toThrow(
      /must be relative/
    );
    expect(() => parseQuarantineRegistry('{"entries":[{"file":"C:/a.test.mjs"}]}')).toThrow(
      /must be relative/
    );
    expect(() => parseQuarantineRegistry('{"entries":[{"file":"../../a.test.mjs"}]}')).toThrow(
      /must not escape/
    );
  });
});

describe('quarantinedFiles', () => {
  it('should return normalised relative paths for exclusion', () => {
    // Arrange
    const registry = { entries: [{ file: 'engines\\node\\a.test.mjs' }, { file: 'b.test.mjs' }] };

    // Act / Assert
    expect(quarantinedFiles(registry)).toEqual(['engines/node/a.test.mjs', 'b.test.mjs']);
  });
});

describe('loadQuarantineRegistry', () => {
  it('should treat a missing registry as nothing quarantined', () => {
    // Act
    const registry = loadQuarantineRegistry(path.join(agentkitRoot, 'no-such-registry.json'));

    // Assert
    expect(registry.entries).toEqual([]);
  });
});

describe('validateQuarantineRegistry', () => {
  const options = { fileExists: () => true, today: '2026-08-10' };

  it('should accept a fully documented entry', () => {
    // Act
    const result = validateQuarantineRegistry({ entries: [makeEntry()] }, options);

    // Assert
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it('should reject an entry with no tracking issue', () => {
    // Act
    const missing = validateQuarantineRegistry(
      { entries: [makeEntry({ issue: undefined })] },
      options
    );
    const malformed = validateQuarantineRegistry(
      { entries: [makeEntry({ issue: 'ask Bob' })] },
      options
    );

    // Assert — a quarantine without an owner never gets fixed.
    expect(missing.problems.map((p) => p.code)).toEqual(['quarantine-untracked']);
    expect(malformed.problems.map((p) => p.code)).toEqual(['quarantine-untracked']);
  });

  it('should accept a short issue reference as well as a URL', () => {
    // Act
    const result = validateQuarantineRegistry({ entries: [makeEntry({ issue: '#584' })] }, options);

    // Assert
    expect(result.ok).toBe(true);
  });

  it('should require a substantive reason', () => {
    // Act
    const result = validateQuarantineRegistry(
      { entries: [makeEntry({ reason: 'flaky' })] },
      options
    );

    // Assert
    expect(result.problems.map((p) => p.code)).toEqual(['quarantine-unexplained']);
  });

  it('should require a sane quarantine date', () => {
    // Act
    const badFormat = validateQuarantineRegistry(
      { entries: [makeEntry({ quarantinedOn: '10-08-2026' })] },
      options
    );
    const future = validateQuarantineRegistry(
      { entries: [makeEntry({ quarantinedOn: '2099-01-01' })] },
      options
    );

    // Assert
    expect(badFormat.problems.map((p) => p.code)).toEqual(['quarantine-undated']);
    expect(future.problems.map((p) => p.code)).toEqual(['quarantine-undated']);
  });

  it('should flag an entry whose file no longer exists', () => {
    // Act — otherwise a deleted test stays "quarantined" forever.
    const result = validateQuarantineRegistry(
      { entries: [makeEntry()] },
      { ...options, fileExists: () => false }
    );

    // Assert
    expect(result.problems.map((p) => p.code)).toEqual(['quarantine-stale']);
  });

  it('should flag duplicate entries for the same file', () => {
    // Act
    const result = validateQuarantineRegistry({ entries: [makeEntry(), makeEntry()] }, options);

    // Assert
    expect(result.problems.map((p) => p.code)).toEqual(['quarantine-duplicate']);
  });
});

describe('quarantineRunPlan', () => {
  it('should skip the Vitest invocation when nothing is quarantined', () => {
    // Act — an empty run would otherwise fail with "No test files found".
    const plan = quarantineRunPlan({ entries: [] });

    // Assert
    expect(plan.shouldRun).toBe(false);
    expect(plan.files).toEqual([]);
  });

  it('should run exactly the quarantined files', () => {
    // Act
    const plan = quarantineRunPlan({ entries: [makeEntry(), makeEntry({ file: 'b.test.mjs' })] });

    // Assert
    expect(plan.shouldRun).toBe(true);
    expect(plan.argv).toEqual(['run', 'engines/node/src/__tests__/example.test.mjs', 'b.test.mjs']);
  });
});

describe('the repository quarantine registry', () => {
  it('should parse and satisfy every policy rule', () => {
    // Arrange
    const registry = parseQuarantineRegistry(readFileSync(registryPath, 'utf8'), {
      source: 'test-quarantine.json',
    });

    // Act
    const result = validateQuarantineRegistry(registry, {
      fileExists: (file) => existsSync(path.join(agentkitRoot, file)),
      today: new Date().toISOString().slice(0, 10),
    });

    // Assert
    expect(result.problems).toEqual([]);
  });
});
