import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { checkDirtyProtectedFiles } from '../sync-guard.mjs';

// ---------------------------------------------------------------------------
// checkDirtyProtectedFiles — integration tests using real git operations
// ---------------------------------------------------------------------------

describe('checkDirtyProtectedFiles', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sync-guard-test-'));
    // Init a git repo in the temp directory
    execFileSync('git', ['init'], { cwd: tempDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], {
      cwd: tempDir,
      stdio: 'pipe',
    });
    execFileSync('git', ['config', 'user.name', 'Test'], {
      cwd: tempDir,
      stdio: 'pipe',
    });

    // Create protected directory structure and initial commit
    mkdirSync(join(tempDir, '.agentkit', 'spec'), { recursive: true });
    mkdirSync(join(tempDir, '.agentkit', 'engines'), { recursive: true });
    mkdirSync(join(tempDir, '.agentkit', 'overlays'), { recursive: true });
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, '.agentkit', 'spec', 'project.yaml'), 'name: test\n');
    writeFileSync(join(tempDir, '.agentkit', 'engines', 'sync.mjs'), 'export default {};\n');
    writeFileSync(join(tempDir, 'src', 'app.js'), 'console.log("hello");\n');
    execFileSync('git', ['add', '-A'], { cwd: tempDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: tempDir, stdio: 'pipe' });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Windows may hold locks briefly
    }
  });

  it('returns dirty:false when working tree is clean', () => {
    const result = checkDirtyProtectedFiles(tempDir, [
      '.agentkit/engines',
      '.agentkit/spec',
      '.agentkit/overlays',
    ]);
    expect(result.dirty).toBe(false);
    expect(result.files).toEqual([]);
  });

  it('detects modified files in .agentkit/spec/', () => {
    writeFileSync(join(tempDir, '.agentkit', 'spec', 'project.yaml'), 'name: changed\n');
    const result = checkDirtyProtectedFiles(tempDir, [
      '.agentkit/engines',
      '.agentkit/spec',
      '.agentkit/overlays',
    ]);
    expect(result.dirty).toBe(true);
    expect(result.files).toContain('.agentkit/spec/project.yaml');
  });

  it('detects modified files in .agentkit/engines/', () => {
    writeFileSync(join(tempDir, '.agentkit', 'engines', 'sync.mjs'), 'export default { v: 2 };\n');
    const result = checkDirtyProtectedFiles(tempDir, ['.agentkit/engines', '.agentkit/spec']);
    expect(result.dirty).toBe(true);
    expect(result.files).toContain('.agentkit/engines/sync.mjs');
  });

  it('ignores dirty files outside protected directories', () => {
    writeFileSync(join(tempDir, 'src', 'app.js'), 'console.log("changed");\n');
    const result = checkDirtyProtectedFiles(tempDir, [
      '.agentkit/engines',
      '.agentkit/spec',
      '.agentkit/overlays',
    ]);
    expect(result.dirty).toBe(false);
    expect(result.files).toEqual([]);
  });

  it('detects untracked files in protected directories', () => {
    writeFileSync(join(tempDir, '.agentkit', 'engines', 'new-file.mjs'), 'new content\n');
    const result = checkDirtyProtectedFiles(tempDir, ['.agentkit/engines', '.agentkit/spec']);
    expect(result.dirty).toBe(true);
    expect(result.files).toContain('.agentkit/engines/new-file.mjs');
  });

  it('degrades gracefully when git is not available', () => {
    // Test with an invalid cwd to simulate git failure
    const result = checkDirtyProtectedFiles('/nonexistent/path/that/does/not/exist', [
      '.agentkit/engines',
    ]);
    expect(result.dirty).toBe(false);
    expect(result.files).toEqual([]);
  });

  it('detects multiple dirty files across protected directories', () => {
    writeFileSync(join(tempDir, '.agentkit', 'spec', 'project.yaml'), 'name: changed\n');
    writeFileSync(join(tempDir, '.agentkit', 'engines', 'sync.mjs'), 'changed\n');
    writeFileSync(join(tempDir, '.agentkit', 'overlays', 'test.yaml'), 'new: true\n');
    const result = checkDirtyProtectedFiles(tempDir, [
      '.agentkit/engines',
      '.agentkit/spec',
      '.agentkit/overlays',
    ]);
    expect(result.dirty).toBe(true);
    expect(result.files.length).toBeGreaterThanOrEqual(3);
  });
});
