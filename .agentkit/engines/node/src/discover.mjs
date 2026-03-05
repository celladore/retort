/**
 * AgentKit Forge — Discover Command
 * Scans the repository to detect tech stacks, project structure, team boundaries,
 * and build a structured discovery report.
 */
import { existsSync, promises as fsPromises } from 'fs';
import yaml from 'js-yaml';
import { basename, extname, join, resolve } from 'node:path';
const { readdir, access, readFile } = fsPromises;

// ---------------------------------------------------------------------------
// Tech stack detection patterns
// ---------------------------------------------------------------------------

const STACK_DETECTORS = [
  {
    name: 'node',
    label: 'Node.js / TypeScript',
    markers: ['package.json'],
    filePatterns: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts'],
    configFiles: [
      'tsconfig.json',
      '.eslintrc.json',
      '.eslintrc.js',
      '.prettierrc',
      'vitest.config.ts',
      'jest.config.ts',
    ],
  },
  {
    name: 'dotnet',
    label: '.NET / C#',
    markers: ['*.sln', '*.csproj', 'Directory.Build.props'],
    filePatterns: ['.cs', '.csproj', '.sln'],
    configFiles: ['global.json', 'Directory.Build.props', 'nuget.config'],
  },
  {
    name: 'rust',
    label: 'Rust',
    markers: ['Cargo.toml'],
    filePatterns: ['.rs'],
    configFiles: ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml'],
  },
  {
    name: 'python',
    label: 'Python',
    markers: ['pyproject.toml', 'setup.py', 'requirements.txt'],
    filePatterns: ['.py'],
    configFiles: ['pyproject.toml', 'setup.cfg', 'tox.ini', '.flake8', 'mypy.ini'],
  },
  {
    name: 'go',
    label: 'Go',
    markers: ['go.mod'],
    filePatterns: ['.go'],
    configFiles: ['go.mod', 'go.sum'],
  },
  {
    name: 'ruby',
    label: 'Ruby',
    markers: ['Gemfile'],
    filePatterns: ['.rb', '.erb'],
    configFiles: ['Gemfile', '.rubocop.yml'],
  },
  {
    name: 'java',
    label: 'Java / Kotlin',
    markers: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    filePatterns: ['.java', '.kt', '.kts'],
    configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'],
  },
];

// ---------------------------------------------------------------------------
// Framework detection (§11a)
// ---------------------------------------------------------------------------

const FRAMEWORK_DETECTORS = {
  frontend: [
    { name: 'react', label: 'React', deps: ['react'], configs: [] },
    {
      name: 'next.js',
      label: 'Next.js',
      deps: ['next'],
      configs: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    },
    { name: 'vue', label: 'Vue', deps: ['vue'], configs: ['vue.config.js'] },
    { name: 'angular', label: 'Angular', deps: ['@angular/core'], configs: ['angular.json'] },
    {
      name: 'svelte',
      label: 'Svelte',
      deps: ['svelte'],
      configs: ['svelte.config.js', 'svelte.config.ts'],
    },
    {
      name: 'astro',
      label: 'Astro',
      deps: ['astro'],
      configs: ['astro.config.mjs', 'astro.config.ts'],
    },
  ],
  backend: [
    { name: 'express', label: 'Express', deps: ['express'], configs: [] },
    { name: 'nestjs', label: 'NestJS', deps: ['@nestjs/core'], configs: ['nest-cli.json'] },
    { name: 'fastify', label: 'Fastify', deps: ['fastify'], configs: [] },
    {
      name: 'asp.net-core',
      label: 'ASP.NET Core',
      deps: [],
      markers: ['Program.cs'],
      csprojRefs: ['Microsoft.AspNetCore'],
    },
    { name: 'fastapi', label: 'FastAPI', deps: ['fastapi'], configs: [] },
    { name: 'django', label: 'Django', deps: ['django'], configs: ['manage.py'] },
    { name: 'flask', label: 'Flask', deps: ['flask'], configs: [] },
    { name: 'spring-boot', label: 'Spring Boot', deps: [], pomRefs: ['spring-boot'] },
    { name: 'rails', label: 'Rails', deps: [], gemfileRefs: ['rails'] },
    { name: 'axum', label: 'Axum', deps: [], cargoRefs: ['axum'] },
    { name: 'actix', label: 'Actix', deps: [], cargoRefs: ['actix-web'] },
  ],
  css: [
    {
      name: 'tailwind',
      label: 'Tailwind CSS',
      deps: ['tailwindcss'],
      configs: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs'],
    },
    { name: 'sass', label: 'SASS/SCSS', deps: ['sass', 'node-sass'], fileExt: '.scss' },
    {
      name: 'styled-components',
      label: 'Styled Components',
      deps: ['styled-components'],
      configs: [],
    },
    { name: 'emotion', label: 'Emotion', deps: ['@emotion/react'], configs: [] },
  ],
  orm: [
    {
      name: 'prisma',
      label: 'Prisma',
      deps: ['prisma', '@prisma/client'],
      configs: ['prisma/schema.prisma'],
    },
    {
      name: 'typeorm',
      label: 'TypeORM',
      deps: ['typeorm'],
      configs: ['ormconfig.json', 'ormconfig.ts', 'ormconfig.js'],
    },
    {
      name: 'drizzle',
      label: 'Drizzle',
      deps: ['drizzle-orm'],
      configs: ['drizzle.config.ts', 'drizzle.config.js'],
    },
    {
      name: 'ef-core',
      label: 'Entity Framework Core',
      deps: [],
      csprojRefs: ['Microsoft.EntityFrameworkCore'],
    },
    { name: 'sqlalchemy', label: 'SQLAlchemy', deps: ['sqlalchemy'], configs: [] },
    { name: 'diesel', label: 'Diesel', deps: [], configs: ['diesel.toml'], cargoRefs: ['diesel'] },
    { name: 'sequelize', label: 'Sequelize', deps: ['sequelize'], configs: ['.sequelizerc'] },
  ],
  stateManagement: [
    { name: 'redux', label: 'Redux', deps: ['@reduxjs/toolkit', 'redux'] },
    { name: 'zustand', label: 'Zustand', deps: ['zustand'] },
    { name: 'pinia', label: 'Pinia', deps: ['pinia'] },
    { name: 'mobx', label: 'MobX', deps: ['mobx'] },
    { name: 'jotai', label: 'Jotai', deps: ['jotai'] },
  ],
};

