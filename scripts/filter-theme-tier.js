#!/usr/bin/env node
// =============================================================================
// filter-theme-tier.js — Filters editor-theme.yaml keys by the selected tier
// =============================================================================
// Reads editor-theme.yaml, parses tier markers (# --- tier: <level> ---),
// and strips keys that belong to tiers above the configured one.
//
// Tier accumulation: minimal ⊂ medium ⊂ full
//   minimal → only keys under "# --- tier: minimal ---"
//   medium  → minimal + keys under "# --- tier: medium ---"
//   full    → all keys (no filtering)
//
// Usage:
//   node scripts/filter-theme-tier.js [--tier minimal|medium|full] [--dry-run]
//
// Without --tier, reads the tier from editor-theme.yaml itself.
// With --dry-run, prints the filtered output to stdout without writing.
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEME_PATH = resolve(__dirname, '..', '.agentkit', 'spec', 'editor-theme.yaml');

const TIERS = ['minimal', 'medium', 'full'];
const TIER_MARKER_RE = /^(\s*)# --- tier:\s*(minimal|medium|full)\s*---\s*$/;
const TOP_LEVEL_TIER_RE = /^tier:\s*(minimal|medium|full)\s*$/m;
const MODE_SECTION_RE = /^(light|dark):\s*$/;
const COMMENT_RE = /^\s*#/;
const BLANK_RE = /^\s*$/;
const KV_RE = /^\s{2}\S/; // indented key-value pair (2-space indent under light/dark)

function parseTierFromFile(content) {
  const match = content.match(TOP_LEVEL_TIER_RE);
  return match ? match[1] : 'full';
}

function parseArgs() {
  const args = process.argv.slice(2);
  let tier = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tier' && args[i + 1]) {
      tier = args[++i];
      if (!TIERS.includes(tier)) {
        console.error(`Invalid tier: ${tier}. Must be one of: ${TIERS.join(', ')}`);
        process.exit(1);
      }
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: filter-theme-tier.js [--tier minimal|medium|full] [--dry-run]');
      console.log('  --tier     Override the tier (default: reads from editor-theme.yaml)');
      console.log('  --dry-run  Print filtered output to stdout without writing');
      process.exit(0);
    }
  }

  return { tier, dryRun };
}

function tierLevel(tier) {
  return TIERS.indexOf(tier);
}

function filterThemeByTier(content, selectedTier) {
  const maxLevel = tierLevel(selectedTier);
  const lines = content.split('\n');
  const output = [];

  let inModeSection = false; // inside light: or dark: block
  let currentTierLevel = -1; // tier level of current section
  let pendingComments = []; // buffer comments/blanks to attach to next tier section

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect top-level mode sections (light: / dark:)
    if (MODE_SECTION_RE.test(line)) {
      // Flush pending comments before mode header
      output.push(...pendingComments);
      pendingComments = [];
      output.push(line);
      inModeSection = true;
      currentTierLevel = -1; // no tier set yet — keys before first marker are excluded
      continue;
    }

    // Detect end of mode section (any non-indented, non-blank, non-comment line
    // that isn't a mode section itself)
    if (inModeSection && !BLANK_RE.test(line) && !COMMENT_RE.test(line) && !KV_RE.test(line)) {
      // We've left the mode section
      inModeSection = false;
      currentTierLevel = -1;
      output.push(...pendingComments);
      pendingComments = [];
      output.push(line);
      continue;
    }

    if (!inModeSection) {
      output.push(line);
      continue;
    }

    // Inside a mode section — check for tier markers
    const tierMatch = line.match(TIER_MARKER_RE);
    if (tierMatch) {
      const markerTier = tierMatch[2];
      currentTierLevel = tierLevel(markerTier);

      if (currentTierLevel <= maxLevel) {
        // Include this tier marker and any buffered comments
        output.push(...pendingComments);
        pendingComments = [];
        output.push(line);
      } else {
        // This tier is above the selected level — discard buffered comments
        pendingComments = [];
      }
      continue;
    }

    // Blank lines and comments — buffer them
    if (BLANK_RE.test(line) || COMMENT_RE.test(line)) {
      if (currentTierLevel <= maxLevel && currentTierLevel >= 0) {
        output.push(line);
      } else {
        pendingComments.push(line);
      }
      continue;
    }

    // Key-value pair — include only if current tier is within selected level
    if (KV_RE.test(line)) {
      if (currentTierLevel >= 0 && currentTierLevel <= maxLevel) {
        output.push(line);
      }
      // else: skip this key (tier too high)
      continue;
    }

    // Anything else — pass through
    output.push(line);
  }

  // Flush remaining
  output.push(...pendingComments);

  return output.join('\n');
}

function countKeys(content) {
  const lines = content.split('\n');
  let inMode = false;
  let count = 0;
  for (const line of lines) {
    if (MODE_SECTION_RE.test(line)) {
      inMode = true;
      continue;
    }
    if (inMode && !BLANK_RE.test(line) && !COMMENT_RE.test(line) && !KV_RE.test(line)) {
      inMode = false;
    }
    if (inMode && KV_RE.test(line) && !COMMENT_RE.test(line)) {
      count++;
    }
  }
  return count;
}

// ── Main ────────────────────────────────────────────────────────────────────

const { tier: cliTier, dryRun } = parseArgs();

let content;
try {
  content = readFileSync(THEME_PATH, 'utf8');
} catch (err) {
  console.error(`Cannot read ${THEME_PATH}: ${err.message}`);
  process.exit(1);
}

const selectedTier = cliTier || parseTierFromFile(content);
const beforeCount = countKeys(content);

if (selectedTier === 'full') {
  console.log(`Tier: full — no filtering needed (${beforeCount} keys)`);
  if (dryRun) {
    process.stdout.write(content);
  }
  process.exit(0);
}

const filtered = filterThemeByTier(content, selectedTier);
const afterCount = countKeys(filtered);

console.log(`Tier: ${selectedTier} — ${beforeCount} keys → ${afterCount} keys (removed ${beforeCount - afterCount})`);

if (dryRun) {
  process.stdout.write(filtered);
} else {
  writeFileSync(THEME_PATH, filtered, 'utf8');
  console.log(`Updated: ${THEME_PATH}`);
}
