/**
 * AgentKit Forge — Doctor
 * Repository diagnostics and setup checks.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import yaml, { FAILSAFE_SCHEMA } from 'js-yaml';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { isUnsafePathSegment } from './fs-utils.mjs';
import {
  validateSpec,
  validateMappingCoverage,
  validateRequiredFields,
} from './spec-validator.mjs';
import { computeProjectCompleteness } from './project-completeness.mjs';
import { PROJECT_MAPPING } from './project-mapping.mjs';
import { flattenProjectYaml } from './template-utils.mjs';
import { emitEvent } from './event-emitter.mjs';

function resolveSpecRoot(agentkitRoot, projectRoot) {
  const projectAgentkitRoot = resolve(projectRoot, '.agentkit');
  const projectSpecDir = resolve(projectAgentkitRoot, 'spec');
  if (existsSync(projectSpecDir)) {
    return projectAgentkitRoot;
  }
  return agentkitRoot;
}

function checkTemplateRoots(agentkitRoot, targets) {
  const templatesRoot = resolve(agentkitRoot, 'templates');
  const checks = [];

  for (const target of targets) {
    let expected;
    switch (target) {
      case 'claude':
      case 'cursor':
      case 'windsurf':
      case 'copilot':
      case 'mcp':
      case 'roo':
      case 'cline':
      case 'ai':
      case 'github':
      case 'docs':
        expected = resolve(templatesRoot, target);
        break;
      default:
        expected = null;
    }

    if (!expected) continue;
    checks.push({
      target,
      exists: existsSync(expected),
      path: expected,
    });
  }

  return checks;
}

function loadOverlayRenderTargets(agentkitRoot) {
  const overlayPath = resolve(agentkitRoot, 'overlays', '__TEMPLATE__', 'settings.yaml');
  if (!existsSync(overlayPath)) return { targets: [], error: null };
  try {
    const data = yaml.load(readFileSync(overlayPath, 'utf-8'), { schema: FAILSAFE_SCHEMA }) || {};
    return {
      targets: Array.isArray(data.renderTargets) ? data.renderTargets : [],
      error: null,
    };
  } catch (err) {
    return {
      targets: [],
      error: `Failed to parse overlay settings at ${overlayPath}: ${err.message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Org-meta skill inventory
// ---------------------------------------------------------------------------

/**
 * Resolves the path to the org-meta skills directory.
 * Mirrors resolveOrgMetaSkillsDir in platform-syncer.mjs — kept inlined here to
 * avoid pulling in the entire syncer just to inspect a path. The shared
 * isUnsafePathSegment helper is now imported from fs-utils.mjs (not the syncer).
 *
 * Priority: ORG_META_PATH env var → ~/repos/org-meta (default).
 */
function resolveOrgMetaSkillsDir() {
  const base = process.env.ORG_META_PATH
    ? resolve(process.env.ORG_META_PATH)
    : resolve(homedir(), 'repos', 'org-meta');
  return join(base, 'skills');
}

/**
 * Inventories every skill in skills.yaml whose source is `org-meta`.
 * Each result row: { name, status: 'present' | 'missing' | 'local-divergent', srcPath }.
 * - present:        SKILL.md exists in org-meta and matches the local copy (or no local copy yet)
 * - missing:        SKILL.md does not exist at the resolved org-meta path
 * - local-divergent: SKILL.md exists in both places but with different content
 */
