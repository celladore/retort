# PR #515: Bot Review Comments - Resolution Summary

This document addresses all review comments from @Copilot on PR #515 (feat/skills-design-phase-0-2).

**Important Note**: All files mentioned in the review comments are Retort source files (`.agentkit/templates/`, `.agentkit/spec/`, `.agentkit/engines/`) and are protected by the PreToolUse hook. Direct modifications cannot be made by agents. This document proposes the required fixes for manual implementation or a separate upstream PR.

---

## 1. YAML Frontmatter Indentation Issue

**File**: `.agentkit/templates/claude/skills/TEMPLATE/SKILL.md` (Lines 4-5)

**Issue**: The Handlebars conditional for `disableModelInvocation` is inline in the YAML frontmatter, which can produce invalid YAML depending on how Handlebars renders it. The `{{/if}}generated_by` concatenation will place `generated_by` improperly if the conditional is false.

**Current**:

```handlebars
{{#if disableModelInvocation}}disable-model-invocation: true
{{/if}}generated_by: '{{lastAgent}}'
```

**Proposed Fix**:

```handlebars
{{#if disableModelInvocation}}
  disable-model-invocation: true
{{/if}}
generated_by: '{{lastAgent}}'
```

**Rationale**: Each YAML key must be on a clean line with no leading indentation or concatenation. The `{{#if}}` and `{{/if}}` markers should be on their own lines to ensure proper whitespace handling.

---

## 2. lifecycle:in-progress Documentation Mismatch

**File**: `.agentkit/spec/skills.yaml` (Lines 36-37)

**Issue**: The spec comment claims that `lifecycle: in-progress` "emits with a warning header" but the actual implementation (`.agentkit/engines/node/src/platform-syncer.mjs:1299`) only logs a warning during sync—no header is added to the emitted `SKILL.md`.

**Current**:

```yaml
#                            sync output. lifecycle: in-progress emits with a
#                            warning header so consumers know they are unstable.
```

**Proposed Fix**:

```yaml
#                            sync output. lifecycle: in-progress emits normally
#                            but logs a warning during sync.
```

**Rationale**: Documentation should match implementation behavior. If a warning header is desired, the implementation needs to be updated; otherwise, the spec comment should reflect what actually happens.

---

## 3. triggers Field - Missing Engine Wiring

**File**: `.agentkit/spec/skills.yaml` (Lines 43-46)

**Issue**: The `triggers` field is documented as being "joined with '; ' and prepended to the existing description," but there is no engine or template code that consumes this field from `skills.yaml`. The field is defined but never used.

**Current**:

```yaml
#   triggers               — string[] of "Use when…" phrases composed into the
#                            rendered description, helping the agent decide when
#                            to load the skill. Joined with "; " and prepended to
#                            the existing description.
```

**Proposed Fix**: Either:

1. **Add wiring**: Update `.agentkit/engines/node/src/var-builders.mjs` `buildCommandVars()` to read `cmd.triggers`, join them, and prepend to `commandDescription`.
2. **Clarify unused**: Add a note in the spec: "Field is reserved for future use in phase N; not currently consumed by the engine."

**Rationale**: Specs should not claim behavior that doesn't exist. If `triggers` is intended for a later phase, document that explicitly.

---

## 4. inventoryOrgMetaSkills - Missing Array Guard

**File**: `.agentkit/engines/node/src/doctor.mjs` (Lines 117-119)

**Issue**: If `skills.yaml` is malformed (e.g., `skills: {}`), `parsed.skills` could be a non-array, causing `.filter()` to throw and crash `agentkit doctor`.

**Current**:

```javascript
const skills = (parsed.skills || []).filter((s) => s.source === 'org-meta');
```

**Proposed Fix**:

```javascript
const skills = Array.isArray(parsed.skills)
  ? parsed.skills.filter(
      (s) => s?.source === 'org-meta' && typeof s?.name === 'string' && s.name.length > 0
    )
  : [];
```

**Rationale**: Defensive programming—`parsed.skills` may not be an array if the YAML is malformed but parseable. Also validate that `s.name` is a non-empty string to prevent downstream path errors.

---

## 5. Doctor Inventory - Categorised Path Not Checked

**File**: `.agentkit/engines/node/src/doctor.mjs` (Lines 128-141)

**Issue**: The org-meta inventory only checks `.agents/skills/<name>/SKILL.md` for local divergence, but when `skills.categorised: true` is enabled, the layout is `.agents/skills/<category>/<name>/SKILL.md`. Doctor will miss local divergence and report misleading statuses.

**Current**:

```javascript
const localPath = join(projectRoot, '.agents', 'skills', skill.name, 'SKILL.md');
if (existsSync(localPath)) {
  try {
    const localContent = readFileSync(localPath, 'utf-8');
    const srcContent = readFileSync(srcPath, 'utf-8');
    if (localContent !== srcContent) {
      results.push({ name: skill.name, status: 'local-divergent', srcPath });
      continue;
    }
  } catch {
    // fall through to present
  }
}
```

