/**
 * Retort — Scaffold Engine
 *
 * Owns the templateMetaMap singleton and the four post-render phases of runSync:
 *
 *   7. writeScaffoldOutputs  — write temp files to project root (scaffold-once / managed / always)
 *   8. cleanStaleFiles       — delete orphaned files from previous sync
 *   9. writeManifest         — write .agentkit/manifest.json
 *  10. runPostSyncPrettier   — format written files with Prettier
 *
 * The templateMetaMap is populated by syncDirectCopy (in synchronize.mjs) via
 * setTemplateMeta() and read here during the scaffold-action resolution step.
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { chmod, cp, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, extname, relative, resolve, sep } from 'path';
import { ensureDir, runConcurrent } from './fs-utils.mjs';
import { normalizeForComparison, threeWayMerge } from './scaffold-merge.mjs';
import { resolveScaffoldAction } from './template-utils.mjs';

// ---------------------------------------------------------------------------
// Template metadata map — populated during template rendering (syncDirectCopy),
// consumed during scaffold output writing (writeScaffoldOutputs).
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} relPath → parsed template frontmatter */
const templateMetaMap = new Map();

/**
 * Retrieve parsed frontmatter metadata for a generated file.
 * @param {string} relPath
 * @returns {object|null}
 */
export function getTemplateMeta(relPath) {
  return templateMetaMap.get(relPath.replace(/\\/g, '/')) || null;
}

/**
 * Store parsed frontmatter metadata for a generated file.
 * Called from syncDirectCopy when a template has scaffold directives.
 * @param {string} relPath
 * @param {object} meta
 */
export function setTemplateMeta(relPath, meta) {
  templateMetaMap.set(relPath.replace(/\\/g, '/'), meta);
}

/**
 * Clear all stored metadata — called at the start of each runSync invocation
 * so that stale entries from a previous sync (e.g. in tests) are not visible.
 */
export function clearTemplateMeta() {
  templateMetaMap.clear();
}

// ---------------------------------------------------------------------------
// Step 7: Write scaffold outputs
// ---------------------------------------------------------------------------

/**
 * Atomic swap: move rendered temp files to the project root, respecting the
 * scaffold action (once / managed / always) for each file.
 *
 * Mutates `newManifestFiles` in place to carry forward scaffold-once entries
 * that were skipped this sync but exist on disk (so orphan cleanup keeps them).
 *
 * @param {object} opts
 * @param {string}   opts.projectRoot
 * @param {string}   opts.agentkitRoot
 * @param {string}   opts.tmpDir
 * @param {string[]} opts.allTmpFiles
 * @param {object}   opts.flags
 * @param {object}   opts.newManifestFiles  — mutated in place
 * @param {object}   opts.previousManifest
 * @param {object}   opts.vars
 * @param {Function} opts.log
 * @param {Function} opts.logVerbose
 * @returns {Promise<{ count: number, skippedScaffold: number, writtenFiles: string[] }>}
 */
