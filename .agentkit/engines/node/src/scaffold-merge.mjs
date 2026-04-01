/**
 * Retort — Scaffold Merge Utilities
 * Three-way merge (git merge-file wrapper) and content normalization for the
 * scaffold engine. Extracted from synchronize.mjs so these can be tested and
 * reasoned about independently of the full sync pipeline.
 */
import { execFileSync } from 'child_process';
import { unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Performs a three-way merge using git merge-file.
 * @param {string} oursContent - User's current version (disk)
 * @param {string} baseContent - Last generated version (scaffold cache)
 * @param {string} theirsContent - Newly generated version (template)
 * @returns {{ merged: string, hasConflicts: boolean }|null} null if git unavailable
 */
export function threeWayMerge(oursContent, baseContent, theirsContent) {
  const prefix = join(
    tmpdir(),
    `agentkit-merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const oursFile = `${prefix}-ours`;
  const baseFile = `${prefix}-base`;
  const theirsFile = `${prefix}-theirs`;

  writeFileSync(oursFile, oursContent);
  writeFileSync(baseFile, baseContent);
  writeFileSync(theirsFile, theirsContent);

  try {
    const merged = execFileSync(
      'git',
      [
        'merge-file',
        '-p',
        '--diff3',
        '-L',
        'YOUR_EDITS',
        '-L',
        'LAST_SYNC',
        '-L',
        'NEW_TEMPLATE',
        oursFile,
        baseFile,
        theirsFile,
      ],
      { encoding: 'utf-8' }
    );
    return { merged, hasConflicts: false };
  } catch (err) {
    if (err.status === 1) {
      // Merge completed but has conflicts
      return {
        merged: typeof err.stdout === 'string' ? err.stdout : oursContent,
        hasConflicts: true,
      };
    }
    // git merge-file not available or other error
    return null;
  } finally {
    try {
      unlinkSync(oursFile);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(baseFile);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(theirsFile);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Strips trailing whitespace and normalises markdown table-cell padding so
 * that a Prettier-aligned table and a compact table compare as equal when
 * the cell *values* are identical. Used to detect whether a disk file
 * differs from the scaffold cache for reasons other than whitespace.
 *
 * @param {string} content
 * @returns {string}
 */
export function normalizeForComparison(content) {
  return content
    .split('\n')
    .map((line) => {
      if (/^\s*\|/.test(line)) {
        // Separator rows (|---|---| or | --- | --- |) — collapse to |---| canonical form
        if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) {
          const cols = line.split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
          return '|' + cols.map((c) => c.trim().replace(/^(:?)-+(:?)$/, '$1-$2')).join('|') + '|';
        }
        // Data rows — normalise cell padding to a single space either side
        return line
          .split('|')
          .map((cell, i, arr) =>
            i === 0 || i === arr.length - 1 ? cell.trimEnd() : ` ${cell.trim()} `
          )
          .join('|');
      }
      return line.trimEnd();
    })
    .join('\n')
    .trimEnd();
}
