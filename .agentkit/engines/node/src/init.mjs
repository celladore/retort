/**
 * AgentKit Forge — Init Command (§12)
 * Interactive multi-phase wizard for project setup.
 * Uses @clack/prompts for Windows-safe interactive prompts.
 *
 * Flags:
 *   --repoName <name>      Override repo name
 *   --force                 Overwrite existing overlay
 *   --non-interactive       Skip prompts, use auto-detected defaults
 *   --ci                    Alias for --non-interactive
 *   --preset <preset>       minimal | full | team | infra
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { basename, resolve } from 'path';
import { REPO_NAME_PATTERN } from './repo-name.mjs';

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

const PRESETS = {
  minimal: {
    label: 'Minimal — AGENTS.md + one primary tool',
    renderTargets: ['claude'],
  },
  full: {
    label: 'Full — all supported AI tools',
    renderTargets: [
      'claude',
      'cursor',
      'windsurf',
      'copilot',
      'gemini',
      'codex',
      'warp',
      'cline',
      'roo',
      'ai',
      'mcp',
    ],
  },
  team: {
    label: 'Team — the big four (Claude, Cursor, Copilot, Windsurf)',
    renderTargets: ['claude', 'cursor', 'copilot', 'windsurf'],
  },
  infra: {
    label: 'Infra — IaC-focused defaults + key AI tools',
    renderTargets: ['claude', 'cursor', 'copilot', 'windsurf', 'mcp'],
  },
};

function applyPresetDefaults(project, preset) {
  if (!project) {
    throw new TypeError('applyPresetDefaults: project is required');
  }
  if (preset !== 'infra') return project;

  project.deployment = project.deployment || {};
  project.deployment.cloudProvider = project.deployment.cloudProvider || 'azure';
  project.deployment.iacTool = project.deployment.iacTool || 'terraform';

  project.infrastructure = project.infrastructure || {};
  project.infrastructure.namingConvention =
    project.infrastructure.namingConvention || '{org}-{env}-{project}-{resourcetype}-{region}';
  project.infrastructure.iacToolchain =
    Array.isArray(project.infrastructure.iacToolchain) &&
    project.infrastructure.iacToolchain.length > 0
      ? project.infrastructure.iacToolchain
      : ['terraform', 'terragrunt'];
  project.infrastructure.stateBackend = project.infrastructure.stateBackend || 'azurerm';

  return project;
}

const ALL_TOOL_OPTIONS = [
  { value: 'claude', label: 'Claude Code', hint: 'CLAUDE.md, .claude/' },
  { value: 'cursor', label: 'Cursor', hint: '.cursor/' },
  { value: 'windsurf', label: 'Windsurf', hint: '.windsurf/' },
  { value: 'copilot', label: 'GitHub Copilot', hint: '.github/' },
  { value: 'gemini', label: 'Gemini', hint: 'GEMINI.md, .gemini/' },
  { value: 'codex', label: 'OpenAI Codex', hint: '.agents/skills/' },
  { value: 'warp', label: 'Warp', hint: 'WARP.md' },
  { value: 'cline', label: 'Cline', hint: '.clinerules/' },
  { value: 'roo', label: 'Roo Code', hint: '.roo/rules/' },
  { value: 'ai', label: 'Continue / AI', hint: '.ai/' },
  { value: 'mcp', label: 'MCP configs', hint: 'mcp/' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeRepoName(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '.' || trimmed === '..') return null;
  if (!trimmed) return null;
  if (/[/\\]/.test(trimmed)) return null;
  if (!REPO_NAME_PATTERN.test(trimmed)) return null;
  return trimmed;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function runInit({ agentkitRoot, projectRoot, flags }) {
  const force = flags.force || false;
  const nonInteractive = flags['non-interactive'] || flags.ci || false;
  const preset = flags.preset || null;
  const rawRepoName = flags.repoName ?? basename(projectRoot);
  const repoName = sanitizeRepoName(rawRepoName);
  if (!repoName) {
    throw new Error(
      'Invalid repo name: must be non-empty and contain only letters, numbers, dots, underscores, and hyphens. Path separators and parent-directory references are not allowed.'
    );
  }

  // Validate preset
  if (preset && !PRESETS[preset]) {
    throw new Error(`Unknown preset: "${preset}". Available: ${Object.keys(PRESETS).join(', ')}`);
  }

  // Check if overlay already exists
  const overlayDir = resolve(agentkitRoot, 'overlays', repoName);
  if (existsSync(overlayDir) && !force) {
    throw new Error(`Overlay already exists at ${overlayDir}. Use --force to overwrite.`);
  }

  // --- Phase 0: Discovery ---
  console.log('[agentkit:init] Scanning repository...');
  const { runDiscover } = await import('./discover.mjs');
  // Run discover silently (capture report without printing)
  const origLog = console.log;
  let report;
  try {
    console.log = () => {};
    report = await runDiscover({ agentkitRoot, projectRoot, flags: { output: 'json' } });
  } finally {
    console.log = origLog;
  }

  // Print discovery summary
  const stacks = report.techStacks.map((s) => `${s.label} (${s.fileCount} files)`).join(', ');
  const fwAll = Object.values(report.frameworks).flat();
  const fwStr = fwAll.length > 0 ? fwAll.join(', ') : 'none detected';
  const testStr = report.testing.length > 0 ? report.testing.join(', ') : 'none detected';
  console.log(`  Stacks:     ${stacks || 'none detected'}`);
  console.log(`  Frameworks: ${fwStr}`);
  console.log(`  Testing:    ${testStr}`);
  if (report.monorepo.detected) {
    console.log(`  Monorepo:   ${report.monorepo.tools.join(' + ')}`);
  }

  // Build project data from discovery defaults
  const project = buildProjectDefaults(report, repoName);

  // --- Non-interactive fast path ---
  if (nonInteractive || process.env.CI) {
    console.log('[agentkit:init] Non-interactive mode — using auto-detected defaults.');
    applyPresetDefaults(project, preset);
    const targets = preset ? PRESETS[preset].renderTargets : PRESETS.full.renderTargets;
    return await finalizeInit({
      agentkitRoot,
      projectRoot,
      repoName,
      project,
      renderTargets: targets,
      force,
    });
  }

  // --- Preset fast path ---
  if (preset) {
    console.log(`[agentkit:init] Using preset: ${PRESETS[preset].label}`);
    applyPresetDefaults(project, preset);
    return await finalizeInit({
      agentkitRoot,
      projectRoot,
      repoName,
      project,
      renderTargets: PRESETS[preset].renderTargets,
      force,
    });
  }

  // --- Interactive wizard ---
  let clack;
  try {
    clack = await import('@clack/prompts');
  } catch {
    console.warn(
      '[agentkit:init] @clack/prompts not available — falling back to non-interactive mode.'
    );
    return await finalizeInit({
      agentkitRoot,
      projectRoot,
      repoName,
      project,
      renderTargets: PRESETS.full.renderTargets,
      force,
    });
  }

  clack.intro('AgentKit Forge — Project Setup');

  // --- Phase 1: Project Identity ---
  const identity = await clack.group({
    name: () =>
      clack.text({
        message: 'Project name',
        initialValue: project.name,
        placeholder: repoName,
      }),
    description: () =>
      clack.text({
        message: 'Project description',
        initialValue: project.description || '',
        placeholder: 'Short project description',
      }),
    phase: () =>
      clack.select({
        message: 'Project phase',
        initialValue: project.phase || 'active',
        options: [
          { value: 'greenfield', label: 'Greenfield — new project, few conventions yet' },
          { value: 'active', label: 'Active — primary development phase' },
          { value: 'maintenance', label: 'Maintenance — stable, mostly bug fixes' },
          { value: 'legacy', label: 'Legacy — minimal changes, sunset planned' },
        ],
      }),
  });

  if (clack.isCancel(identity)) {
    clack.cancel('Init cancelled.');
    process.exit(0);
  }
  Object.assign(project, identity);

  // --- Phase 2: Architecture & Process ---
  const archProcess = await clack.group({
    architecturePattern: () =>
      clack.select({
        message: 'Architecture pattern',
        initialValue: project.architecture?.pattern || 'monolith',
        options: [
          { value: 'clean', label: 'Clean Architecture' },
          { value: 'hexagonal', label: 'Hexagonal / Ports & Adapters' },
          { value: 'mvc', label: 'MVC' },
          { value: 'microservices', label: 'Microservices' },
          { value: 'monolith', label: 'Monolith' },
          { value: 'serverless', label: 'Serverless' },
        ],
      }),
    apiStyle: () =>
      clack.select({
        message: 'API style',
        initialValue: project.architecture?.apiStyle || 'rest',
        options: [
          { value: 'rest', label: 'REST' },
          { value: 'graphql', label: 'GraphQL' },
          { value: 'grpc', label: 'gRPC' },
          { value: 'mixed', label: 'Mixed' },
        ],
      }),
    branchStrategy: () =>
      clack.select({
        message: 'Branch strategy',
        initialValue: project.process?.branchStrategy || 'github-flow',
        options: [
          { value: 'trunk-based', label: 'Trunk-based development' },
          { value: 'github-flow', label: 'GitHub Flow (feature branches + PRs)' },
          { value: 'gitflow', label: 'GitFlow (develop/release/hotfix)' },
        ],
      }),
    commitConvention: () =>
      clack.select({
        message: 'Commit convention',
        initialValue: project.process?.commitConvention || 'conventional',
        options: [
          { value: 'conventional', label: 'Conventional Commits (feat:, fix:, etc.)' },
          { value: 'semantic', label: 'Semantic versioning messages' },
          { value: 'none', label: 'No convention' },
        ],
      }),
    teamSize: () =>
      clack.select({
        message: 'Team size',
        initialValue: project.process?.teamSize || 'small',
        options: [
          { value: 'solo', label: 'Solo developer' },
          { value: 'small', label: 'Small (2-5 devs)' },
          { value: 'medium', label: 'Medium (6-15 devs)' },
          { value: 'large', label: 'Large (15+ devs)' },
        ],
      }),
  });

  if (clack.isCancel(archProcess)) {
    clack.cancel('Init cancelled.');
    process.exit(0);
  }
  project.architecture = project.architecture || {};
  project.architecture.pattern = archProcess.architecturePattern;
  project.architecture.apiStyle = archProcess.apiStyle;
  project.process = project.process || {};
  project.process.branchStrategy = archProcess.branchStrategy;
  project.process.commitConvention = archProcess.commitConvention;
  project.process.codeReview = 'required-pr';
  project.process.teamSize = archProcess.teamSize;

  // --- Phase 3: Documentation (auto-detected, confirm) ---
  if (report.documentation.length > 0 || report.designSystem.length > 0) {
    const docSummary = [
      ...report.documentation.map((d) => `  ✓ ${d.label} at ${d.path}`),
      ...report.designSystem.map((d) => `  ✓ ${d}`),
    ].join('\n');
    clack.note(docSummary, 'Detected documentation');

    const acceptDocs = await clack.confirm({
      message: 'Accept detected documentation paths?',
      initialValue: true,
    });
    if (clack.isCancel(acceptDocs)) {
      clack.cancel('Init cancelled.');
      process.exit(0);
    }
  }

  // --- Phase 4: Deployment ---
  const cloudDetected = detectCloudProvider(report);
  const deployment = await clack.group({
    cloudProvider: () =>
      clack.select({
        message: 'Cloud provider',
        initialValue: cloudDetected || 'none',
        options: [
          { value: 'aws', label: 'AWS' },
          { value: 'azure', label: 'Azure' },
          { value: 'gcp', label: 'Google Cloud' },
          { value: 'vercel', label: 'Vercel' },
          { value: 'netlify', label: 'Netlify' },
          { value: 'self-hosted', label: 'Self-hosted' },
          { value: 'none', label: 'None / Not sure' },
        ],
      }),
    containerized: () =>
      clack.confirm({
        message: 'Containerized (Docker)?',
        initialValue: report.infrastructure.includes('docker'),
      }),
    iacTool: () =>
      clack.select({
        message: 'Infrastructure-as-Code tool',
        initialValue: detectIacTool(report) || 'none',
        options: [
          { value: 'terraform', label: 'Terraform' },
          { value: 'bicep', label: 'Bicep' },
          { value: 'pulumi', label: 'Pulumi' },
          { value: 'cdk', label: 'AWS CDK' },
          { value: 'none', label: 'None' },
        ],
      }),
  });

  if (clack.isCancel(deployment)) {
    clack.cancel('Init cancelled.');
    process.exit(0);
  }
  project.deployment = project.deployment || {};
  project.deployment.cloudProvider = deployment.cloudProvider;
  project.deployment.containerized = deployment.containerized;
  project.deployment.iacTool = deployment.iacTool;

  // --- Phase 5: Cross-cutting concerns ---
  const ccDetected = [];
  if (report.crosscutting.logging?.length)
    ccDetected.push(`Logging: ${report.crosscutting.logging.join(', ')}`);
  if (report.crosscutting.authentication?.length)
    ccDetected.push(`Auth: ${report.crosscutting.authentication.join(', ')}`);
  if (report.crosscutting.caching?.length)
    ccDetected.push(`Caching: ${report.crosscutting.caching.join(', ')}`);
  if (report.crosscutting.errorHandling?.length)
    ccDetected.push(`Error handling: ${report.crosscutting.errorHandling.join(', ')}`);
  if (report.crosscutting.featureFlags?.length)
    ccDetected.push(`Feature flags: ${report.crosscutting.featureFlags.join(', ')}`);

  if (ccDetected.length > 0) {
    clack.note(ccDetected.map((c) => `  ${c}`).join('\n'), 'Detected cross-cutting patterns');
    const acceptCC = await clack.confirm({
      message: 'Accept detected cross-cutting patterns?',
      initialValue: true,
    });
    if (clack.isCancel(acceptCC)) {
      clack.cancel('Init cancelled.');
      process.exit(0);
    }
  }

  // --- Phase 6: AI Tool Selection ---
  const existingHints = detectExistingTools(projectRoot);
  const toolOptions = ALL_TOOL_OPTIONS.map((opt) => ({
    ...opt,
    label: existingHints.includes(opt.value) ? `${opt.label} (detected)` : opt.label,
  }));

  const selectedTools = await clack.multiselect({
    message: 'Which AI tools does your team use? (AGENTS.md always generated)',
    options: toolOptions,
    initialValues: existingHints.length > 0 ? existingHints : ['claude', 'cursor', 'copilot'],
    required: false,
  });

  if (clack.isCancel(selectedTools)) {
    clack.cancel('Init cancelled.');
    process.exit(0);
  }
  const renderTargets = selectedTools.length > 0 ? selectedTools : ['claude'];

  // --- Phase 7: Write & Sync ---
  clack.outro('Configuration complete — writing files...');

  return await finalizeInit({ agentkitRoot, projectRoot, repoName, project, renderTargets, force });
}

// ---------------------------------------------------------------------------
// Finalize: write overlay, project.yaml, run sync
// ---------------------------------------------------------------------------

async function finalizeInit({
  agentkitRoot,
  projectRoot,
  repoName,
  project,
  renderTargets,
  force,
}) {
  // 1. Copy __TEMPLATE__ overlay
  const templateDir = resolve(agentkitRoot, 'overlays', '__TEMPLATE__');
  const overlayDir = resolve(agentkitRoot, 'overlays', repoName);
  if (!existsSync(templateDir)) {
    throw new Error(`Template overlay not found at ${templateDir}`);
  }

  console.log(`[agentkit:init] Creating overlay for: ${repoName}`);
  mkdirSync(overlayDir, { recursive: true });
  cpSync(templateDir, overlayDir, { recursive: true, force: true });

  // 2. Update settings.yaml with repoName + renderTargets
  const settingsPath = resolve(overlayDir, 'settings.yaml');
  if (existsSync(settingsPath)) {
    const settings = yaml.load(readFileSync(settingsPath, 'utf-8')) || {};
    settings.repoName = repoName;
    settings.renderTargets = renderTargets;
    if (project.stack?.languages?.length > 0) {
      settings.primaryStack = project.stack.languages[0];
    }
    writeFileSync(settingsPath, yaml.dump(settings, { lineWidth: 120 }), 'utf-8');
    console.log(
      `[agentkit:init] Updated overlay settings (${renderTargets.length} render targets)`
    );
  }

  // 3. Write project.yaml
  const projectYamlPath = resolve(agentkitRoot, 'spec', 'project.yaml');
  writeProjectYaml(projectYamlPath, project);
  console.log(`[agentkit:init] Generated spec/project.yaml`);

  // 4. Create .agentkit-repo marker
  const markerPath = resolve(projectRoot, '.agentkit-repo');
  writeFileSync(markerPath, repoName + '\n', 'utf-8');
  console.log(`[agentkit:init] Created .agentkit-repo marker`);

  // 5. Run sync
  console.log(`[agentkit:init] Running sync...`);
  const { runSync } = await import('./synchronize.mjs');
  await runSync({ agentkitRoot, projectRoot, flags: { overlay: repoName } });

  console.log(`[agentkit:init] Done! Repo initialized as: ${repoName}`);
  console.log(`  Render targets: ${renderTargets.join(', ')}`);
  console.log(`  Tip: Run "agentkit add <tool>" to add tools later.`);
}

// ---------------------------------------------------------------------------
// Build project defaults from discovery report
// ---------------------------------------------------------------------------

function buildProjectDefaults(report, repoName) {
  const project = {
    name: repoName,
    description: null,
    phase: 'active',
    stack: {
      languages: report.techStacks.map((s) => s.name),
      frameworks: {
        frontend: report.frameworks.frontend || [],
        backend: report.frameworks.backend || [],
        css: report.frameworks.css || [],
      },
      orm: report.frameworks.orm?.[0] || null,
      database: [],
      search: null,
      messaging: [],
    },
    architecture: {
      pattern: null,
      apiStyle: 'rest',
      monorepo: report.monorepo.detected,
      monorepoTool: report.monorepo.tools?.[0] || null,
    },
    documentation: {
      hasPrd: false,
      prdPath: null,
      hasAdr: false,
      adrPath: null,
      hasApiSpec: false,
      apiSpecPath: null,
      hasTechnicalSpec: false,
      technicalSpecPath: null,
      hasDesignSystem: false,
      designSystemPath: null,
      storybook: false,
      designTokensPath: null,
    },
    deployment: {
      cloudProvider: null,
      containerized: false,
      environments: [],
      iacTool: null,
    },
    process: {
      branchStrategy: 'github-flow',
      commitConvention: 'conventional',
      codeReview: 'required-pr',
      teamSize: 'small',
    },
    testing: {
      unit: [],
      integration: [],
      e2e: [],
      coverage: null,
    },
    integrations: [],
    crosscutting: {
      logging: { framework: null, structured: false, correlationId: false, level: null, sink: [] },
      errorHandling: {
        strategy: null,
        globalHandler: false,
        customExceptions: false,
        errorCodes: false,
      },
      authentication: { provider: null, strategy: null, multiTenant: false, rbac: false },
      caching: { provider: null, patterns: [], distributedCache: false },
      api: { versioning: null, pagination: null, responseFormat: null, rateLimiting: false },
      database: {
        migrations: null,
        seeding: false,
        transactionStrategy: null,
        connectionPooling: false,
      },
      performance: { bundleBudget: null, lazyLoading: false, imageOptimization: false },
      featureFlags: { provider: null },
      environments: { naming: [], configStrategy: null, envFilePattern: null },
    },
  };

  // Populate documentation from discovery
  for (const doc of report.documentation || []) {
    if (doc.name === 'prd') {
      project.documentation.hasPrd = true;
      project.documentation.prdPath = doc.path;
    }
    if (doc.name === 'adr') {
      project.documentation.hasAdr = true;
      project.documentation.adrPath = doc.path;
    }
    if (doc.name === 'apiSpec') {
      project.documentation.hasApiSpec = true;
      project.documentation.apiSpecPath = doc.path;
    }
    if (doc.name === 'technicalSpec') {
      project.documentation.hasTechnicalSpec = true;
      project.documentation.technicalSpecPath = doc.path;
    }
  }
  for (const ds of report.designSystem || []) {
    if (ds === 'storybook') project.documentation.storybook = true;
    if (ds === 'component-library') {
      project.documentation.hasDesignSystem = true;
      project.documentation.designSystemPath = 'packages/ui/';
    }
    if (ds === 'design-tokens') project.documentation.designTokensPath = 'styles/tokens/';
  }

  // Populate testing from discovery
  const unitTools = ['vitest', 'jest', 'xunit', 'nunit', 'pytest', 'mocha'];
  const e2eTools = ['playwright', 'cypress'];
  for (const t of report.testing || []) {
    if (e2eTools.includes(t)) {
      project.testing.e2e.push(t);
      project.testing.integration.push(t);
    } else if (unitTools.includes(t)) {
      project.testing.unit.push(t);
    }
  }

  // Populate crosscutting from discovery
  if (report.crosscutting.logging?.length) {
    project.crosscutting.logging.framework = report.crosscutting.logging[0];
    project.crosscutting.logging.structured = true;
  }
  if (report.crosscutting.authentication?.length) {
    project.crosscutting.authentication.provider = report.crosscutting.authentication[0];
  }
  if (report.crosscutting.caching?.length) {
    project.crosscutting.caching.provider = report.crosscutting.caching[0];
    project.crosscutting.caching.distributedCache = report.crosscutting.caching[0] === 'redis';
  }
  if (report.crosscutting.errorHandling?.length) {
    project.crosscutting.errorHandling.strategy = report.crosscutting.errorHandling[0];
    project.crosscutting.errorHandling.globalHandler = true;
  }
  if (report.crosscutting.featureFlags?.length) {
    project.crosscutting.featureFlags.provider = report.crosscutting.featureFlags[0];
  }
  if (report.crosscutting.envConfig) {
    project.crosscutting.environments.configStrategy = report.crosscutting.envConfig;
  }

  // Deployment hints from infra detection
  project.deployment.containerized = report.infrastructure.includes('docker');

  return project;
}

// ---------------------------------------------------------------------------
// Write project.yaml with comments
// ---------------------------------------------------------------------------

function writeProjectYaml(filePath, project) {
  const header = [
    '# =============================================================================',
    '# project.yaml — Project-level metadata for rich, context-aware AI configs',
    '# Generated by `agentkit init` — edit as needed.',
    '# =============================================================================',
    '',
  ].join('\n');

  const yamlContent = yaml.dump(project, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });

  writeFileSync(filePath, header + yamlContent, 'utf-8');
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function detectCloudProvider(report) {
  if (report.infrastructure.includes('bicep')) return 'azure';
  if (report.infrastructure.includes('terraform')) return null;
  return null;
}

function detectIacTool(report) {
  if (report.infrastructure.includes('bicep')) return 'bicep';
  if (report.infrastructure.includes('terraform')) return 'terraform';
  if (report.infrastructure.includes('pulumi')) return 'pulumi';
  return null;
}

function detectExistingTools(projectRoot) {
  const detected = [];
  const checks = [
    { tool: 'claude', paths: ['.claude', 'CLAUDE.md'] },
    { tool: 'cursor', paths: ['.cursor'] },
    { tool: 'windsurf', paths: ['.windsurf'] },
    { tool: 'copilot', paths: ['.github/copilot-instructions.md'] },
    { tool: 'gemini', paths: ['GEMINI.md', '.gemini'] },
    { tool: 'codex', paths: ['.agents'] },
    { tool: 'warp', paths: ['WARP.md'] },
    { tool: 'cline', paths: ['.clinerules'] },
    { tool: 'roo', paths: ['.roo'] },
    { tool: 'ai', paths: ['.ai'] },
    { tool: 'mcp', paths: ['mcp'] },
  ];
  for (const { tool, paths } of checks) {
    if (paths.some((p) => existsSync(resolve(projectRoot, p)))) {
      detected.push(tool);
    }
  }
  return detected;
}