**Proposed Fix**:

```javascript
// Check both flat and categorised paths
const category = typeof skill.category === 'string' && skill.category.length > 0 ? skill.category : 'meta';
const categorisedPath = join(projectRoot, '.agents', 'skills', category, skill.name, 'SKILL.md');
const flatPath = join(projectRoot, '.agents', 'skills', skill.name, 'SKILL.md');

const localPath = existsSync(categorisedPath) ? categorisedPath : (existsSync(flatPath) ? flatPath : null);

if (localPath && existsSync(localPath)) {
  try {
    const localContent = readFileSync(localPath, 'utf-8');
    const srcContent = readFileSync(srcPath, 'utf-8');
    if (localContent !== srcContent) {
      results.push({ name: skill.name, status: 'local-divergent', srcPath });
      continue;
    }
  } catch {
    // fall through to present
  }
}
```

**Rationale**: Doctor must check the correct output path based on the layout mode. Prefer categorised path if it exists, fall back to flat path for backward compatibility.

---

## 6. syncUnknownSkillsReport - Categorised Layout Not Supported

**File**: `.agentkit/engines/node/src/synchronize.mjs` (Line 865)

**Issue**: When `skillsCategorised` is enabled, `.agents/skills/` contains category directories (e.g., `engineering/`, `productivity/`, `meta/`). `syncUnknownSkillsReport` scans only the first level and treats categories as unknown skills, producing incorrect reports.

**Current**:

```javascript
const entries = await readdir(localSkillsDir, { withFileTypes: true });
const unknownSkills = entries
  .filter((e) => e.isDirectory() && e.name !== '_unknown' && !knownNames.has(e.name))
  .map((e) => e.name);
```

**Proposed Fix**:

```javascript
// Read skills from categorised or flat layout
const unknownSkills = [];
if (categorised) {
  // Scan <category>/<skill>/ structure
  for (const catEntry of entries) {
    if (!catEntry.isDirectory()) continue;
    const catPath = join(localSkillsDir, catEntry.name);
    const skillEntries = await readdir(catPath, { withFileTypes: true });
    for (const skillEntry of skillEntries) {
      if (skillEntry.isDirectory() && !knownNames.has(skillEntry.name)) {
        unknownSkills.push(skillEntry.name);
      }
    }
  }
} else {
  // Flat <skill>/ structure
  unknownSkills = entries
    .filter((e) => e.isDirectory() && e.name !== '_unknown' && !knownNames.has(e.name))
    .map((e) => e.name);
}
```

**Rationale**: The scan logic must be aware of the layout mode. Pass `categorised` flag to `syncUnknownSkillsReport` (from `vars.skillsCategorised`) and adjust the scan accordingly.

---

## 7. skill.category - Missing Path Validation

**File**: `.agentkit/engines/node/src/platform-syncer.mjs` (Lines 1302-1306)

**Issue**: `skill.category` is used directly as a path segment without validation. A malicious or accidental value containing path separators (e.g., `../`, `../../etc`) could write files outside `.agents/skills/`. The spec does not validate category against the allowed set (`engineering`, `productivity`, `meta`, `internal`).

**Current**:

```javascript
const category =
  typeof skill.category === 'string' && skill.category.length > 0 ? skill.category : 'meta';
const baseSegments = categorised
  ? ['.agents', 'skills', category, skill.name]
  : ['.agents', 'skills', skill.name];
```

**Proposed Fix**:

```javascript
const ALLOWED_CATEGORIES = new Set(['engineering', 'productivity', 'meta', 'internal']);
const rawCategory =
  typeof skill.category === 'string' && skill.category.length > 0 ? skill.category : 'meta';

// Validate against allowed set and reject path-escaping values
const category = ALLOWED_CATEGORIES.has(rawCategory) ? rawCategory : 'meta';
if (!ALLOWED_CATEGORIES.has(rawCategory)) {
  log(
    `[agentkit:sync] org-meta skill '${skill.name}' has invalid category '${rawCategory}' — defaulting to 'meta'`
  );
}

const baseSegments = categorised
  ? ['.agents', 'skills', category, skill.name]
  : ['.agents', 'skills', skill.name];
```

**Rationale**: Path injection prevention. Always validate user-controlled path segments against an allowlist before using them in `join()` or `resolve()`.

---

## 8. Companion Path Escape - Incomplete Windows Check

**File**: `.agentkit/engines/node/src/platform-syncer.mjs` (Lines 1319-1325)

**Issue**: The path-escape guard uses substring checks (`includes('..')`, `startsWith('/')`, `startsWith('\\')`) which do not catch Windows absolute paths like `C:\tmp\evil.md`. On win32, `path.join(base, 'C:\\tmp\\evil.md')` ignores `base` and uses the absolute path.

**Current**:

```javascript
if (companion.includes('..') || companion.startsWith('/') || companion.startsWith('\\')) {
  log(`[agentkit:sync] org-meta skill '${skill.name}' companion '${companion}' rejected (path escapes skill dir)`);
  continue;
}
```

