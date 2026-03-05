# SPEC: commitConvention Auto-Detection

**Status:** Draft
**Feature ID:** F-CCAD
**Author:** Claude (AI-assisted)
**Created:** 2026-03-05
**Related:** `agentkit discover`, `project-mapping.mjs`, `init.mjs`

---

## 1. Functional Specification

### 1.1 Problem Statement

Today, `process.commitConvention` in `project.yaml` defaults to `conventional` during
`agentkit init` and is never updated automatically. Projects that adopt commit tooling
(commitlint, semantic-release, etc.) after init keep the stale default, causing generated
configs to emit incorrect commit-format guidance.

### 1.2 Goal

Extend `agentkit discover` to detect the commit convention from the repository's
filesystem artifacts, and update `project.yaml` when a confident match is found.

### 1.3 Detection Signals (Priority Order)

| Signal | Files / Patterns | Detected Convention |
|---|---|---|
| commitlint config | `.commitlintrc`, `.commitlintrc.{json,yaml,yml,js,cjs,mjs,ts}`, `commitlint.config.{js,cjs,mjs,ts}` | `conventional` |
| semantic-release config | `.releaserc`, `.releaserc.{json,yaml,yml,js,cjs}`, `release.config.{js,cjs,mjs,ts}` | `semantic` |
| `package.json` keys | `"commitlint"` key, `"release"` key, `"standard-version"` key | `conventional` / `semantic` |
| Git log heuristic | Last 20 commit messages match `^(feat|fix|chore|docs|refactor|test|ci|perf|build|style|revert)(\(.+\))?!?:` | `conventional` |
| Git log heuristic | Last 20 commit messages match `^(major|minor|patch):` | `semantic` |
| No match | — | Leave existing value unchanged |

### 1.4 User Flow

1. User runs `agentkit discover` (or `agentkit sync --discover`).
2. Discover scans for commit-convention artifacts listed above.
3. If a confident match is found (config file OR ≥60% of recent commits match pattern):
   - `project.yaml` → `process.commitConvention` is updated.
   - Log line: `[agentkit:discover] Detected commit convention: conventional (via .commitlintrc.json)`
4. If no match, the existing value is preserved. A debug-level log is emitted.

### 1.5 Edge Cases

- **Multiple conflicting signals:** Config-file signal wins over git-log heuristic.
- **Monorepo with mixed conventions:** Use root-level config; ignore workspace-level.
- **Empty or shallow clone:** Skip git-log heuristic when `git log` returns <5 commits.
- **`commitConvention: none` set explicitly:** Discover still detects but logs
  `[agentkit:discover] Skipping commitConvention update (explicitly set to none)`.

### 1.6 Acceptance Criteria

- [ ] `agentkit discover` detects `conventional` when `.commitlintrc.json` exists.
- [ ] `agentkit discover` detects `semantic` when `.releaserc` exists.
- [ ] Git-log heuristic triggers only when ≥60% of last 20 messages match.
- [ ] Existing value preserved when no signal is found.
- [ ] Unit tests cover all 6 signal types + edge cases.

---

## 2. Technical Specification

### 2.1 Affected Files

| File | Change |
|---|---|
| `.agentkit/engines/node/src/discover.mjs` | Add `detectCommitConvention()` detector |
| `.agentkit/engines/node/src/__tests__/discover.test.mjs` | Unit tests |
| `.agentkit/spec/project.yaml` | Updated by discover (runtime) |

### 2.2 Implementation

#### 2.2.1 New Detector: `detectCommitConvention(projectRoot)`

```js
// discover.mjs — new export
const COMMITLINT_FILES = [
  '.commitlintrc',
  '.commitlintrc.json', '.commitlintrc.yaml', '.commitlintrc.yml',
  '.commitlintrc.js', '.commitlintrc.cjs', '.commitlintrc.mjs', '.commitlintrc.ts',
  'commitlint.config.js', 'commitlint.config.cjs', 'commitlint.config.mjs',
  'commitlint.config.ts',
];

const SEMANTIC_RELEASE_FILES = [
  '.releaserc', '.releaserc.json', '.releaserc.yaml', '.releaserc.yml',
  '.releaserc.js', '.releaserc.cjs',
  'release.config.js', 'release.config.cjs', 'release.config.mjs',
  'release.config.ts',
];

const CONVENTIONAL_RE = /^(feat|fix|chore|docs|refactor|test|ci|perf|build|style|revert)(\(.+\))?!?:/;
const SEMANTIC_RE = /^(major|minor|patch):/;

export async function detectCommitConvention(projectRoot) {
  // 1. Config-file detection (highest priority)
  for (const f of COMMITLINT_FILES) {
    if (existsSync(join(projectRoot, f))) return { convention: 'conventional', source: f };
  }
  for (const f of SEMANTIC_RELEASE_FILES) {
    if (existsSync(join(projectRoot, f))) return { convention: 'semantic', source: f };
  }

  // 2. package.json key detection
  const pkgPath = join(projectRoot, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    if (pkg.commitlint || pkg['standard-version']) return { convention: 'conventional', source: 'package.json' };
    if (pkg.release) return { convention: 'semantic', source: 'package.json' };
  }

  // 3. Git-log heuristic (lowest priority)
  // Uses child_process.execSync to read last 20 commit subjects
  // Returns match only if ≥60% match the pattern
  // Skips if <5 commits available

  return null; // no confident match
}
```

#### 2.2.2 Integration Point

In `discover.mjs`'s main `runDiscover()` function, call `detectCommitConvention()`
after stack detection and before writing the discovery report. If a result is returned
and the existing value is not `none`, update `project.commitConvention`.

#### 2.2.3 Git-Log Heuristic Detail

```js
import { execSync } from 'child_process';

function gitLogHeuristic(projectRoot) {
  try {
    const log = execSync('git log --oneline -20 --format=%s', { cwd: projectRoot, encoding: 'utf8' });
    const lines = log.trim().split('\n').filter(Boolean);
    if (lines.length < 5) return null;

    const conventionalCount = lines.filter(l => CONVENTIONAL_RE.test(l)).length;
    const semanticCount = lines.filter(l => SEMANTIC_RE.test(l)).length;
    const threshold = lines.length * 0.6;

    if (conventionalCount >= threshold) return { convention: 'conventional', source: 'git-log' };
    if (semanticCount >= threshold) return { convention: 'semantic', source: 'git-log' };
    return null;
  } catch {
    return null; // git not available or not a repo
  }
}
```

### 2.3 Testing Strategy

| Test Case | Fixture | Expected |
|---|---|---|
| `.commitlintrc.json` exists | Temp dir with file | `{ convention: 'conventional', source: '.commitlintrc.json' }` |
| `.releaserc` exists | Temp dir with file | `{ convention: 'semantic', source: '.releaserc' }` |
| `package.json` has `commitlint` key | Temp dir with pkg | `{ convention: 'conventional', source: 'package.json' }` |
| No signals | Empty temp dir | `null` |
| Config + git log conflict | Both present | Config wins |
| Explicit `none` | project.yaml set | Value preserved, log emitted |

### 2.4 Rollout

1. Implement in `discover.mjs` behind existing `agentkit discover` command.
2. No feature flag needed — discover is opt-in.
3. Coordinate: no dependency on other PRs.