export function inventoryOrgMetaSkills(specRoot, projectRoot) {
  const skillsPath = resolve(specRoot, 'spec', 'skills.yaml');
  if (!existsSync(skillsPath)) {
    return { orgMetaDir: null, results: [], error: `skills.yaml not found at ${skillsPath}` };
  }

  let parsed;
  try {
    parsed = yaml.load(readFileSync(skillsPath, 'utf-8'), { schema: FAILSAFE_SCHEMA }) || {};
  } catch (err) {
    return { orgMetaDir: null, results: [], error: `Failed to parse skills.yaml: ${err.message}` };
  }

  const orgMetaDir = resolveOrgMetaSkillsDir();
  const rawSkills = Array.isArray(parsed.skills) ? parsed.skills : [];
  // Filter out malformed entries (missing/empty name, wrong source) AND any entries
  // whose name would be unsafe to use as a path segment — skills.yaml isn't validated
  // by doctor, so a crafted name with `..` or path separators must not reach join().
  const skills = rawSkills.filter(
    (s) =>
      typeof s?.name === 'string' &&
      s.name.length > 0 &&
      s.source === 'org-meta' &&
      !isUnsafePathSegment(s.name)
  );
  const results = [];

  for (const skill of skills) {
    const srcPath = join(orgMetaDir, skill.name, 'SKILL.md');
    if (!existsSync(srcPath)) {
      results.push({ name: skill.name, status: 'missing', srcPath });
      continue;
    }

    // Check both layouts. Prefer the categorised path when it exists so a stale
    // flat copy left over from before the layout switch doesn't mask divergence
    // in the active categorised copy. Fall back to flat only if categorised is
    // absent. Defaults category to 'meta' (matches the syncer); reject unsafe
    // category values defensively (skills.yaml isn't validated here).
    const rawCategory =
      typeof skill.category === 'string' && skill.category.length > 0 ? skill.category : 'meta';
    const category = isUnsafePathSegment(rawCategory) ? 'meta' : rawCategory;
    const localCatPath = join(projectRoot, '.agents', 'skills', category, skill.name, 'SKILL.md');
    const localFlatPath = join(projectRoot, '.agents', 'skills', skill.name, 'SKILL.md');
    const localPath = existsSync(localCatPath)
      ? localCatPath
      : existsSync(localFlatPath)
        ? localFlatPath
        : null;

    if (localPath) {
      try {
        const localContent = readFileSync(localPath, 'utf-8');
        const srcContent = readFileSync(srcPath, 'utf-8');
        if (localContent !== srcContent) {
          results.push({ name: skill.name, status: 'local-divergent', srcPath });
          continue;
        }
      } catch {
        // fall through to present
      }
    }
    results.push({ name: skill.name, status: 'present', srcPath });
  }

  return { orgMetaDir, results, error: null };
}

// ---------------------------------------------------------------------------
// Template hygiene — detect hardcoded values that should use template vars
// ---------------------------------------------------------------------------

/**
 * Known patterns: maps a template var name to regex patterns that indicate
 * the literal value is hardcoded instead of using the template placeholder.
 * Each entry: { varName, patterns: RegExp[], description }
 */
