import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderTemplate,
  sanitizeTemplateValue,
  getCommentStyle,
  startSyncReport,
  getSyncReportData,
  resetSyncReport,
  getGeneratedHeader,
  mergePermissions,
  insertHeader,
  isScaffoldOnce,
  isTestSuitePath,
  parseTemplateFrontmatter,
  resolveScaffoldAction,
  resolveConditionals,
  resolveEachBlocks,
  replacePlaceholders,
  evalTruthy,
  flattenProjectYaml,
  flattenCrosscutting,
  resolveRenderTargets,
  ALL_RENDER_TARGETS,
  collapseBlankLines,
  escapeYamlString,
  resolveHelpers,
} from '../template-utils.mjs';
import { transform } from '../project-mapping.mjs';

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
  it('replaces simple placeholders', () => {
    expect(replacePlaceholders('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('replaces longest keys first to prevent partial collisions', () => {
    expect(
      replacePlaceholders('{{version}} {{versionInfo}}', {
        version: '1.0',
        versionInfo: 'v1.0-beta',
      })
    ).toBe('1.0 v1.0-beta');
  });

  it('serialises non-string values as JSON', () => {
    expect(replacePlaceholders('items: {{list}}', { list: ['a', 'b'] })).toBe('items: ["a","b"]');
  });

  it('leaves unresolved placeholders intact', () => {
    expect(replacePlaceholders('{{known}} {{unknown}}', { known: 'yes' })).toContain('{{unknown}}');
  });

  it('does not sanitize string values by default', () => {
    expect(replacePlaceholders('{{val}}', { val: '$(rm -rf /)' })).toBe('$(rm -rf /)');
  });

  it('sanitizes string values when sanitizeStrings is enabled', () => {
    expect(replacePlaceholders('{{val}}', { val: '$(rm -rf /)' }, true)).toBe('rm -rf /');
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

  it('resolves {{var|default}} pipe syntax with fallback when var is missing', () => {
    const result = replacePlaceholders('coverage: {{testingCoverage|80}}%', {});
    expect(result).toBe('coverage: 80%');
  });

  it('resolves {{var|default}} pipe syntax with var value when present', () => {
    const result = replacePlaceholders('coverage: {{testingCoverage|80}}%', {
      testingCoverage: '95',
    });
    expect(result).toBe('coverage: 95%');
  });

  it('supports empty default in {{var|}} pipe syntax', () => {
    const result = replacePlaceholders('val: {{missing|}}!', {});
    expect(result).toBe('val: !');
  });

  it('warns on unresolved placeholders', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    replacePlaceholders('{{unknown}}', {});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('{{unknown}}'));
    warnSpy.mockRestore();
  });

  it('does not warn when all placeholders are resolved', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    replacePlaceholders('{{known}}', { known: 'value' });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// escapeYamlString
// ---------------------------------------------------------------------------
describe('escapeYamlString', () => {
  it('wraps a simple string in single quotes', () => {
    expect(escapeYamlString('hello world')).toBe("'hello world'");
  });

  it('doubles internal single quotes per YAML spec', () => {
    expect(escapeYamlString("it's a test")).toBe("'it''s a test'");
  });

  it('handles multiple single quotes', () => {
    expect(escapeYamlString("a'b'c")).toBe("'a''b''c'");
  });

  it('returns empty quoted string for undefined', () => {
    expect(escapeYamlString(undefined)).toBe("''");
  });

  it('returns empty quoted string for null', () => {
    expect(escapeYamlString(null)).toBe("''");
  });

  it('converts non-string values to string', () => {
    expect(escapeYamlString(42)).toBe("'42'");
  });

  it('handles empty string', () => {
    expect(escapeYamlString('')).toBe("''");
  });

  it('handles strings with colons and special YAML chars', () => {
    expect(escapeYamlString('key: value')).toBe("'key: value'");
  });
});

// ---------------------------------------------------------------------------
// resolveHelpers
// ---------------------------------------------------------------------------
describe('resolveHelpers', () => {
  it('resolves {{escapeYamlString varName}} with the helper', () => {
    const result = resolveHelpers('description: {{escapeYamlString desc}}', {
      desc: 'A simple description',
    });
    expect(result).toBe("description: 'A simple description'");
  });

  it('escapes single quotes in helper output', () => {
    const result = resolveHelpers('val: {{escapeYamlString title}}', {
      title: "it's here",
    });
    expect(result).toBe("val: 'it''s here'");
  });

  it('returns empty quotes when variable is undefined', () => {
    const result = resolveHelpers('val: {{escapeYamlString missing}}', {});
    expect(result).toBe("val: ''");
  });

  it('leaves non-helper double-brace expressions untouched', () => {
    const result = resolveHelpers('{{normalVar}}', { normalVar: 'keep' });
    expect(result).toBe('{{normalVar}}');
  });

  it('handles multiple helper calls in one template', () => {
    const result = resolveHelpers('{{escapeYamlString a}} and {{escapeYamlString b}}', {
      a: 'foo',
      b: 'bar',
    });
    expect(result).toBe("'foo' and 'bar'");
  });

  it('does not match helper syntax without a space', () => {
    // {{escapeYamlStringfoo}} is not valid helper syntax
    const result = resolveHelpers('{{escapeYamlStringfoo}}', { foo: 'val' });
    expect(result).toBe('{{escapeYamlStringfoo}}');
  });

  it('warns about unknown helper names in helper-like syntax', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveHelpers('{{unknownHelper someVar}}', { someVar: 'val' });
    // Unknown helper expression is left untouched in output
    expect(result).toBe('{{unknownHelper someVar}}');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown helper 'unknownHelper'"));
    warnSpy.mockRestore();
  });

  it('does not warn for built-in block helpers like if/each/unless', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // These look like {{word word}} but are block helpers, not template helpers
    const result = resolveHelpers('{{if someVar}}', { someVar: true });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns with suggestion listing known helpers', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveHelpers('{{badHelper foo}}', {});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('escapeYamlString'));
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
    expect(sanitizeTemplateValue('user@example.com /home/user')).toBe(
      'user@example.com /home/user'
    );
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
    expect(header).toContain('GENERATED by Retort v0.1.0');
    expect(header).toContain('.agentkit/overlays/my-repo');
    expect(header).toContain('pnpm --dir .agentkit retort:sync');
  });

  it('returns empty string for JSON', () => {
    expect(getGeneratedHeader('0.1.0', 'my-repo', '.json')).toBe('');
  });

  it('generates YAML-style header for .yml', () => {
    const header = getGeneratedHeader('0.1.0', 'my-repo', '.yml');
    expect(header).toContain('# GENERATED by Retort v0.1.0');
  });
});

// ---------------------------------------------------------------------------
// mergePermissions
// ---------------------------------------------------------------------------
describe('mergePermissions', () => {
  it('merges allow lists with deduplication', () => {
    const result = mergePermissions({ allow: ['Read', 'Write'] }, { allow: ['Write', 'Bash'] });
    expect(result.allow).toEqual(['Read', 'Write', 'Bash']);
  });

  it('merges deny lists with deduplication', () => {
    const result = mergePermissions({ deny: ['Bash'] }, { deny: ['Bash', 'Write'] });
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
    expect(result).toMatch(/^# GENERATED by Retort/);
    expect(result).toContain('Hello world');
  });

  it('skips if header already present', () => {
    const content = '# GENERATED by Retort v0.1.0\nHello';
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
    expect(result).toContain('GENERATED by Retort');
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
    expect(isScaffoldOnce('docs/product/overview.md')).toBe(true);
  });

  it('identifies .vscode/ directory files', () => {
    expect(isScaffoldOnce('.vscode/settings.json')).toBe(true);
    expect(isScaffoldOnce('.vscode/extensions.json')).toBe(true);
  });

  it('identifies GitHub scaffold-once files', () => {
    expect(isScaffoldOnce('.github/PULL_REQUEST_TEMPLATE.md')).toBe(true);
    expect(isScaffoldOnce('.github/ISSUE_TEMPLATE/bug_report.md')).toBe(true);
    expect(isScaffoldOnce('.github/instructions/docs.md')).toBe(true);
  });

  it('treats .github/copilot-instructions.md as always-regenerated', () => {
    expect(isScaffoldOnce('.github/copilot-instructions.md')).toBe(false);
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

  it('supports scaffold override lists from vars', () => {
    const vars = {
      languageProfileScaffoldAlwaysRegenerateList: ['docs/README.md'],
      languageProfileScaffoldOnceList: ['CLAUDE.md'],
    };

    expect(isScaffoldOnce('docs/README.md', vars)).toBe(false);
    expect(isScaffoldOnce('CLAUDE.md', vars)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseTemplateFrontmatter
// ---------------------------------------------------------------------------
describe('parseTemplateFrontmatter', () => {
  it('returns null meta and original content when no frontmatter', () => {
    const template = '# Hello World\nSome content here.';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta).toBeNull();
    expect(result.content).toBe(template);
  });

  it('parses scaffold: always directive', () => {
    const template = '---\nagentkit:\n  scaffold: always\n---\n# Hello';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta).toEqual({ agentkit: { scaffold: 'always' } });
    expect(result.content).toBe('# Hello');
  });

  it('parses scaffold: managed directive', () => {
    const template = '---\nagentkit:\n  scaffold: managed\n---\n# Hello';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta).toEqual({ agentkit: { scaffold: 'managed' } });
    expect(result.content).toBe('# Hello');
  });

  it('parses scaffold: once directive', () => {
    const template = '---\nagentkit:\n  scaffold: once\n---\n# Hello';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta).toEqual({ agentkit: { scaffold: 'once' } });
    expect(result.content).toBe('# Hello');
  });

  it('strips frontmatter from content', () => {
    const template =
      '---\nagentkit:\n  scaffold: always\n---\n<!-- GENERATED -->\n# Title\nBody text';
    const result = parseTemplateFrontmatter(template);
    expect(result.content).toBe('<!-- GENERATED -->\n# Title\nBody text');
    expect(result.content).not.toContain('---');
    expect(result.content).not.toContain('scaffold');
  });

  it('does not confuse horizontal rules with frontmatter', () => {
    const template = '# Title\n\n---\nSome content\n---\nMore content';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta).toBeNull();
    expect(result.content).toBe(template);
  });

  it('returns null meta when closing --- is missing', () => {
    const template = '---\nagentkit:\n  scaffold: always\nNo closing marker';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta).toBeNull();
    expect(result.content).toBe(template);
  });

  it('preserves unknown keys in meta (forward-compatible)', () => {
    const template = '---\nagentkit:\n  scaffold: managed\n  version: 2\n---\n# Content';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta.agentkit.scaffold).toBe('managed');
    expect(result.meta.agentkit.version).toBe('2');
  });

  it('handles top-level flat keys', () => {
    const template = '---\ntitle: My Doc\nagentkit:\n  scaffold: always\n---\nBody';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta.title).toBe('My Doc');
    expect(result.meta.agentkit.scaffold).toBe('always');
  });

  it('handles empty frontmatter block', () => {
    const template = '---\n---\n# Content';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta).toEqual({});
    expect(result.content).toBe('# Content');
  });

  it('handles frontmatter with comment lines', () => {
    const template = '---\n# This is a comment\nagentkit:\n  scaffold: managed\n---\nBody';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta.agentkit.scaffold).toBe('managed');
  });

  it('handles values containing colons', () => {
    const template = '---\nurl: http://example.com\n---\nBody';
    const result = parseTemplateFrontmatter(template);
    expect(result.meta.url).toBe('http://example.com');
    expect(result.content).toBe('Body');
  });
});