export async function writeScaffoldOutputs({
  projectRoot,
  agentkitRoot,
  tmpDir,
  allTmpFiles,
  flags,
  newManifestFiles,
  previousManifest,
  vars,
  log,
  logVerbose,
}) {
  const resolvedRoot = resolve(projectRoot) + sep;
  const scaffoldCacheDir = resolve(agentkitRoot, '.scaffold-cache');

  let count = 0;
  let skippedScaffold = 0;
  const failedFiles = [];
  // NOTE: Safe for single-threaded async (Array.push is synchronous in V8).
  // If runConcurrent ever uses worker threads, this needs synchronization.
  const writtenFiles = []; // absolute paths of files written, for post-sync formatting
  const scaffoldResults = {
    alwaysRegenerated: [],
    managedRegenerated: [],
    managedMerged: [],
    managedConflicts: [],
    managedPreserved: [],
    managedNoCache: [],
  };

  await runConcurrent(allTmpFiles, async (srcFile) => {
    if (!existsSync(srcFile)) return;
    const relPath = relative(tmpDir, srcFile);
    const normalizedRel = relPath.replace(/\\/g, '/');
    const destFile = resolve(projectRoot, relPath);

    // Interactive skip: user chose to skip this file in "prompt each" mode
    if (flags?._skipPaths?.has(normalizedRel)) {
      logVerbose(`  skipped ${normalizedRel} (user chose to skip)`);
      return;
    }

    // Path traversal protection: ensure all output stays within project root
    if (!resolve(destFile).startsWith(resolvedRoot) && resolve(destFile) !== resolve(projectRoot)) {
      console.error(`[retort:sync] BLOCKED: path traversal detected — ${normalizedRel}`);
      failedFiles.push({ file: normalizedRel, error: 'path traversal blocked' });
      return;
    }

    // Scaffold action resolution: always | managed (check-hash) | once (skip)
    const meta = getTemplateMeta(normalizedRel);
    const overwrite = flags?.overwrite || flags?.force;
    if (!overwrite && existsSync(destFile)) {
      const action = resolveScaffoldAction(normalizedRel, vars, meta);

      if (action === 'skip') {
        skippedScaffold++;
        return;
      }

      if (action === 'check-hash') {
        const diskContent = await readFile(destFile);
        const diskHash = createHash('sha256').update(diskContent).digest('hex').slice(0, 12);
        const prevHash = previousManifest?.files?.[normalizedRel]?.hash;

        if (prevHash && diskHash !== prevHash) {
          const cachePath = resolve(scaffoldCacheDir, relPath);
          const newContent = await readFile(srcFile, 'utf-8');

          if (existsSync(cachePath)) {
            const baseContent = readFileSync(cachePath, 'utf-8');
            const diskText = diskContent.toString('utf-8');

            // Check whether the disk differs from the cache for reasons other
            // than table-cell padding (Prettier alignment).  If the normalised
            // forms are identical the file contains no real user edits — fall
            // through to the pristine overwrite path below.
            if (normalizeForComparison(diskText) !== normalizeForComparison(baseContent)) {
              // Real user edit.  Only attempt a three-way merge when the template
              // has actually changed since the last sync (base ≠ theirs after
              // normalisation).  When the template is unchanged the merge would
              // be a no-op (result === disk) — skip it to stop the churn loop.
              if (normalizeForComparison(baseContent) === normalizeForComparison(newContent)) {
                // Template unchanged — preserve user edits, no write needed
                skippedScaffold++;
                scaffoldResults.managedPreserved.push(normalizedRel);
                logVerbose(`  skipped ${normalizedRel} (user edits preserved, template unchanged)`);
                return;
              }

              const result = threeWayMerge(diskText, baseContent, newContent);

              if (result) {
                // Write merged result
                await ensureDir(dirname(destFile));
                await writeFile(destFile, result.merged, 'utf-8');
                // Update scaffold cache with new generated content
                await ensureDir(dirname(cachePath));
                await writeFile(cachePath, newContent, 'utf-8');
                count++;

                writtenFiles.push(destFile);
                if (result.hasConflicts) {
                  scaffoldResults.managedConflicts.push(normalizedRel);
                  console.warn(
                    `[retort:sync] CONFLICT in ${normalizedRel} — resolve <<<< markers manually`
                  );
                } else {
                  scaffoldResults.managedMerged.push(normalizedRel);
                  logVerbose(`  merged ${normalizedRel} (user edits + template changes combined)`);
                }
                return;
              }
              // git merge-file unavailable — skip and preserve user edits
              skippedScaffold++;
              scaffoldResults.managedPreserved.push(normalizedRel);
              logVerbose(
                `  skipped ${normalizedRel} (user edits detected, hash: ${prevHash} → ${diskHash})`
              );
              return;
            }
            // Formatting-only diff — fall through to pristine overwrite
          } else {
            // No cache — skip and preserve user edits
            skippedScaffold++;
            scaffoldResults.managedPreserved.push(normalizedRel);
            scaffoldResults.managedNoCache.push(normalizedRel);
            logVerbose(
              `  skipped ${normalizedRel} (user edits detected, hash: ${prevHash} → ${diskHash})`
            );
            return;
          }
        }
        // Hash matches, no previous hash, or formatting-only diff — safe to overwrite (pristine)
        scaffoldResults.managedRegenerated.push(normalizedRel);
      } else {
        // action === 'write' for scaffold: always
        if (meta?.agentkit?.scaffold === 'always') {
          scaffoldResults.alwaysRegenerated.push(normalizedRel);
        }
      }
    }

    // Content-hash guard: skip write if content is identical to the existing file.
    // This prevents mtime churn on generated files that haven't logically changed,
    // reducing adopter merge-conflict counts on framework-update merges.
    // Also skips when the only difference is markdown table-cell padding (Prettier
    // alignment vs compact template output) so formatted files are not reverted each run.
    if (existsSync(destFile)) {
      const existingContent = await readFile(destFile);
      const newHash = newManifestFiles[normalizedRel]?.hash;
      if (newHash) {
        const existingHash = createHash('sha256')
          .update(existingContent)
          .digest('hex')
          .slice(0, 12);
        if (existingHash === newHash) {
          logVerbose(`  unchanged ${normalizedRel} (content identical, skipping write)`);
          return;
        }
      }
      // Slower path: skip write when the only difference is table-cell padding.
      const newContent = await readFile(srcFile, 'utf-8');
      if (
        normalizeForComparison(existingContent.toString('utf-8')) ===
        normalizeForComparison(newContent)
      ) {
        // Still queue for Prettier even though we skip the write — the file on
        // disk may be unformatted from a previous sync that predates this guard.
        writtenFiles.push(destFile);
        logVerbose(`  unchanged ${normalizedRel} (formatting-only diff, skipping write)`);
        return;
      }
    }

    try {
      await ensureDir(dirname(destFile));
      await cp(srcFile, destFile, { force: true, recursive: false });

      // Update scaffold cache for managed files
      if (meta?.agentkit?.scaffold === 'managed' || meta?.agentkit?.scaffold === 'always') {
        const cachePath = resolve(scaffoldCacheDir, relPath);
        try {
          await ensureDir(dirname(cachePath));
          const content = await readFile(srcFile, 'utf-8');
          await writeFile(cachePath, content, 'utf-8');
        } catch {
          /* ignore cache write failures */
        }
      }

      // Make .sh files executable
      if (extname(srcFile) === '.sh') {
        try {
          await chmod(destFile, 0o755);
        } catch {
          /* ignore on Windows */
        }
      }
      count++;
      writtenFiles.push(destFile);
      logVerbose(`  wrote ${normalizedRel}`);
    } catch (err) {
      failedFiles.push({ file: normalizedRel, error: err.message });
      console.error(`[retort:sync] Failed to write: ${normalizedRel} — ${err.message}`);
    }
  });

  if (failedFiles.length > 0) {
    console.error(`[retort:sync] Error: ${failedFiles.length} file(s) failed to write:`);
    for (const f of failedFiles) {
      console.error(`  - ${f.file}: ${f.error}`);
    }
    throw new Error(`Sync completed with ${failedFiles.length} write failure(s)`);
  }

  // Scaffold summary
  const hasManagedActivity =
    scaffoldResults.alwaysRegenerated.length > 0 ||
    scaffoldResults.managedRegenerated.length > 0 ||
    scaffoldResults.managedMerged.length > 0 ||
    scaffoldResults.managedConflicts.length > 0 ||
    scaffoldResults.managedPreserved.length > 0;

  if (hasManagedActivity) {
    log('[retort:sync] Scaffold summary:');
    if (scaffoldResults.alwaysRegenerated.length > 0) {
      log(`  ${scaffoldResults.alwaysRegenerated.length} file(s) always-regenerated`);
    }
    if (scaffoldResults.managedRegenerated.length > 0) {
      log(`  ${scaffoldResults.managedRegenerated.length} managed file(s) regenerated (pristine)`);
    }
    if (scaffoldResults.managedMerged.length > 0) {
      log(
        `  ${scaffoldResults.managedMerged.length} managed file(s) merged (user edits + template changes)`
      );
    }
    if (scaffoldResults.managedConflicts.length > 0) {
      console.warn(
        `  ${scaffoldResults.managedConflicts.length} managed file(s) with CONFLICTS — resolve manually:`
      );
      for (const f of scaffoldResults.managedConflicts) {
        console.warn(`    - ${f}`);
      }
    }
    if (scaffoldResults.managedPreserved.length > 0) {
      log(
        `  ${scaffoldResults.managedPreserved.length} managed file(s) preserved (user edits detected)`
      );
      for (const f of scaffoldResults.managedPreserved) {
        logVerbose(`    - ${f}`);
      }
    }
  }
  const scaffoldOnceSkipped = skippedScaffold - scaffoldResults.managedPreserved.length;
  if (scaffoldOnceSkipped > 0) {
    logVerbose(`  ${scaffoldOnceSkipped} scaffold-once file(s) skipped`);
  }

  // Carry forward scaffold-once files from previous manifest.
  // When a file was generated in a previous sync but skipped this time (scaffold-once),
  // it must remain in the new manifest so orphan cleanup does not delete it.
  if (previousManifest?.files) {
    for (const [prevFile, prevMeta] of Object.entries(previousManifest.files)) {
      if (!newManifestFiles[prevFile]) {
        const prevPath = resolve(projectRoot, prevFile);
        if (existsSync(prevPath)) {
          // File exists on disk but was not regenerated — carry forward its manifest entry
          newManifestFiles[prevFile] = prevMeta;
        }
      }
    }
  }

  return { count, skippedScaffold, writtenFiles };
}

