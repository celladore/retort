/**
 * AgentKit Forge — propose-skill
 *
 * Promotes a local skill from .agents/skills/<name>/ to org-meta/skills/<name>/
 * by creating a branch and copying the SKILL.md file.
 *
 * Usage:
 *   node propose-skill.mjs <skill-name>
 *   pnpm ak:propose-skill <skill-name>
 *
 * What it does:
 *   1. Reads the skill from {projectRoot}/.agents/skills/<name>/SKILL.md
 *   2. Resolves the org-meta path (ORG_META_PATH env var or ~/repos/org-meta)
 *   3. Creates a new git branch: feat/propose-skill-<name>
 *   4. Copies the SKILL.md to org-meta/skills/<name>/SKILL.md
 *   5. Prints instructions for the next steps (commit, push, PR)
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  process.stdout.write(msg + '\n');
}

function err(msg) {
  process.stderr.write(`[propose-skill] Error: ${msg}\n`);
  process.exit(1);
}

function resolveOrgMetaPath() {
  return process.env.ORG_META_PATH
    ? resolve(process.env.ORG_META_PATH)
    : resolve(process.env.HOME || process.env.USERPROFILE || '~', 'repos', 'org-meta');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const skillName = process.argv[2];

if (!skillName || skillName.startsWith('-')) {
  log('Usage: pnpm ak:propose-skill <skill-name>');
  log('');
  log('Promotes a local skill from .agents/skills/<name>/ to org-meta/skills/<name>/.');
  log('The skill must exist in the current repo and NOT already be in skills.yaml.');
  process.exit(0);
}

const projectRoot = process.cwd();
const localSkillPath = join(projectRoot, '.agents', 'skills', skillName, 'SKILL.md');

if (!existsSync(localSkillPath)) {
  err(`Skill '${skillName}' not found at ${localSkillPath}`);
}

const orgMetaRoot = resolveOrgMetaPath();
if (!existsSync(orgMetaRoot)) {
  err(`org-meta not found at ${orgMetaRoot}. Set ORG_META_PATH env var to override.`);
}

const destDir = join(orgMetaRoot, 'skills', skillName);
const destPath = join(destDir, 'SKILL.md');

if (existsSync(destPath)) {
  log(`[propose-skill] '${skillName}' already exists in org-meta at ${destPath}`);
  log('If you want to update it, edit the file directly and open a PR in org-meta.');
  process.exit(0);
}

// Read the local skill content
const content = readFileSync(localSkillPath, 'utf-8');

// Create branch in org-meta
const branchName = `feat/propose-skill-${skillName}`;
log(`[propose-skill] Creating branch '${branchName}' in org-meta...`);
try {
  execFileSync('git', ['checkout', '-b', branchName], { cwd: orgMetaRoot, stdio: 'pipe' });
} catch (e) {
  err(`Failed to create branch: ${e?.message ?? e}`);
}

// Write the skill file
mkdirSync(destDir, { recursive: true });
writeFileSync(destPath, content, 'utf-8');
log(`[propose-skill] Wrote ${destPath}`);

// Print next steps
log('');
log('Next steps:');
log(`  cd ${orgMetaRoot}`);
log(`  git add skills/${skillName}/SKILL.md`);
log(`  git commit -m "feat(skills): propose ${skillName} from downstream repo"`);
log(`  git push -u origin ${branchName}`);
log('  # Then open a PR against org-meta main');
log('');
log(`Once merged, add '${skillName}' to .agentkit/spec/skills.yaml with source: org-meta.`);
