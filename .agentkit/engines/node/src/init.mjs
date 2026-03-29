/**
 * Retort — Init Command (§12)
 * Interactive multi-phase wizard for project setup.
 * Uses @clack/prompts for Windows-safe interactive prompts.
 *
 * Flags:
 *   --repoName <name>      Override repo name
 *   --force                 Overwrite existing overlay
 *   --non-interactive       Skip prompts, use auto-detected defaults
 *   --ci                    Alias for --non-interactive
 *   --preset <preset>       minimal | full | team | infra
 *   --dry-run               Show what would be generated without writing files
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { basename, resolve } from 'path';
import { loadFeatureSpec, resolveFeatures } from './feature-manager.mjs';
import { REPO_NAME_PATTERN } from './repo-name.mjs';

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

const PRESETS = {
  minimal: {
    label: 'Minimal — AGENTS.md + one primary tool',
    renderTargets: ['claude'],
    featurePreset: 'minimal',
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
    featurePreset: 'full',
  },
  team: {
    label: 'Team — the big four (Claude, Cursor, Copilot, Windsurf)',
    renderTargets: ['claude', 'cursor', 'copilot', 'windsurf'],
    featurePreset: 'standard',
  },
  infra: {
    label: 'Infra — IaC-focused defaults + key AI tools',
    renderTargets: ['claude', 'cursor', 'copilot', 'windsurf', 'mcp'],
    featurePreset: 'standard',
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

const EXTERNAL_KNOWLEDGE_MODES = ['metadata-overlays', 'direct-copy', 'hybrid'];
const EXTERNAL_KNOWLEDGE_PLATFORMS = ['copilot', 'windsurf', 'claude', 'cursor'];

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

function parseCsvList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function applyExternalKnowledgeFlags(project, flags = {}) {
  project.externalKnowledge = project.externalKnowledge || {
    enabled: false,
    mode: 'metadata-overlays',
    sources: {
      windsurfDomainGuidesPath: null,
      mystiraDocsPath: null,
      markdownFiles: [],
      gitRepoUrls: [],
    },
    targetPlatforms: ['copilot', 'windsurf'],
  };

  const ek = project.externalKnowledge;
  ek.sources = ek.sources || {
    windsurfDomainGuidesPath: null,
    mystiraDocsPath: null,
    markdownFiles: [],
    gitRepoUrls: [],
  };

  if (flags['external-knowledge'] === true) {
    ek.enabled = true;
  }

  if (typeof flags['external-mode'] === 'string') {
    const mode = flags['external-mode'].trim();
    if (EXTERNAL_KNOWLEDGE_MODES.includes(mode)) {
      ek.mode = mode;
      ek.enabled = true;
    }
  }

  if (typeof flags['windsurf-guides-path'] === 'string') {
    const windsurfPath = flags['windsurf-guides-path'].trim();
    ek.sources.windsurfDomainGuidesPath = windsurfPath === '' ? null : windsurfPath;
    if (windsurfPath !== '') {
      ek.enabled = true;
    }
  }

  if (typeof flags['mystira-docs-path'] === 'string') {
    const mystiraPath = flags['mystira-docs-path'].trim();
    ek.sources.mystiraDocsPath = mystiraPath === '' ? null : mystiraPath;
    if (mystiraPath !== '') {
      ek.enabled = true;
    }
  }

  if (typeof flags['external-markdown-files'] === 'string') {
    ek.sources.markdownFiles = parseCsvList(flags['external-markdown-files']);
    if (ek.sources.markdownFiles.length > 0) ek.enabled = true;
  }

  if (typeof flags['external-git-repos'] === 'string') {
    ek.sources.gitRepoUrls = parseCsvList(flags['external-git-repos']);
    if (ek.sources.gitRepoUrls.length > 0) ek.enabled = true;
  }

  if (typeof flags['external-target-platforms'] === 'string') {
    const parsed = parseCsvList(flags['external-target-platforms']);
    const valid = parsed.filter((platform) => EXTERNAL_KNOWLEDGE_PLATFORMS.includes(platform));
    if (valid.length > 0) {
      ek.targetPlatforms = valid;
      ek.enabled = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function runInit({ agentkitRoot, projectRoot, flags }) {
  const force = flags.force || false;
  const dryRun = flags['dry-run'] || false;
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
  applyExternalKnowledgeFlags(project, flags);

  // --- Non-interactive fast path ---
  if (nonInteractive || process.env.CI) {
    console.log('[agentkit:init] Non-interactive mode — using auto-detected defaults.');
    applyPresetDefaults(project, preset);
    applyDetectedKitDefaults(project, report);
    const presetDef = preset ? PRESETS[preset] : PRESETS.full;
    return await finalizeInit({
      agentkitRoot,
      projectRoot,
      repoName,
      project,
      renderTargets: presetDef.renderTargets,
      featurePreset: presetDef.featurePreset || 'standard',
      force,
      dryRun,
    });
  }

  // --- Preset fast path ---
  if (preset) {
    console.log(`[agentkit:init] Using preset: ${PRESETS[preset].label}`);
    applyPresetDefaults(project, preset);
    applyDetectedKitDefaults(project, report);
    return await finalizeInit({
      agentkitRoot,
      projectRoot,
      repoName,
      project,
      renderTargets: PRESETS[preset].renderTargets,
      featurePreset: PRESETS[preset].featurePreset || 'standard',
      force,
      dryRun,
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
    applyDetectedKitDefaults(project, report);
    return await finalizeInit({
      agentkitRoot,
      projectRoot,
      repoName,
      project,
      renderTargets: PRESETS.full.renderTargets,
      featurePreset: 'standard',
      force,
      dryRun,
    });
  }

  clack.intro('Retort — Project Setup');

  // --- Kit detection display ---
  const STACK_TO_DOMAIN = {
    javascript: 'typescript',
    typescript: 'typescript',
    node: 'typescript',
    csharp: 'dotnet',
    dotnet: 'dotnet',
    rust: 'rust',
    python: 'python',
    solidity: 'blockchain',
    blockchain: 'blockchain',
  };
  const UNIVERSAL_KIT_NAMES = [
    'security',
    'testing',
    'git-workflow',
    'documentation',
    'ci-cd',
    'dependency-management',
    'agent-conduct',
  ];

  const detectedLangDomains = new Set();
  for (const stack of report.techStacks) {
    const domain = STACK_TO_DOMAIN[(stack.name || '').toLowerCase()];
    if (domain) detectedLangDomains.add(domain);
  }
  const iacDetectedFromReport = !!detectIacTool(report);

  const kitSummaryLines = [];
  if (detectedLangDomains.size > 0) {
    kitSummaryLines.push('Language kits (auto-detected from stack):');
    for (const d of detectedLangDomains) kitSummaryLines.push(`  ✓ ${d}`);
  } else {
    kitSummaryLines.push('Language kits: none detected');
  }
  kitSummaryLines.push('');
  kitSummaryLines.push('Universal kits (always included):');
  kitSummaryLines.push(`  ✓ ${UNIVERSAL_KIT_NAMES.join(', ')}`);
  if (iacDetectedFromReport) kitSummaryLines.push('  ✓ iac (detected from infra/)');
  clack.note(kitSummaryLines.join('\n'), 'Kit detection — nothing forced');

  // --- Optional kit selection ---
  const optionalKitChoices = await clack.multiselect({
    message: 'Additional kits to activate (space to toggle)',
    options: [
      {
        value: 'iac',
        label: 'iac — Terraform / Bicep / Pulumi',
        hint: iacDetectedFromReport ? 'auto-detected' : 'no infra/ directory found',
      },
      { value: 'finops', label: 'finops — Azure cost tracking' },
      { value: 'ai-cost-ops', label: 'ai-cost-ops — LLM token budgets' },
    ],
    initialValues: iacDetectedFromReport ? ['iac'] : [],
    required: false,
  });

  if (clack.isCancel(optionalKitChoices)) {
    clack.cancel('Init cancelled.');
    process.exit(0);
  }

  const selectedOptionalKits = Array.isArray(optionalKitChoices) ? optionalKitChoices : [];
  // Persist kit selections to project for sync engine consumption
  applyKitSelections(project, report, selectedOptionalKits);

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

  // --- Phase 3.5: External Knowledge Integration ---
  const ekFromFlags =
    flags['external-knowledge'] === true ||
    (typeof flags['external-mode'] === 'string' && flags['external-mode'].trim().length > 0) ||
    (typeof flags['windsurf-guides-path'] === 'string' &&
      flags['windsurf-guides-path'].trim().length > 0) ||
    (typeof flags['mystira-docs-path'] === 'string' &&
      flags['mystira-docs-path'].trim().length > 0) ||
    (typeof flags['external-markdown-files'] === 'string' &&
      flags['external-markdown-files'].trim().length > 0) ||
    (typeof flags['external-git-repos'] === 'string' &&
      flags['external-git-repos'].trim().length > 0) ||
    (typeof flags['external-target-platforms'] === 'string' &&
      flags['external-target-platforms'].trim().length > 0);

  if (!ekFromFlags) {
    const enableExternal = await clack.confirm({
      message: 'Configure external knowledge/doc sources for template seeding?',
      initialValue: project.externalKnowledge?.enabled || false,
    });

    if (clack.isCancel(enableExternal)) {
      clack.cancel('Init cancelled.');
      process.exit(0);
    }

    project.externalKnowledge.enabled = enableExternal;

    if (enableExternal) {
      const externalConfig = await clack.group({
        mode: () =>
          clack.select({
            message: 'External knowledge ingestion mode',
            initialValue: project.externalKnowledge.mode || 'metadata-overlays',
            options: [
              { value: 'metadata-overlays', label: 'metadata-overlays (recommended)' },
              { value: 'direct-copy', label: 'direct-copy' },
              { value: 'hybrid', label: 'hybrid' },
            ],
          }),
        windsurfPath: () =>
          clack.text({
            message: 'Windsurf domain guides path (optional)',
            initialValue: project.externalKnowledge.sources?.windsurfDomainGuidesPath || '',
            placeholder: 'C:/Users/<user>/.windsurf/plans/domain-guides',
          }),
        mystiraPath: () =>
          clack.text({
            message: 'Mystira docs path (optional)',
            initialValue: project.externalKnowledge.sources?.mystiraDocsPath || '',
            placeholder: 'C:/Users/<user>/repos/Mystira.workspace/docs',
          }),
        markdownFiles: () =>
          clack.text({
            message: 'Extra markdown files CSV (optional)',
            initialValue: (project.externalKnowledge.sources?.markdownFiles || []).join(', '),
            placeholder: 'docs/vision.md, docs/strategy.md',
          }),
        gitRepos: () =>
          clack.text({
            message: 'External git repo URLs CSV (optional)',
            initialValue: (project.externalKnowledge.sources?.gitRepoUrls || []).join(', '),
            placeholder: 'https://github.com/org/repo',
          }),
        targetPlatforms: () =>
          clack.multiselect({
            message: 'Target platforms for external knowledge',
            initialValues: project.externalKnowledge.targetPlatforms || ['copilot', 'windsurf'],
            options: EXTERNAL_KNOWLEDGE_PLATFORMS.map((p) => ({ value: p, label: p })),
            required: false,
          }),
      });

      if (clack.isCancel(externalConfig)) {
        clack.cancel('Init cancelled.');
        process.exit(0);
      }

      project.externalKnowledge.mode = externalConfig.mode;
      project.externalKnowledge.sources.windsurfDomainGuidesPath =
        externalConfig.windsurfPath?.trim() || null;
      project.externalKnowledge.sources.mystiraDocsPath =
        externalConfig.mystiraPath?.trim() || null;
      project.externalKnowledge.sources.markdownFiles = parseCsvList(externalConfig.markdownFiles);
      project.externalKnowledge.sources.gitRepoUrls = parseCsvList(externalConfig.gitRepos);
      if (Array.isArray(externalConfig.targetPlatforms)) {
        project.externalKnowledge.targetPlatforms = externalConfig.targetPlatforms;
      } else {
        project.externalKnowledge.targetPlatforms = [];
      }
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

  // --- Phase 5.5: Kit Feature Selection ---
  let featurePreset = null;
  let enabledFeatures = null;
  try {
    const featureSpec = loadFeatureSpec(agentkitRoot);
    const nonCoreFeatures = featureSpec.features.filter((f) => !f.alwaysOn);
    const presetOptions = Object.entries(featureSpec.presets).map(([key, p]) => ({
      value: key,
      label: p.label,
      hint: `${p.features.length} features`,
    }));

    const featureMode = await clack.select({
      message: 'Kit feature adoption strategy',
      options: [
        ...presetOptions,
        { value: '__custom__', label: 'Custom — pick individual features' },
      ],
      initialValue: 'standard',
    });

    if (clack.isCancel(featureMode)) {
      clack.cancel('Init cancelled.');
      process.exit(0);
    }

    if (featureMode === '__custom__') {
      const featureChoices = nonCoreFeatures.map((f) => ({
        value: f.id,
        label: f.name,
        hint: f.category,
      }));

      const defaultFeatures = nonCoreFeatures.filter((f) => f.default).map((f) => f.id);

      const selectedFeatures = await clack.multiselect({
        message: 'Select kit features to enable (core features are always on)',
        options: featureChoices,
        initialValues: defaultFeatures,
        required: false,
      });

      if (clack.isCancel(selectedFeatures)) {
        clack.cancel('Init cancelled.');
        process.exit(0);
      }

      enabledFeatures = [
        ...featureSpec.features.filter((f) => f.alwaysOn).map((f) => f.id),
        ...selectedFeatures,
      ];
    } else {
      featurePreset = featureMode;
    }
  } catch {
    // features.yaml not available — skip feature selection
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

  const initResult = await finalizeInit({
    agentkitRoot,
    projectRoot,
    repoName,
    project,
    renderTargets,
    featurePreset,
    enabledFeatures,
    force,
    dryRun,
  });

  // --- Phase 8: .retortconfig generation ---
  if (!flags['skip-retortconfig'] && !nonInteractive && !dryRun) {
    const confirmed = await clack.confirm({
      message: 'Generate .retortconfig?',
      initialValue: true,
    });
    if (!clack.isCancel(confirmed) && confirmed) {
      const { runRetortConfigWizard } = await import('./retort-config-wizard.mjs');
      await runRetortConfigWizard({
        agentkitRoot,
        projectRoot,
        flags,
        prefill: { projectName: repoName, stacks: project.stack?.languages ?? [], enabledFeatures },
      });
    }
  }

  return initResult;
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
  featurePreset,
  enabledFeatures,
  force,
  dryRun = false,
}) {
  // --- Dry-run: show plan without writing ---
  if (dryRun) {
    const langs = project.stack?.languages || [];
    const mode = project.automation?.languageProfile?.mode || 'configured';
    const features = [];
    if (project.features?.aiCostOps) features.push('ai-cost-ops');
    if (project.features?.finops) features.push('finops');
    const featureInfo = enabledFeatures
      ? `${enabledFeatures.length} features (custom)`
      : featurePreset
        ? `preset: ${featurePreset}`
        : 'default features';

    console.log('\n[agentkit:init] DRY-RUN — no files will be written\n');
    console.log(`  Repo name:       ${repoName}`);
    console.log(`  Languages:       ${langs.join(', ') || 'none'}`);
    console.log(`  Language mode:   ${mode}`);
    console.log(
      `  Features:        ${featureInfo}${features.length ? ' + ' + features.join(', ') : ''}`
    );
    console.log(`  Render targets:  ${renderTargets.join(', ')}`);
    console.log('');
    console.log('  Would write:');
    console.log(`    .agentkit/overlays/${repoName}/settings.yaml`);
    console.log('    .agentkit/spec/project.yaml');
    console.log('    .agentkit-repo');
    console.log('    (+ all sync outputs for configured render targets)');
    console.log('\n  Run without --dry-run to generate.\n');
    return;
  }
  // 1. Copy __TEMPLATE__ overlay
  const templateDir = resolve(agentkitRoot, 'overlays', '__TEMPLATE__');
  const overlayDir = resolve(agentkitRoot, 'overlays', repoName);
  if (!existsSync(templateDir)) {
    throw new Error(`Template overlay not found at ${templateDir}`);
  }

  console.log(`[agentkit:init] Creating overlay for: ${repoName}`);
  mkdirSync(overlayDir, { recursive: true });
  cpSync(templateDir, overlayDir, { recursive: true, force: true });

  // 2. Update settings.yaml with repoName + renderTargets + features
  const settingsPath = resolve(overlayDir, 'settings.yaml');
  if (existsSync(settingsPath)) {
    const settings = yaml.load(readFileSync(settingsPath, 'utf-8')) || {};
    settings.repoName = repoName;
    settings.renderTargets = renderTargets;
    if (project.stack?.languages?.length > 0) {
      settings.primaryStack = project.stack.languages[0];
    }

    // Write feature configuration
    if (enabledFeatures) {
      // Custom feature list — explicit mode
      settings.enabledFeatures = enabledFeatures;
      delete settings.featurePreset;
    } else if (featurePreset) {
      // Preset mode
      settings.featurePreset = featurePreset;
      delete settings.enabledFeatures;
    }

    writeFileSync(settingsPath, yaml.dump(settings, { lineWidth: 120 }), 'utf-8');
    const featureInfo = enabledFeatures
      ? `${enabledFeatures.length} features (custom)`
      : featurePreset
        ? `preset: ${featurePreset}`
        : 'default features';
    console.log(
      `[agentkit:init] Updated overlay settings (${renderTargets.length} render targets, ${featureInfo})`
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

  // 6. Auto-import issues if enabled
  try {
    const projectPath = resolve(agentkitRoot, 'spec', 'project.yaml');
    if (existsSync(projectPath)) {
      const projectYaml = yaml.load(readFileSync(projectPath, 'utf-8')) || {};
      const autoImport = projectYaml?.process?.intake?.autoImport ?? false;
      const tracker = projectYaml?.process?.issueTracker || 'none';

      if (autoImport && tracker !== 'none') {
        console.log(`[agentkit:init] Auto-importing issues from ${tracker}...`);
        try {
          const { runImportIssues } = await import('./import-issues.mjs');
          await runImportIssues({
            agentkitRoot,
            projectRoot,
            flags: { force: true },
          });
        } catch (importErr) {
          console.warn(`[agentkit:init] Issue import failed (non-fatal): ${importErr.message}`);
          console.warn(
            `  You can import later with: pnpm --dir .agentkit agentkit:import-issues -- --force`
          );
        }
      }
    }
  } catch {
    /* issue import is best-effort during init */
  }

  console.log(`[agentkit:init] Done! Repo initialized as: ${repoName}`);
  console.log(`  Render targets: ${renderTargets.join(', ')}`);
  console.log(`  Tip: Run "agentkit add <tool>" to add tools later.`);
  console.log(`  Tip: Run "agentkit features" to manage kit features.`);
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
      hasBrandGuide: false,
      brandGuidePath: null,
    },
    editorTheme: {
      enabled: false,
      source: 'none',
    },
    externalKnowledge: {
      enabled: false,
      mode: 'metadata-overlays',
      sources: {
        windsurfDomainGuidesPath: null,
        mystiraDocsPath: null,
        markdownFiles: [],
        gitRepoUrls: [],
      },
      targetPlatforms: ['copilot', 'windsurf'],
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
    if (ds === 'brand-guide') {
      project.documentation.hasBrandGuide = true;
      project.documentation.brandGuidePath = '.agentkit/spec/brand.yaml';
    }
    if (ds === 'editor-theme') {
      project.editorTheme.enabled = true;
      project.editorTheme.source = 'brand';
    }
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

// ---------------------------------------------------------------------------
// Kit helpers
// ---------------------------------------------------------------------------

/**
 * Applies kit defaults to project based on auto-detected stack.
 * Used by non-interactive / preset / fallback paths so they get the same
 * language-profile configuration as the interactive wizard.
 */
function applyDetectedKitDefaults(project, report) {
  project.automation = project.automation || {};
  project.automation.languageProfile = project.automation.languageProfile || {};
  // Non-interactive defaults to 'hybrid' so heuristic detection still works
  if (!project.automation.languageProfile.mode) {
    project.automation.languageProfile.mode = 'hybrid';
  }
}

/**
 * Persists interactive kit selections to the project object for project.yaml.
 * Called after the optional-kit multiselect prompt.
 */
function applyKitSelections(project, report, selectedOptionalKits) {
  project.automation = project.automation || {};
  project.automation.languageProfile = project.automation.languageProfile || {};
  project.automation.languageProfile.mode = 'configured';

  if (selectedOptionalKits.includes('ai-cost-ops')) {
    project.features = project.features || {};
    project.features.aiCostOps = true;
  }
  if (selectedOptionalKits.includes('finops')) {
    project.features = project.features || {};
    project.features.finops = true;
  }
  if (selectedOptionalKits.includes('iac') && !detectIacTool(report)) {
    // User explicitly opted into iac but no IaC tool was detected — default to terraform
    project.deployment = project.deployment || {};
    if (!project.deployment.iacTool) project.deployment.iacTool = 'terraform';
  }
}

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
