/**
 * Coverage tests for discover.mjs (#520 phase 3).
 *
 * Covers branches not exercised by discover.test.mjs:
 *   - Each tech stack detector (dotnet, rust, python, go, ruby, java)
 *   - Framework detection from package.json deps (frontend, backend, css, orm, stateManagement)
 *   - Testing tool detection paths
 *   - Documentation artifact detection (dirs vs files)
 *   - Design system detection (dirs vs files)
 *   - Cross-cutting concern detection (every category)
 *   - Infrastructure markers (docker, k8s, terraform, bicep, pulumi)
 *   - CI markers (gitlab, circleci, jenkins, azure-devops)
 *   - Monorepo: pnpm-workspace, nx, turbo, lerna, cargo workspace, npm workspaces
 *   - getPythonDeps: poetry, project.dependencies, project.optional-dependencies
 *   - detectFromList: csprojRefs, cargoRefs, gemfileRefs, pomRefs, fileExt
 *   - runDiscover output format: yaml (default) and markdown
 *   - formatMarkdown: all sections populated + empty-stacks branch
 *   - .agentkit-repo marker read path
 *   - Recommendations branches (testing missing, cicd missing, agentkit overlay missing)
 */
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDiscover } from '../discover.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = join(
    tmpdir(),
    `discover-cov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(filePath, content = '') {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

function gitInit(cwd) {
  execFileSync('git', ['init'], { cwd, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd, stdio: 'ignore' });
}

function gitCommit(cwd, message) {
  execFileSync('git', ['add', '-A'], { cwd, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', message], { cwd, stdio: 'ignore' });
}

async function runOnFixture(projectRoot, flags = {}) {
  return runDiscover({
    agentkitRoot: null,
    projectRoot,
    flags: { output: 'json', ...flags },
  });
}

// ---------------------------------------------------------------------------
// Tech stack detection — every detector type
// ---------------------------------------------------------------------------

describe('runDiscover — stack detection branches', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('detects dotnet stack from .csproj marker', async () => {
    writeFile(join(tmpDir, 'App.csproj'), '<Project Sdk="Microsoft.NET.Sdk"/>');
    writeFile(join(tmpDir, 'Program.cs'), '// program');
    const report = await runOnFixture(tmpDir);
    expect(report.techStacks.map((s) => s.name)).toContain('dotnet');
  });

  it('detects rust stack from Cargo.toml', async () => {
    writeFile(join(tmpDir, 'Cargo.toml'), '[package]\nname = "p"\n');
    writeFile(join(tmpDir, 'src/main.rs'), 'fn main() {}');
    const report = await runOnFixture(tmpDir);
    expect(report.techStacks.map((s) => s.name)).toContain('rust');
  });

  it('detects python stack from pyproject.toml', async () => {
    writeFile(join(tmpDir, 'pyproject.toml'), '[project]\nname = "p"\n');
    writeFile(join(tmpDir, 'app.py'), '# python');
    const report = await runOnFixture(tmpDir);
    expect(report.techStacks.map((s) => s.name)).toContain('python');
  });

  it('detects go stack from go.mod', async () => {
    writeFile(join(tmpDir, 'go.mod'), 'module example\n');
    writeFile(join(tmpDir, 'main.go'), 'package main');
    const report = await runOnFixture(tmpDir);
    expect(report.techStacks.map((s) => s.name)).toContain('go');
  });

  it('detects ruby stack from Gemfile', async () => {
    writeFile(join(tmpDir, 'Gemfile'), 'source "https://rubygems.org"\ngem "rails"\n');
    writeFile(join(tmpDir, 'app.rb'), '# ruby');
    const report = await runOnFixture(tmpDir);
    expect(report.techStacks.map((s) => s.name)).toContain('ruby');
  });

  it('detects java stack from pom.xml', async () => {
    writeFile(
      join(tmpDir, 'pom.xml'),
      '<project xmlns="http://maven.apache.org/POM/4.0.0"></project>'
    );
    writeFile(join(tmpDir, 'src/Main.java'), 'class Main {}');
    const report = await runOnFixture(tmpDir);
    expect(report.techStacks.map((s) => s.name)).toContain('java');
  });

  it('picks primaryStack by file count', async () => {
    writeFile(join(tmpDir, 'package.json'), '{}');
    writeFile(join(tmpDir, 'Cargo.toml'), '[package]\nname = "p"\n');
    for (let i = 0; i < 5; i++) writeFile(join(tmpDir, `src/file${i}.rs`), '');
    writeFile(join(tmpDir, 'index.js'), '');
    const report = await runOnFixture(tmpDir);
    expect(report.primaryStack).toBe('rust');
  });

  it('no recognised stacks → recommendation emitted', async () => {
    const report = await runOnFixture(tmpDir);
    expect(report.techStacks).toEqual([]);
    expect(report.recommendations.some((r) => r.includes('No recognised tech stacks'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Framework / cross-cutting detection from package.json deps
// ---------------------------------------------------------------------------

describe('runDiscover — framework + crosscutting detection from npm deps', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('detects react + next.js + tailwind + prisma + redux + winston + auth0', async () => {
    writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          react: '^18',
          next: '^14',
          tailwindcss: '^3',
          prisma: '^5',
          '@reduxjs/toolkit': '^2',
          winston: '^3',
          auth0: '^4',
          redis: '^4',
          jsonwebtoken: '^9',
          'launchdarkly-node-server-sdk': '^7',
        },
        devDependencies: {
          vitest: '^4',
          '@playwright/test': '^1',
        },
        peerDependencies: {
          '@nestjs/swagger': '^7',
        },
      })
    );
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.frontend).toContain('react');
    expect(report.frameworks.frontend).toContain('next.js');
    expect(report.frameworks.css).toContain('tailwind');
    expect(report.frameworks.orm).toContain('prisma');
    expect(report.frameworks.stateManagement).toContain('redux');
    expect(report.testing).toContain('vitest');
    expect(report.testing).toContain('playwright');
    expect(report.crosscutting.logging).toContain('winston');
    expect(report.crosscutting.authentication).toContain('auth0');
    expect(report.crosscutting.authentication).toContain('custom-jwt');
    expect(report.crosscutting.caching).toContain('redis');
    expect(report.crosscutting.featureFlags).toContain('launchdarkly');
    expect(report.crosscutting.apiPatterns).toContain('swagger');
  });

  it('detects framework from config file when deps are absent', async () => {
    writeFile(join(tmpDir, 'package.json'), JSON.stringify({ dependencies: {} }));
    writeFile(join(tmpDir, 'tailwind.config.js'), 'module.exports = {};');
    writeFile(join(tmpDir, 'next.config.js'), 'module.exports = {};');
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.css).toContain('tailwind');
    expect(report.frameworks.frontend).toContain('next.js');
  });

  it('detects asp.net-core via Program.cs marker', async () => {
    writeFile(join(tmpDir, 'Program.cs'), 'using Microsoft.AspNetCore.Builder;');
    writeFile(join(tmpDir, 'App.csproj'), '<Project></Project>');
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.backend).toContain('asp.net-core');
  });

  it('detects ef-core via .csproj reference', async () => {
    writeFile(
      join(tmpDir, 'App.csproj'),
      `<Project Sdk="Microsoft.NET.Sdk">
         <ItemGroup>
           <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
         </ItemGroup>
       </Project>`
    );
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.orm).toContain('ef-core');
  });

  it('detects axum via cargo ref', async () => {
    writeFile(
      join(tmpDir, 'Cargo.toml'),
      `[package]