// ---------------------------------------------------------------------------
// resolveScaffoldAction
// ---------------------------------------------------------------------------
describe('resolveScaffoldAction', () => {
  it('returns write for scaffold: always', () => {
    const meta = { agentkit: { scaffold: 'always' } };
    expect(resolveScaffoldAction('docs/README.md', {}, meta)).toBe('write');
  });

  it('returns check-hash for scaffold: managed', () => {
    const meta = { agentkit: { scaffold: 'managed' } };
    expect(resolveScaffoldAction('docs/product/README.md', {}, meta)).toBe('check-hash');
  });

  it('returns skip for scaffold: once', () => {
    const meta = { agentkit: { scaffold: 'once' } };
    expect(resolveScaffoldAction('some/file.md', {}, meta)).toBe('skip');
  });

  it('returns adopt-if-missing for scaffold: adopt-if-missing', () => {
    const meta = { agentkit: { scaffold: 'adopt-if-missing' } };
    expect(resolveScaffoldAction('some/file.md', {}, meta)).toBe('adopt-if-missing');
  });

  it('adopt-if-missing overrides scaffold-once path defaults', () => {
    const meta = { agentkit: { scaffold: 'adopt-if-missing' } };
    // docs/ is normally scaffold-once, adopt-if-missing takes precedence
    expect(resolveScaffoldAction('docs/README.md', {}, meta)).toBe('adopt-if-missing');
  });

  it('falls through to isScaffoldOnce when no meta', () => {
    // docs/ is scaffold-once by default
    expect(resolveScaffoldAction('docs/README.md', {}, null)).toBe('skip');
    // CLAUDE.md is not scaffold-once
    expect(resolveScaffoldAction('CLAUDE.md', {}, null)).toBe('write');
  });

  it('falls through to isScaffoldOnce when meta has no agentkit key', () => {
    const meta = { title: 'Some Doc' };
    expect(resolveScaffoldAction('docs/README.md', {}, meta)).toBe('skip');
  });

  it('always overrides scaffold-once dirs when set to always', () => {
    const meta = { agentkit: { scaffold: 'always' } };
    // docs/ is normally scaffold-once, but always overrides it
    expect(resolveScaffoldAction('docs/README.md', {}, meta)).toBe('write');
    expect(resolveScaffoldAction('docs/product/README.md', {}, meta)).toBe('write');
  });

  it('managed overrides scaffold-once dirs', () => {
    const meta = { agentkit: { scaffold: 'managed' } };
    expect(resolveScaffoldAction('docs/engineering/README.md', {}, meta)).toBe('check-hash');
  });

  it('respects vars override lists when no frontmatter', () => {
    const vars = {
      languageProfileScaffoldAlwaysRegenerateList: ['docs/README.md'],
    };
    expect(resolveScaffoldAction('docs/README.md', vars, null)).toBe('write');
  });

  it('frontmatter takes priority over vars override lists', () => {
    const meta = { agentkit: { scaffold: 'managed' } };
    const vars = {
      languageProfileScaffoldAlwaysRegenerateList: ['docs/README.md'],
    };
    // Frontmatter says managed, vars say always-regenerate — frontmatter wins
    expect(resolveScaffoldAction('docs/README.md', vars, meta)).toBe('check-hash');
  });

  describe('test suite guard (GH#422)', () => {
    it('skips test dirs when testingExamplesEnabled is false', () => {
      expect(resolveScaffoldAction('tests/foo.test.js', {}, null)).toBe('skip');
      expect(resolveScaffoldAction('__tests__/auth.test.ts', {}, null)).toBe('skip');
      expect(resolveScaffoldAction('cypress/e2e/login.cy.ts', {}, null)).toBe('skip');
      expect(resolveScaffoldAction('playwright/tests/home.spec.ts', {}, null)).toBe('skip');
    });

    it('skips test config files when testingExamplesEnabled is false', () => {
      expect(resolveScaffoldAction('vitest.config.ts', {}, null)).toBe('skip');
      expect(resolveScaffoldAction('jest.config.js', {}, null)).toBe('skip');
      expect(resolveScaffoldAction('playwright.config.ts', {}, null)).toBe('skip');
      expect(resolveScaffoldAction('cypress.config.js', {}, null)).toBe('skip');
    });

    it('allows test files when testingExamplesEnabled is true', () => {
      const vars = { testingExamplesEnabled: true };
      // tests/ is not scaffold-once, so should write
      expect(resolveScaffoldAction('tests/foo.test.js', vars, null)).toBe('write');
      expect(resolveScaffoldAction('vitest.config.ts', vars, null)).toBe('write');
    });

    it('frontmatter always overrides test suite guard', () => {
      const meta = { agentkit: { scaffold: 'always' } };
      expect(resolveScaffoldAction('tests/foo.test.js', {}, meta)).toBe('write');
    });
  });
});

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// isTestSuitePath
// ---------------------------------------------------------------------------
describe('isTestSuitePath', () => {
  it('matches top-level test directories', () => {
    expect(isTestSuitePath('tests/foo.js')).toBe(true);
    expect(isTestSuitePath('__tests__/bar.ts')).toBe(true);
    expect(isTestSuitePath('test/baz.js')).toBe(true);
    expect(isTestSuitePath('cypress/integration/login.cy.ts')).toBe(true);
    expect(isTestSuitePath('playwright/tests/home.spec.ts')).toBe(true);
    expect(isTestSuitePath('e2e/smoke.spec.ts')).toBe(true);
  });

  it('matches nested test directories', () => {
    expect(isTestSuitePath('src/__tests__/auth.test.ts')).toBe(true);
    expect(isTestSuitePath('packages/core/tests/index.test.js')).toBe(true);
  });

  it('matches test file name patterns', () => {
    expect(isTestSuitePath('src/auth.test.ts')).toBe(true);
    expect(isTestSuitePath('src/auth.spec.ts')).toBe(true);
    expect(isTestSuitePath('src/auth_test.ts')).toBe(true);
    expect(isTestSuitePath('tests_module.test.py')).toBe(true);
    expect(isTestSuitePath('vitest.config.ts')).toBe(true);
    expect(isTestSuitePath('jest.config.js')).toBe(true);
    expect(isTestSuitePath('playwright.config.ts')).toBe(true);
    expect(isTestSuitePath('cypress.config.js')).toBe(true);
  });

  it('does not match non-test files', () => {
    expect(isTestSuitePath('src/auth.ts')).toBe(false);
    expect(isTestSuitePath('CLAUDE.md')).toBe(false);
    expect(isTestSuitePath('docs/engineering/03_testing.md')).toBe(false);
    expect(isTestSuitePath('.claude/rules/testing.md')).toBe(false);
    expect(isTestSuitePath('scripts/validate-state.sh')).toBe(false);
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
    const result = resolveEachBlocks('{{#each items}}{{.name}}:{{.purpose}} {{/each}}', {
      items: [
        { name: 'A', purpose: 'auth' },
        { name: 'B', purpose: 'pay' },
      ],
    });
    expect(result).toBe('A:auth B:pay ');
  });

  it('replaces missing object props with empty string', () => {
    const result = resolveEachBlocks('{{#each items}}{{.name}}{{.missing}}{{/each}}', {
      items: [{ name: 'X' }],
    });
    expect(result).toBe('X');
  });

  it('exposes {{@index}} for current position', () => {
    const result = resolveEachBlocks('{{#each items}}{{@index}}:{{.}} {{/each}}', {
      items: ['x', 'y'],
    });
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
      deployment: {
        cloudProvider: 'azure',
        containerized: true,
        environments: ['dev', 'prod'],
        iacTool: 'bicep',
      },
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

  it('maps extended testing fields (mutation, staticAnalysis, contractTesting, performanceTesting)', () => {
    const vars = flattenProjectYaml({
      testing: {
        mutation: 'stryker',
        staticAnalysis: ['semgrep', 'eslint'],
        contractTesting: 'pact',
        performanceTesting: 'k6',
      },
    });
    expect(vars.testingMutation).toBe('stryker');
    expect(vars.hasMutationTesting).toBe(true);
    expect(vars.testingStaticAnalysis).toBe('semgrep, eslint');
    expect(vars.hasStaticAnalysis).toBe(true);
    expect(vars.testingContractTesting).toBe('pact');
    expect(vars.hasContractTesting).toBe(true);
    expect(vars.testingPerformanceTesting).toBe('k6');
    expect(vars.hasPerformanceTesting).toBe(true);
  });

  it('sets hasStaticAnalysis false for empty staticAnalysis array', () => {
    const vars = flattenProjectYaml({ testing: { staticAnalysis: [] } });
    expect(vars.hasStaticAnalysis).toBe(false);
  });

  it('sets hasMutationTesting false when mutation is null', () => {
    const vars = flattenProjectYaml({ testing: { mutation: null } });
    expect(vars.hasMutationTesting).toBeFalsy();
  });

  it('derives hasLanguageRust from stack.languages', () => {
    const vars = flattenProjectYaml({ stack: { languages: ['Rust', 'TypeScript'] } });
    expect(vars.hasLanguageRust).toBe(true);
    expect(vars.hasLanguageTypeScript).toBe(true);
    expect(vars.hasLanguageJsLike).toBe(true);
    expect(vars.hasLanguagePython).toBe(false);
  });

  it('derives hasLanguageJsLike for javascript variants', () => {
    const vars = flattenProjectYaml({ stack: { languages: ['javascript'] } });
    expect(vars.hasLanguageJavaScript).toBe(true);
    expect(vars.hasLanguageJsLike).toBe(true);
    expect(vars.hasLanguageJsLikeEffective).toBe(true);
    expect(vars.languageInferenceSource).toBe('configured');
    expect(vars.languageInferenceConfidence).toBe('high');
  });

  it('infers js-like language from node framework when configured languages are missing', () => {
    const vars = flattenProjectYaml({
      stack: { languages: [], frameworks: { backend: ['node.js'] } },
      testing: { unit: [] },
    });
    expect(vars.hasConfiguredLanguages).toBe(false);
    expect(vars.hasLanguageJsLikeInferred).toBe(true);
    expect(vars.hasLanguageJsLikeEffective).toBe(true);
    expect(vars.languageInferenceSource).toBe('heuristic');
    expect(vars.languageInferenceConfidence).toBe('medium');
    expect(vars.hasLanguageInferenceUsed).toBe(true);
    expect(vars.hasLanguageInferenceMismatch).toBe(false);
  });

  it('prefers configured languages over inferred signals for effective flags', () => {
    const vars = flattenProjectYaml({
      stack: {
        languages: ['python'],
        frameworks: { backend: ['node.js'] },
      },
      testing: { unit: [] },
    });
    expect(vars.hasConfiguredLanguages).toBe(true);
    expect(vars.hasLanguageJsLikeInferred).toBe(true);
    expect(vars.hasLanguageJsLikeEffective).toBe(false);
    expect(vars.hasLanguagePythonEffective).toBe(true);
    expect(vars.languageInferenceSource).toBe('mixed');
    expect(vars.languageInferenceConfidence).toBe('high');
    expect(vars.hasLanguageInferenceMismatch).toBe(true);
    expect(vars.hasLanguageInferenceUsed).toBe(false);
  });

  it('supports configured mode language profile', () => {
    const vars = flattenProjectYaml({
      stack: {
        languages: ['python'],
        frameworks: { backend: ['node.js'] },
      },
      automation: {
        languageProfile: {
          mode: 'configured',
        },
      },
    });

    expect(vars.languageProfileMode).toBe('configured');
    expect(vars.hasLanguagePythonEffective).toBe(true);
    expect(vars.hasLanguageJsLikeEffective).toBe(false);
    expect(vars.languageInferenceSource).toBe('configured');
    expect(vars.hasLanguageInferenceUsedRaw).toBe(false);
  });

  it('supports heuristic mode language profile', () => {
    const vars = flattenProjectYaml({
      stack: {
        languages: ['python'],
        frameworks: { backend: ['node.js'] },
      },
      automation: {
        languageProfile: {
          mode: 'heuristic',
        },
      },
    });

    expect(vars.languageProfileMode).toBe('heuristic');
    expect(vars.hasLanguagePythonEffective).toBe(false);
    expect(vars.hasLanguageJsLikeEffective).toBe(true);
    expect(vars.languageInferenceSource).toBe('heuristic');
    expect(vars.hasLanguageInferenceUsedRaw).toBe(true);
  });

  it('respects inferFrom signal toggles', () => {
    const vars = flattenProjectYaml({
      stack: {
        languages: [],
        frameworks: { backend: ['node.js'] },
      },
      testing: { unit: ['vitest'] },
      automation: {
        languageProfile: {
          inferFrom: {
            frameworks: false,
            tests: true,
          },
        },
      },
    });

    expect(vars.languageInferenceFromFrameworks).toBe(false);
    expect(vars.languageInferenceFromTests).toBe(true);
    expect(vars.hasLanguageJsLikeInferred).toBe(true);
    expect(vars.hasLanguageJsLikeEffective).toBe(true);
  });

  it('disables language diagnostics output vars when diagnostics is off', () => {
    const vars = flattenProjectYaml({
      stack: {
        languages: ['python'],
        frameworks: { backend: ['node.js'] },
      },
      automation: {
        languageProfile: {
          diagnostics: 'off',
        },
      },
    });

    expect(vars.showLanguageProfileDiagnostics).toBe(false);
    expect(vars.hasLanguageInferenceMismatchRaw).toBe(true);
    expect(vars.hasLanguageInferenceMismatch).toBe(false);
  });

  it('derives hasLanguageDotnet for csharp variant', () => {
    const vars = flattenProjectYaml({ stack: { languages: ['csharp'] } });
    expect(vars.hasLanguageDotnet).toBe(true);
  });

  it('derives hasLanguageBlockchain for solidity variant', () => {
    const vars = flattenProjectYaml({ stack: { languages: ['solidity'] } });
    expect(vars.hasLanguageBlockchain).toBe(true);
  });

  it('all language booleans false for empty languages array', () => {
    const vars = flattenProjectYaml({ stack: { languages: [] } });
    expect(vars.hasLanguageRust).toBe(false);
    expect(vars.hasLanguagePython).toBe(false);
    expect(vars.hasLanguageTypeScript).toBe(false);
    expect(vars.hasLanguageJsLike).toBe(false);
    expect(vars.hasLanguageJsLikeEffective).toBe(false);
    expect(vars.hasLanguageDotnet).toBe(false);
    expect(vars.hasLanguageBlockchain).toBe(false);
    expect(vars.languageInferenceSource).toBe('none');
    expect(vars.languageInferenceConfidence).toBe('low');
    expect(vars.hasLanguageInferenceUsed).toBe(false);
    expect(vars.hasLanguageInferenceMismatch).toBe(false);
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

  it('produces infraMandatoryTagsList sorted and deduplicated from infrastructure.tagging.mandatory', () => {
    const vars = flattenProjectYaml({
      infrastructure: {
        tagging: { mandatory: ['project', 'environment', 'owner', 'project'] },
      },
    });
    expect(vars.infraMandatoryTagsList).toEqual(['environment', 'owner', 'project']);
  });

  it('produces infraOptionalTagsList sorted and deduplicated from infrastructure.tagging.optional', () => {
    const vars = flattenProjectYaml({
      infrastructure: {
        tagging: { optional: ['team', 'cost-center', 'team'] },
      },
    });
    expect(vars.infraOptionalTagsList).toEqual(['cost-center', 'team']);
  });

  it('trims whitespace from tags and filters non-string entries', () => {
    const vars = flattenProjectYaml({
      infrastructure: {
        tagging: { mandatory: [' owner ', 'project', null, 42, ''] },
      },
    });
    expect(vars.infraMandatoryTagsList).toEqual(['owner', 'project']);
  });

  it('omits infraMandatoryTagsList when mandatory tags are empty', () => {
    const vars = flattenProjectYaml({
      infrastructure: { tagging: { mandatory: [] } },
    });
    expect(vars.infraMandatoryTagsList).toBeUndefined();
  });

  it('omits infraOptionalTagsList when optional tags are absent', () => {
    const vars = flattenProjectYaml({
      infrastructure: { tagging: { mandatory: ['owner'] } },
    });
    expect(vars.infraOptionalTagsList).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// branchProtection mappings (flattenProjectYaml)
// ---------------------------------------------------------------------------
describe('flattenProjectYaml — branchProtection', () => {
  it('maps core branch protection booleans and scalars', () => {
    const vars = flattenProjectYaml({
      branchProtection: {
        requiredReviewCount: 2,
        dismissStaleReviews: true,
        requireCodeOwnerReviews: false,
        requireLastPushApproval: true,
        strictStatusChecks: true,
        enforceAdmins: true,
        requiredLinearHistory: false,
        requireSignedCommits: true,
        allowForcePushes: false,
        allowDeletions: true,
        blockCreations: true,
        requiredConversationResolution: false,
      },
    });
    expect(vars.bpRequiredReviewCount).toBe('2');
    expect(vars.bpDismissStaleReviews).toBe(true);
    expect(vars.bpRequireCodeOwnerReviews).toBe(false);
    expect(vars.bpRequireLastPushApproval).toBe(true);
    expect(vars.bpStrictStatusChecks).toBe(true);
    expect(vars.bpEnforceAdmins).toBe(true);
    expect(vars.bpRequiredLinearHistory).toBe(false);
    expect(vars.bpRequireSignedCommits).toBe(true);
    expect(vars.bpAllowForcePushes).toBe(false);
    expect(vars.bpAllowDeletions).toBe(true);
    expect(vars.bpBlockCreations).toBe(true);
    expect(vars.bpRequiredConversationResolution).toBe(false);
  });

  it('maps requiredStatusChecks as array (not joined string)', () => {
    const vars = flattenProjectYaml({
      branchProtection: {
        requiredStatusChecks: ['CI / test', 'CI / validate'],
      },
    });
    expect(vars.bpRequiredStatusChecks).toEqual(['CI / test', 'CI / validate']);
  });

  it('maps code scanning fields', () => {
    const vars = flattenProjectYaml({
      branchProtection: {
        codeScanning: {
          enabled: true,
          tools: [
            { name: 'CodeQL', securityAlertThreshold: 'high_or_higher', alertThreshold: 'errors' },
          ],
        },
      },
    });
    expect(vars.bpCodeScanningEnabled).toBe(true);
    expect(vars.bpCodeScanningTools).toEqual([
      { name: 'CodeQL', securityAlertThreshold: 'high_or_higher', alertThreshold: 'errors' },
    ]);
  });

  it('maps copilot review fields', () => {
    const vars = flattenProjectYaml({
      branchProtection: {
        copilotReview: {
          enabled: true,
          reviewNewPushes: true,
          reviewDraftPRs: false,
        },
      },
    });
    expect(vars.bpCopilotReviewEnabled).toBe(true);
    expect(vars.bpCopilotReviewNewPushes).toBe(true);
    expect(vars.bpCopilotReviewDraftPRs).toBe(false);
  });

  it('maps merge strategy and merge queue fields', () => {
    const vars = flattenProjectYaml({
      branchProtection: {
        mergeStrategies: {
          allowMergeCommits: false,
          allowSquashMerge: true,
          allowRebaseMerge: false,
          deleteBranchOnMerge: true,
          allowAutoMerge: true,
        },
        mergeQueue: {
          enabled: true,
          mergeMethod: 'squash',
          minGroupSize: 2,
          maxGroupSize: 10,
        },
      },
    });
    expect(vars.bpAllowMergeCommits).toBe(false);
    expect(vars.bpAllowSquashMerge).toBe(true);
    expect(vars.bpAllowRebaseMerge).toBe(false);
    expect(vars.bpDeleteBranchOnMerge).toBe(true);
    expect(vars.bpAllowAutoMerge).toBe(true);
    expect(vars.bpMergeQueueEnabled).toBe(true);
    expect(vars.bpMergeQueueMethod).toBe('squash');
    expect(vars.bpMergeQueueMinGroupSize).toBe('2');
    expect(vars.bpMergeQueueMaxGroupSize).toBe('10');
  });

  it('returns no bp* vars when branchProtection is absent', () => {
    const vars = flattenProjectYaml({ name: 'NoProtection' });
    expect(vars.bpRequiredReviewCount).toBeUndefined();
    expect(vars.bpCodeScanningEnabled).toBeUndefined();
    expect(vars.bpCopilotReviewEnabled).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// transform — array type
// ---------------------------------------------------------------------------
describe('transform — array type', () => {
  it('passes through arrays unchanged', () => {
    expect(transform(['a', 'b'], 'array')).toEqual(['a', 'b']);
  });

  it('passes through object arrays unchanged', () => {
    const tools = [{ name: 'CodeQL', threshold: 'errors' }];
    expect(transform(tools, 'array')).toEqual(tools);
  });

  it('returns undefined for non-array values', () => {
    expect(transform('not-array', 'array')).toBeUndefined();
    expect(transform(42, 'array')).toBeUndefined();
  });

  it('returns empty array for empty array', () => {
    expect(transform([], 'array')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveEachBlocks — JSON comma handling
// ---------------------------------------------------------------------------
describe('resolveEachBlocks — JSON array rendering', () => {
  it('renders object arrays with trailing commas for JSON post-processing', () => {
    const template =
      '[\n{{#each tools}}  {"tool": "{{.name}}", "threshold": "{{.threshold}}"},\n{{/each}}]';
    const result = resolveEachBlocks(template, {
      tools: [
        { name: 'CodeQL', threshold: 'errors' },
        { name: 'Semgrep', threshold: 'warnings' },
      ],
    });
    // Each item gets a trailing comma; the last comma before ] can be stripped by the consumer
    expect(result).toContain('"tool": "CodeQL"');
    expect(result).toContain('"tool": "Semgrep"');
    // Verify the trailing-comma-then-strip pattern produces valid JSON
    const cleaned = result.replace(/,(\s*[\]}])/g, '$1');
    expect(() => JSON.parse(cleaned)).not.toThrow();
  });

  it('renders string arrays with trailing commas for JSON post-processing', () => {
    const template = '[\n{{#each checks}}  "{{.}}",\n{{/each}}]';
    const result = resolveEachBlocks(template, {
      checks: ['CI / test', 'CI / validate', 'Branch Protection / branch-rules'],
    });
    const cleaned = result.replace(/,(\s*[\]}])/g, '$1');
    const parsed = JSON.parse(cleaned);
    expect(parsed).toEqual(['CI / test', 'CI / validate', 'Branch Protection / branch-rules']);
  });
});

// ---------------------------------------------------------------------------
// flattenCrosscutting
// ---------------------------------------------------------------------------
describe('flattenCrosscutting', () => {
  it('maps logging fields', () => {
    const vars = {};
    flattenCrosscutting(
      {
        logging: {
          framework: 'serilog',
          structured: true,
          correlationId: true,
          level: 'information',
          sink: ['console'],
        },
      },
      vars
    );
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
    flattenCrosscutting(
      {
        authentication: {
          provider: 'auth0',
          strategy: 'jwt-bearer',
          rbac: true,
          multiTenant: false,
        },
      },
      vars
    );
    expect(vars.authProvider).toBe('auth0');
    expect(vars.hasAuth).toBe(true);
    expect(vars.authStrategy).toBe('jwt-bearer');
    expect(vars.hasRbac).toBe(true);
    expect(vars.hasMultiTenant).toBe(false);
  });

  it('maps caching fields', () => {
    const vars = {};
    flattenCrosscutting(
      {
        caching: { provider: 'redis', patterns: ['cache-aside'], distributedCache: true },
      },
      vars
    );
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
    const result = resolveRenderTargets(['claude', 'cursor', 'windsurf'], {
      only: 'claude,cursor',
    });
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

// ---------------------------------------------------------------------------
// applyWhitespaceControl
// ---------------------------------------------------------------------------
import { applyWhitespaceControl } from '../template-utils.mjs';

describe('applyWhitespaceControl', () => {
  it('strips trailing whitespace + newline for right tilde on {{/if~}}', () => {
    const input = '{{/if~}}\nallowed-tools: Read';
    expect(applyWhitespaceControl(input)).toBe('{{/if}}allowed-tools: Read');
  });

  it('strips trailing whitespace + newline for right tilde on {{/each~}}', () => {
    const input = '{{/each~}}\nnext line';
    expect(applyWhitespaceControl(input)).toBe('{{/each}}next line');
  });

  it('strips trailing whitespace + newline for right tilde on {{/unless~}}', () => {
    const input = '{{/unless~}}\nnext line';
    expect(applyWhitespaceControl(input)).toBe('{{/unless}}next line');
  });

  it('strips trailing whitespace + newline for right tilde on {{else~}}', () => {
    const input = '{{else~}}\nnext line';
    expect(applyWhitespaceControl(input)).toBe('{{else}}next line');
  });

  it('strips trailing spaces and tabs before newline for right tilde', () => {
    const input = '{{/if~}}  \t \nallowed-tools: Read';
    expect(applyWhitespaceControl(input)).toBe('{{/if}}allowed-tools: Read');
  });

  it('strips preceding newline + whitespace for left tilde on {{~#if}}', () => {
    const input = 'some text\n  {{~#if myVar}}';
    expect(applyWhitespaceControl(input)).toBe('some text{{#if myVar}}');
  });

  it('strips preceding newline + whitespace for left tilde on {{~/if}}', () => {
    const input = 'description: value\n  {{~/if}}';
    expect(applyWhitespaceControl(input)).toBe('description: value{{/if}}');
  });

  it('strips preceding newline + whitespace for left tilde on {{~else}}', () => {
    const input = 'content\n  {{~else}}';
    expect(applyWhitespaceControl(input)).toBe('content{{else}}');
  });

  it('strips preceding newline for left tilde on {{~#each}}', () => {
    const input = 'header\n{{~#each items}}';
    expect(applyWhitespaceControl(input)).toBe('header{{#each items}}');
  });

  it('handles right tilde on opening tag {{#if var~}}', () => {
    const input = '{{#if myVar~}}\ndescription: value';
    expect(applyWhitespaceControl(input)).toBe('{{#if myVar}}description: value');
  });

  it('leaves tags without tilde unchanged', () => {
    const input = '{{#if myVar}}\ndescription: value\n{{/if}}\nallowed-tools: Read';
    expect(applyWhitespaceControl(input)).toBe(input);
  });

  it('handles both tildes in a single template', () => {
    const input = 'before\n{{~#if x}}\ncontent\n{{/if~}}\nafter';
    expect(applyWhitespaceControl(input)).toBe('before{{#if x}}\ncontent\n{{/if}}after');
  });

  it('handles CRLF line endings for right tilde', () => {
    const input = '{{/if~}}\r\nallowed-tools: Read';
    expect(applyWhitespaceControl(input)).toBe('{{/if}}allowed-tools: Read');
  });

  it('handles CRLF line endings for left tilde', () => {
    const input = 'text\r\n{{~/if}}';
    expect(applyWhitespaceControl(input)).toBe('text{{/if}}');
  });

  it('strips trailing newline at end of file for right tilde', () => {
    const input = '{{/if~}}\n';
    expect(applyWhitespaceControl(input)).toBe('{{/if}}');
  });

  it('works with the YAML frontmatter pattern from command templates', () => {
    const input =
      '---\n{{#if commandDescription}}\ndescription: value\n{{/if~}}\nallowed-tools: Read';
    const expected =
      '---\n{{#if commandDescription}}\ndescription: value\n{{/if}}allowed-tools: Read';
    expect(applyWhitespaceControl(input)).toBe(expected);
  });

  it('integrates with renderTemplate end-to-end (right tilde)', () => {
    const template = '---\n{{#if x}}\ndescription: hello\n{{/if~}}\nallowed: yes';
    const vars = { x: true };
    const result = renderTemplate(template, vars);
    expect(result).toBe('---\n\ndescription: hello\nallowed: yes');
  });

  it('integrates with renderTemplate end-to-end (falsy removes block cleanly)', () => {
    const template = '---\n{{#if x}}\ndescription: hello\n{{/if~}}\nallowed: yes';
    const vars = { x: false };
    const result = renderTemplate(template, vars);
    expect(result).toBe('---\nallowed: yes');
  });
});

// ---------------------------------------------------------------------------
// Sync report collector (GH#415)
// ---------------------------------------------------------------------------
describe('sync report collector', () => {
  beforeEach(() => {
    resetSyncReport();
  });

  afterEach(() => {
    resetSyncReport();
  });

  it('getSyncReportData returns null before startSyncReport is called', () => {
    expect(getSyncReportData()).toBeNull();
  });

  it('getSyncReportData returns empty collector after startSyncReport', () => {
    startSyncReport();
    const data = getSyncReportData();
    expect(data).not.toBeNull();
    expect(data.unresolvedPlaceholders).toEqual([]);
    expect(data.renderErrors).toEqual([]);
  });

  it('replacePlaceholders pushes to collector when active', () => {
    startSyncReport();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    replacePlaceholders('{{unknown}}', {}, false, { filePath: 'test/file.md' });
    warnSpy.mockRestore();
    const data = getSyncReportData();
    expect(data.unresolvedPlaceholders).toHaveLength(1);
    expect(data.unresolvedPlaceholders[0].file).toBe('test/file.md');
    expect(data.unresolvedPlaceholders[0].vars).toContain('{{unknown}}');
  });

  it('replacePlaceholders does not push when collector is inactive', () => {
    // collector is null (resetSyncReport called in beforeEach)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    replacePlaceholders('{{unknown}}', {});
    warnSpy.mockRestore();
    expect(getSyncReportData()).toBeNull();
  });

  it('resetSyncReport clears the collector', () => {
    startSyncReport();
    expect(getSyncReportData()).not.toBeNull();
    resetSyncReport();
    expect(getSyncReportData()).toBeNull();
  });
});
