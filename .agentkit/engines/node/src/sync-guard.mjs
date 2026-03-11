/**
 * AgentKit Forge — Sync Guard
 * Pre-sync safety checks and interactive apply prompts.
 * Uses @clack/prompts for Windows-safe terminal UI.
 */
import { execFileSync } from 'child_process';

// ---------------------------------------------------------------------------
// Dirty file detection
// ---------------------------------------------------------------------------

/**
 * Check for uncommitted changes in protected directories.
 * Runs `git status --porcelain` scoped to the given directories.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @param {string[]} protectedDirs - Relative paths to check
 * @returns {{ dirty: boolean, files: string[] }}
 */
export function checkDirtyProtectedFiles(projectRoot, protectedDirs) {
  try {
    const stdout = execFileSync(
      'git',
      ['status', '--porcelain', '--', ...protectedDirs],
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const files = stdout
      .split('\n')
      .filter((line) => line.length > 3)
      .map((line) => {
        // git status --porcelain format: XY<space>PATH or XY<space>OLD -> NEW (renames)
        // XY is 2-char status, followed by a space, then the path.
        const path = line.substring(3);
        // Handle renames: "R  old -> new" — take the new path
        const arrowIdx = path.indexOf(' -> ');
        return arrowIdx >= 0 ? path.substring(arrowIdx + 4) : path;
      });
    return { dirty: files.length > 0, files };
  } catch {
    // git not available or not a repo — degrade gracefully
    return { dirty: false, files: [] };
  }
}

// ---------------------------------------------------------------------------
// Interactive prompts — lazy-load @clack/prompts
// ---------------------------------------------------------------------------

/** @returns {Promise<typeof import('@clack/prompts')>} */
async function loadClack() {
  return await import('@clack/prompts');
}

/**
 * Prompt user to decide what to do about dirty protected files.
 *
 * @param {string[]} dirtyFiles - List of dirty file paths
 * @returns {Promise<'abort'|'stash'|'continue'>}
 */
export async function promptDirtyFileAction(dirtyFiles) {
  const clack = await loadClack();

  clack.note(
    dirtyFiles.map((f) => `  ${f}`).join('\n'),
    'Uncommitted changes in protected directories'
  );

  const action = await clack.select({
    message: 'How would you like to proceed?',
    options: [
      { value: 'abort', label: 'Abort sync', hint: 'commit or stash manually first' },
      { value: 'stash', label: 'Stash and continue', hint: 'git stash push -- <files>' },
      { value: 'continue', label: 'Continue anyway (unsafe)', hint: 'changes may be overwritten' },
    ],
  });

  if (clack.isCancel(action)) return 'abort';

  if (action === 'stash') {
    try {
      execFileSync(
        'git',
        ['stash', 'push', '-m', 'agentkit-sync-guard', '--', ...dirtyFiles],
        { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' }
      );
      clack.log.success('Changes stashed. Run `git stash pop` after sync to restore.');
    } catch (err) {
      clack.log.error(`Stash failed: ${err?.message ?? err}`);
      return 'abort';
    }
  }

  return action;
}

/**
 * Show a change summary and prompt the user for an apply strategy.
 *
 * @param {{ creates: number, updates: number }} summary
 * @returns {Promise<'all'|'none'|'each'>}
 */
export async function promptApplyMode(summary) {
  const clack = await loadClack();

  const total = summary.creates + summary.updates;
  const mode = await clack.select({
    message: `${total} file(s) would change (${summary.creates} new, ${summary.updates} updated). Apply?`,
    options: [
      { value: 'all', label: 'Apply all', hint: 'write all changes' },
      { value: 'none', label: 'Skip all', hint: 'exit without writing' },
      { value: 'each', label: 'Prompt each', hint: 'decide file-by-file' },
    ],
  });

  if (clack.isCancel(mode)) return 'none';
  return mode;
}

/**
 * Prompt for a single file during "prompt each" mode.
 *
 * @param {{ relPath: string, action: 'create'|'update' }} change
 * @param {function(string, string): string|null} diffFn - Returns diff string or null
 * @param {string|null} oldContent - Existing file content (null for creates)
 * @param {string} newContent - New file content
 * @returns {Promise<'apply'|'skip'|'apply-rest'>}
 */
export async function promptSingleFile(change, diffFn, oldContent, newContent) {
  const clack = await loadClack();

  const options = [
    { value: 'apply', label: 'Apply' },
    { value: 'skip', label: 'Skip' },
    { value: 'apply-rest', label: 'Apply all remaining' },
  ];

  if (change.action === 'update' && diffFn) {
    options.splice(2, 0, { value: 'diff', label: 'Show diff', hint: 'then re-prompt' });
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const decision = await clack.select({
      message: `${change.action} ${change.relPath}`,
      options,
    });

    if (clack.isCancel(decision)) return 'skip';

    if (decision === 'diff') {
      const diffOut = diffFn(oldContent, newContent);
      if (diffOut) {
        console.log(
          diffOut
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n')
        );
      } else {
        console.log('    (no differences)');
      }
      continue; // re-prompt after showing diff
    }

    return decision;
  }
}