// ---------------------------------------------------------------------------
// Step 8: Stale file cleanup
// ---------------------------------------------------------------------------

/**
 * Delete orphaned files from the previous sync manifest that are no longer
 * present in the new manifest. Skipped when `noClean` is true.
 *
 * @param {object} opts
 * @param {string}   opts.projectRoot
 * @param {object}   opts.previousManifest
 * @param {object}   opts.newManifestFiles
 * @param {boolean}  opts.noClean
 * @param {Function} opts.logVerbose
 * @returns {Promise<number>} Number of files deleted
 */
export async function cleanStaleFiles({
  projectRoot,
  previousManifest,
  newManifestFiles,
  noClean,
  logVerbose,
}) {
  let cleanedCount = 0;
  if (!noClean && previousManifest?.files) {
    const resolvedRoot = resolve(projectRoot) + sep;
    const staleFiles = [];
    for (const prevFile of Object.keys(previousManifest.files)) {
      if (!newManifestFiles[prevFile]) {
        staleFiles.push(prevFile);
      }
    }

    await runConcurrent(staleFiles, async (prevFile) => {
      const orphanPath = resolve(projectRoot, prevFile);
      // Path traversal protection: ensure orphan path stays within project root
      if (!orphanPath.startsWith(resolvedRoot)) {
        console.warn(`[retort:sync] BLOCKED: path traversal in manifest — ${prevFile}`);
        return;
      }
      if (existsSync(orphanPath)) {
        try {
          await unlink(orphanPath);
          cleanedCount++;
          logVerbose(`[retort:sync] Cleaned stale file: ${prevFile}`);
        } catch (err) {
          console.warn(
            `[retort:sync] Warning: could not clean stale file ${prevFile} — ${err.message}`
          );
        }
      }
    });
  }
  return cleanedCount;
}

