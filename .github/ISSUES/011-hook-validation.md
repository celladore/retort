# feat(validate): Add hook executable and shebang validation

**Priority:** P2 — Medium
**Labels:** `enhancement`, `validation`, `hooks`
**Blocked by:** None

---

## Problem

`validate.mjs` checks that hook **files exist** but doesn't verify:

1. Hook scripts are **executable** (`chmod +x`)
2. Hook scripts have correct **shebang lines** (`#!/usr/bin/env bash`)
3. Hook event matchers in `settings.json` reference **valid tool names**
4. **PowerShell variants** exist alongside Bash scripts (cross-platform)
5. Hook scripts are **syntactically valid** (no parse errors)

A hook file that exists but isn't executable will silently fail at runtime.

---

## Implementation Plan

### Step 1: Add executable check to validate.mjs (~30 min)

In `validate.mjs`, after the existing hook file existence check:

```javascript
// Phase: Hook executability
for (const hook of expectedHooks) {
  const shPath = resolve(projectRoot, '.claude', 'hooks', `${hook.name}.sh`);
  if (existsSync(shPath)) {
    const stat = statSync(shPath);
    const isExecutable = (stat.mode & 0o111) !== 0;
    if (!isExecutable) {
      findings.push({
        severity: 'warning',
        file: `.claude/hooks/${hook.name}.sh`,
        message: `Hook script is not executable. Run: chmod +x .claude/hooks/${hook.name}.sh`,
      });
    }
  }
}
```

### Step 2: Add shebang validation (~20 min)

```javascript
// Phase: Hook shebang lines
for (const hook of expectedHooks) {
  const shPath = resolve(projectRoot, '.claude', 'hooks', `${hook.name}.sh`);
  if (existsSync(shPath)) {
    const firstLine = readFileSync(shPath, 'utf-8').split('\n')[0];
    if (!firstLine.startsWith('#!/')) {
      findings.push({
        severity: 'warning',
        file: `.claude/hooks/${hook.name}.sh`,
        message: `Missing shebang line. Expected #!/usr/bin/env bash or similar.`,
      });
    }
  }
}
```

### Step 3: Validate tool matchers in settings.json (~30 min)

The settings.json hooks section uses tool name matchers (e.g., `Write|Edit`, `Bash`). Validate these reference real Claude Code tool names:

```javascript
const VALID_TOOL_NAMES = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebSearch', 'WebFetch', 'TodoWrite', 'Agent',
  'NotebookEdit', 'AskUserQuestion',
];

// For each hook in settings.json:
//   Parse the tool_name matcher (e.g., "Write|Edit")
//   Split by | and validate each against VALID_TOOL_NAMES
//   Flag unknown tool names
```

### Step 4: Cross-platform parity check (~20 min)

```javascript
// For each .sh hook, verify .ps1 exists (and vice versa)
for (const hook of expectedHooks) {
  const shExists = existsSync(resolve(hooksDir, `${hook.name}.sh`));
  const ps1Exists = existsSync(resolve(hooksDir, `${hook.name}.ps1`));
  if (shExists && !ps1Exists) {
    findings.push({
      severity: 'info',
      message: `${hook.name}.ps1 missing — Windows users won't have this hook.`,
    });
  }
}
```

### Step 5: Basic syntax check (~30 min, optional)

```javascript
// For .sh files: run bash -n (syntax check only, no execution)
const syntaxCheck = execCommand(`bash -n "${shPath}"`, { cwd: projectRoot });
if (syntaxCheck.exitCode !== 0) {
  findings.push({
    severity: 'error',
    file: `.claude/hooks/${hook.name}.sh`,
    message: `Syntax error: ${syntaxCheck.stderr.trim()}`,
  });
}
```

---

## Acceptance Criteria

- [ ] `agentkit validate` warns on non-executable hook scripts
- [ ] `agentkit validate` warns on missing shebang lines
- [ ] `agentkit validate` warns on invalid tool name matchers
- [ ] `agentkit validate` reports missing cross-platform variants
- [ ] `agentkit validate` detects syntax errors in hook scripts (optional)

---

## Related

- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