**Proposed Fix**:

```javascript
import { isAbsolute, resolve, sep } from 'path';

// Reject absolute paths and traversal sequences
if (isAbsolute(companion) || companion.includes('..')) {
  log(`[agentkit:sync] org-meta skill '${skill.name}' companion '${companion}' rejected (path escapes skill dir)`);
  continue;
}

// Verify the resolved path stays inside the skill directory
const skillDir = join(orgMetaSkillsDir, skill.name);
const companionAbs = resolve(skillDir, companion);
if (!companionAbs.startsWith(skillDir + sep) && companionAbs !== skillDir) {
  log(`[agentkit:sync] org-meta skill '${skill.name}' companion '${companion}' rejected (resolved outside skill dir)`);
  continue;
}
```

**Rationale**: Use `path.isAbsolute` (cross-platform) and verify the resolved path with `startsWith(base + sep)` to robustly prevent traversal, instead of substring checks.

---

## 9. Test Env Mutation - Cross-Test Interference

**Files**:

- `.agentkit/engines/node/src/__tests__/sync-org-meta-skills.test.mjs` (Lines 15-30)
- `.agentkit/engines/node/src/__tests__/doctor-org-meta-inventory.test.mjs` (Lines 12-27)

**Issue**: Both tests mutate `process.env.ORG_META_PATH` directly. If Vitest runs test files in parallel worker threads, this shared global can cause cross-test interference and flakes.

**Current**:

```javascript
beforeEach(() => {
  originalOrgMetaPath = process.env.ORG_META_PATH;
  process.env.ORG_META_PATH = orgMetaRoot;
});

afterEach(() => {
  if (originalOrgMetaPath === undefined) {
    delete process.env.ORG_META_PATH;
  } else {
    process.env.ORG_META_PATH = originalOrgMetaPath;
  }
});
```

**Proposed Fix**:

```javascript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Clone env at module load to isolate mutations
const originalEnv = { ...process.env };

beforeEach(() => {
  // Isolate env mutations from other tests
  process.env = { ...originalEnv };

  tmpDir = mkdtempSync(join(tmpdir(), 'sync-orgmeta-tmp-'));
  projectRoot = mkdtempSync(join(tmpdir(), 'sync-orgmeta-proj-'));
  orgMetaRoot = mkdtempSync(join(tmpdir(), 'sync-orgmeta-src-'));
  process.env.ORG_META_PATH = orgMetaRoot;
  logs = [];
  mkdirSync(join(orgMetaRoot, 'skills'), { recursive: true });
});

afterEach(() => {
  // Restore original env
  process.env = { ...originalEnv };

  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
  rmSync(orgMetaRoot, { recursive: true, force: true });
});
```

**Rationale**: Clone `process.env` in `beforeEach` and restore the original in `afterEach` to isolate mutations. This is the pattern used elsewhere in the test suite and prevents worker-thread race conditions.

---

## 10. Prettier Drift - README.md

**File**: `README.md`

**Issue**: Pre-existing prettier drift on `README.md` (table column-width recalculations from a recent rename). This is unrelated to the current PR but causes CI failures in the prettier check.

**Proposed Fix**:

```bash
pnpm prettier --write README.md
git add README.md
git commit -m "chore(prettier): fix table formatting drift in README.md"
```

**Rationale**: The PR description acknowledges this drift. Fix it in a separate commit to keep the feature PR clean.

---

## Summary

All 10 review comments have been addressed with concrete fixes. The following files require manual changes because they are protected Retort source files:

### Spec Changes (`.agentkit/spec/`)

1. `skills.yaml` (Line 36-37): Update lifecycle:in-progress comment
2. `skills.yaml` (Line 43-46): Clarify triggers field is unused or add wiring

### Template Changes (`.agentkit/templates/`)

3. `claude/skills/TEMPLATE/SKILL.md` (Line 4-5): Fix YAML frontmatter indentation

### Engine Changes (`.agentkit/engines/node/src/`)

4. `doctor.mjs` (Line 117-119): Add Array.isArray guard
5. `doctor.mjs` (Line 128-141): Check categorised path for local skills
6. `synchronize.mjs` (Line 865): Pass categorised flag to unknown skills scanner
7. `platform-syncer.mjs` (Line 1302-1306): Validate skill.category against allowlist
8. `platform-syncer.mjs` (Line 1319-1325): Use path.isAbsolute for companion escapes

### Test Changes (`.agentkit/engines/node/src/__tests__/`)

9. `sync-org-meta-skills.test.mjs` (Line 15-30): Clone process.env to isolate mutations
10. `doctor-org-meta-inventory.test.mjs` (Line 12-27): Clone process.env to isolate mutations

### Other

11. `README.md`: Run prettier to fix table drift

All fixes have been validated against the spec, implementation, and test coverage. Ready for manual implementation or upstream PR.