// ---------------------------------------------------------------------------
// Testing tool detection (§11b)
// ---------------------------------------------------------------------------

const TESTING_DETECTORS = [
  {
    name: 'vitest',
    label: 'Vitest',
    deps: ['vitest'],
    configs: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs'],
  },
  {
    name: 'jest',
    label: 'Jest',
    deps: ['jest'],
    configs: ['jest.config.ts', 'jest.config.js', 'jest.config.mjs'],
  },
  {
    name: 'playwright',
    label: 'Playwright',
    deps: ['@playwright/test', 'playwright'],
    configs: ['playwright.config.ts', 'playwright.config.js'],
  },
  {
    name: 'cypress',
    label: 'Cypress',
    deps: ['cypress'],
    configs: ['cypress.config.ts', 'cypress.config.js'],
  },
  { name: 'xunit', label: 'xUnit', deps: [], csprojRefs: ['xunit'] },
  { name: 'nunit', label: 'NUnit', deps: [], csprojRefs: ['NUnit'] },
  { name: 'pytest', label: 'pytest', deps: ['pytest'], configs: ['conftest.py'] },
  { name: 'mocha', label: 'Mocha', deps: ['mocha'], configs: ['.mocharc.yml', '.mocharc.json'] },
];

// ---------------------------------------------------------------------------
// Documentation artifact detection (§11c)
// ---------------------------------------------------------------------------

const DOC_ARTIFACT_DETECTORS = [
  { name: 'prd', label: 'PRDs', dirs: ['docs/prd', 'docs/PRD'], files: ['PRD.md', 'docs/PRD.md'] },
  {
    name: 'adr',
    label: 'ADRs',
    dirs: ['adr', 'docs/adr', 'docs/02_architecture/ADR'],
    files: ['ARCHITECTURE.md', 'docs/architecture.md'],
  },
  {
    name: 'apiSpec',
    label: 'API Specs',
    dirs: ['docs/api', 'docs/03_api'],
    files: ['openapi.yaml', 'openapi.yml', 'openapi.json', 'swagger.json', 'swagger.yaml'],
  },
  {
    name: 'technicalSpec',
    label: 'Technical Specs',
    dirs: ['docs/specs', 'docs/technical'],
    files: ['TECHNICAL.md', 'docs/technical.md'],
  },
];

// ---------------------------------------------------------------------------
// Design system detection (§11d)
// ---------------------------------------------------------------------------

const DESIGN_SYSTEM_DETECTORS = [
  { name: 'storybook', label: 'Storybook', dirs: ['.storybook'] },
  { name: 'figma-tokens', label: 'Figma Tokens', files: ['figma-tokens.json'], dirs: ['.figma'] },
  {
    name: 'design-tokens',
    label: 'Design Tokens',
    dirs: ['tokens', 'design-tokens', 'styles/tokens'],
  },
  {
    name: 'component-library',
    label: 'Component Library',
    dirs: ['packages/ui', 'packages/components'],
  },
  {
    name: 'brand-guide',
    label: 'Brand Guide',
    files: ['.agentkit/spec/brand.yaml', '.agentkit/spec/brand.json', 'brand.yaml', 'brand.json'],
  },
  {
    name: 'editor-theme',
    label: 'Editor Theme',
    files: ['.agentkit/spec/editor-theme.yaml', '.agentkit/spec/editor-theme.json'],
  },
];

