/**
 * AgentKit Forge — Template Utilities
 * Pure, synchronous helper functions for template rendering, data transformation,
 * header generation, and project-spec flattening. No file I/O.
 */
import { extname } from 'path';
import { PROJECT_MAPPING, get, transform, check } from './project-mapping.mjs';

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

const RAW_TEMPLATE_VARS = new Set(['commandFlags']);

function isShellScriptTarget(targetPath) {
  const ext = extname(targetPath || '').toLowerCase();
  return ext === '.sh' || ext === '.ps1';
}

/**
 * Renders a template by:
 * 1. Resolving {{#if var}}...{{/if}} conditional blocks
 * 2. Resolving {{#each var}}...{{/each}} iteration blocks
 * 3. Replacing {{key}} placeholders with values from vars
 *
 * - Replaces longest keys first to prevent partial matches (e.g., {{versionInfo}} before {{version}})
 * - Sanitizes string values to prevent shell metacharacter injection
 * - Warns on unresolved placeholders when DEBUG is set
 */
export function renderTemplate(template, vars, targetPath = '') {
  let result = template;
  const allowRawVars = isShellScriptTarget(targetPath);

  // Phase 1: Resolve {{#if var}}...{{/if}} blocks (supports nesting)
  result = resolveConditionals(result, vars);

  // Phase 2: Resolve {{#each var}}...{{/each}} blocks
  result = resolveEachBlocks(result, vars);

  // Phase 3: Replace {{key}} placeholders
  result = replacePlaceholders(result, vars, allowRawVars);

  // Phase 4: Collapse excessive blank lines left by removed conditionals
  result = collapseBlankLines(result);

  return result;
}

/**
 * Collapses runs of 3+ consecutive blank lines down to a single blank line.
 * Preserves one blank line between sections (standard Markdown paragraph break).
 */
export function collapseBlankLines(text) {
  return text.replace(/\n{3,}/g, '\n\n');
}

/**
 * Replaces {{key}} placeholders with values from vars.
 * - Replaces longest keys first to prevent partial matches
 * - Sanitizes string values to prevent shell metacharacter injection
 * - Allows raw values for keys in RAW_TEMPLATE_VARS when allowRawVars is true
 * - Warns on unresolved placeholders when DEBUG is set
 */
