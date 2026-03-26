/**
 * Retort — Expansion Analyzer (Phase 1)
 * Read-only gap analysis engine that scans the repository and produces
 * scored, ranked suggestions for missing documentation, tests, security
 * measures, and architectural improvements.
 *
 * Consumes discovery output and project metadata. Never writes files.
 */
import { existsSync, promises as fsPromises } from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'node:path';
import { loadAgentsSpec } from './synchronize.mjs';

const { readdir, readFile } = fsPromises;

// ---------------------------------------------------------------------------
// Suggestion categories
// ---------------------------------------------------------------------------

export const SUGGESTION_CATEGORIES = [
  'documentation',
  'testing',
  'security',
  'architecture',
  'operations',
  'feature',
];

// ---------------------------------------------------------------------------
// Impact / effort levels
// ---------------------------------------------------------------------------

export const IMPACT_LEVELS = ['critical', 'high', 'medium', 'low'];
export const EFFORT_LEVELS = ['XS', 'S', 'M', 'L', 'XL'];

// ---------------------------------------------------------------------------
// Analyzer registry — each analyzer returns an array of raw suggestions
// ---------------------------------------------------------------------------

const ANALYZERS = [
  { id: 'docs-gaps', category: 'documentation', fn: analyzeDocumentationGaps },
  { id: 'adr-gaps', category: 'documentation', fn: analyzeAdrGaps },
  { id: 'test-gaps', category: 'testing', fn: analyzeTestingGaps },
  { id: 'security-gaps', category: 'security', fn: analyzeSecurityGaps },
  { id: 'ops-gaps', category: 'operations', fn: analyzeOpsGaps },
  { id: 'arch-gaps', category: 'architecture', fn: analyzeArchitectureGaps },
];

// ---------------------------------------------------------------------------
// Scoring weights (configurable per-project in future phases)
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHTS = {
  impact: 3,
  riskIfSkipped: 2,
  alignment: 1,
  effort: -1, // higher effort penalizes score
};

const EFFORT_SCORES = { XS: 5, S: 4, M: 3, L: 2, XL: 1 };
const IMPACT_SCORES = { critical: 4, high: 3, medium: 2, low: 1 };

// ---------------------------------------------------------------------------
// Core analysis entry point
// ---------------------------------------------------------------------------

/**
 * Run the expansion analysis.
 * @param {object} options
 * @param {string} options.projectRoot — absolute path to the repository
 * @param {string} [options.agentkitRoot] — path to .agentkit directory
 * @param {object} [options.discoveryReport] — pre-computed discovery report
 * @param {object} [options.flags] — CLI flags
 * @returns {Promise<object>} — the analysis report with scored suggestions
 */
