/**
 * AgentKit Forge — Doctor
 * Repository diagnostics and setup checks.
 */
import { existsSync, readFileSync } from 'fs';
import yaml, { FAILSAFE_SCHEMA } from 'js-yaml';
import { resolve } from 'path';
import { validateSpec, validateMappingCoverage } from './spec-validator.mjs';
import { computeProjectCompleteness } from './project-completeness.mjs';
import { flattenProjectYaml } from './template-utils.mjs';

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

  // 2) Mapping coverage
  const mappingWarnings = validateMappingCoverage(specRoot);
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