export function replacePlaceholders(template, vars, allowRawVars = false) {
  let result = template;
  const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const value = vars[key];
    const placeholder = `{{${key}}}`;
    const safeValue =
      typeof value === 'string'
        ? allowRawVars && RAW_TEMPLATE_VARS.has(key)
          ? value
          : sanitizeTemplateValue(value)
        : JSON.stringify(value);
    result = result.split(placeholder).join(safeValue);
  }

  // Warn about unresolved placeholders (ignore block syntax remnants, including {{else}})
  const unresolved = result.match(/\{\{(?!#|\/|else\}\})([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
  if (unresolved && process.env.DEBUG) {
    const unique = [...new Set(unresolved)];
    console.warn(`[agentkit:sync] Warning: unresolved placeholders: ${unique.join(', ')}`);
  }
  return result;
}

/**
 * Resolves {{#if var}}...{{/if}} conditional blocks.
 * A var is truthy if it exists in vars and is not null, undefined, false, empty string, or empty array.
 * Supports {{#if var}}...{{else}}...{{/if}} syntax.
 * Handles nested conditionals via innermost-first resolution.
 */
export function resolveConditionals(template, vars) {
  let result = template;
  // Process innermost #if blocks first (no nested #if inside)
  const ifRegex =
    /\{\{#if\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}((?:(?!\{\{#if\s)(?!\{\{\/if\}\})[\s\S])*?)\{\{\/if\}\}/g;
  let safety = 50; // prevent infinite loops on malformed templates
  while (ifRegex.test(result) && safety-- > 0) {
    result = result.replace(ifRegex, (_, varName, body) => {
      const isTruthy = evalTruthy(vars[varName]);
      // Split only on the first {{else}} to avoid matching multiple occurrences
      const elseMarker = '{{else}}';
      const elseIndex = body.indexOf(elseMarker);
      if (elseIndex === -1) {
        return isTruthy ? body : '';
      }
      return isTruthy ? body.slice(0, elseIndex) : body.slice(elseIndex + elseMarker.length);
    });
    ifRegex.lastIndex = 0;
  }
  // Warn if safety limit was hit and there are still unresolved {{#if}} blocks
  if (safety <= 0) {
    ifRegex.lastIndex = 0;
    if (ifRegex.test(result)) {
      console.warn(
        'resolveConditionals: safety limit reached while processing template. ' +
          'Template may contain malformed or deeply nested {{#if}} blocks; output may be partially rendered.'
      );
    }
  }

  // Process {{#unless var}}...{{/unless}} blocks (inverted #if).
  // Supports nesting via innermost-first resolution (same strategy as #if above).
  const unlessRegex =
    /\{\{#unless\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}((?:(?!\{\{#unless\s)(?!\{\{\/unless\}\})[\s\S])*?)\{\{\/unless\}\}/g;
  let unlessSafety = 50;
  while (unlessRegex.test(result) && unlessSafety-- > 0) {
    result = result.replace(unlessRegex, (_, varName, body) => {
      const isTruthy = evalTruthy(vars[varName]);
      const elseMarker = '{{else}}';
      const elseIndex = body.indexOf(elseMarker);
      if (elseIndex === -1) {
        return isTruthy ? '' : body;
      }
      return isTruthy ? body.slice(elseIndex + elseMarker.length) : body.slice(0, elseIndex);
    });
    unlessRegex.lastIndex = 0;
  }

  return result;
}

/**
 * Resolves {{#each var}}...{{/each}} iteration blocks.
 * Inside the block, {{.}} refers to the current item (for string arrays).
 * For object arrays, {{.name}}, {{.purpose}} etc. access properties.
 */
export function resolveEachBlocks(template, vars) {
  const eachRegex = /\{\{#each\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  return template.replace(eachRegex, (_, varName, body) => {
    const arr = vars[varName];
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr
      .map((item, index) => {
        let rendered = body;
        // Replace {{.}} with the item itself (for string arrays)
        if (typeof item === 'string') {
          rendered = rendered.split('{{.}}').join(sanitizeTemplateValue(item));
        } else if (typeof item === 'object' && item !== null) {
          // Replace {{.prop}} with item.prop
          rendered = rendered.replace(/\{\{\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (__, prop) => {
            const val = item[prop];
            if (val === undefined || val === null) return '';
            return typeof val === 'string' ? sanitizeTemplateValue(val) : JSON.stringify(val);
          });
        }
        // Replace {{@index}} with current index
        rendered = rendered.split('{{@index}}').join(String(index));
        return rendered;
      })
      .join('');
  });
}

/**
 * Evaluates whether a template variable is "truthy" for {{#if}} blocks.
 * Falsy: undefined, null, false, '', 0, empty array []
 * Truthy: everything else (including 'none' — use explicit checks in templates)
 */
export function evalTruthy(value) {
  if (value === undefined || value === null || value === false || value === '' || value === 0)
    return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Flattens a project.yaml object into a flat key→value map suitable for template rendering.
 * Uses a declarative mapping configuration for cleaner code.
 */
export function flattenProjectYaml(project, docsSpec = null) {
  if (!project || typeof project !== 'object') return {};
  const vars = {};

  // Apply declarative mappings
  for (const mapping of PROJECT_MAPPING) {
    const value = get(project, mapping.src);
    if (check(value, mapping.check)) {
      const transformed = transform(value, mapping.type);
      if (transformed !== undefined) {
        vars[mapping.dest] = transformed;
      }
    }
  }

  // --- Post-processing / Complex derivations ---

  // hasAnyPattern
  vars.hasAnyPattern =
    vars.hasPatternRepository ||
    vars.hasPatternCqrs ||
    vars.hasPatternEventSourcing ||
    vars.hasPatternMediator ||
    vars.hasPatternUnitOfWork;

  // docsSpec overlay for PRD
  const prdSpec = docsSpec?.specialDirectories?.find((d) => d.id === 'prd');
  if (prdSpec) {
    vars.hasPrd = true;
    if (!vars.prdPath) vars.prdPath = prdSpec.path;
  }

  // hasAnyInfraConfig
  vars.hasAnyInfraConfig =
    !!vars.infraNamingConvention ||
    !!vars.infraDefaultRegion ||
    !!vars.infraOrg ||
    !!vars.infraIacToolchain ||
    !!vars.infraStateBackend ||
    !!vars.infraMandatoryTags;

  // hasAnyMonitoring
  vars.hasAnyMonitoring =
    !!vars.monitoringProvider ||
    !!vars.alertingProvider ||
    !!vars.tracingProvider ||
    !!vars.hasCentralisedLogging;

  // hasDr
  vars.hasDr =
    !!vars.drRpoHours ||
    !!vars.drRtoHours ||
    !!vars.drBackupSchedule ||
    vars.hasGeoRedundancy;

  // hasAnyComplianceConfig
  vars.hasAnyComplianceConfig =
    !!vars.complianceFramework ||
    !!vars.drRpoHours ||
    !!vars.drRtoHours ||
    !!vars.drBackupSchedule ||
    !!vars.drTestSchedule ||
    !!vars.auditEventBus;

  // Integrations (kept as array for {{#each}})
  if (Array.isArray(project.integrations)) {
    vars.integrations = project.integrations;
    vars.hasIntegrations = project.integrations.length > 0;
  }

  return vars;
}

/**
 * Flattens the crosscutting section of project.yaml into template vars.
 * @deprecated - Merged into flattenProjectYaml via declarative mappings.
 * Kept exported for test compatibility if any tests import it directly.
 */
export function flattenCrosscutting(cc, vars) {
  // Delegate to main flatten function by wrapping cc in a project-like structure
  // This is a backward compatibility shim.
  const tempProject = { crosscutting: cc };
  const mapped = flattenProjectYaml(tempProject);

  // Copy mapped crosscutting vars into the target vars object
  // Filter out keys that don't belong to crosscutting to avoid noise
  for (const [key, val] of Object.entries(mapped)) {
    if (key !== 'hasAnyPattern' &&
        key !== 'hasAnyInfraConfig' &&
        key !== 'hasAnyMonitoring' &&
        key !== 'hasDr' &&
        key !== 'hasAnyComplianceConfig') {
      vars[key] = val;
    }
  }
}

/**
 * Sanitizes a template variable value to prevent injection.
 * Strips shell metacharacters that could cause command injection if the
 * rendered output is executed in a shell context (e.g., hook scripts).
 */
export function sanitizeTemplateValue(value) {
  let s = value;
  s = s.replace(/\$\([^)]*\)/g, (m) => m.slice(2, -1));
  s = s.replace(/[`$\\;|&<>!{}]/g, '');
  return s;
}

export function formatCommandFlags(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return '';
  const rows = flags.map(
    (f) =>
      `| \`${f.name || ''}\` | ${(f.description || '').replace(/\|/g, '\\|')} | ${f.default !== undefined && f.default !== null ? String(f.default) : '—'} |`
  );
  return ['| Flag | Description | Default |', '|------|-------------|---------|', ...rows].join(
    '\n'
  );
}

// ---------------------------------------------------------------------------
// Header generation
// ---------------------------------------------------------------------------

export function getGeneratedHeader(version, repoName, ext) {
  const comment = getCommentStyle(ext);
  if (!comment) return '';
  return [
    `${comment.start} GENERATED by AgentKit Forge v${version} — DO NOT EDIT ${comment.end}`,
    `${comment.start} Source: .agentkit/spec + .agentkit/overlays/${repoName} ${comment.end}`,
    `${comment.start} Regenerate: pnpm -C .agentkit agentkit:sync ${comment.end}`,
    '',
  ].join('\n');
}

export function getCommentStyle(ext) {
  switch (ext) {
    case '.md':
    case '.mdc':
      return { start: '<!--', end: '-->' };
    case '.json':
    case '.template':
      return null; // JSON / template files don't support comments
    case '.yml':
    case '.yaml':
      return { start: '#', end: '' };
    case '.sh':
      return { start: '#', end: '' };
    case '.ps1':
      return { start: '#', end: '' };
    case '':
      return { start: '#', end: '' }; // files like "cursorrules"
    default:
      return { start: '#', end: '' };
  }
}

/**
 * Inserts a generated header into file content.
 * - Skip if already has header
 * - Insert after shebang for .sh/.ps1 files
 * - Insert after frontmatter (---...---) for .md/.mdc files
 * - Return unchanged for .json/.template files
 */
export function insertHeader(content, ext, version, repoName) {
  const header = getGeneratedHeader(version, repoName, ext);
  if (!header) return content; // JSON / template — no comment syntax
  if (content.includes('GENERATED by AgentKit Forge')) return content; // already present

  const normalizedExt = ext.toLowerCase();

  if (normalizedExt === '.sh' || normalizedExt === '.ps1') {
    // Insert after shebang line
    if (content.startsWith('#!')) {
      const newlineIdx = content.indexOf('\n');
      if (newlineIdx !== -1) {
        return content.slice(0, newlineIdx + 1) + header + content.slice(newlineIdx + 1);
      }
    }
    return header + content;
  }

  if (normalizedExt === '.md' || normalizedExt === '.mdc') {
    // Insert after frontmatter if present
    if (content.startsWith('---')) {
      const closingMarker = '\n---';
      const endFrontmatter = content.indexOf(closingMarker, 3);
      if (endFrontmatter !== -1) {
        const afterClose = endFrontmatter + closingMarker.length;
        // Include the trailing newline after --- so header is on its own line,
        // then add a blank line to separate front-matter from the generated comment.
        const insertPos =
          content[afterClose] === '\n' ? afterClose + 1 : afterClose;
        return content.slice(0, insertPos) + '\n' + header + content.slice(insertPos);
      }
    }
    return header + content;
  }

  return header + content;
}

// ---------------------------------------------------------------------------
// Scaffold-once file detection
// ---------------------------------------------------------------------------

// Project-owned files: generated once as scaffolds, then owned by the consuming repo.
// Sync will NOT overwrite these if they already exist at the destination.
const SCAFFOLD_ONCE_ROOT_FILES = new Set([
  'AGENT_BACKLOG.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'MIGRATIONS.md',
  'SECURITY.md',
  '.editorconfig',
  '.prettierrc',
  '.markdownlint.json',
]);

const SCAFFOLD_ONCE_DIRS = [
  'docs/',
  '.vscode/',
  '.github/ISSUE_TEMPLATE/',
  '.github/instructions/',
];

// GitHub root files that are scaffold-once (matched by full relative path)
const SCAFFOLD_ONCE_GITHUB_FILES = new Set([
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/copilot-instructions.md',
]);

/**
 * Check if a relative path is a scaffold-once file (project-owned content).
 * These are only written on first sync; subsequent syncs skip them if they exist.
 */
export function isScaffoldOnce(relPath) {
  // Normalize Windows backslashes to forward slashes for consistent matching
  const normalized = relPath.replace(/\\/g, '/');
  if (SCAFFOLD_ONCE_ROOT_FILES.has(normalized)) return true;
  if (SCAFFOLD_ONCE_GITHUB_FILES.has(normalized)) return true;
  for (const dir of SCAFFOLD_ONCE_DIRS) {
    if (normalized.startsWith(dir)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Diff and output helpers
// ---------------------------------------------------------------------------

export function simpleDiff(a, b) {
  const aLines = a.split(/\r?\n/);
  const bLines = b.split(/\r?\n/);
  const out = [];
  const maxLen = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < maxLen; i++) {
    const al = aLines[i];
    const bl = bLines[i];
    if (al === undefined) out.push(`+ ${bl || ''}`);
    else if (bl === undefined) out.push(`- ${al}`);
    else if (al !== bl) {
      out.push(`- ${al}`);
      out.push(`+ ${bl}`);
    }
  }
  return out.slice(0, 20).join('\n') + (out.length > 20 ? '\n...' : '');
}

/**
 * Merges two permissions objects. Each has `allow` and `deny` arrays.
 * Union both lists with deduplication.
 */
export function mergePermissions(base, overlay) {
  const allow = [...new Set([...(base.allow || []), ...(overlay.allow || [])])];
  const deny = [...new Set([...(base.deny || []), ...(overlay.deny || [])])];
  return { allow, deny };
}

// ---------------------------------------------------------------------------
// Render target resolution
// ---------------------------------------------------------------------------

/**
 * All available render targets.
 */
export const ALL_RENDER_TARGETS = [
  'claude', 'cursor', 'windsurf', 'ai', 'copilot', 'gemini', 'codex',
  'warp', 'cline', 'roo', 'mcp',
];

/**
 * Resolves which render targets to generate.
 * - If flags?.only is set, split by comma, trim, filter empty.
 * - If overlayTargets is a non-empty array, return Set(overlayTargets).
 * - Otherwise return Set(ALL_RENDER_TARGETS).
 */
export function resolveRenderTargets(overlayTargets, flags) {
  if (flags?.only) {
    return new Set(
      flags.only
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    );
  }
  if (Array.isArray(overlayTargets) && overlayTargets.length > 0) {
    return new Set(overlayTargets);
  }
  return new Set(ALL_RENDER_TARGETS);
}

/**
 * Categorizes a file by its path prefix.
 */
export function categorizeFile(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm.startsWith('.claude/')) return 'claude';
  if (norm.startsWith('.cursor/')) return 'cursor';
  if (norm.startsWith('.windsurf/')) return 'windsurf';
  if (norm.startsWith('.github/')) return 'github';
  if (norm.startsWith('.gemini/')) return 'gemini';
  if (norm.startsWith('.agents/')) return 'codex';
  if (norm.startsWith('.clinerules/')) return 'cline';
  if (norm.startsWith('.roo/')) return 'roo';
  if (norm.startsWith('.ai/')) return 'ai';
  if (norm.startsWith('.mcp/')) return 'mcp';
  if (norm.startsWith('docs/')) return 'docs';
  if (norm.startsWith('.vscode/')) return 'vscode';
  if (norm === 'GEMINI.md') return 'gemini';
  if (norm === 'WARP.md') return 'warp';
  if (norm === 'CLAUDE.md') return 'claude';
  return 'root';
}

/**
 * Prints a sync summary to console. Skip if opts.quiet.
 */
export function printSyncSummary(fileSummary, targets, opts) {
  if (opts?.quiet) return;
  const total = Object.values(fileSummary).reduce((s, c) => s + c, 0);
  console.log(`[agentkit:sync] Summary: ${total} file(s) across ${[...targets].join(', ')}`);
  for (const [cat, count] of Object.entries(fileSummary).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
}

/**
 * Computes project.yaml completeness.
 * Returns { total, present, percent, missing }.
 */
export function computeProjectCompleteness(projectSpec) {
  if (!projectSpec || typeof projectSpec !== 'object') {
    return { total: 0, present: 0, percent: 0, missing: [] };
  }
  const fields = [
    'name',
    'description',
    'phase',
    'stack.languages',
    'stack.database',
    'architecture.pattern',
    'architecture.apiStyle',
    'deployment.cloudProvider',
    'deployment.environments',
    'testing.coverage',
  ];
  const missing = [];
  let present = 0;
  for (const field of fields) {
    const parts = field.split('.');
    let val = projectSpec;
    for (const p of parts) val = val?.[p];
    const isEmpty =
      val === undefined ||
      val === null ||
      val === '' ||
      (Array.isArray(val) && val.length === 0);
    if (!isEmpty) {
      present++;
    } else {
      missing.push(field);
    }
  }
  const percent = Math.round((present / fields.length) * 100);
  return { total: fields.length, present, percent, missing };
}
