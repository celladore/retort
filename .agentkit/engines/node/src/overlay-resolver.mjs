/**
 * Retort — Overlay Resolver
 * Determines which overlay to use and collects template files from base + overlay.
 * Extracted from synchronize.mjs (Step 4 of modularization).
 */
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { basename, join, relative, resolve } from 'path';
import { readText } from './spec-loader.mjs';

// ---------------------------------------------------------------------------
// Local walkDir (avoids circular import with synchronize.mjs)
// ---------------------------------------------------------------------------

async function* walkDir(dir) {
  if (!existsSync(dir)) return;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(full);
    } else {
      yield full;
    }
  }
}

// ---------------------------------------------------------------------------
// Overlay selection
// ---------------------------------------------------------------------------

function inferOverlayFromProjectRoot(agentkitRoot, projectRoot) {
  const inferredName = basename(resolve(projectRoot));
  if (!inferredName) return null;
  const settingsPath = resolve(agentkitRoot, 'overlays', inferredName, 'settings.yaml');
  return existsSync(settingsPath) ? inferredName : null;
}

export function resolveOverlaySelection(agentkitRoot, projectRoot, flags) {
  if (flags?.overlay) {
    return {
      repoName: flags.overlay,
      reason: '--overlay flag',
    };
  }

  const markerPath = resolve(projectRoot, '.agentkit-repo');
  if (existsSync(markerPath)) {
    return {
      repoName: readText(markerPath).trim(),
      reason: '.agentkit-repo marker',
    };
  }

  const inferredOverlay = inferOverlayFromProjectRoot(agentkitRoot, projectRoot);
  if (inferredOverlay) {
    return {
      repoName: inferredOverlay,
      reason: `inferred from project root name "${basename(resolve(projectRoot))}"`,
    };
  }

  return {
    repoName: '__TEMPLATE__',
    reason: 'fallback to __TEMPLATE__ (no --overlay, no .agentkit-repo, no inferred overlay)',
  };
}

// ---------------------------------------------------------------------------
// Template file collection
// ---------------------------------------------------------------------------

export async function collectTemplateFiles(baseDir, overlayDir = null) {
  const filesByRelativePath = new Map();

  for (const dir of [baseDir, overlayDir]) {
    if (!dir || !existsSync(dir)) continue;
    for await (const srcFile of walkDir(dir)) {
      const relPath = relative(dir, srcFile);
      filesByRelativePath.set(relPath, srcFile);
    }
  }

  return filesByRelativePath;
}