const HYGIENE_RULES = [
  {
    varName: 'nodeVersion',
    patterns: [/node-version:\s*(?:lts\/\*|\d+)/],
    description: 'Node version should use {{nodeVersion}}',
  },
  {
    varName: 'pythonVersion',
    patterns: [/python-version:\s*['"]\d+\.\d+['"]/],
    description: 'Python version should use {{pythonVersion}}',
  },
  {
    varName: 'protectedBranches',
    patterns: [/branches:\s*\[(?:main|master)(?:,\s*\w+)*\]/],
    description: 'Branch list should use {{protectedBranches}}',
  },
  {
    varName: 'docsHistoryPath',
    patterns: [/docs\/history(?:\/|\*|'|")/],
    description: 'History path should use {{docsHistoryPath}}',
  },
  {
    varName: 'testingCoverage',
    patterns: [/THRESHOLD[^}]*:-\s*\d+/],
    description: 'Coverage threshold should use {{testingCoverage}}',
  },
];

/**
 * Scans workflow templates for hardcoded values that should use template vars.
 * Returns an array of findings with file, line, and recommendation.
 */
export function checkTemplateHygiene(agentkitRoot) {
  const findings = [];
  const workflowDir = resolve(agentkitRoot, 'templates', 'github', 'workflows');
  if (!existsSync(workflowDir)) return findings;

  let files;
  try {
    files = readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch {
    return findings;
  }

  for (const file of files) {
    const filePath = resolve(workflowDir, file);
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (const rule of HYGIENE_RULES) {
      const placeholder = `{{${rule.varName}}}`;

      // Check each line for the hardcoded pattern
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(placeholder)) continue;
        for (const pattern of rule.patterns) {
          if (pattern.test(line)) {
            findings.push({
              file,
              line: i + 1,
              varName: rule.varName,
              description: rule.description,
            });
          }
        }
      }
    }
  }

  return findings;
}

export async function runDoctor({ agentkitRoot, projectRoot, flags = {} }) {
  const userContext =
    Array.isArray(flags._args) && flags._args.length > 0 ? flags._args.join(' ') : null;
  if (userContext) {
    console.log(`[agentkit:doctor] Context: ${userContext}`);
  }
  const findings = [];
  const specRoot = resolveSpecRoot(agentkitRoot, projectRoot);
  const templateSpecRoot = agentkitRoot;

  // 1) Spec validation
  let spec;
  try {
    spec = validateSpec(specRoot);
  } catch (err) {
    findings.push({
      severity: 'error',
      message: `Spec validation failed: ${err.message}`,
    });
    if (err.stack) {
      findings.push({ severity: 'error', message: `Stack: ${err.stack}` });
    }
    spec = null;
  }

  if (spec) {
    if (!spec.valid) {
      findings.push({
        severity: 'error',
        message: `Spec validation failed (${spec.errors.length} errors)`,
      });
      for (const e of spec.errors) findings.push({ severity: 'error', message: e });
    } else {
      findings.push({
        severity: 'info',
        message: `Spec validation passed (${spec.warnings.length} warnings)`,
      });
      for (const w of spec.warnings) findings.push({ severity: 'warning', message: w });
    }
  }

  // 2) Required fields coverage
  const mappingWarnings = validateRequiredFields(specRoot);
  if (mappingWarnings && mappingWarnings.length > 0) {
    for (const w of mappingWarnings) {
      findings.push({ severity: 'warning', message: w });
    }
  }

  // 3) Overlay/template sanity
  const { targets, error: overlayError } = loadOverlayRenderTargets(templateSpecRoot);
  if (overlayError) {
    findings.push({ severity: 'error', message: overlayError });
  } else if (targets.length === 0) {
    findings.push({
      severity: 'warning',
      message: 'No renderTargets defined in overlay settings; sync defaults may be broad.',
    });
  } else {
    const checks = checkTemplateRoots(templateSpecRoot, targets);
    for (const c of checks) {
      if (!c.exists)
        findings.push({
          severity: 'error',
          message: `Missing template root for target '${c.target}': ${c.path}`,
        });
    }
    const missingCount = checks.filter((c) => !c.exists).length;
    if (checks.length > 0 && missingCount === 0)
      findings.push({
        severity: 'info',
        message: `Template roots present for all ${checks.length} configured targets.`,
      });
  }

  // 4) project.yaml completeness
  const projectPath = resolve(specRoot, 'spec', 'project.yaml');
  if (existsSync(projectPath)) {
    try {
      const project =
        yaml.load(readFileSync(projectPath, 'utf-8'), { schema: FAILSAFE_SCHEMA }) || {};
      const c = computeProjectCompleteness(project, { profile: 'diagnostics' });
      findings.push({
        severity: 'info',
        message: `project.yaml completeness: ${c.percent}% (${c.present}/${c.total})`,
      });
      if (c.missing.length > 0) {
        findings.push({
          severity: 'warning',
          message: `Top missing high-impact fields: ${c.missing.slice(0, 5).join(', ')}`,
        });
      }

      // 3b) Validate PROJECT_MAPPING src paths exist in project.yaml
      const mappingWarnings = validateMappingCoverage(project, PROJECT_MAPPING);
      if (mappingWarnings && mappingWarnings.length > 0) {
        for (const w of mappingWarnings) {
          findings.push({ severity: 'warning', message: w });
        }
      }

      const vars = flattenProjectYaml(project);
      if (vars.languageProfileMode === 'configured' && !vars.hasConfiguredLanguages) {
        findings.push({
          severity: 'warning',
          message:
            'Language profile mode is configured-only but stack.languages is empty. Effective language flags will remain false until languages are explicitly configured.',
        });
      }
      if (vars.languageProfileMode === 'heuristic' && !vars.hasLanguageInferenceSignalsEnabled) {
        findings.push({
          severity: 'warning',
          message:
            'Language profile mode is heuristic, but all inference signals are disabled (inferFrom.frameworks/tests). Effective language flags may remain false.',
        });
      }

      if (!vars.showLanguageProfileDiagnostics) {
        findings.push({
          severity: 'info',
          message:
            'Language profile diagnostics are disabled via automation.languageProfile.diagnostics=off.',
        });
      } else if (vars.hasLanguageInferenceUsedRaw) {
        findings.push({
          severity: 'warning',
          message:
            'Language profile is being inferred heuristically because stack.languages is empty. Add explicit stack.languages in project.yaml for deterministic generation.',
        });
      }
      if (vars.showLanguageProfileDiagnostics && vars.hasLanguageInferenceMismatchRaw) {
        findings.push({
          severity: 'warning',
          message:
            'Configured stack.languages diverges from inferred language signals (frameworks/tests). Generation uses configured values. Review stack.languages for alignment.',
        });
      }
    } catch (err) {
      findings.push({ severity: 'error', message: `Failed to parse project.yaml: ${err.message}` });
    }
  } else {
    findings.push({ severity: 'warning', message: `project.yaml not found at ${projectPath}` });
  }

  // 4) Merge driver health
  const gitattrsPath = resolve(projectRoot, '.gitattributes');
  if (existsSync(gitattrsPath)) {
    const gitattrs = readFileSync(gitattrsPath, 'utf-8');
    const hasMarkers =
      (gitattrs.includes('# >>> Retort merge drivers') ||
        gitattrs.includes('# >>> AgentKit Forge merge drivers')) &&
      (gitattrs.includes('# <<< Retort merge drivers') ||
        gitattrs.includes('# <<< AgentKit Forge merge drivers'));
    const hasMergeRules = gitattrs.includes('merge=agentkit-generated');

    if (!hasMergeRules) {
      findings.push({
        severity: 'error',
        message:
          '.gitattributes is missing merge=agentkit-generated rules. Run sync to generate them.',
      });
    } else if (!hasMarkers) {
      findings.push({
        severity: 'warning',
        message:
          '.gitattributes has merge rules but missing managed-section markers. Run sync to update.',
      });
    } else {
      findings.push({
        severity: 'info',
        message: '.gitattributes merge driver section is present with managed markers.',
      });
    }

    // Check local git config for the merge driver
    if (hasMergeRules) {
      try {
        const driver = execSync('git config merge.agentkit-generated.driver', {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (driver) {
          findings.push({
            severity: 'info',
            message: `Merge driver active locally: ${driver}`,
          });
        }
      } catch {
        findings.push({
          severity: 'warning',
          message:
            'Merge driver "agentkit-generated" not configured locally. Run: git config merge.agentkit-generated.name "Accept upstream for generated files" && git config merge.agentkit-generated.driver "cp %B %A"',
        });
      }
    }
  } else {
    findings.push({
      severity: 'error',
      message: '.gitattributes not found. Run sync to generate merge driver configuration.',
    });
  }

  // 5) Org-meta skill inventory
  const inventory = inventoryOrgMetaSkills(specRoot, projectRoot);
  if (inventory.error) {
    findings.push({ severity: 'warning', message: `Org-meta skill inventory: ${inventory.error}` });
  } else if (inventory.results.length === 0) {
    findings.push({
      severity: 'info',
      message: 'Org-meta skill inventory: no skills sourced from org-meta in skills.yaml.',
    });
  } else {
    const present = inventory.results.filter((r) => r.status === 'present').length;
    const missing = inventory.results.filter((r) => r.status === 'missing');
    const divergent = inventory.results.filter((r) => r.status === 'local-divergent');
    findings.push({
      severity: 'info',
      message: `Org-meta skill inventory: ${present} present, ${missing.length} missing, ${divergent.length} local-divergent (org-meta dir: ${inventory.orgMetaDir}).`,
    });
    for (const r of missing) {
      findings.push({
        severity: 'warning',
        message: `  Org-meta skill '${r.name}' missing at ${r.srcPath}`,
      });
    }
    for (const r of divergent) {
      findings.push({
        severity: 'info',
        message: `  Org-meta skill '${r.name}' has local divergence (sync preserves local copy)`,
      });
    }
  }

  // 6) Template hygiene — detect hardcoded values that should use template vars
  const hygieneFindings = checkTemplateHygiene(agentkitRoot);
  if (hygieneFindings.length === 0) {
    findings.push({
      severity: 'info',
      message: 'Template hygiene: all workflow templates use template vars correctly.',
    });
  } else {
    findings.push({
      severity: 'warning',
      message: `Template hygiene: ${hygieneFindings.length} hardcoded value(s) should use template vars.`,
    });
    for (const h of hygieneFindings) {
      findings.push({
        severity: 'warning',
        message: `  ${h.file}:${h.line} — ${h.description}`,
      });
    }
  }

  // Output
  const hasErrors = findings.some((f) => f.severity === 'error');
  const hasWarnings = findings.some((f) => f.severity === 'warning');
  const status = hasErrors ? 'FAIL' : hasWarnings ? 'WARN' : 'PASS';

  console.log(`[agentkit:doctor] Status: ${status}`);
  for (const f of findings) {
    const tag = f.severity.toUpperCase().padEnd(7);
    console.log(`  ${tag} ${f.message}`);
  }

  if (flags.verbose) {
    console.log('\n[agentkit:doctor] Suggested next actions:');
    if (hasErrors) {
      console.log('  1) Fix spec errors: node src/cli.mjs spec-validate');
      console.log('  2) Re-run diagnostics: node src/cli.mjs doctor --verbose');
    } else if (hasWarnings) {
      console.log('  1) Fill missing project.yaml fields for richer templates');
      console.log('  2) Run sync to regenerate outputs: node src/cli.mjs sync');
    } else {
      console.log('  System healthy. Continue with /orchestrate workflow.');
    }
  }

  await emitEvent(
    projectRoot,
    'doctor_completed',
    {
      status,
      errorCount: findings.filter((f) => f.severity === 'error').length,
      warningCount: findings.filter((f) => f.severity === 'warning').length,
      ...(userContext ? { userContext } : {}),
    },
    { source: 'doctor' }
  );

  return { ok: !hasErrors, status, findings };
}
