import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderTemplate,
  sanitizeTemplateValue,
  getCommentStyle,
  getGeneratedHeader,
  mergePermissions,
  insertHeader,
  isScaffoldOnce,
  resolveConditionals,
  resolveEachBlocks,
  replacePlaceholders,
  evalTruthy,
  flattenProjectYaml,
  flattenCrosscutting,
  resolveRenderTargets,
  ALL_RENDER_TARGETS,
  collapseBlankLines,
} from '../template-utils.mjs';

// ---------------------------------------------------------------------------
// renderTemplate
// ---------------------------------------------------------------------------
describe('renderTemplate', () => {
  it('replaces simple placeholders', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('replaces multiple placeholders', () => {
    const result = renderTemplate('{{a}} and {{b}}', { a: '1', b: '2' });
    expect(result).toBe('1 and 2');
  });

  it('replaces longest keys first to prevent partial collisions', () => {
    const result = renderTemplate('{{version}} {{versionInfo}}', {
      version: '1.0',
      versionInfo: 'v1.0-beta',
    });
    expect(result).toBe('1.0 v1.0-beta');
  });

  it('serialises non-string values as JSON', () => {
    const result = renderTemplate('items: {{list}}', { list: ['a', 'b'] });
    expect(result).toBe('items: ["a","b"]');
  });

  it('leaves unresolved placeholders intact', () => {
    const result = renderTemplate('{{known}} {{unknown}}', { known: 'yes' });
    expect(result).toContain('{{unknown}}');
  });

  it('handles empty vars object', () => {
    const result = renderTemplate('no vars here', {});
    expect(result).toBe('no vars here');
  });

  it('handles empty template', () => {
    const result = renderTemplate('', { key: 'value' });
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// replacePlaceholders
// ---------------------------------------------------------------------------
describe('replacePlaceholders', () => {
  let origDebug;
  beforeEach(() => {
    origDebug = process.env.DEBUG;
    delete process.env.DEBUG;
  });
  afterEach(() => {
    if (origDebug !== undefined) process.env.DEBUG = origDebug;
    else delete process.env.DEBUG;
  });

  it('replaces simple placeholders', () => {
    expect(replacePlaceholders('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('replaces longest keys first to prevent partial collisions', () => {
    expect(
      replacePlaceholders('{{version}} {{versionInfo}}', { version: '1.0', versionInfo: 'v1.0-beta' })
    ).toBe('1.0 v1.0-beta');
  });

  it('serialises non-string values as JSON', () => {
    expect(replacePlaceholders('items: {{list}}', { list: ['a', 'b'] })).toBe('items: ["a","b"]');
  });

  it('leaves unresolved placeholders intact', () => {
    expect(replacePlaceholders('{{known}} {{unknown}}', { known: 'yes' })).toContain('{{unknown}}');
  });

  it('sanitizes string values by default', () => {
    expect(replacePlaceholders('{{val}}', { val: '$(rm -rf /)' })).toBe('rm -rf /');
  });

  it('allows raw vars when allowRawVars is true and key is in RAW_TEMPLATE_VARS', () => {
    // commandFlags is in RAW_TEMPLATE_VARS — should pass through unsanitized when allowRawVars=true
    const raw = '| `--flag` | desc | — |';
    expect(replacePlaceholders('{{commandFlags}}', { commandFlags: raw }, true)).toBe(raw);
  });

  it('still sanitizes non-raw keys even when allowRawVars is true', () => {
    expect(replacePlaceholders('{{name}}', { name: '`injection`' }, true)).toBe('injection');
  });

  it('handles empty vars object', () => {
    expect(replacePlaceholders('no vars', {})).toBe('no vars');
  });

  it('warns on unresolved placeholders when DEBUG is set', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.DEBUG = '1';
    replacePlaceholders('{{unknown}}', {});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('{{unknown}}'));
    warnSpy.mockRestore();
  });

  it('does not warn when DEBUG is not set', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    replacePlaceholders('{{unknown}}', {});
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// sanitizeTemplateValue
// ---------------------------------------------------------------------------
describe('sanitizeTemplateValue', () => {
  it('preserves safe characters', () => {
    expect(sanitizeTemplateValue('my-project_v2.0')).toBe('my-project_v2.0');
  });

  it('strips shell injection characters', () => {
    expect(sanitizeTemplateValue('$(rm -rf /)')).toBe('rm -rf /');
  });

  it('preserves parentheses in non-injection context', () => {
    expect(sanitizeTemplateValue('IO operations (file system, network, database)')).toBe(
      'IO operations (file system, network, database)'
    );
  });

  it('strips backtick injection', () => {
    expect(sanitizeTemplateValue('`whoami`')).toBe('whoami');
  });

  it('strips pipe and semicolons', () => {
    expect(sanitizeTemplateValue('name; echo pwned | cat')).toBe('name echo pwned  cat');
  });

  it('preserves spaces, slashes, and @ symbols', () => {
    expect(sanitizeTemplateValue('user@example.com /home/user')).toBe('user@example.com /home/user');
  });
});

// ---------------------------------------------------------------------------
// getCommentStyle
// ---------------------------------------------------------------------------
describe('getCommentStyle', () => {
  it('returns HTML comments for .md', () => {
    expect(getCommentStyle('.md')).toEqual({ start: '<!--', end: '-->' });
  });

  it('returns HTML comments for .mdc', () => {
    expect(getCommentStyle('.mdc')).toEqual({ start: '<!--', end: '-->' });
  });

  it('returns null for .json', () => {
    expect(getCommentStyle('.json')).toBeNull();
  });

  it('returns hash comments for .yaml', () => {
    expect(getCommentStyle('.yaml')).toEqual({ start: '#', end: '' });
  });

  it('returns hash comments for .sh', () => {
    expect(getCommentStyle('.sh')).toEqual({ start: '#', end: '' });
  });

  it('returns hash comments for unknown extensions', () => {
    expect(getCommentStyle('.xyz')).toEqual({ start: '#', end: '' });
  });
});

// ---------------------------------------------------------------------------
// getGeneratedHeader
// ---------------------------------------------------------------------------
describe('getGeneratedHeader', () => {
  it('generates a markdown header', () => {
    const header = getGeneratedHeader('0.1.0', 'my-repo', '.md');
    expect(header).toContain('GENERATED by AgentKit Forge v0.1.0');
    expect(header).toContain('.agentkit/overlays/my-repo');
    expect(header).toContain('pnpm -C .agentkit agentkit:sync');
  });

  it('returns empty string for JSON', () => {
    expect(getGeneratedHeader('0.1.0', 'my-repo', '.json')).toBe('');
  });

  it('generates YAML-style header for .yml', () => {
    const header = getGeneratedHeader('0.1.0', 'my-repo', '.yml');
    expect(header).toContain('# GENERATED by AgentKit Forge v0.1.0');
  });
});

// ---------------------------------------------------------------------------
// mergePermissions
// ---------------------------------------------------------------------------
describe('mergePermissions', () => {
  it('merges allow lists with deduplication', () => {
    const result = mergePermissions(
      { allow: ['Read', 'Write'] },
      { allow: ['Write', 'Bash'] }
    );
    expect(result.allow).toEqual(['Read', 'Write', 'Bash']);
  });

  it('merges deny lists with deduplication', () => {
    const result = mergePermissions(
      { deny: ['Bash'] },
      { deny: ['Bash', 'Write'] }
    );
    expect(result.deny).toEqual(['Bash', 'Write']);
  });

  it('handles empty base', () => {
    const result = mergePermissions({}, { allow: ['Read'], deny: ['Bash'] });
    expect(result.allow).toEqual(['Read']);
    expect(result.deny).toEqual(['Bash']);
  });

  it('handles empty overlay', () => {
    const result = mergePermissions({ allow: ['Read'], deny: ['Bash'] }, {});
    expect(result.allow).toEqual(['Read']);
    expect(result.deny).toEqual(['Bash']);
  });

  it('handles both empty', () => {
    const result = mergePermissions({}, {});
    expect(result.allow).toEqual([]);
    expect(result.deny).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// insertHeader
// ---------------------------------------------------------------------------
describe('insertHeader', () => {
  it('prepends header to plain content', () => {
    const result = insertHeader('Hello world', '.yml', '0.1.0', 'test');
    expect(result).toMatch(/^# GENERATED by AgentKit Forge/);
    expect(result).toContain('Hello world');
  });

  it('skips if header already present', () => {
    const content = '# GENERATED by AgentKit Forge v0.1.0\nHello';
    const result = insertHeader(content, '.yml', '0.1.0', 'test');
    expect(result).toBe(content);
  });

  it('inserts after shebang in .sh files', () => {
    const content = '#!/usr/bin/env bash\necho "hello"';
    const result = insertHeader(content, '.sh', '0.1.0', 'test');
    expect(result).toMatch(/^#!\/usr\/bin\/env bash\n# GENERATED/);
    expect(result).toContain('echo "hello"');
  });

  it('inserts after frontmatter in .md files', () => {
    const content = '---\ntitle: Test\n---\n# Content';
    const result = insertHeader(content, '.md', '0.1.0', 'test');
    expect(result).toContain('title: Test');
    expect(result).toContain('GENERATED by AgentKit Forge');
    expect(result).toContain('# Content');
  });

  it('returns content unchanged for .json', () => {
    const content = '{"key": "value"}';
    const result = insertHeader(content, '.json', '0.1.0', 'test');
    expect(result).toBe(content);
  });
});

// ---------------------------------------------------------------------------
// isScaffoldOnce
// ---------------------------------------------------------------------------
describe('isScaffoldOnce', () => {
  it('identifies project-owned root files', () => {
    expect(isScaffoldOnce('AGENT_BACKLOG.md')).toBe(true);
    expect(isScaffoldOnce('CHANGELOG.md')).toBe(true);
    expect(isScaffoldOnce('CONTRIBUTING.md')).toBe(true);
    expect(isScaffoldOnce('MIGRATIONS.md')).toBe(true);
    expect(isScaffoldOnce('SECURITY.md')).toBe(true);
  });

  it('identifies editor config files', () => {
    expect(isScaffoldOnce('.editorconfig')).toBe(true);
    expect(isScaffoldOnce('.prettierrc')).toBe(true);
    expect(isScaffoldOnce('.markdownlint.json')).toBe(true);
  });

  it('identifies docs/ directory files', () => {
    expect(isScaffoldOnce('docs/README.md')).toBe(true);
    expect(isScaffoldOnce('docs/01_product/overview.md')).toBe(true);
  });

  it('identifies .vscode/ directory files', () => {
    expect(isScaffoldOnce('.vscode/settings.json')).toBe(true);
    expect(isScaffoldOnce('.vscode/extensions.json')).toBe(true);
  });

  it('identifies GitHub scaffold-once files', () => {
    expect(isScaffoldOnce('.github/PULL_REQUEST_TEMPLATE.md')).toBe(true);
    expect(isScaffoldOnce('.github/copilot-instructions.md')).toBe(true);
    expect(isScaffoldOnce('.github/ISSUE_TEMPLATE/bug_report.md')).toBe(true);
    expect(isScaffoldOnce('.github/instructions/docs.md')).toBe(true);
  });

  it('returns false for always-regenerate AI tool configs', () => {
    expect(isScaffoldOnce('CLAUDE.md')).toBe(false);
    expect(isScaffoldOnce('QUALITY_GATES.md')).toBe(false);
    expect(isScaffoldOnce('UNIFIED_AGENT_TEAMS.md')).toBe(false);
    expect(isScaffoldOnce('.github/workflows/ai-framework-ci.yml')).toBe(false);
  });

  it('returns false for AI tool directories', () => {
    expect(isScaffoldOnce('.claude/settings.json')).toBe(false);
    expect(isScaffoldOnce('.cursor/rules/team-backend.mdc')).toBe(false);
    expect(isScaffoldOnce('.windsurf/rules/team-backend.md')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evalTruthy
// ---------------------------------------------------------------------------
describe('evalTruthy', () => {
  it('returns false for undefined', () => {
    expect(evalTruthy(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(evalTruthy(null)).toBe(false);
  });

  it('returns false for false', () => {
    expect(evalTruthy(false)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(evalTruthy('')).toBe(false);
  });

  it('returns false for 0', () => {
    expect(evalTruthy(0)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(evalTruthy([])).toBe(false);
  });

  it('returns true for non-empty string', () => {
    expect(evalTruthy('hello')).toBe(true);
  });

  it('returns true for true', () => {
    expect(evalTruthy(true)).toBe(true);
  });

  it('returns true for non-zero number', () => {
    expect(evalTruthy(1)).toBe(true);
  });

  it('returns true for non-empty array', () => {
    expect(evalTruthy(['a'])).toBe(true);
  });

  it('returns true for object', () => {
    expect(evalTruthy({})).toBe(true);
  });

  it('returns true for the string "none"', () => {
    // 'none' is truthy — templates must use explicit checks
    expect(evalTruthy('none')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveConditionals
// ---------------------------------------------------------------------------
describe('resolveConditionals', () => {
  it('keeps content when var is truthy', () => {
    const result = resolveConditionals('{{#if name}}Hello {{name}}!{{/if}}', { name: 'World' });
    expect(result).toBe('Hello {{name}}!');
  });

  it('removes content when var is falsy', () => {
    const result = resolveConditionals('{{#if name}}Hello!{{/if}}', { name: '' });
    expect(result).toBe('');
  });

  it('removes content when var is undefined', () => {
    const result = resolveConditionals('{{#if missing}}present{{/if}}', {});
    expect(result).toBe('');
  });

  it('handles {{else}} branch — truthy', () => {
    const result = resolveConditionals('{{#if flag}}yes{{else}}no{{/if}}', { flag: true });
    expect(result).toBe('yes');
  });

  it('handles {{else}} branch — falsy', () => {
    const result = resolveConditionals('{{#if flag}}yes{{else}}no{{/if}}', { flag: false });
    expect(result).toBe('no');
  });

  it('resolves nested conditionals — both truthy', () => {
    const tpl = '{{#if outer}}{{#if inner}}both{{/if}}{{/if}}';
    expect(resolveConditionals(tpl, { outer: true, inner: true })).toBe('both');
  });

  it('resolves nested conditionals — inner falsy', () => {
    const tpl = '{{#if outer}}{{#if inner}}both{{/if}}{{/if}}';
    expect(resolveConditionals(tpl, { outer: true, inner: false })).toBe('');
  });

  it('resolves nested conditionals — outer falsy', () => {
    const tpl = '{{#if outer}}{{#if inner}}both{{/if}}{{/if}}';
    expect(resolveConditionals(tpl, { outer: false, inner: true })).toBe('');
  });

  it('returns empty string for empty array var', () => {
    const result = resolveConditionals('{{#if items}}list{{/if}}', { items: [] });
    expect(result).toBe('');
  });

  it('warns on safety limit exhaustion', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 51 levels of nesting will exhaust the 50-iteration safety counter
    const open = '{{#if a}}'.repeat(51);
    const close = '{{/if}}'.repeat(51);
    resolveConditionals(open + 'deep' + close, { a: true });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('safety limit reached'));
    warnSpy.mockRestore();
  });

  it('uses only the first {{else}} when body contains multiple potential splits', () => {
    const result = resolveConditionals('{{#if flag}}A{{else}}B{{/if}}', { flag: false });
    expect(result).toBe('B');

    const result2 = resolveConditionals('{{#if flag}}A{{else}}B{{/if}}', { flag: true });
    expect(result2).toBe('A');
  });

  it('preserves surrounding text', () => {
    const result = resolveConditionals('before {{#if x}}X{{/if}} after', { x: 'yes' });
    expect(result).toBe('before X after');
  });

  it('handles multiple independent if blocks', () => {
    const result = resolveConditionals('{{#if a}}A{{/if}}{{#if b}}B{{/if}}', { a: true, b: true });
    expect(result).toBe('AB');
  });

  // {{#unless}} support
  it('keeps content when unless var is falsy', () => {
    const result = resolveConditionals('{{#unless flag}}shown{{/unless}}', { flag: false });
    expect(result).toBe('shown');
  });

  it('removes content when unless var is truthy', () => {
    const result = resolveConditionals('{{#unless flag}}hidden{{/unless}}', { flag: true });
    expect(result).toBe('');
  });

  it('keeps content when unless var is undefined', () => {
    const result = resolveConditionals('{{#unless missing}}shown{{/unless}}', {});
    expect(result).toBe('shown');
  });

  it('handles unless with {{else}} — falsy', () => {
    const result = resolveConditionals('{{#unless flag}}A{{else}}B{{/unless}}', { flag: false });
    expect(result).toBe('A');
  });

  it('handles unless with {{else}} — truthy', () => {
    const result = resolveConditionals('{{#unless flag}}A{{else}}B{{/unless}}', { flag: true });
    expect(result).toBe('B');
  });

  it('handles unless with empty array (falsy)', () => {
    const result = resolveConditionals('{{#unless items}}no items{{/unless}}', { items: [] });
    expect(result).toBe('no items');
  });

  it('handles unless with non-empty array (truthy)', () => {
    const result = resolveConditionals('{{#unless items}}no items{{/unless}}', { items: ['a'] });
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// resolveEachBlocks
// ---------------------------------------------------------------------------
describe('resolveEachBlocks', () => {
  it('iterates over string array using {{.}}', () => {
    const result = resolveEachBlocks('{{#each items}}{{.}},{{/each}}', { items: ['a', 'b', 'c'] });
    expect(result).toBe('a,b,c,');
  });

  it('returns empty string for empty array', () => {
    const result = resolveEachBlocks('{{#each items}}{{.}}{{/each}}', { items: [] });
    expect(result).toBe('');
  });

  it('returns empty string when var is not an array', () => {
    const result = resolveEachBlocks('{{#each items}}{{.}}{{/each}}', { items: 'notarray' });
    expect(result).toBe('');
  });

  it('returns empty string when var is undefined', () => {
    const result = resolveEachBlocks('{{#each items}}{{.}}{{/each}}', {});
    expect(result).toBe('');
  });

  it('iterates over object array using {{.prop}}', () => {
    const result = resolveEachBlocks(
      '{{#each items}}{{.name}}:{{.purpose}} {{/each}}',
      { items: [{ name: 'A', purpose: 'auth' }, { name: 'B', purpose: 'pay' }] }
    );
    expect(result).toBe('A:auth B:pay ');
  });

  it('replaces missing object props with empty string', () => {
    const result = resolveEachBlocks(
      '{{#each items}}{{.name}}{{.missing}}{{/each}}',
      { items: [{ name: 'X' }] }
    );
    expect(result).toBe('X');
  });

  it('exposes {{@index}} for current position', () => {
    const result = resolveEachBlocks(
      '{{#each items}}{{@index}}:{{.}} {{/each}}',
      { items: ['x', 'y'] }
    );
    expect(result).toBe('0:x 1:y ');
  });
});

// ---------------------------------------------------------------------------
// flattenProjectYaml
// ---------------------------------------------------------------------------
describe('flattenProjectYaml', () => {
  it('returns empty object for null input', () => {
    expect(flattenProjectYaml(null)).toEqual({});
  });

  it('returns empty object for non-object input', () => {
    expect(flattenProjectYaml('string')).toEqual({});
  });

  it('maps top-level scalar fields', () => {
    const vars = flattenProjectYaml({ name: 'MyApp', description: 'Desc', phase: 'active' });
    expect(vars.projectName).toBe('MyApp');
    expect(vars.projectDescription).toBe('Desc');
    expect(vars.projectPhase).toBe('active');
  });

  it('maps stack.languages as comma-separated string', () => {
    const vars = flattenProjectYaml({ stack: { languages: ['TypeScript', 'C#'] } });
    expect(vars.stackLanguages).toBe('TypeScript, C#');
  });

  it('maps stack.frameworks arrays', () => {
    const vars = flattenProjectYaml({
      stack: { frameworks: { frontend: ['React'], backend: ['Express'], css: ['Tailwind'] } },
    });
    expect(vars.stackFrontendFrameworks).toBe('React');
    expect(vars.stackBackendFrameworks).toBe('Express');
    expect(vars.stackCssFrameworks).toBe('Tailwind');
  });

  it('maps architecture fields', () => {
    const vars = flattenProjectYaml({
      architecture: { pattern: 'clean', apiStyle: 'rest', monorepo: true, monorepoTool: 'nx' },
    });
    expect(vars.architecturePattern).toBe('clean');
    expect(vars.architectureApiStyle).toBe('rest');
    expect(vars.hasMonorepo).toBe(true);
    expect(vars.monorepoTool).toBe('nx');
  });

  it('maps deployment fields', () => {
    const vars = flattenProjectYaml({
      deployment: { cloudProvider: 'azure', containerized: true, environments: ['dev', 'prod'], iacTool: 'bicep' },
    });
    expect(vars.cloudProvider).toBe('azure');
    expect(vars.hasContainerized).toBe(true);
    expect(vars.environments).toBe('dev, prod');
    expect(vars.iacTool).toBe('bicep');
  });

  it('maps testing fields', () => {
    const vars = flattenProjectYaml({
      testing: { unit: ['vitest'], integration: ['supertest'], e2e: ['playwright'], coverage: 80 },
    });
    expect(vars.testingUnit).toBe('vitest');
    expect(vars.testingIntegration).toBe('supertest');
    expect(vars.testingE2e).toBe('playwright');
    expect(vars.testingCoverage).toBe('80');
  });

  it('keeps integrations as array and sets hasIntegrations true', () => {
    const vars = flattenProjectYaml({
      integrations: [{ name: 'Stripe', purpose: 'payments' }],
    });
    expect(Array.isArray(vars.integrations)).toBe(true);
    expect(vars.hasIntegrations).toBe(true);
  });

  it('sets hasIntegrations false for empty integrations array', () => {
    const vars = flattenProjectYaml({ integrations: [] });
    expect(vars.hasIntegrations).toBe(false);
  });

  it('does not create a meaningful stackLanguages var for empty languages array', () => {
    const vars = flattenProjectYaml({ stack: { languages: [] } });
    expect(vars.stackLanguages == null || vars.stackLanguages === '').toBe(true);
  });

  it('handles database as string (defensive fallback)', () => {
    const vars = flattenProjectYaml({ stack: { database: 'postgres' } });
    expect(vars.stackDatabase).toBe('postgres');
  });

  it('maps documentation boolean has* flags', () => {
    const vars = flattenProjectYaml({
      documentation: { hasPrd: true, prdPath: 'docs/prd.md', hasAdr: false },
    });
    expect(vars.hasPrd).toBe(true);
    expect(vars.prdPath).toBe('docs/prd.md');
    expect(vars.hasAdr).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// flattenCrosscutting
// ---------------------------------------------------------------------------
describe('flattenCrosscutting', () => {
  it('maps logging fields', () => {
    const vars = {};
    flattenCrosscutting({
      logging: { framework: 'serilog', structured: true, correlationId: true, level: 'information', sink: ['console'] },
    }, vars);
    expect(vars.loggingFramework).toBe('serilog');
    expect(vars.hasLogging).toBe(true);
    expect(vars.hasStructuredLogging).toBe(true);
    expect(vars.hasCorrelationId).toBe(true);
    expect(vars.loggingLevel).toBe('information');
    expect(vars.loggingSinks).toBe('console');
  });

  it('does not set hasLogging when framework is "none"', () => {
    const vars = {};
    flattenCrosscutting({ logging: { framework: 'none' } }, vars);
    expect(vars.hasLogging).toBeUndefined();
  });

  it('maps authentication fields', () => {
    const vars = {};
    flattenCrosscutting({
      authentication: { provider: 'auth0', strategy: 'jwt-bearer', rbac: true, multiTenant: false },
    }, vars);
    expect(vars.authProvider).toBe('auth0');
    expect(vars.hasAuth).toBe(true);
    expect(vars.authStrategy).toBe('jwt-bearer');
    expect(vars.hasRbac).toBe(true);
    expect(vars.hasMultiTenant).toBe(false);
  });

  it('maps caching fields', () => {
    const vars = {};
    flattenCrosscutting({
      caching: { provider: 'redis', patterns: ['cache-aside'], distributedCache: true },
    }, vars);
    expect(vars.cachingProvider).toBe('redis');
    expect(vars.hasCaching).toBe(true);
    expect(vars.cachingPatterns).toBe('cache-aside');
    expect(vars.hasDistributedCache).toBe(true);
  });

  it('maps feature flags', () => {
    const vars = {};
    flattenCrosscutting({ featureFlags: { provider: 'launchdarkly' } }, vars);
    expect(vars.featureFlagProvider).toBe('launchdarkly');
    expect(vars.hasFeatureFlags).toBe(true);
  });

  it('handles empty crosscutting object without throwing', () => {
    const vars = {};
    expect(() => flattenCrosscutting({}, vars)).not.toThrow();
  });

  it('does not set hasAuth when provider is none', () => {
    const vars = {};
    flattenCrosscutting({ authentication: { provider: 'none' } }, vars);
    expect(vars.hasAuth).toBeUndefined();
  });

  it('sets hasApiVersioning when versioning is not none', () => {
    const vars = {};
    flattenCrosscutting({ api: { versioning: 'url-segment', pagination: 'cursor' } }, vars);
    expect(vars.hasApiVersioning).toBe(true);
    expect(vars.apiVersioning).toBe('url-segment');
    expect(vars.hasApiPagination).toBe(true);
    expect(vars.apiPagination).toBe('cursor');
  });

  it('sets hasDbMigrations when migrations is not none', () => {
    const vars = {};
    flattenCrosscutting({ database: { migrations: 'code-first' } }, vars);
    expect(vars.hasDbMigrations).toBe(true);
    expect(vars.dbMigrations).toBe('code-first');
  });
});

// ---------------------------------------------------------------------------
// resolveRenderTargets
// ---------------------------------------------------------------------------
describe('resolveRenderTargets', () => {
  it('returns all targets when overlayTargets is undefined and no --only flag', () => {
    const result = resolveRenderTargets(undefined, {});
    expect(result).toEqual(new Set(ALL_RENDER_TARGETS));
  });

  it('returns all targets when overlayTargets is empty array and no --only flag', () => {
    const result = resolveRenderTargets([], {});
    expect(result).toEqual(new Set(ALL_RENDER_TARGETS));
  });

  it('returns overlay targets when defined and no --only flag', () => {
    const result = resolveRenderTargets(['claude', 'cursor'], {});
    expect(result).toEqual(new Set(['claude', 'cursor']));
  });

  it('--only flag overrides overlay targets', () => {
    const result = resolveRenderTargets(['claude', 'cursor', 'windsurf'], { only: 'claude,cursor' });
    expect(result).toEqual(new Set(['claude', 'cursor']));
  });

  it('--only flag overrides default all-targets', () => {
    const result = resolveRenderTargets(undefined, { only: 'copilot' });
    expect(result).toEqual(new Set(['copilot']));
  });

  it('--only flag handles whitespace around commas', () => {
    const result = resolveRenderTargets(undefined, { only: 'claude , cursor , windsurf' });
    expect(result).toEqual(new Set(['claude', 'cursor', 'windsurf']));
  });

  it('--only flag filters out empty tokens', () => {
    const result = resolveRenderTargets(undefined, { only: 'claude,,cursor' });
    expect(result).toEqual(new Set(['claude', 'cursor']));
  });

  it('returns all targets when flags is null', () => {
    const result = resolveRenderTargets(undefined, null);
    expect(result).toEqual(new Set(ALL_RENDER_TARGETS));
  });
});

// ---------------------------------------------------------------------------
// collapseBlankLines
// ---------------------------------------------------------------------------
describe('collapseBlankLines', () => {
  it('collapses 3+ consecutive blank lines to a single blank line', () => {
    const input = 'A\n\n\n\nB';
    expect(collapseBlankLines(input)).toBe('A\n\nB');
  });

  it('preserves a single blank line between paragraphs', () => {
    const input = 'A\n\nB';
    expect(collapseBlankLines(input)).toBe('A\n\nB');
  });

  it('collapses many blank lines', () => {
    const input = 'A\n\n\n\n\n\n\n\n\nB';
    expect(collapseBlankLines(input)).toBe('A\n\nB');
  });

  it('handles text with no blank lines', () => {
    const input = 'A\nB\nC';
    expect(collapseBlankLines(input)).toBe('A\nB\nC');
  });

  it('handles empty string', () => {
    expect(collapseBlankLines('')).toBe('');
  });

  it('handles multiple sections with excessive blanks', () => {
    const input = 'A\n\n\n\nB\n\n\n\n\nC';
    expect(collapseBlankLines(input)).toBe('A\n\nB\n\nC');
  });
});