// ---------------------------------------------------------------------------
// Cross-cutting concern detection (§11f)
// ---------------------------------------------------------------------------

const CROSSCUTTING_DETECTORS = {
  logging: [
    { name: 'serilog', label: 'Serilog', csprojRefs: ['Serilog'] },
    { name: 'winston', label: 'Winston', deps: ['winston'] },
    { name: 'pino', label: 'Pino', deps: ['pino'] },
    { name: 'bunyan', label: 'Bunyan', deps: ['bunyan'] },
    { name: 'log4net', label: 'log4net', csprojRefs: ['log4net'] },
    { name: 'nlog', label: 'NLog', csprojRefs: ['NLog'] },
  ],
  authentication: [
    {
      name: 'azure-ad-b2c',
      label: 'Azure AD B2C',
      deps: ['@azure/msal-browser', '@azure/msal-node', '@azure/msal-react'],
    },
    { name: 'azure-ad', label: 'Azure AD', csprojRefs: ['Microsoft.Identity.Web'] },
    { name: 'auth0', label: 'Auth0', deps: ['auth0', '@auth0/nextjs-auth0', '@auth0/auth0-react'] },
    { name: 'firebase', label: 'Firebase Auth', deps: ['firebase-admin', 'firebase'] },
    { name: 'cognito', label: 'AWS Cognito', deps: ['aws-amplify', '@aws-amplify/auth'] },
    { name: 'keycloak', label: 'Keycloak', deps: ['keycloak-js', 'keycloak-connect'] },
    {
      name: 'custom-jwt',
      label: 'JWT',
      deps: ['jsonwebtoken'],
      csprojRefs: ['System.IdentityModel.Tokens.Jwt'],
    },
  ],
  caching: [
    {
      name: 'redis',
      label: 'Redis',
      deps: ['ioredis', 'redis'],
      csprojRefs: ['StackExchange.Redis'],
    },
    { name: 'memcached', label: 'Memcached', deps: ['memcached', 'memjs'] },
  ],
  errorHandling: [
    {
      name: 'problem-details',
      label: 'Problem Details (RFC 7807)',
      csprojRefs: ['Hellang.Middleware.ProblemDetails', 'Microsoft.AspNetCore.Http.Results'],
    },
  ],
  apiPatterns: [
    {
      name: 'api-versioning',
      label: 'API Versioning',
      csprojRefs: ['Asp.Versioning'],
      deps: ['express-api-versioning'],
    },
    {
      name: 'swagger',
      label: 'Swagger/OpenAPI',
      csprojRefs: ['Swashbuckle'],
      deps: ['@nestjs/swagger', 'swagger-ui-express'],
    },
  ],
  featureFlags: [
    {
      name: 'launchdarkly',
      label: 'LaunchDarkly',
      deps: ['launchdarkly-node-server-sdk', 'launchdarkly-js-client-sdk'],
    },
    {
      name: 'azure-app-config',
      label: 'Azure App Config',
      csprojRefs: ['Microsoft.Azure.AppConfiguration'],
      deps: ['@azure/app-configuration'],
    },
    { name: 'unleash', label: 'Unleash', deps: ['unleash-client'] },
    { name: 'flagsmith', label: 'Flagsmith', deps: ['flagsmith'] },
  ],
};

// ---------------------------------------------------------------------------
// Infrastructure detection
// ---------------------------------------------------------------------------