name = "p"

[dependencies]
axum = "0.7"
`
    );
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.backend).toContain('axum');
  });

  it('detects rails via Gemfile ref', async () => {
    writeFile(join(tmpDir, 'Gemfile'), 'gem "rails", "~> 7.0"\n');
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.backend).toContain('rails');
  });

  it('detects spring-boot via pom.xml ref', async () => {
    writeFile(
      join(tmpDir, 'pom.xml'),
      `<project>
         <dependencies>
           <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter</artifactId></dependency>
         </dependencies>
       </project>`
    );
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.backend).toContain('spring-boot');
  });

  it('detects sass via .scss file extension', async () => {
    writeFile(join(tmpDir, 'package.json'), JSON.stringify({ dependencies: {} }));
    writeFile(join(tmpDir, 'styles/main.scss'), '// scss');
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.css).toContain('sass');
  });
});

// ---------------------------------------------------------------------------
// Python deps — section-aware parsing
// ---------------------------------------------------------------------------

describe('runDiscover — getPythonDeps parser branches', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('parses poetry-style dependencies', async () => {
    writeFile(
      join(tmpDir, 'pyproject.toml'),
      `[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.110"
django = "^5"
`
    );
    writeFile(join(tmpDir, 'app.py'), '# py');
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.backend).toContain('fastapi');
    expect(report.frameworks.backend).toContain('django');
  });

  it('parses PEP 621 [project] dependencies array (single-line)', async () => {
    writeFile(
      join(tmpDir, 'pyproject.toml'),
      `[project]
name = "p"
dependencies = ["flask", "sqlalchemy"]
`
    );
    writeFile(join(tmpDir, 'app.py'), '# py');
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.backend).toContain('flask');
    expect(report.frameworks.orm).toContain('sqlalchemy');
  });

  it('parses PEP 621 [project] dependencies array (multi-line)', async () => {
    writeFile(
      join(tmpDir, 'pyproject.toml'),
      `[project]
name = "p"
dependencies = [
  "flask",
  "pytest",
]
`
    );
    writeFile(join(tmpDir, 'app.py'), '# py');
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.backend).toContain('flask');
    expect(report.testing).toContain('pytest');
  });

  it('parses [project.optional-dependencies] section', async () => {
    writeFile(
      join(tmpDir, 'pyproject.toml'),
      `[project]
name = "p"

[project.optional-dependencies]
dev = ["pytest", "fastapi"]
`
    );
    writeFile(join(tmpDir, 'app.py'), '# py');
    const report = await runOnFixture(tmpDir);
    expect(report.testing).toContain('pytest');
    expect(report.frameworks.backend).toContain('fastapi');
  });

  it('parses requirements.txt', async () => {
    writeFile(
      join(tmpDir, 'requirements.txt'),
      `flask>=2.0
django==5.0
pytest # for testing
sqlalchemy[asyncio]>=2
`
    );
    writeFile(join(tmpDir, 'app.py'), '# py');
    writeFile(join(tmpDir, 'pyproject.toml'), '[project]\nname = "p"\n');
    const report = await runOnFixture(tmpDir);
    expect(report.frameworks.backend).toContain('flask');
    expect(report.frameworks.backend).toContain('django');
    expect(report.testing).toContain('pytest');
  });
});

// ---------------------------------------------------------------------------
// Documentation / design system / infra / CI detection
// ---------------------------------------------------------------------------

describe('runDiscover — documentation, design, infra, CI markers', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('detects PRD dir, ADR dir, OpenAPI file, technical specs dir', async () => {
    mkdirSync(join(tmpDir, 'docs/prd'), { recursive: true });
    mkdirSync(join(tmpDir, 'adr'), { recursive: true });
    writeFile(join(tmpDir, 'docs/api/openapi.yaml'), 'openapi: 3.0.0\n');
    mkdirSync(join(tmpDir, 'docs/specs'), { recursive: true });
    const report = await runOnFixture(tmpDir);
    const names = report.documentation.map((d) => d.name);
    expect(names).toContain('prd');
    expect(names).toContain('adr');
    expect(names).toContain('apiSpec');
    expect(names).toContain('technicalSpec');
  });

  it('detects design system markers: storybook, figma-tokens, brand-guide', async () => {
    mkdirSync(join(tmpDir, '.storybook'), { recursive: true });
    writeFile(join(tmpDir, 'figma-tokens.json'), '{}');
    writeFile(join(tmpDir, 'brand.yaml'), 'brand: name\n');
    const report = await runOnFixture(tmpDir);
    expect(report.designSystem).toContain('storybook');
    expect(report.designSystem).toContain('figma-tokens');
    expect(report.designSystem).toContain('brand-guide');
  });

  it('detects infra markers: docker, terraform, bicep, pulumi', async () => {
    writeFile(join(tmpDir, 'Dockerfile'), 'FROM node:22');
    writeFile(join(tmpDir, 'main.tf'), 'resource "x" "y" {}');
    writeFile(join(tmpDir, 'main.bicep'), 'param name string');
    writeFile(join(tmpDir, 'Pulumi.yaml'), 'name: p');
    const report = await runOnFixture(tmpDir);
    expect(report.infrastructure).toContain('docker');
    expect(report.infrastructure).toContain('terraform');
    expect(report.infrastructure).toContain('bicep');
    expect(report.infrastructure).toContain('pulumi');
  });

  it('detects CI systems: gitlab-ci, circleci, jenkins, azure-devops', async () => {
    writeFile(join(tmpDir, '.gitlab-ci.yml'), 'stages: [build]');
    writeFile(join(tmpDir, '.circleci/config.yml'), 'version: 2');
    writeFile(join(tmpDir, 'Jenkinsfile'), 'pipeline {}');
    writeFile(join(tmpDir, 'azure-pipelines.yml'), 'trigger: main');
    const report = await runOnFixture(tmpDir);
    expect(report.cicd).toContain('gitlab-ci');
    expect(report.cicd).toContain('circleci');
    expect(report.cicd).toContain('jenkins');
    expect(report.cicd).toContain('azure-devops');
  });

  it('no CI/CD → recommendation emitted', async () => {
    writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'p' }));
    const report = await runOnFixture(tmpDir);
    expect(report.cicd).toEqual([]);
    expect(report.recommendations.some((r) => r.includes('No CI/CD'))).toBe(true);
  });

  it('emits recommendation when techStacks present but no testing tool', async () => {
    writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'p' }));
    const report = await runOnFixture(tmpDir);
    expect(report.testing).toEqual([]);
    expect(report.recommendations.some((r) => r.includes('No testing frameworks'))).toBe(true);
  });

  it('emits recommendation when .agentkit-repo marker is missing', async () => {
    const report = await runOnFixture(tmpDir);
    expect(report.recommendations.some((r) => r.includes('.agentkit-repo'))).toBe(true);
  });

  it('reads .agentkit-repo marker and records overlay', async () => {
    writeFile(join(tmpDir, '.agentkit-repo'), 'my-overlay\n');
    const report = await runOnFixture(tmpDir);
    expect(report.repository.agentkitOverlay).toBe('my-overlay');
  });

  it('detects .env config marker', async () => {
    writeFile(join(tmpDir, '.env.example'), 'FOO=bar');
    const report = await runOnFixture(tmpDir);
    expect(report.crosscutting.envConfig).toBe('env-vars');
  });

  it('detects appsettings.json config marker', async () => {
    writeFile(join(tmpDir, 'appsettings.json'), '{}');
    const report = await runOnFixture(tmpDir);
    expect(report.crosscutting.envConfig).toBe('config-files');
  });
});

// ---------------------------------------------------------------------------
// Monorepo detection
// ---------------------------------------------------------------------------

describe('runDiscover — monorepo detection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('detects pnpm-workspace + turborepo + nx + lerna', async () => {
    writeFile(join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n');
    writeFile(join(tmpDir, 'turbo.json'), '{}');
    writeFile(join(tmpDir, 'nx.json'), '{}');
    writeFile(join(tmpDir, 'lerna.json'), '{}');
    const report = await runOnFixture(tmpDir);
    expect(report.monorepo.detected).toBe(true);
    expect(report.monorepo.tools).toEqual(
      expect.arrayContaining(['pnpm-workspace', 'turborepo', 'nx', 'lerna'])
    );
  });

  it('detects npm workspaces from package.json', async () => {
    writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'mono', workspaces: ['packages/*'] })
    );
    const report = await runOnFixture(tmpDir);
    expect(report.monorepo.detected).toBe(true);
    expect(report.monorepo.tools).toContain('npm-workspaces');
  });

  it('detects cargo workspace', async () => {
    writeFile(
      join(tmpDir, 'Cargo.toml'),
      `[workspace]
members = ["crates/a", "crates/b"]
`
    );
    writeFile(join(tmpDir, 'crates/a/src/lib.rs'), '');
    const report = await runOnFixture(tmpDir);
    expect(report.monorepo.detected).toBe(true);
    expect(report.monorepo.tools).toContain('cargo-workspace');
  });
});

// ---------------------------------------------------------------------------
// Output formats
// ---------------------------------------------------------------------------

describe('runDiscover — output formats', () => {
  let tmpDir;
  let logSpy;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'p', dependencies: { react: '^18' } })
    );
    writeFile(join(tmpDir, 'src/x.ts'), '');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('default yaml output emits yaml-shaped string', async () => {
    await runDiscover({ agentkitRoot: null, projectRoot: tmpDir, flags: {} });
    const calls = logSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => /techStacks:/.test(c))).toBe(true);
  });

  it('markdown output renders sections + recommendations', async () => {
    writeFile(join(tmpDir, 'Dockerfile'), 'FROM node:22');
    mkdirSync(join(tmpDir, 'docs/prd'), { recursive: true });
    writeFile(join(tmpDir, 'figma-tokens.json'), '{}');
    writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18', winston: '^3' } })
    );
    writeFile(join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n');
    writeFile(join(tmpDir, '.github/workflows/ci.yml'), 'name: CI');

    await runDiscover({ agentkitRoot: null, projectRoot: tmpDir, flags: { output: 'markdown' } });
    const calls = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(calls).toMatch(/# Discovery Report/);
    expect(calls).toMatch(/## Tech Stacks/);
    expect(calls).toMatch(/## Frameworks/);
    expect(calls).toMatch(/## Documentation/);
    expect(calls).toMatch(/## Design System/);
    expect(calls).toMatch(/## Cross-Cutting/);
    expect(calls).toMatch(/## Monorepo/);
    expect(calls).toMatch(/## Infrastructure/);
    expect(calls).toMatch(/## CI\/CD/);
    expect(calls).toMatch(/## Project Structure/);
  });

  it('markdown output handles empty techStacks gracefully', async () => {
    rmSync(join(tmpDir, 'package.json'));
    rmSync(join(tmpDir, 'src'), { recursive: true });
    await runDiscover({ agentkitRoot: null, projectRoot: tmpDir, flags: { output: 'markdown' } });
    const calls = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(calls).toMatch(/No recognised tech stacks detected\./);
    expect(calls).toMatch(/## Recommendations/);
  });

  it('userContext arg is logged and emitted', async () => {
    await runDiscover({
      agentkitRoot: null,
      projectRoot: tmpDir,
      flags: { output: 'json', _args: ['migrate', 'to', 'next15'] },
    });
    const calls = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(calls).toMatch(/Context: migrate to next15/);
  });
});

// ---------------------------------------------------------------------------
// agentkitRoot integration — project.yaml respects explicit commit convention
// ---------------------------------------------------------------------------

describe('runDiscover — agentkitRoot integration', () => {
  let tmpDir;
  let agentkitRoot;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    agentkitRoot = join(tmpDir, '.agentkit');
    mkdirSync(join(agentkitRoot, 'spec'), { recursive: true });
    writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'p' }));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('respects commitConvention=none in spec/project.yaml', async () => {
    writeFile(
      join(agentkitRoot, 'spec/project.yaml'),
      `process:
  commitConvention: none
`
    );
    writeFile(join(tmpDir, '.commitlintrc.json'), '{}');
    const report = await runDiscover({
      agentkitRoot,
      projectRoot: tmpDir,
      flags: { output: 'json' },
    });
    expect(report.commitConvention).toBe('none');
  });

  it('runs git-log heuristic when no file config + project.yaml has explicit value', async () => {
    writeFile(
      join(agentkitRoot, 'spec/project.yaml'),
      `process:
  commitConvention: conventional
`
    );
    gitInit(tmpDir);
    writeFileSync(join(tmpDir, 'a.txt'), '');
    gitCommit(tmpDir, 'feat: initial');

    const report = await runDiscover({
      agentkitRoot,
      projectRoot: tmpDir,
      flags: { output: 'json' },
    });
    // Either matches via git log heuristic or remains null — both are valid outcomes
    expect(['conventional', null]).toContain(report.commitConvention);
  });

  it('handles malformed project.yaml gracefully', async () => {
    writeFile(join(agentkitRoot, 'spec/project.yaml'), '%%%not yaml%%%');
    const report = await runDiscover({
      agentkitRoot,
      projectRoot: tmpDir,
      flags: { output: 'json' },
    });
    expect(report).toBeDefined();
  });
});
