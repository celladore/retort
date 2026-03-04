# feat(integration): Wire doctor.mjs into pre-sync and healthcheck

**Priority:** P2 — Medium
**Labels:** `enhancement`, `integration`, `dx`
**Blocked by:** None

---

## Problem

`doctor.mjs` runs 4 diagnostic checks (spec validation, overlay sanity, project completeness, merge driver health) but is only invoked:
- Manually via `agentkit doctor`
- In CI via the validate job (added in this branch)

It's **not called from**:
- `healthcheck.mjs` (which checks tools + stacks but not framework health)
- `synchronize.mjs` pre-sync (which could catch issues before rendering)
- `session-start.sh` hook (lightweight check on session open)

---

## Implementation Plan

### Step 1: Integrate doctor into healthcheck.mjs (~30 min)

In `healthcheck.mjs`, after the AgentKit Setup section (line 84):

```javascript
// --- Step 2b: Framework Diagnostics ---
console.log('--- Framework Diagnostics ---');
try {
  const { runDoctor } = await import('./doctor.mjs');
  const doctorResult = await runDoctor({
    agentkitRoot,
    projectRoot,
    flags: { verbose: false },
  });

  const errorCount = doctorResult.findings.filter(f => f.severity === 'error').length;
  const warnCount = doctorResult.findings.filter(f => f.severity === 'warning').length;

  console.log(`  Doctor: ${doctorResult.status} (${errorCount} errors, ${warnCount} warnings)`);

  if (doctorResult.status === 'FAIL') {
    results.overallHealth = 'UNHEALTHY';
  }

  results.doctor = {
    status: doctorResult.status,
    errors: errorCount,
    warnings: warnCount,
  };
} catch (err) {
  console.warn(`  Doctor: SKIP (${err.message})`);
}
console.log('');
```

### Step 2: Add pre-sync doctor check to synchronize.mjs (~30 min)

In `synchronize.mjs` `runSync()`, before rendering:

```javascript
// Pre-sync diagnostics (non-blocking, warnings only)
try {
  const { runDoctor } = await import('./doctor.mjs');
  const result = await runDoctor({
    agentkitRoot,
    projectRoot,
    flags: { verbose: false },
  });
  if (result.status === 'FAIL') {
    console.warn('[agentkit:sync] Doctor reports issues. Run "agentkit doctor --verbose" for details.');
    // Don't block sync — just warn
  }
} catch {
  // Doctor is advisory, don't block sync
}
```

### Step 3: Add lightweight merge driver check to session-start.sh (~30 min)

In `.agentkit/templates/claude/hooks/session-start.sh`, add after existing initialization:

```bash
# Lightweight merge driver check
if [ -f ".gitattributes" ]; then
  if ! grep -q "merge=agentkit-generated" .gitattributes 2>/dev/null; then
    echo "[agentkit] Warning: .gitattributes missing merge drivers. Run: agentkit sync"
  fi
  if ! git config merge.agentkit-generated.driver >/dev/null 2>&1; then
    echo "[agentkit] Tip: Activate merge drivers locally:"
    echo "  git config merge.agentkit-generated.name 'Accept upstream for generated files'"
    echo "  git config merge.agentkit-generated.driver 'cp %B %A'"
  fi
fi
```

---

## Acceptance Criteria

- [ ] `agentkit healthcheck` includes doctor diagnostics in output
- [ ] `agentkit sync` warns (non-blocking) when doctor reports issues
- [ ] `session-start.sh` checks merge driver activation on session open
- [ ] Doctor failures in healthcheck mark overall health as UNHEALTHY

---

## Related

- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