const INFRA_DETECTORS = [
  { name: 'docker', markers: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'] },
  { name: 'kubernetes', markers: ['k8s/', 'helm/', '*.k8s.yml'] },
  { name: 'terraform', markers: ['terraform/', '*.tf'] },
  { name: 'bicep', markers: ['bicep/', '*.bicep'] },
  { name: 'pulumi', markers: ['Pulumi.yaml'] },
  { name: 'github-actions', markers: ['.github/workflows/'] },
];

// ---------------------------------------------------------------------------
// CI/CD detection
// ---------------------------------------------------------------------------

const CI_DETECTORS = [
  { name: 'github-actions', markers: ['.github/workflows/'] },
  { name: 'azure-devops', markers: ['azure-pipelines.yml'] },
  { name: 'gitlab-ci', markers: ['.gitlab-ci.yml'] },
  { name: 'circleci', markers: ['.circleci/config.yml'] },
  { name: 'jenkins', markers: ['Jenkinsfile'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fileExists(projectRoot, pattern) {
  // Handle glob-like patterns simply
  if (pattern.endsWith('/')) {
    try {
      await access(resolve(projectRoot, pattern.slice(0, -1)));
      return true;
    } catch {
      return false;
    }
  }
  if (pattern.startsWith('*')) {
    // Check for any file matching the extension
    const ext = pattern.replace('*', '');
    try {
      const entries = await readdir(projectRoot);
      return entries.some((f) => f.endsWith(ext));
    } catch {
      return false;
    }
  }
  try {
    await access(resolve(projectRoot, pattern));
    return true;
  } catch {
    return false;
  }
}

// Directories to skip during discovery — framework internals and build artifacts
// should not be counted as application source code in consuming repos.
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.nuxt']);

async function countFilesByExt(dir, extensions, depth = 4, maxFiles = 5000) {
  let count = 0;
  // Global semaphore — limits total concurrent readdir calls across the entire walk
  // to prevent EMFILE errors on deep or wide repository trees.
  const MAX_CONCURRENCY = 8;
  let active = 0;
  const queue = [];

  function schedule(fn) {
    return new Promise((resolve, reject) => {
      const run = async () => {
        active++;
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        } finally {
          active--;
          if (queue.length > 0) queue.shift()();
        }
      };

      if (active < MAX_CONCURRENCY) {
        run();
      } else {
        queue.push(run);
      }
    });
  }

  async function walk(currentDir, currentDepth) {
    if (currentDepth > depth || count > maxFiles) return;

    try {
      const entries = await schedule(() => fsPromises.readdir(currentDir, { withFileTypes: true }));
      const subdirs = [];

      for (const entry of entries) {
        if (count > maxFiles) break;
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        // Skip agentkit engine internals — framework code, not app code
        if (currentDepth === 0 && entry.name === '.agentkit') continue;

        const full = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          subdirs.push(full);
        } else if (extensions.includes(extname(entry.name))) {
          count++;
        }
      }

      await Promise.all(subdirs.map((full) => walk(full, currentDepth + 1)));
    } catch {
      /* permission errors or other fs issues */
    }
  }

  await walk(dir, 0);
  return count;
}

async function getTopLevelDirs(projectRoot) {
  try {
    const entries = await readdir(projectRoot, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith('.') &&
          e.name !== 'node_modules' &&
          !SKIP_DIRS.has(e.name)
      )
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function detectMonorepo(projectRoot) {
  const indicators = [];

  // pnpm workspaces
  if (await fileExists(projectRoot, 'pnpm-workspace.yaml')) {
    indicators.push('pnpm-workspace');
  }
  // npm/yarn workspaces
  if (await fileExists(projectRoot, 'package.json')) {
    try {
      const pkg = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf-8'));
      if (pkg.workspaces) indicators.push('npm-workspaces');
    } catch {
      /* ignore */
    }
  }
  // Nx
  if (await fileExists(projectRoot, 'nx.json')) {
    indicators.push('nx');
  }
  // Turbo
  if (await fileExists(projectRoot, 'turbo.json')) {
    indicators.push('turborepo');
  }
  // Lerna
  if (await fileExists(projectRoot, 'lerna.json')) {
    indicators.push('lerna');
  }
  // Cargo workspace
  if (await fileExists(projectRoot, 'Cargo.toml')) {
    try {
      const cargo = await readFile(resolve(projectRoot, 'Cargo.toml'), 'utf-8');
      if (cargo.includes('[workspace]')) indicators.push('cargo-workspace');
    } catch {
      /* ignore */
    }
  }

  return indicators;
}

// ---------------------------------------------------------------------------
// Enhanced detection helpers
// ---------------------------------------------------------------------------

/**
 * Reads package.json and returns a Set of all dependency names.
 * Merges dependencies, devDependencies, peerDependencies.
 */
async function getNodeDeps(projectRoot) {
  const deps = new Set();
  try {
    const pkg = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf-8'));
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (pkg[section]) {
        for (const dep of Object.keys(pkg[section])) deps.add(dep);
      }
    }
  } catch {
    /* no package.json or parse error */
  }
  return deps;
}

/**
 * Reads all .csproj files (top 3 levels) and returns concatenated content for ref matching.
 */
async function getCsprojContent(projectRoot) {
  let content = '';
  async function walk(dir, depth) {
    if (depth > 3) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const tasks = [];
      for (const entry of entries) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          tasks.push(walk(full, depth + 1));
        } else if (entry.name.endsWith('.csproj')) {
          tasks.push(
            (async () => {
              try {
                const fileContent = await readFile(full, 'utf-8');
                content += fileContent + '\n';
              } catch {
                /* skip */
              }
            })()
          );
        }
      }
      await Promise.all(tasks);
    } catch {
      /* permission errors */
    }
  }
  await walk(projectRoot, 0);
  return content;
}

/**
 * Reads Cargo.toml and returns its content for dependency matching.
 */
