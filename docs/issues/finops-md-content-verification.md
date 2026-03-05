# fix(sync): Verify finops.md generated content across all platforms

> **Labels**: `bug`, `sync`, `finops`
> **Priority**: P1 (verification needed)

## Summary

A concern was raised that `.claude/rules/languages/finops.md` contains blockchain rules instead of finops content. **Investigation shows the current content is correct** — all 7 conventions are finops-specific (phased-delivery, reference-tables, tag-safety, audit-reversibility, cost-centre-governance, adx-alternatives, budget-approval).

However, this warrants a verification pass to ensure:
1. The issue was a stale-state observation (previous sync produced wrong output, since corrected)
2. All 8 platform outputs for `finops.md` contain correct finops content
3. The sync engine correctly maps the `finops` rule domain to the finops language template (not blockchain)

## Verification Results (current state)

| Platform | File | Content Correct? |
|---|---|---|
| Claude | `.claude/rules/languages/finops.md` | **YES** — 7 finops conventions |
| Claude | `.claude/rules/finops.md` | Does not exist (only `languages/` version) |
| GitHub Copilot | `.github/instructions/languages/finops.md` | **YES** |
| Cline | `.clinerules/finops.md` | **YES** |
| Cline | `.clinerules/languages/finops.md` | **YES** |
| Cursor | `.cursor/rules/languages/finops.md` | **YES** |
| Roo | `.roo/rules/finops.md` | **YES** |
| Roo | `.roo/rules/languages/finops.md` | **YES** |
| Windsurf | `.windsurf/rules/languages/finops.md` | **YES** |

All files have the correct header `# Instructions — finops` and contain the 7 finops conventions.

## Possible Root Cause of Original Report

1. **Stale working tree**: A previous sync may have produced incorrect output that was since corrected
2. **Template fallback**: If no finops-specific template existed when sync first ran, the `TEMPLATE.md` fallback may have produced generic/wrong content
3. **Rule domain ordering**: If the sync engine iterated rules in spec order and the blockchain domain was processed before finops, a caching/variable leakage bug could have injected blockchain content

## Recommended Actions

### 1. Run a clean sync and verify

```bash
pnpm -C .agentkit agentkit:sync
git diff  # Check if any finops.md files change
```

If `git diff` shows changes to any finops.md file, the current committed version was out of sync.

### 2. Check template mapping

Verify that `.agentkit/templates/` has a finops-specific template (not relying on generic fallback):

```bash
find .agentkit/templates/ -name "*finops*" -type f
```

### 3. Audit sync engine for variable leakage

In `.agentkit/engines/node/src/synchronize.mjs`, verify that template rendering for each rule domain uses a fresh context and doesn't carry over variables from the previous domain iteration.

### 4. Add regression test

Add a test to the sync engine test suite that verifies each generated `finops.md` file:
- Contains the string "finops" in the title
- Contains at least one `[finops-` convention ID
- Does NOT contain `[bc-` (blockchain convention IDs)
- Does NOT contain "Solana", "Anchor", "EtherLink", or "smart contract"

## Acceptance Criteria

- [ ] All 8 finops.md files verified to contain correct finops content
- [ ] Clean sync produces no diff on finops.md files
- [ ] Template mapping confirmed (finops domain → finops template, not fallback)
- [ ] No variable leakage between rule domains in sync engine
- [ ] Regression test added to prevent future content mismatches

## References

- Finops rule domain: `.agentkit/spec/rules.yaml`
- Sync engine: `.agentkit/engines/node/src/synchronize.mjs`
- Generated finops files: 8 files across all platforms (see table above)
- Blockchain rules: `.claude/rules/languages/blockchain.md` (verified separate and correct)
