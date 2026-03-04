# feat(cli): Build `security` command on top of review-runner.mjs

**Priority:** P1 — High
**Labels:** `enhancement`, `security`, `cli`
**Blocked by:** None (can be done as part of #001 or independently)

---

## Problem

`review-runner.mjs` already has robust secret scanning (5 patterns, concurrency pool, symlink protection) but only runs on **changed files**. The spec defines a `security` command with broader scope:

- `--scan-type deps` — dependency vulnerability scanning (not implemented anywhere)
- `--scan-type secrets` — secret scanning (exists in review-runner but only for changed files)
- `--scan-type owasp` — OWASP pattern detection (not implemented)
- `--scan-type permissions` — permission auditing (not implemented)
- `--output sarif` — SARIF format for GitHub Security tab (not implemented)

---

## Implementation Plan

### Step 1: Create `security.mjs` that reuses review-runner internals (~3 hours)

```javascript
// .agentkit/engines/node/src/security.mjs
import { resolve } from 'path';
import { readdirSync, statSync } from 'fs';
import { execCommand } from './runner.mjs';
import { appendEvent } from './orchestrator.mjs';

// Reuse secret patterns from review-runner
// Either export them from review-runner or move to shared module

export async function runSecurity({ agentkitRoot, projectRoot, flags = {} }) {
  const scanType = flags['scan-type'] || 'all';
  const severity = flags.severity || 'LOW'; // minimum severity to report
  const outputFormat = flags.output || 'markdown';
  const allFindings = [];

  // --- deps: Dependency vulnerability scanning ---
  if (scanType === 'deps' || scanType === 'all') {
    console.log('--- Dependency Vulnerability Scan ---');
    // Detect package managers and run their audit commands:
    //   package.json → npm audit --json OR pnpm audit --json
    //   Cargo.toml → cargo audit --json (if installed)
    //   pyproject.toml → pip-audit --format json (if installed)
    //   *.csproj → dotnet list package --vulnerable --format json
    // Parse JSON output, normalize to { type, severity, package, version, advisory }
  }

  // --- secrets: Full-codebase secret scanning ---
  if (scanType === 'secrets' || scanType === 'all') {
    console.log('--- Secret Scan (full codebase) ---');
    // Walk ALL project files (not just changed)
    // Reuse scanSecrets() from review-runner, but feed it all files
    // Use the same concurrency pool and skip patterns
  }

  // --- owasp: Pattern-based vulnerability detection ---
  if (scanType === 'owasp' || scanType === 'all') {
    console.log('--- OWASP Pattern Scan ---');
    // Scan for common vulnerabilities:
    const OWASP_PATTERNS = [
      { name: 'eval-injection', pattern: /\beval\s*\(/, severity: 'HIGH',
        message: 'eval() usage — potential code injection' },
      { name: 'inner-html', pattern: /\.innerHTML\s*=/, severity: 'MEDIUM',
        message: 'innerHTML assignment — potential XSS' },
      { name: 'sql-concat', pattern: /['"`]\s*\+\s*\w+.*(?:SELECT|INSERT|UPDATE|DELETE)/i,
        severity: 'HIGH', message: 'SQL string concatenation — potential injection' },
      { name: 'hardcoded-ip', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
        severity: 'LOW', message: 'Hardcoded IP address' },
      { name: 'http-no-tls', pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/,
        severity: 'MEDIUM', message: 'HTTP without TLS' },
    ];
    // Walk source files, apply patterns, collect findings
  }

  // --- permissions: Audit settings.yaml allow/deny ---
  if (scanType === 'permissions' || scanType === 'all') {
    console.log('--- Permission Audit ---');
    // Load settings.yaml
    // Check for overly broad allow rules (e.g., Bash(*))
    // Check deny list covers dangerous commands
    // Compare against OWASP recommendations
    // Flag: missing deny rules for rm -rf, git push --force, etc.
  }

  // --- Output formatting ---
  if (outputFormat === 'json') {
    console.log(JSON.stringify({ findings: allFindings }, null, 2));
  } else if (outputFormat === 'sarif') {
    // SARIF 2.1.0 format for GitHub Security tab
    console.log(JSON.stringify(toSarif(allFindings), null, 2));
  } else {
    // Default: markdown table
    printMarkdownReport(allFindings, severity);
  }

  return { findings: allFindings, status: allFindings.some(f => f.severity === 'HIGH') ? 'FAIL' : 'PASS' };
}
```

### Step 2: Extract shared secret patterns from review-runner.mjs (~30 min)

Move `SECRET_PATTERNS`, `SKIP_SECRET_SCAN_PATHS`, `SKIP_SECRET_SCAN_EXTENSIONS`, and `scanSecrets()` to a shared module:

```
.agentkit/engines/node/src/secret-scanner.mjs
```

Both `review-runner.mjs` and `security.mjs` import from it. review-runner continues to scan only changed files; security scans the full codebase.

### Step 3: Wire into CLI (~10 min)

In `cli.mjs`:

```javascript
case 'security': {
  const { runSecurity } = await import('./security.mjs');
  const result = await runSecurity({
    agentkitRoot: AGENTKIT_ROOT,
    projectRoot: PROJECT_ROOT,
    flags,
  });
  if (result.status === 'FAIL') process.exit(1);
  break;
}
```

### Step 4: Tests (~1 hour)

- Test each scan type independently
- Test severity filtering
- Test output formats (markdown, json, sarif)
- Test that secret scanning reuses shared patterns correctly

---

## Acceptance Criteria

- [ ] `agentkit security` runs all 4 scan types by default
- [ ] `agentkit security --scan-type deps` runs only dependency audit
- [ ] `agentkit security --scan-type secrets` scans full codebase (not just changed files)
- [ ] `agentkit security --output sarif` produces valid SARIF output
- [ ] `agentkit security --severity HIGH` filters to high-severity only
- [ ] Secret scanning patterns shared between review-runner and security
- [ ] OWASP patterns catch eval, innerHTML, SQL concatenation
- [ ] Permission audit flags overly broad allow rules

---

## Related

- Part of: #001 (missing CLI handlers)
- Extends: review-runner.mjs
- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