// ---------------------------------------------------------------------------
// Step 9: Write manifest
// ---------------------------------------------------------------------------

/**
 * Persist the new manifest to disk. Logs a warning (does not throw) on failure
 * so that a manifest write error does not mask a successful sync.
 *
 * @param {string} manifestPath  — absolute path to manifest.json
 * @param {object} manifest      — manifest object to serialise
 * @returns {Promise<void>}
 */
export async function writeManifest(manifestPath, manifest) {
  try {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.warn(`[retort:sync] Warning: could not write manifest — ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Step 10: Post-sync Prettier formatting
// ---------------------------------------------------------------------------

/**
 * Run Prettier on all files written during this sync pass.
 * Silently skipped when Prettier is not installed or `writtenFiles` is empty.
 * Formats in batches of 50 to avoid OS argument-length limits.
 *
 * @param {object} opts
 * @param {string}   opts.agentkitRoot
 * @param {string}   opts.projectRoot
 * @param {string[]} opts.writtenFiles
 * @param {Function} opts.logVerbose
 * @returns {Promise<void>}
 */
export async function runPostSyncPrettier({ agentkitRoot, projectRoot, writtenFiles, logVerbose }) {
  const prettierBin = resolve(agentkitRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  if (!existsSync(prettierBin) || writtenFiles.length === 0) return;

  try {
    const BATCH_SIZE = 50;
    let formattedCount = 0;
    for (let i = 0; i < writtenFiles.length; i += BATCH_SIZE) {
      const batch = writtenFiles.slice(i, i + BATCH_SIZE);
      try {
        execFileSync(process.execPath, [prettierBin, '--write', ...batch], {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 60_000,
        });
        formattedCount += batch.length;
      } catch (err) {
        if (err?.killed) {
          logVerbose(`[retort:sync] Prettier batch timed out, continuing...`);
        }
        // prettier may fail on some files (e.g. non-parseable) — continue
      }
    }
    if (formattedCount > 0) {
      logVerbose(`[retort:sync] Formatted ${formattedCount} generated file(s) with Prettier.`);
    }
  } catch {
    // If prettier is not available or fails entirely, just continue
  }
}
