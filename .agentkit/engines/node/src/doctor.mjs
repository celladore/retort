/**
 * AgentKit Forge — Doctor
 * Repository diagnostics and setup checks.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import yaml, { FAILSAFE_SCHEMA } from 'js-yaml';
import { resolve } from 'path';
import { validateSpec } from './spec-validator.mjs';
import { computeProjectCompleteness } from './project-completeness.mjs';

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

export async function runDoctor({ agentkitRoot, projectRoot, flags = {} }) {
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

  // 2) Overlay/template sanity
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

  // 3) project.yaml completeness
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
      gitattrs.includes('# >>> AgentKit Forge merge drivers') &&
      gitattrs.includes('# <<< AgentKit Forge merge drivers');
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

  return { ok: !hasErrors, status, findings };
}