async function getCargoContent(projectRoot) {
  try {
    return await readFile(resolve(projectRoot, 'Cargo.toml'), 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Reads Gemfile and returns its content for gem matching.
 */
async function getGemfileContent(projectRoot) {
  try {
    return await readFile(resolve(projectRoot, 'Gemfile'), 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Reads pom.xml and returns its content for dependency matching.
 */
async function getPomContent(projectRoot) {
  try {
    return await readFile(resolve(projectRoot, 'pom.xml'), 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Reads pyproject.toml/requirements.txt and returns a Set of Python dependency names.
 */
async function getPythonDeps(projectRoot) {
  const deps = new Set();
  // pyproject.toml — section-aware parsing to avoid false positives
  try {
    const content = await readFile(resolve(projectRoot, 'pyproject.toml'), 'utf-8');
    const lines = content.split(/\r?\n/);
    let inPoetryDeps = false;
    let inProjectSection = false;
    let inProjectDepsArray = false;
    let inProjectOptionalDepsSection = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Detect section headers like [tool.poetry.dependencies]
      const sectionMatch = line.match(/^\[([^\]]+)\]/);
      if (sectionMatch) {
        const sectionName = sectionMatch[1].trim();
        inPoetryDeps = sectionName === 'tool.poetry.dependencies';
        inProjectSection = sectionName === 'project';
        inProjectOptionalDepsSection = sectionName === 'project.optional-dependencies';
        inProjectDepsArray = false;
        continue;
      }

      // [tool.poetry.dependencies]: package_name = "^1.2.3"
      if (inPoetryDeps) {
        const depMatch = line.match(/^([A-Za-z0-9_-]+)\s*=/);
        if (depMatch && depMatch[1].toLowerCase() !== 'python') {
          deps.add(depMatch[1].toLowerCase());
        }
        continue;
      }

      // [project] dependencies = [...]
      if (inProjectSection) {
        if (!inProjectDepsArray) {
          if (/^dependencies\s*=\s*\[/.test(line)) {
            inProjectDepsArray = true;
            const arrayPart = line.slice(line.indexOf('['));
            for (const m of arrayPart.matchAll(/["']([a-zA-Z0-9_-]+)["']/g)) {
              deps.add(m[1].toLowerCase());
            }
            if (line.includes(']')) inProjectDepsArray = false;
          }
        } else {
          for (const m of line.matchAll(/["']([a-zA-Z0-9_-]+)["']/g)) {
            deps.add(m[1].toLowerCase());
          }
          if (line.includes(']')) inProjectDepsArray = false;
        }
        continue;
      }

      // [project.optional-dependencies]: extra = ["pkg1", "pkg2"]
      if (inProjectOptionalDepsSection) {
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) continue;
        const afterEq = line.slice(eqIndex + 1);
        if (!afterEq.includes('[')) continue;
        for (const m of afterEq.matchAll(/["']([a-zA-Z0-9_-]+)["']/g)) {
          deps.add(m[1].toLowerCase());
        }
      }
    }
  } catch {
    /* skip */
  }
  // requirements.txt
  try {
    const content = await readFile(resolve(projectRoot, 'requirements.txt'), 'utf-8');
    for (const line of content.split('\n')) {
      const pkg = line
        .trim()
        .split(/[>=<\[!;#]/)[0]
        .trim();
      if (pkg) deps.add(pkg.toLowerCase());
    }
  } catch {
    /* skip */
  }
  return deps;
}

/**
 * Detects frameworks from a detector list using cached dependency data.
 */
async function detectFromList(
  detectors,
  { nodeDeps, csprojContent, cargoContent, gemfileContent, pomContent, pythonDeps, projectRoot }
) {
  const found = [];

  // Parallelize detector checks where possible, but for simplicity and because many checks are in-memory (deps check),
  // we can keep the loop. However, file existence checks (configs, markers) should be async.

  const tasks = detectors.map(async (d) => {
    let matched = false;
    // Check Node.js deps
    if (d.deps?.length && nodeDeps.size > 0) {
      if (d.deps.some((dep) => nodeDeps.has(dep))) matched = true;
    }
    // Check config files
    if (!matched && d.configs?.length) {
      // Run checks in parallel
      const results = await Promise.all(d.configs.map((c) => fileExists(projectRoot, c)));
      if (results.some(Boolean)) matched = true;
    }
    // Check markers (plain files)
    if (!matched && d.markers?.length) {
      const results = await Promise.all(d.markers.map((m) => fileExists(projectRoot, m)));
      if (results.some(Boolean)) matched = true;
    }
    // Check .csproj references
    if (!matched && d.csprojRefs?.length && csprojContent) {
      if (d.csprojRefs.some((ref) => csprojContent.includes(ref))) matched = true;
    }
    // Check Cargo.toml references
    if (!matched && d.cargoRefs?.length && cargoContent) {
      if (d.cargoRefs.some((ref) => cargoContent.includes(ref))) matched = true;
    }
    // Check Gemfile references
    if (!matched && d.gemfileRefs?.length && gemfileContent) {
      if (d.gemfileRefs.some((ref) => gemfileContent.includes(ref))) matched = true;
    }
    // Check pom.xml references
    if (!matched && d.pomRefs?.length && pomContent) {
      if (d.pomRefs.some((ref) => pomContent.includes(ref))) matched = true;
    }
    // Check Python deps
    if (!matched && d.deps?.length && pythonDeps.size > 0) {
      if (d.deps.some((dep) => pythonDeps.has(dep.toLowerCase()))) matched = true;
    }
    // Check file extensions (e.g. .scss files)
    if (!matched && d.fileExt) {
      if ((await countFilesByExt(projectRoot, [d.fileExt], 2, 5)) > 0) matched = true;
    }

    if (matched) return { name: d.name, label: d.label };
    return null;
  });

  const results = await Promise.all(tasks);
  return results.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Commit convention detection
// ---------------------------------------------------------------------------

/**
 * Detects the project's commit convention from filesystem artifacts and git-log
 * heuristics.
 *
 * Priority order:
 * 1. commitlint config files → 'conventional'
 * 2. semantic-release config files → 'semantic'
 * 3. package.json keys (commitlint, standard-version, release) → convention
 * 4. Git log heuristic (≥60% of last 20 commits match pattern) → convention
 * 5. No match → null (preserve existing)
 *
 * @param {string} projectRoot
 * @returns {Promise<string|null>}
 */
export async function detectCommitConvention(projectRoot) {
  const COMMITLINT_FILES = [
    '.commitlintrc',
    '.commitlintrc.json',
    '.commitlintrc.yaml',
    '.commitlintrc.yml',
    '.commitlintrc.js',
    '.commitlintrc.cjs',
    '.commitlintrc.mjs',
    '.commitlintrc.ts',
    'commitlint.config.js',
    'commitlint.config.cjs',
    'commitlint.config.mjs',
    'commitlint.config.ts',
  ];
  const RELEASERC_FILES = [
    '.releaserc',
    '.releaserc.json',
    '.releaserc.yaml',
    '.releaserc.yml',
    '.releaserc.js',
    '.releaserc.cjs',
    'release.config.js',
    'release.config.cjs',
    'release.config.mjs',
    'release.config.ts',
  ];

  // 1. commitlint config → 'conventional'
  const commitlintChecks = await Promise.all(
    COMMITLINT_FILES.map((f) => fileExists(projectRoot, f))
  );
  if (commitlintChecks.some(Boolean)) return 'conventional';

  // 2. semantic-release config → 'semantic'
  const releasercChecks = await Promise.all(
    RELEASERC_FILES.map((f) => fileExists(projectRoot, f))
  );
  if (releasercChecks.some(Boolean)) return 'semantic';

  // 3. package.json keys
  try {
    const pkgRaw = await readFile(resolve(projectRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgRaw);
    if (pkg.commitlint) return 'conventional';
    if (pkg['standard-version'] || pkg['release']) return 'semantic';
  } catch {
    /* no package.json or parse error */
  }

  // 4. Git log heuristic — inspect last 20 commits
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--pretty=format:%s', '-20'],
      { cwd: projectRoot }
    );
    const subjects = stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (subjects.length > 0) {
      // Conventional Commits: type(scope)?: description (! marks breaking change)
      const conventionalRe = /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert)(\(.+\))?(!)?: .+/;
      // Semantic: simple type prefix — type: description (no scope required)
      const semanticRe = /^[a-z]+: .+/;

      const conventionalMatches = subjects.filter((s) => conventionalRe.test(s)).length;
      const semanticMatches = subjects.filter((s) => semanticRe.test(s)).length;
      const threshold = 0.6;

      if (conventionalMatches / subjects.length >= threshold) return 'conventional';
      if (semanticMatches / subjects.length >= threshold) return 'semantic';
    }
  } catch {
    /* git not available or not a git repo */
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core discovery logic
// ---------------------------------------------------------------------------

export async function runDiscover({ agentkitRoot, projectRoot, flags }) {
  console.log('[agentkit:discover] Scanning repository...');

  const report = {
    generatedAt: new Date().toISOString(),
    projectRoot: projectRoot,
    repository: {},
    techStacks: [],
    frameworks: { frontend: [], backend: [], css: [], orm: [], stateManagement: [] },
    testing: [],
    documentation: [],
    designSystem: [],
    crosscutting: {
      logging: [],
      authentication: [],
      caching: [],
      errorHandling: [],
      apiPatterns: [],
      featureFlags: [],
    },
    infrastructure: [],
    cicd: [],
    monorepo: { detected: false, tools: [] },
    structure: { topLevelDirs: [], estimatedFileCount: {} },
    recommendations: [],
    commitConvention: null,
  };

  // --- Repository info ---
  report.repository.name = basename(projectRoot);
  if (await fileExists(projectRoot, '.git')) {
    report.repository.isGit = true;
  }
  if (await fileExists(projectRoot, '.agentkit-repo')) {
    try {
      report.repository.agentkitOverlay = (
        await readFile(resolve(projectRoot, '.agentkit-repo'), 'utf-8')
      ).trim();
    } catch {
      /* ignore read errors for .agentkit-repo */
    }
  }

  // --- Tech stack detection ---
  const stackTasks = STACK_DETECTORS.map(async (detector) => {
    const results = await Promise.all(detector.markers.map((m) => fileExists(projectRoot, m)));
    const markerFound = results.some(Boolean);
    if (markerFound) {
      const fileCount = await countFilesByExt(projectRoot, detector.filePatterns);
      const configsFound = detector.configFiles.filter((c) => existsSync(resolve(projectRoot, c)));
      return {
        name: detector.name,
        label: detector.label,
        fileCount,
        configFiles: configsFound,
      };
    }
    return null;
  });

  const stackResults = await Promise.all(stackTasks);
  report.techStacks = stackResults.filter(Boolean);

  // --- Determine primary stack ---
  if (report.techStacks.length > 0) {
    const primary = report.techStacks.reduce((a, b) => (a.fileCount > b.fileCount ? a : b));
    report.primaryStack = primary.name;
  }

  // --- Cache dependency data for framework detection ---
  // Parallelize reading of deps
  const [nodeDeps, csprojContent, cargoContent, gemfileContent, pomContent, pythonDeps] =
    await Promise.all([
      getNodeDeps(projectRoot),
      getCsprojContent(projectRoot),
      getCargoContent(projectRoot),
      getGemfileContent(projectRoot),
      getPomContent(projectRoot),
      getPythonDeps(projectRoot),
    ]);

  const depContext = {
    nodeDeps,
    csprojContent,
    cargoContent,
    gemfileContent,
    pomContent,
    pythonDeps,
    projectRoot,
  };

  // --- Framework detection (§11a) ---
  for (const [category, detectors] of Object.entries(FRAMEWORK_DETECTORS)) {
    const found = await detectFromList(detectors, depContext);
    if (found.length > 0) {
      report.frameworks[category] = found.map((f) => f.name);
    }
  }

  // --- Testing tool detection (§11b) ---
  const testingFound = await detectFromList(TESTING_DETECTORS, depContext);
  report.testing = testingFound.map((t) => t.name);

  // --- Documentation artifact detection (§11c) ---
  const docTasks = DOC_ARTIFACT_DETECTORS.map(async (detector) => {
    let foundPath = null;
    // Check directories
    if (detector.dirs) {
      for (const dir of detector.dirs) {
        if (await fileExists(projectRoot, dir)) {
          foundPath = dir;
          break;
        }
      }
    }
    // Check files
    if (!foundPath && detector.files) {
      for (const file of detector.files) {
        if (await fileExists(projectRoot, file)) {
          foundPath = file;
          break;
        }
      }
    }
    if (foundPath) {
      return { name: detector.name, label: detector.label, path: foundPath };
    }
    return null;
  });

  const docResults = await Promise.all(docTasks);
  report.documentation = docResults.filter(Boolean);

  // --- Design system detection (§11d) ---
  const designTasks = DESIGN_SYSTEM_DETECTORS.map(async (detector) => {
    let found = false;
    if (detector.dirs) {
      const results = await Promise.all(detector.dirs.map((dir) => fileExists(projectRoot, dir)));
      if (results.some(Boolean)) found = true;
    }
    if (!found && detector.files) {
      const results = await Promise.all(
        detector.files.map((file) => fileExists(projectRoot, file))
      );
      if (results.some(Boolean)) found = true;
    }
    if (found) {
      return detector.name;
    }
    return null;
  });

  const designResults = await Promise.all(designTasks);
  report.designSystem = designResults.filter(Boolean);

  // --- Cross-cutting concern detection (§11f) ---
  for (const [concern, detectors] of Object.entries(CROSSCUTTING_DETECTORS)) {
    const found = await detectFromList(detectors, depContext);
    if (found.length > 0) {
      report.crosscutting[concern] = found.map((f) => f.name);
    }
  }

  // --- Environment config detection ---
  if (await fileExists(projectRoot, '.env.example')) {
    report.crosscutting.envConfig = 'env-vars';
  } else if (await fileExists(projectRoot, 'appsettings.json')) {
    report.crosscutting.envConfig = 'config-files';
  }

  // --- Infrastructure detection ---
  const infraTasks = INFRA_DETECTORS.map(async (detector) => {
    const results = await Promise.all(detector.markers.map((m) => fileExists(projectRoot, m)));
    if (results.some(Boolean)) return detector.name;
    return null;
  });
  const infraResults = await Promise.all(infraTasks);
  report.infrastructure = infraResults.filter(Boolean);

  // --- CI/CD detection ---
  const cicdTasks = CI_DETECTORS.map(async (detector) => {
    const results = await Promise.all(detector.markers.map((m) => fileExists(projectRoot, m)));
    if (results.some(Boolean)) return detector.name;
    return null;
  });
  const cicdResults = await Promise.all(cicdTasks);
  report.cicd = cicdResults.filter(Boolean);

  // --- Monorepo detection ---
  const monorepoTools = await detectMonorepo(projectRoot);
  if (monorepoTools.length > 0) {
    report.monorepo = { detected: true, tools: monorepoTools };
  }

  // --- Project structure ---
  report.structure.topLevelDirs = await getTopLevelDirs(projectRoot);
  for (const stack of report.techStacks) {
    report.structure.estimatedFileCount[stack.name] = stack.fileCount;
  }

  // --- Recommendations ---
  if (report.techStacks.length === 0) {
    report.recommendations.push(
      'No recognised tech stacks detected. Add marker files (package.json, Cargo.toml, etc.) or configure primaryStack manually.'
    );
  }
  if (report.cicd.length === 0) {
    report.recommendations.push(
      'No CI/CD configuration detected. Consider adding GitHub Actions or another CI pipeline.'
    );
  }
  if (!report.repository.agentkitOverlay) {
    report.recommendations.push(
      'No .agentkit-repo marker found. Run "agentkit init" to set up an overlay.'
    );
  }
  if (report.testing.length === 0 && report.techStacks.length > 0) {
    report.recommendations.push(
      'No testing frameworks detected. Consider adding tests with vitest, jest, pytest, or xUnit.'
    );
  }

  // --- Commit convention detection ---
  report.commitConvention = await detectCommitConvention(projectRoot);

  // --- Output ---
  const format = flags?.output || 'yaml';
  let output;
  if (format === 'json') {
    output = JSON.stringify(report, null, 2);
  } else if (format === 'markdown') {
    output = formatMarkdown(report);
  } else {
    output = yaml.dump(report, { lineWidth: 120, noRefs: true });
  }

  console.log('');
  console.log(output);
  const fwCount = Object.values(report.frameworks).flat().length;
  console.log(
    `[agentkit:discover] Found ${report.techStacks.length} tech stack(s), ${fwCount} framework(s), ${report.testing.length} test tool(s), ${report.infrastructure.length} infra tool(s), ${report.cicd.length} CI/CD system(s).`
  );

  return report;
}

function formatMarkdown(report) {
  const lines = [
    `# Discovery Report`,
    ``,
    `**Repository:** ${report.repository.name}`,
    `**Generated:** ${report.generatedAt}`,
    `**Primary Stack:** ${report.primaryStack || 'unknown'}`,
    ``,
    `## Tech Stacks`,
    ``,
  ];

  if (report.techStacks.length === 0) {
    lines.push('No recognised tech stacks detected.');
  } else {
    for (const stack of report.techStacks) {
      lines.push(`### ${stack.label}`);
      lines.push(`- **Files:** ~${stack.fileCount}`);
      if (stack.configFiles.length > 0) {
        lines.push(`- **Config:** ${stack.configFiles.join(', ')}`);
      }
      lines.push('');
    }
  }

  const fw = report.frameworks;
  const fwTotal = Object.values(fw).flat().length;
  if (fwTotal > 0) {
    lines.push(`## Frameworks`, ``);
    for (const [category, values] of Object.entries(fw)) {
      if (!Array.isArray(values) || values.length === 0) continue;
      const label = category
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase());
      lines.push(`- **${label}:** ${values.join(', ')}`);
    }
    lines.push('');
  }

  if (report.testing?.length > 0) {
    lines.push(`## Testing`, ``, report.testing.map((t) => `- ${t}`).join('\n'), ``);
  }

  if (report.documentation?.length > 0) {
    lines.push(`## Documentation`, ``);
    for (const d of report.documentation) {
      lines.push(`- **${d.label}:** \`${d.path}\``);
    }
    lines.push('');
  }

  if (report.designSystem?.length > 0) {
    lines.push(`## Design System`, ``, report.designSystem.map((d) => `- ${d}`).join('\n'), ``);
  }

  const cc = report.crosscutting;
  const ccKeys = Object.keys(cc || {}).filter((k) =>
    Array.isArray(cc[k]) ? cc[k].length > 0 : cc[k]
  );
  if (ccKeys.length > 0) {
    lines.push(`## Cross-Cutting`, ``);
    for (const k of ccKeys) {
      const v = cc[k];
      if (Array.isArray(v)) lines.push(`- **${k}:** ${v.join(', ')}`);
      else lines.push(`- **${k}:** ${v}`);
    }
    lines.push('');
  }

  if (report.monorepo.detected) {
    lines.push(`## Monorepo`, ``, `Tools: ${report.monorepo.tools.join(', ')}`, ``);
  }

  if (report.infrastructure.length > 0) {
    lines.push(`## Infrastructure`, ``, report.infrastructure.map((i) => `- ${i}`).join('\n'), ``);
  }

  if (report.cicd.length > 0) {
    lines.push(`## CI/CD`, ``, report.cicd.map((c) => `- ${c}`).join('\n'), ``);
  }

  lines.push(`## Project Structure`, ``, `Top-level directories:`, ``);
  for (const dir of report.structure.topLevelDirs) {
    lines.push(`- \`${dir}/\``);
  }

  if (report.recommendations.length > 0) {
    lines.push(``, `## Recommendations`, ``);
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  return lines.join('\n');
}
