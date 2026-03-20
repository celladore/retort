# CRITICAL: Implement 6 missing CLI command handlers

**Priority:** P0 — Critical
**Labels:** `bug`, `cli`, `spec-drift`
**Blocked by:** None
**Blocks:** Most downstream CLI usage

---

## Problem

6 commands are fully defined in `.agentkit/spec/commands.yaml` (with types, flags, descriptions, allowed tools) but have **no `case` statement** in `cli.mjs` (lines 442-566). Running them produces `Unknown command`.

| Command        | Spec Type | Spec Lines | Flags Defined                                               |
| -------------- | --------- | ---------- | ----------------------------------------------------------- |
| `build`        | utility   | 433-459    | `--stack`, `--package`, `--production`, `--verbose`         |
| `test`         | utility   | 460-491    | `--stack`, `--filter`, `--coverage`, `--watch`, `--package` |
| `format`       | utility   | 492-515    | `--stack`, `--check`, `--path`                              |
| `deploy`       | utility   | 516-544    | `--environment`, `--dry-run`, `--skip-checks`, `--stack`    |
| `security`     | utility   | 545-573    | `--scan-type`, `--severity`, `--fix`, `--output`            |
| `sync-backlog` | workflow  | 157-177    | `--direction`, `--labels`, `--team`                         |

---

## Implementation Plan

### Phase 1: Extract `build`, `test`, `format` from `check.mjs` (~2-3 hours)

These three already have logic inside `check.mjs` (`buildSteps()` function, lines 24-97). The plan is to extract reusable helpers and create thin standalone handlers.

#### 1a. Create `stack-runner.mjs` (shared utility)

Extract `detectStacks()` (lines 220-259) and the formatter/linter resolver functions into a shared module:

```
.agentkit/engines/node/src/stack-runner.mjs
```

Exports:

- `detectStacks(agentkitRoot, projectRoot, filterStack)` — moved from check.mjs
- `resolveFormatter(formatter, agentkitRoot)` — moved from check.mjs
- `resolveLinter(linter)` — moved from check.mjs
- `isAllowedFormatter(resolved)` / `isAllowedLinter(resolved)` — moved from check.mjs
- `runStackCommand(projectRoot, stack, commandKey, flags)` — new helper that runs a single stack command (build, test, format, lint) with fix support
- Re-export `ALLOWED_FORMATTER_BASES`, `ALLOWED_LINTER_BASES`, `ALLOWED_NPX_PACKAGES`

#### 1b. Create `build.mjs`

```javascript
// .agentkit/engines/node/src/build.mjs
export async function runBuild({ agentkitRoot, projectRoot, flags = {} }) {
  // 1. detectStacks(agentkitRoot, projectRoot, flags.stack)
  // 2. For each stack: run stack.buildCommand
  //    - If --package flag: pass monorepo filter (e.g., pnpm --filter <pkg> build)
  //    - If --production flag: set NODE_ENV=production
  //    - If --verbose flag: stream stdout
  // 3. Return { stacks, overallPassed }
}
```

#### 1c. Create `test-runner-cli.mjs`

(Named to avoid conflict with existing test files)

```javascript
// .agentkit/engines/node/src/test-runner-cli.mjs
export async function runTest({ agentkitRoot, projectRoot, flags = {} }) {
  // 1. detectStacks(agentkitRoot, projectRoot, flags.stack)
  // 2. For each stack: run stack.testCommand
  //    - If --filter flag: append filter pattern (e.g., pnpm test -- --grep <filter>)
  //    - If --coverage flag: append coverage flag (e.g., --coverage)
  //    - If --watch flag: append watch flag
  // 3. Return { stacks, overallPassed }
}
```

#### 1d. Create `format-runner.mjs`

```javascript
// .agentkit/engines/node/src/format-runner.mjs
export async function runFormat({ agentkitRoot, projectRoot, flags = {} }) {
  // 1. detectStacks(agentkitRoot, projectRoot, flags.stack)
  // 2. For each stack: resolveFormatter(stack.formatter, agentkitRoot)
  //    - If --check flag: run resolved.check
  //    - Else: run resolved.fix (default to write/fix mode)
  //    - If --path flag: replace "." with flags.path in command
  // 3. Return { stacks, overallPassed }
}
```

#### 1e. Refactor `check.mjs` to compose

```javascript
// check.mjs becomes a composition:
import { runFormat } from './format-runner.mjs';
import { runTest } from './test-runner-cli.mjs';
import { runBuild } from './build.mjs';
// check = format(--check) → lint → typecheck → test → build (unless --fast)
```

### Phase 2: Implement `security.mjs` (~3-4 hours)

Extend `review-runner.mjs` patterns into a dedicated security command.

