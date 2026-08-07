/**
 * AgentKit Forge — Validate Command
 * Validates generated outputs for correctness.
 * Now includes spec-aware validation via spec-validator.mjs.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import { extname, join, resolve } from 'path';
import { validateSpec, PROJECT_ENUMS } from './spec-validator.mjs';
import { emitEvent } from './event-emitter.mjs';
import { createTask } from './task-protocol.mjs';
import {
  VALID_COMMANDS,
  FRAMEWORK_COMMANDS as CLI_FRAMEWORK_COMMANDS,
} from './commands-registry.mjs';

export async function runValidate({ agentkitRoot, projectRoot, flags }) {
  const userContext =
    Array.isArray(flags?._args) && flags._args.length > 0 ? flags._args.join(' ') : null;
  console.log('[agentkit:validate] Validating generated outputs...');
  if (userContext) {
    console.log(`[agentkit:validate] Context: ${userContext}`);
  }
  let errors = 0;
  let warnings = 0;

  // ─── Phase 1: Validate spec files ──────────────────────────────────────
  console.log('\n  --- Spec Validation ---');
  const specResult = validateSpec(agentkitRoot);
  for (const err of specResult.errors) {
    console.error(`  FAIL: [spec] ${err}`);
    errors++;
  }
  for (const warn of specResult.warnings) {
    console.warn(`  WARN: [spec] ${warn}`);
    warnings++;
  }
  if (specResult.valid) {
    console.log('  OK: All spec files pass schema validation');
  }

  // ─── Phase 2: Check required directories ───────────────────────────────
  console.log('\n  --- Output Directories ---');
  const requiredDirs = [
    '.claude/commands',
    '.claude/hooks',
    '.claude/rules',
    '.claude/agents',
    '.cursor/rules',
    '.windsurf/rules',
    '.ai',
    'docs',
  ];

  for (const dir of requiredDirs) {
    const fullPath = resolve(projectRoot, dir);
    if (!existsSync(fullPath)) {
      console.error(`  FAIL: Missing directory: ${dir}`);
      errors++;
    } else {
      console.log(`  OK: ${dir}`);
    }
  }

  // ─── Phase 3: Validate JSON files ──────────────────────────────────────
  console.log('\n  --- JSON Files ---');
  const jsonFiles = [
    { label: '.claude/settings.json', path: resolve(projectRoot, '.claude/settings.json') },
    {
      label: '.agentkit/templates/claude/state/schema.json',
      path: resolve(agentkitRoot, 'templates/claude/state/schema.json'),
    },
  ];

  for (const file of jsonFiles) {
    const fullPath = file.path;
    if (!existsSync(fullPath)) {
      console.error(`  FAIL: Missing JSON file: ${file.label}`);
      errors++;
      continue;
    }
    try {
      JSON.parse(readFileSync(fullPath, 'utf-8'));
      console.log(`  OK: ${file.label} (valid JSON)`);
    } catch (err) {
      console.error(`  FAIL: ${file.label} — invalid JSON: ${err.message}`);
      errors++;
    }
  }

  // ─── Phase 4: Check command files match spec ───────────────────────────
  console.log('\n  --- Commands ---');
  const requiredCommands = [
    'orchestrate',
    'discover',
    'healthcheck',
    'review',
    'sync-backlog',
    'check',
    'plan',
    'handoff',
    'build',
    'test',
    'format',
    'deploy',
    'security',
    'project-review',
    'team-backend',
    'team-frontend',
    'team-data',
    'team-infra',
    'team-devops',
    'team-testing',
    'team-security',
    'team-docs',
    'team-product',
    'team-quality',
  ];

  let commandsOk = 0;
  for (const cmd of requiredCommands) {
    const fullPath = resolve(projectRoot, '.claude', 'commands', `${cmd}.md`);
    if (!existsSync(fullPath)) {
      console.error(`  FAIL: Missing command: .claude/commands/${cmd}.md`);
      errors++;
    } else {
      commandsOk++;
    }
  }
  console.log(`  Checked ${requiredCommands.length} commands (${commandsOk} present)`);

  // ─── Phase 5: Check hook files ─────────────────────────────────────────
  console.log('\n  --- Hooks ---');
  // The invariant is that every hook script settings.json wires up exists on
  // disk. Deriving the list from settings.json rather than hardcoding it keeps
  // validation correct when feature gating legitimately omits a hook (see #185)
  // — a hardcoded list fails such repos for a file they were never meant to get.
  const settingsFile = resolve(projectRoot, '.claude', 'settings.json');
  const wiredHookFiles = new Set();
  if (existsSync(settingsFile)) {
    try {
      const parsed = JSON.parse(readFileSync(settingsFile, 'utf-8'));
      // Structurally malformed entries (null matchers, non-array hook lists)
      // are skipped rather than thrown on — Phase 7 reports the shape error,
      // and aborting here would suppress the rest of this phase.
      for (const matchers of Object.values(parsed.hooks || {})) {
        if (!Array.isArray(matchers)) continue;
        for (const matcher of matchers) {
          if (!matcher || !Array.isArray(matcher.hooks)) continue;
          for (const hook of matcher.hooks) {
            if (!hook) continue;
            for (const m of String(hook.command || '').matchAll(
              /\.claude\/hooks\/([\w.-]+?\.(?:sh|ps1))\b/g
            )) {
              wiredHookFiles.add(m[1]);
            }
          }
        }
      }
    } catch {
      /* invalid JSON is already reported by the JSON Files phase above */
    }
  }

  for (const hookFile of wiredHookFiles) {
    if (!existsSync(resolve(projectRoot, '.claude', 'hooks', hookFile))) {
      console.error(`  FAIL: settings.json wires .claude/hooks/${hookFile}, which does not exist`);
      errors++;
    }
  }
  console.log(`  Checked ${wiredHookFiles.size} hook script(s) wired in settings.json`);

  // ─── Phase 6: Check generated headers ──────────────────────────────────
  console.log('\n  --- Generated Headers ---');
  const sampleFiles = ['.claude/commands/orchestrate.md', 'CLAUDE.md', 'UNIFIED_AGENT_TEAMS.md'];

  for (const file of sampleFiles) {
    const fullPath = resolve(projectRoot, file);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, 'utf-8');
    if (
      !content.includes('GENERATED by Retort') &&
      !content.includes('GENERATED by AgentKit Forge')
    ) {
      console.warn(`  WARN: ${file} missing GENERATED header`);
      warnings++;
    } else {
      console.log(`  OK: ${file} has GENERATED header`);
    }
  }

  // ─── Phase 7: Check settings.json structure ────────────────────────────
  console.log('\n  --- Settings ---');
  const settingsPath = resolve(projectRoot, '.claude', 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      if (!settings.hooks) {
        console.error('  FAIL: settings.json missing hooks configuration');
        errors++;
      } else {
        // Verify hooks use nested array format
        for (const [event, matchers] of Object.entries(settings.hooks)) {
          if (!Array.isArray(matchers)) {
            console.error(`  FAIL: settings.json hooks.${event} should be an array`);
            errors++;
          }
        }
        console.log('  OK: settings.json hooks structure');
      }
      if (!settings.permissions?.allow?.length) {
        console.warn('  WARN: settings.json has empty allow list');
        warnings++;
      } else {
        console.log(`  OK: settings.json has ${settings.permissions.allow.length} allow rules`);
      }
    } catch {
      /* already reported above */
    }
  }

  // ─── Phase 8: Scan for forbidden patterns ──────────────────────────────
  console.log('\n  --- Secret Scan ---');
  const sensitivePatterns = [
    /password\s*[:=]\s*["'][^"']+["']/i,
    /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
    /secret\s*[:=]\s*["'][A-Za-z0-9+/=]{20,}["']/i,
    /AKIA[A-Z0-9]{16}/, // AWS access key pattern
    /ghp_[A-Za-z0-9]{36}/, // GitHub personal access token
    /sk-[A-Za-z0-9]{48}/, // OpenAI/Anthropic-style API key
  ];

  let scannedFiles = 0;
  const generatedDirs = ['.claude', '.cursor', '.windsurf', '.ai', 'docs'];
  for (const dir of generatedDirs) {
    const fullDir = resolve(projectRoot, dir);
    if (!existsSync(fullDir)) continue;
    scanForPatterns(
      fullDir,
      sensitivePatterns,
      (file, pattern) => {
        console.error(`  FAIL: Forbidden pattern in ${file}: ${pattern}`);
        errors++;
      },
      (count) => {
        scannedFiles += count;
      }
    );
  }
  console.log(`  Scanned ${scannedFiles} files for secrets`);

  // ─── Phase 9: Validate issue template fields ────────────────────────────
  console.log('\n  --- Issue Template Validation ---');
  const issueTemplateDir = resolve(projectRoot, '.github', 'ISSUE_TEMPLATE');
  if (existsSync(issueTemplateDir)) {
    const templateFiles = readdirSync(issueTemplateDir).filter(
      (f) => f.endsWith('.yml') || f.endsWith('.yaml')
    );
    for (const file of templateFiles) {
      if (file === 'config.yml' || file === 'config.yaml') continue;
      const fullPath = join(issueTemplateDir, file);
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const parsed = yaml.load(content);
        if (!parsed || !Array.isArray(parsed.body)) {
          console.warn(`  WARN: ${file} — not a valid issue form (missing body array)`);
          warnings++;
          continue;
        }
        let fieldErrors = 0;
        for (const field of parsed.body) {
          if (field.type !== 'dropdown' || !field.attributes?.options) continue;
          const id = field.id || field.attributes?.label || 'unknown';
          const options = field.attributes.options;

          if (id === 'area') {
            for (const opt of options) {
              // Extract bare area value before any description separator (e.g. "backend — Server-side" → "backend")
              const areaValue = String(opt).split(' — ')[0].trim();
              if (!PROJECT_ENUMS.issueArea.includes(areaValue)) {
                console.error(`  FAIL: ${file} field "area" has invalid option "${opt}"`);
                errors++;
                fieldErrors++;
              }
            }
          }
          if (id === 'priority') {
            for (const opt of options) {
              const prioMatch = String(opt).match(/^(P\d)/);
              if (!prioMatch || !PROJECT_ENUMS.issuePriority.includes(prioMatch[1])) {
                console.error(`  FAIL: ${file} field "priority" has invalid option "${opt}"`);
                errors++;
                fieldErrors++;
              }
            }
          }
          if (id === 'severity') {
            for (const opt of options) {
              const sevLevel = String(opt).split(' — ')[0].trim();
              if (!PROJECT_ENUMS.issueSeverity.includes(sevLevel)) {
                console.error(`  FAIL: ${file} field "severity" has invalid option "${opt}"`);
                errors++;
                fieldErrors++;
              }
            }
          }
          if (id === 'phase') {
            for (const opt of options) {
              if (!PROJECT_ENUMS.phase.includes(opt)) {
                console.error(`  FAIL: ${file} field "phase" has invalid option "${opt}"`);
                errors++;
                fieldErrors++;
              }
            }
          }
          if (id === 'impact') {
            for (const opt of options) {
              if (!PROJECT_ENUMS.issueImpact.includes(opt)) {
                console.error(`  FAIL: ${file} field "impact" has invalid option "${opt}"`);
                errors++;
                fieldErrors++;
              }
            }
          }
        }
        if (fieldErrors === 0) {
          console.log(`  OK: ${file} — all dropdown values valid`);
        }
      } catch (err) {
        console.error(`  FAIL: ${file} — parse error: ${err.message}`);
        errors++;
      }
    }
  } else {
    console.warn('  WARN: No .github/ISSUE_TEMPLATE/ directory found');
    warnings++;
  }

  // ─── Phase 10: CLI-spec command parity ─────────────────────────────────
  console.log('\n  --- CLI-Spec Command Parity ---');
  {
    // Imported from commands-registry.mjs — single source of truth
    const FRAMEWORK_COMMANDS = CLI_FRAMEWORK_COMMANDS;

    // Load spec command names from commands.yaml
    const commandsYamlPath = join(agentkitRoot, 'spec', 'commands.yaml');
    let specCommandNames = new Set();
    if (existsSync(commandsYamlPath)) {
      try {
        const commandsYaml = yaml.load(readFileSync(commandsYamlPath, 'utf-8'));
        for (const cmd of commandsYaml?.commands ?? []) {
          if (cmd.name) specCommandNames.add(cmd.name);
        }
      } catch (err) {
        console.warn(`  WARN: Could not parse commands.yaml for parity check: ${err.message}`);
        warnings++;
      }
    } else {
      console.warn('  WARN: commands.yaml not found — skipping CLI-spec parity check');
      warnings++;
    }

    // Single source of truth: imported from cli.mjs
    const CLI_COMMANDS = new Set(VALID_COMMANDS);

    // CLI commands not in spec and not framework internals — these are gaps
    const missingFromSpec = [...CLI_COMMANDS].filter(
      (cmd) => !FRAMEWORK_COMMANDS.has(cmd) && !specCommandNames.has(cmd)
    );
    // Spec commands (non-team) not in CLI — could be slash-only or missing from CLI
    const missingFromCli = [...specCommandNames].filter(
      (cmd) => !cmd.startsWith('team-') && !CLI_COMMANDS.has(cmd) && !FRAMEWORK_COMMANDS.has(cmd)
    );

    if (missingFromSpec.length > 0) {
      for (const cmd of missingFromSpec) {
        console.warn(`  WARN: CLI command '${cmd}' has no entry in commands.yaml spec`);
        warnings++;
      }
    }
    if (missingFromCli.length > 0) {
      for (const cmd of missingFromCli) {
        console.warn(`  WARN: spec command '${cmd}' has no CLI equivalent in VALID_COMMANDS`);
        warnings++;
      }
    }
    if (missingFromSpec.length === 0 && missingFromCli.length === 0) {
      console.log('  OK: CLI commands and spec commands are in sync');
    }
  }

  // ─── Event + Summary ────────────────────────────────────────────────────
  emitEvent(
    projectRoot,
    'validate_completed',
    {
      errors,
      warnings,
      passed: errors === 0,
      ...(userContext ? { userContext } : {}),
    },
    { source: 'validate' }
  );

  // Auto-create task for validation failures
  if (flags['auto-task'] && errors > 0) {
    const priority = errors >= 5 ? 'P0' : errors >= 2 ? 'P1' : 'P2';
    const result = await createTask(projectRoot, {
      delegator: 'validate',
      assignees: ['quality'],
      title: `Fix ${errors} validation error(s)`,
      description: `Validation found ${errors} error(s) and ${warnings} warning(s). Run /validate for details.`,
      type: 'implement',
      priority,
      area: 'quality',
      dependsOn: [],
      handoffTo: [],
    });
    if (result.task) {
      console.log(`[agentkit:validate] Created task for validation failures (${priority}).`);
    }
  }

  console.log('');
  if (errors > 0) {
    console.error(`[agentkit:validate] FAILED: ${errors} error(s), ${warnings} warning(s)`);
    process.exit(1);
  } else {
    console.log(`[agentkit:validate] PASSED: ${warnings} warning(s)`);
  }
}

function scanForPatterns(dir, patterns, onMatch, onCount) {
  if (!existsSync(dir)) return;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForPatterns(full, patterns, onMatch, onCount);
    } else {
      const ext = extname(entry.name);
      // Only scan text files
      if (['.md', '.json', '.yaml', '.yml', '.sh', '.ps1', '.mdc', ''].includes(ext)) {
        count++;
        try {
          let content = readFileSync(full, 'utf-8');
          // Strip code blocks and inline code to avoid false positives from documentation examples
          content = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
          for (const pattern of patterns) {
            if (pattern.test(content)) {
              onMatch(full, pattern.toString());
            }
          }
        } catch {
          /* skip unreadable files */
        }
      }
    }
  }
  if (onCount) onCount(count);
}