export async function runExpansionAnalysis({
  projectRoot,
  agentkitRoot,
  discoveryReport,
  flags = {},
}) {
  const effectiveAgentkitRoot = agentkitRoot || resolve(projectRoot, '.agentkit');
  const categories = flags.category
    ? flags.category.split(',').map((c) => c.trim())
    : SUGGESTION_CATEGORIES;
  const maxSuggestions = flags.maxSuggestions ?? 10;
  const minImpact = flags.minImpact ?? 'low';

  // Load project metadata
  const projectSpec = await loadProjectSpec(effectiveAgentkitRoot);

  // Load docs spec
  const docsSpec = await loadYamlSpec(effectiveAgentkitRoot, 'docs.yaml');

  // Load agents spec
  const agentsSpec = loadAgentsSpec(effectiveAgentkitRoot);

  // Load existing backlog items to avoid duplicates
  const backlogItems = await loadBacklogItems(projectRoot);

  // Build the analysis context
  const context = {
    projectRoot,
    agentkitRoot: effectiveAgentkitRoot,
    projectSpec,
    docsSpec,
    agentsSpec,
    discoveryReport: discoveryReport || {},
    backlogItems,
    flags,
  };

  // Run applicable analyzers
  const rawSuggestions = [];
  const applicableAnalyzers = ANALYZERS.filter((a) => categories.includes(a.category));

  for (const analyzer of applicableAnalyzers) {
    try {
      const suggestions = await analyzer.fn(context);
      rawSuggestions.push(...suggestions);
    } catch (err) {
      console.warn(`[expansion-analyzer] Analyzer ${analyzer.id} failed: ${err.message}`);
    }
  }

  // Deduplicate against backlog
  const deduped = deduplicateAgainstBacklog(rawSuggestions, backlogItems);

  // Score and rank
  const scored = deduped.map((s) => scoreSuggestion(s));
  scored.sort((a, b) => b.score - a.score);

  // Filter by minimum impact
  const minImpactScore = IMPACT_SCORES[minImpact] || 0;
  const filtered = scored.filter((s) => (IMPACT_SCORES[s.impact] || 0) >= minImpactScore);

  // Truncate to max
  const final = filtered.slice(0, maxSuggestions);

  // Assign suggestion IDs
  final.forEach((s, i) => {
    s.id = `SUG-${String(i + 1).padStart(3, '0')}`;
  });

  return {
    generatedAt: new Date().toISOString(),
    projectRoot,
    totalAnalyzersRun: applicableAnalyzers.length,
    totalRawSuggestions: rawSuggestions.length,
    totalAfterDedup: deduped.length,
    totalAfterFilter: filtered.length,
    categoriesAnalyzed: categories,
    minImpact,
    maxSuggestions,
    suggestions: final,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreSuggestion(suggestion) {
  const impactScore = IMPACT_SCORES[suggestion.impact] || 1;
  const riskScore = IMPACT_SCORES[suggestion.riskIfSkipped] || 1;
  const effortScore = EFFORT_SCORES[suggestion.effort] || 3;
  const alignmentScore =
    suggestion.alignment === 'high' ? 3 : suggestion.alignment === 'medium' ? 2 : 1;

  const score =
    DEFAULT_WEIGHTS.impact * impactScore +
    DEFAULT_WEIGHTS.riskIfSkipped * riskScore +
    DEFAULT_WEIGHTS.alignment * alignmentScore +
    DEFAULT_WEIGHTS.effort * (6 - effortScore); // invert: higher effort = lower score

  return { ...suggestion, score };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function normalizeTitle(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function deduplicateAgainstBacklog(suggestions, backlogItems) {
  if (!backlogItems || backlogItems.length === 0) return suggestions;

  const backlogNormalized = new Set(backlogItems.map((item) => normalizeTitle(item)));

  return suggestions.filter((s) => {
    const normalized = normalizeTitle(s.title);
    // Exact match after normalization — avoids false positives from substring matching
    return !backlogNormalized.has(normalized);
  });
}

// ---------------------------------------------------------------------------
// Documentation gap analyzer
// ---------------------------------------------------------------------------

async function analyzeDocumentationGaps(context) {
  const suggestions = [];
  const { projectRoot, docsSpec } = context;

  // Check for expected documentation categories from docs.yaml
  const expectedCategories = docsSpec?.categories || [];
  for (const cat of expectedCategories) {
    if (cat.path) {
      const catPath = resolve(projectRoot, cat.path);
      const exists = existsSync(catPath);
      if (!exists) {
        suggestions.push({
          category: 'documentation',
          title: `Create ${cat.name} documentation directory`,
          rationale: `The docs spec defines a "${cat.name}" category at ${cat.path}, but the directory does not exist. This means documentation for ${cat.id} has not been started.`,
          impact: 'medium',
          effort: 'S',
          riskIfSkipped: 'low',
          alignment: 'high',
          suggestedArtifacts: [{ type: 'directory', path: cat.path }],
        });
      } else {
        // Check if the directory is empty
        try {
          const entries = await readdir(catPath);
          const contentFiles = entries.filter((e) => !e.startsWith('.') && e !== 'README.md');
          if (contentFiles.length === 0) {
            suggestions.push({
              category: 'documentation',
              title: `Add content to ${cat.name} documentation`,
              rationale: `The ${cat.path} directory exists but contains no content files beyond a README. The docs spec expects content like: ${(cat.contents || []).slice(0, 3).join(', ')}.`,
              impact: 'low',
              effort: 'M',
              riskIfSkipped: 'low',
              alignment: 'medium',
              suggestedArtifacts: [{ type: 'docs', path: cat.path }],
            });
          }
        } catch {
          /* ignore readdir errors */
        }
      }
    }
  }

  // Check for README
  if (!existsSync(resolve(projectRoot, 'README.md'))) {
    suggestions.push({
      category: 'documentation',
      title: 'Create project README',
      rationale:
        'No README.md found in the project root. A README is the primary entry point for developers and contributors.',
      impact: 'high',
      effort: 'S',
      riskIfSkipped: 'medium',
      alignment: 'high',
      suggestedArtifacts: [{ type: 'docs', path: 'README.md' }],
    });
  }

  // Check for CHANGELOG
  if (!existsSync(resolve(projectRoot, 'CHANGELOG.md'))) {
    suggestions.push({
      category: 'documentation',
      title: 'Create CHANGELOG',
      rationale:
        'No CHANGELOG.md found. A changelog helps track releases, breaking changes, and migration steps.',
      impact: 'medium',
      effort: 'S',
      riskIfSkipped: 'low',
      alignment: 'medium',
      suggestedArtifacts: [{ type: 'docs', path: 'CHANGELOG.md' }],
    });
  }

  // Check for CONTRIBUTING guide
  if (!existsSync(resolve(projectRoot, 'CONTRIBUTING.md'))) {
    suggestions.push({
      category: 'documentation',
      title: 'Create CONTRIBUTING guide',
      rationale:
        'No CONTRIBUTING.md found. A contributing guide helps onboard new contributors and sets expectations.',
      impact: 'low',
      effort: 'S',
      riskIfSkipped: 'low',
      alignment: 'medium',
      suggestedArtifacts: [{ type: 'docs', path: 'CONTRIBUTING.md' }],
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// ADR gap analyzer
// ---------------------------------------------------------------------------

async function analyzeAdrGaps(context) {
  const suggestions = [];
  const { projectRoot, docsSpec, projectSpec } = context;

  const adrPath = docsSpec?.adrRanges?.[0]?.path;
  if (!adrPath) return suggestions;

  const adrDir = resolve(projectRoot, adrPath);

  // Check if ADR directory exists
  if (!existsSync(adrDir)) {
    suggestions.push({
      category: 'documentation',
      title: 'Create ADR directory and first decision record',
      rationale:
        'The docs spec defines ADR numbering ranges but no ADR directory exists. Architectural decisions should be documented.',
      impact: 'high',
      effort: 'S',
      riskIfSkipped: 'medium',
      alignment: 'high',
      suggestedArtifacts: [{ type: 'ADR', path: adrPath }],
    });
    return suggestions;
  }

  // Known architectural patterns that typically deserve ADRs
  const architecturalConcerns = [
    {
      concern: 'task delegation protocol',
      check: () => existsSync(resolve(context.agentkitRoot, 'engines/node/src/task-protocol.mjs')),
      title: 'Add ADR for task protocol design decisions',
      rationale:
        'The A2A-lite task protocol is a core architectural decision with specific tradeoffs (file-based vs. message queue, atomic operations, lock semantics). Document why these choices were made.',
    },
    {
      concern: 'orchestration strategy',
      check: () => existsSync(resolve(context.agentkitRoot, 'engines/node/src/orchestrator.mjs')),
      title: 'Add ADR for orchestration phase design',
      rationale:
        'The 5-phase orchestration model is a significant architectural choice. Document the phase boundaries, state transitions, and why this model was chosen over alternatives.',
    },
    {
      concern: 'review criteria model',
      check: () => existsSync(resolve(context.agentkitRoot, 'engines/node/src/review-runner.mjs')),
      title: 'Add ADR for review criteria framework',
      rationale:
        'The 10-criterion review framework is a quality architecture decision. Document why these specific criteria were chosen and how they interact.',
    },
  ];

  // Check each concern against existing ADR titles
  let existingAdrTitles = [];
  try {
    const entries = await readdir(adrDir);
    existingAdrTitles = entries
      .filter((e) => e.endsWith('.md') && e !== 'README.md')
      .map((e) => e.toLowerCase());
  } catch {
    /* ignore */
  }

  for (const concern of architecturalConcerns) {
    if (!concern.check()) continue;

    const alreadyDocumented = existingAdrTitles.some((title) =>
      title.includes(concern.concern.replace(/\s+/g, '-'))
    );

    if (!alreadyDocumented) {
      suggestions.push({
        category: 'documentation',
        title: concern.title,
        rationale: concern.rationale,
        impact: 'medium',
        effort: 'S',
        riskIfSkipped: 'low',
        alignment: 'high',
        suggestedArtifacts: [{ type: 'ADR', path: adrPath }],
      });
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Testing gap analyzer
// ---------------------------------------------------------------------------

async function analyzeTestingGaps(context) {
  const suggestions = [];
  const { projectRoot, discoveryReport } = context;

  // Check if any test framework is detected
  const testFrameworks = discoveryReport?.testing || [];
  if (testFrameworks.length === 0) {
    suggestions.push({
      category: 'testing',
      title: 'Set up test framework',
      rationale:
        'No test framework detected in the project. Testing is essential for code quality and regression prevention.',
      impact: 'critical',
      effort: 'M',
      riskIfSkipped: 'high',
      alignment: 'high',
      suggestedArtifacts: [],
    });
    return suggestions;
  }

  // Check for E2E test setup
  const hasE2e =
    existsSync(resolve(projectRoot, 'e2e')) ||
    existsSync(resolve(projectRoot, 'tests/e2e')) ||
    existsSync(resolve(projectRoot, 'playwright'));

  if (!hasE2e) {
    // Only suggest E2E if there's a frontend framework detected
    const hasFrontend = discoveryReport?.frameworks?.frontend?.length > 0;
    if (hasFrontend) {
      suggestions.push({
        category: 'testing',
        title: 'Add end-to-end test suite',
        rationale:
          'Frontend framework detected but no E2E test directory found. E2E tests validate critical user workflows.',
        impact: 'medium',
        effort: 'L',
        riskIfSkipped: 'medium',
        alignment: 'medium',
        suggestedArtifacts: [],
      });
    }
  }

  // Check test coverage configuration
  const hasCoverageConfig =
    existsSync(resolve(projectRoot, '.nycrc')) ||
    existsSync(resolve(projectRoot, '.nycrc.json')) ||
    existsSync(resolve(projectRoot, '.c8rc.json'));

  // Check vitest/jest config for coverage settings
  let hasCoverageInConfig = false;
  for (const configFile of [
    'vitest.config.ts',
    'vitest.config.js',
    'vitest.config.mjs',
    'jest.config.ts',
    'jest.config.js',
  ]) {
    const configPath = resolve(projectRoot, configFile);
    if (existsSync(configPath)) {
      try {
        const content = await readFile(configPath, 'utf-8');
        if (content.includes('coverage')) {
          hasCoverageInConfig = true;
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (!hasCoverageConfig && !hasCoverageInConfig) {
    suggestions.push({
      category: 'testing',
      title: 'Configure test coverage reporting',
      rationale:
        'No test coverage configuration detected. Coverage metrics help identify untested code paths.',
      impact: 'medium',
      effort: 'S',
      riskIfSkipped: 'low',
      alignment: 'medium',
      suggestedArtifacts: [],
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Security gap analyzer
// ---------------------------------------------------------------------------

async function analyzeSecurityGaps(context) {
  const suggestions = [];
  const { projectRoot, projectSpec } = context;

  // Check for security policy
  if (
    !existsSync(resolve(projectRoot, 'SECURITY.md')) &&
    !existsSync(resolve(projectRoot, '.github/SECURITY.md'))
  ) {
    suggestions.push({
      category: 'security',
      title: 'Add security policy (SECURITY.md)',
      rationale:
        'No SECURITY.md found. A security policy tells users how to report vulnerabilities responsibly.',
      impact: 'medium',
      effort: 'XS',
      riskIfSkipped: 'medium',
      alignment: 'high',
      suggestedArtifacts: [{ type: 'docs', path: 'SECURITY.md' }],
    });
  }

  // Check for dependency scanning in CI
  const hasGitHubActions = existsSync(resolve(projectRoot, '.github/workflows'));
  if (hasGitHubActions) {
    let hasDependabot =
      existsSync(resolve(projectRoot, '.github/dependabot.yml')) ||
      existsSync(resolve(projectRoot, '.github/dependabot.yaml'));

    if (!hasDependabot) {
      suggestions.push({
        category: 'security',
        title: 'Enable Dependabot or dependency scanning',
        rationale:
          'GitHub Actions detected but no Dependabot configuration found. Automated dependency updates help catch known vulnerabilities.',
        impact: 'medium',
        effort: 'XS',
        riskIfSkipped: 'medium',
        alignment: 'high',
        suggestedArtifacts: [{ type: 'config', path: '.github/dependabot.yml' }],
      });
    }
  }

  // Check for .env.example (secrets management hint)
  const hasEnvFile = existsSync(resolve(projectRoot, '.env'));
  const hasEnvExample = existsSync(resolve(projectRoot, '.env.example'));
  if (hasEnvFile && !hasEnvExample) {
    suggestions.push({
      category: 'security',
      title: 'Add .env.example template',
      rationale:
        'A .env file exists without a corresponding .env.example. An example template helps developers set up without exposing real secrets.',
      impact: 'low',
      effort: 'XS',
      riskIfSkipped: 'low',
      alignment: 'medium',
      suggestedArtifacts: [{ type: 'config', path: '.env.example' }],
    });
  }

  // Check gitignore for sensitive patterns
  const gitignorePath = resolve(projectRoot, '.gitignore');
  if (existsSync(gitignorePath)) {
    try {
      const gitignore = await readFile(gitignorePath, 'utf-8');
      const sensitivePatterns = ['.env', '.env.local', '*.pem', '*.key'];
      const missing = sensitivePatterns.filter((p) => !gitignore.includes(p));
      if (missing.length > 0) {
        suggestions.push({
          category: 'security',
          title: 'Add sensitive file patterns to .gitignore',
          rationale: `The .gitignore is missing patterns for: ${missing.join(', ')}. These files may contain secrets.`,
          impact: 'medium',
          effort: 'XS',
          riskIfSkipped: 'high',
          alignment: 'high',
          suggestedArtifacts: [],
        });
      }
    } catch {
      /* ignore */
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Operations gap analyzer
// ---------------------------------------------------------------------------

async function analyzeOpsGaps(context) {
  const suggestions = [];
  const { projectRoot, projectSpec, discoveryReport } = context;

  // Check for CI/CD
  const hasCicd =
    existsSync(resolve(projectRoot, '.github/workflows')) ||
    existsSync(resolve(projectRoot, '.gitlab-ci.yml')) ||
    existsSync(resolve(projectRoot, 'Jenkinsfile')) ||
    existsSync(resolve(projectRoot, '.circleci'));

  if (!hasCicd) {
    suggestions.push({
      category: 'operations',
      title: 'Set up CI/CD pipeline',
      rationale:
        'No CI/CD configuration detected. Automated builds, tests, and deployments reduce manual errors and improve delivery speed.',
      impact: 'high',
      effort: 'M',
      riskIfSkipped: 'high',
      alignment: 'high',
      suggestedArtifacts: [],
    });
  }

  // Check for Docker
  const hasDocker =
    existsSync(resolve(projectRoot, 'Dockerfile')) ||
    existsSync(resolve(projectRoot, 'docker-compose.yml')) ||
    existsSync(resolve(projectRoot, 'docker-compose.yaml'));

  // Only suggest Docker if the project seems non-trivial (has a backend framework)
  if (!hasDocker && discoveryReport?.frameworks?.backend?.length > 0) {
    suggestions.push({
      category: 'operations',
      title: 'Add containerization (Dockerfile)',
      rationale:
        'Backend framework detected but no Dockerfile found. Containerization ensures consistent environments across development and production.',
      impact: 'medium',
      effort: 'M',
      riskIfSkipped: 'low',
      alignment: 'medium',
      suggestedArtifacts: [],
    });
  }

  // Check for operations documentation — derive path from docsSpec
  const opsCategory = context.docsSpec?.categories?.find(
    (c) => c.id?.includes('operations') || c.name?.toLowerCase() === 'operations'
  );
  const opsPath = opsCategory?.path || 'docs/operations/';

  if (
    discoveryReport?.frameworks?.backend?.length > 0 &&
    !existsSync(resolve(projectRoot, opsPath))
  ) {
    suggestions.push({
      category: 'operations',
      title: 'Create operations documentation',
      rationale:
        'Backend service detected but no operations documentation found. Runbooks, deployment guides, and incident procedures are essential for production services.',
      impact: 'medium',
      effort: 'M',
      riskIfSkipped: 'medium',
      alignment: 'high',
      suggestedArtifacts: [{ type: 'docs', path: opsPath }],
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Architecture gap analyzer
// ---------------------------------------------------------------------------

async function analyzeArchitectureGaps(context) {
  const suggestions = [];
  const { projectRoot, projectSpec, discoveryReport } = context;

  // Check for architecture documentation
  const archOverview = resolve(projectRoot, 'docs/architecture/01_overview.md');
  if (!existsSync(archOverview)) {
    suggestions.push({
      category: 'architecture',
      title: 'Create architecture overview document',
      rationale:
        'No architecture overview found. A high-level architecture document helps developers understand system design, component relationships, and data flows.',
      impact: 'high',
      effort: 'M',
      riskIfSkipped: 'medium',
      alignment: 'high',
      suggestedArtifacts: [{ type: 'docs', path: 'docs/architecture/01_overview.md' }],
    });
  }

  // Check for API documentation if API patterns exist
  const hasApi =
    discoveryReport?.frameworks?.backend?.length > 0 ||
    discoveryReport?.crosscutting?.apiPatterns?.length > 0;

  if (hasApi) {
    const hasApiDocs =
      existsSync(resolve(projectRoot, 'docs/api')) ||
      existsSync(resolve(projectRoot, 'openapi.yaml')) ||
      existsSync(resolve(projectRoot, 'openapi.json')) ||
      existsSync(resolve(projectRoot, 'swagger.yaml')) ||
      existsSync(resolve(projectRoot, 'swagger.json'));

    if (!hasApiDocs) {
      suggestions.push({
        category: 'architecture',
        title: 'Create API documentation (OpenAPI spec)',
        rationale:
          'Backend/API framework detected but no API documentation found. An OpenAPI specification enables client generation, testing, and documentation.',
        impact: 'high',
        effort: 'M',
        riskIfSkipped: 'medium',
        alignment: 'high',
        suggestedArtifacts: [{ type: 'docs', path: 'docs/api/' }],
      });
    }
  }

  // Check for architecture diagrams
  const diagramDir = resolve(projectRoot, 'docs/architecture/diagrams');
  if (!existsSync(diagramDir)) {
    suggestions.push({
      category: 'architecture',
      title: 'Add architecture diagrams',
      rationale:
        'No architecture diagrams directory found. Visual diagrams (C4 model, sequence diagrams, data flow) significantly improve understanding of system design.',
      impact: 'medium',
      effort: 'M',
      riskIfSkipped: 'low',
      alignment: 'medium',
      suggestedArtifacts: [{ type: 'docs', path: 'docs/architecture/diagrams/' }],
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Helpers — spec loading
// ---------------------------------------------------------------------------

async function loadProjectSpec(agentkitRoot) {
  const specPath = resolve(agentkitRoot, 'spec', 'project.yaml');
  try {
    const raw = await readFile(specPath, 'utf-8');
    return yaml.load(raw) || {};
  } catch {
    return {};
  }
}

async function loadYamlSpec(agentkitRoot, filename) {
  const specPath = resolve(agentkitRoot, 'spec', filename);
  try {
    const raw = await readFile(specPath, 'utf-8');
    return yaml.load(raw) || {};
  } catch {
    return {};
  }
}

async function loadBacklogItems(projectRoot) {
  const backlogPath = resolve(projectRoot, 'AGENT_BACKLOG.md');
  if (!existsSync(backlogPath)) return [];

  try {
    const content = await readFile(backlogPath, 'utf-8');
    // Extract items that look like backlog entries (lines starting with - or *)
    return content
      .split('\n')
      .filter((line) => /^\s*[-*]\s+/.test(line))
      .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

/**
 * Format the analysis report as YAML for human-readable output.
 */
export function formatReportAsYaml(report) {
  return yaml.dump(report, { lineWidth: 100, noRefs: true, sortKeys: false });
}

/**
 * Format the analysis report as a Markdown summary.
 */
export function formatReportAsMarkdown(report) {
  const lines = [];
  lines.push('# Expansion Analysis Report');
  lines.push('');
  lines.push(`**Generated**: ${report.generatedAt}`);
  lines.push(`**Categories analyzed**: ${report.categoriesAnalyzed.join(', ')}`);
  lines.push(
    `**Suggestions**: ${report.suggestions.length} (from ${report.totalRawSuggestions} raw, ${report.totalAfterDedup} after dedup)`
  );
  lines.push('');

  if (report.suggestions.length === 0) {
    lines.push('No suggestions found matching the criteria.');
    return lines.join('\n');
  }

  lines.push('## Suggestions');
  lines.push('');
  lines.push('| # | Category | Title | Impact | Effort | Score |');
  lines.push('|---|----------|-------|--------|--------|-------|');

  for (const s of report.suggestions) {
    lines.push(`| ${s.id} | ${s.category} | ${s.title} | ${s.impact} | ${s.effort} | ${s.score} |`);
  }

  lines.push('');
  lines.push('## Details');
  lines.push('');

  for (const s of report.suggestions) {
    lines.push(`### ${s.id}: ${s.title}`);
    lines.push('');
    lines.push(
      `**Category**: ${s.category} | **Impact**: ${s.impact} | **Effort**: ${s.effort} | **Risk if skipped**: ${s.riskIfSkipped} | **Score**: ${s.score}`
    );
    lines.push('');
    lines.push(s.rationale);
    lines.push('');
    if (s.suggestedArtifacts && s.suggestedArtifacts.length > 0) {
      lines.push('**Suggested artifacts**:');
      for (const a of s.suggestedArtifacts) {
        lines.push(`- ${a.type}: \`${a.path}\``);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