```javascript
// .agentkit/engines/node/src/security.mjs
export async function runSecurity({ agentkitRoot, projectRoot, flags = {} }) {
  const scanType = flags['scan-type'] || 'all';
  const results = { findings: [], scanTypes: [] };

  // 1. deps — Dependency vulnerability scanning
  if (scanType === 'deps' || scanType === 'all') {
    // Detect stack → run: npm audit --json, cargo audit, pip-audit, dotnet list package --vulnerable
    // Parse JSON output into normalized findings
  }

  // 2. secrets — Reuse review-runner.mjs scanSecrets() on full codebase
  if (scanType === 'secrets' || scanType === 'all') {
    // Walk all files (not just changed), run scanSecrets()
  }

  // 3. owasp — Pattern-based detection
  if (scanType === 'owasp' || scanType === 'all') {
    // Scan for: eval(), innerHTML, SQL concatenation, hardcoded credentials
    // Configurable patterns from rules.yaml
  }

  // 4. permissions — Audit settings.yaml allow/deny rules
  if (scanType === 'permissions' || scanType === 'all') {
    // Compare settings.yaml permissions against OWASP recommendations
    // Flag overly permissive allow rules
  }

  // Output: JSON, markdown, or SARIF format (--output flag)
}
```

### Phase 3: Implement `deploy.mjs` (~2 hours)

```javascript
// .agentkit/engines/node/src/deploy.mjs
export async function runDeploy({ agentkitRoot, projectRoot, flags = {} }) {
  const env = flags.environment || 'dev';
  const dryRun = flags['dry-run'] !== false; // default true per spec

  // 1. Pre-deployment gates (unless --skip-checks)
  if (!flags['skip-checks']) {
    // Run: check (build + test + lint)
    // If any fail, abort with actionable error
  }

  // 2. Detect deployment method
  //    - Look for: .github/workflows/deploy*.yml, Dockerfile, terraform/, serverless.yml
  //    - Stack-specific: dotnet publish, cargo build --release, etc.

  // 3. If --dry-run: report what WOULD happen, exit
  // 4. If not dry-run: execute deployment pipeline
  //    - Validate environment target
  //    - Run deployment command
  //    - Report status
}
```

### Phase 4: Implement `sync-backlog.mjs` (~3 hours)

```javascript
// .agentkit/engines/node/src/sync-backlog.mjs
export async function runSyncBacklog({ agentkitRoot, projectRoot, flags = {} }) {
  const direction = flags.direction || 'pull';

  // 1. pull — Fetch open GitHub Issues via `gh issue list --json`
  //    - Filter by --labels if provided
  //    - Filter by --team scope if provided
  //    - Map issues to local tracking format

  // 2. push — Create/update GitHub Issues from local task files
  //    - Read .claude/state/tasks/*.yaml
  //    - Map to GitHub Issue create/update API calls

  // 3. both — Bidirectional sync with conflict detection
  //    - Compare timestamps, flag conflicts

  // Requires: gh CLI authenticated (check via commandExists)
}
```

### Phase 5: Wire into CLI (~30 min)

In `cli.mjs`:

1. Add to `VALID_COMMANDS` array (line 26-48):

   ```javascript
   ('build', 'test', 'format', 'deploy', 'security', 'sync-backlog');
   ```

2. Add flag definitions to `VALID_FLAGS` (line 56-122):

   ```javascript
   build: ['stack', 'package', 'production', 'verbose', 'help'],
   test: ['stack', 'filter', 'coverage', 'watch', 'package', 'help'],
   format: ['stack', 'check', 'path', 'help'],
   deploy: ['environment', 'dry-run', 'skip-checks', 'stack', 'help'],
   security: ['scan-type', 'severity', 'fix', 'output', 'help'],
   'sync-backlog': ['direction', 'labels', 'team', 'help'],
   ```

3. Add `case` statements (after line 522):

   ```javascript
   case 'build': { ... }
   case 'test': { ... }
   case 'format': { ... }
   case 'deploy': { ... }
   case 'security': { ... }
   case 'sync-backlog': { ... }
   ```

4. Update `showHelp()` text (lines 273-376).

### Phase 6: Tests (~2 hours)

Create `__tests__/build.test.mjs`, `__tests__/format-runner.test.mjs`, etc. following the existing pattern in `__tests__/check.test.mjs`.

---

## Acceptance Criteria

- [ ] `agentkit build` works standalone with `--stack`, `--package`, `--production` flags
- [ ] `agentkit test` works standalone with `--filter`, `--coverage`, `--watch` flags
- [ ] `agentkit format` works standalone with `--check`, `--path` flags
- [ ] `agentkit security` scans deps/secrets/owasp/permissions based on `--scan-type`
- [ ] `agentkit deploy` validates pre-deployment gates and supports `--dry-run`
- [ ] `agentkit sync-backlog` syncs with GitHub Issues via `gh` CLI
- [ ] `agentkit check` still works (now composes the standalone commands)
- [ ] All new commands have tests
- [ ] Help text updated for all 6 commands

---

## Related

- Contradiction #1: build/test/format in two places (resolved by this issue)
- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
