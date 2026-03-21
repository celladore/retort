# feat(governance): Assign ownership and review process for rules.yaml

**Priority:** P3 — Low (reduced from P2)
**Labels:** `enhancement`, `governance`, `spec`
**Blocked by:** #002 (maintenance-coordinator agent)

---

## Problem

`.agentkit/spec/rules.yaml` contains critical domain-specific coding standards (TypeScript, .NET, Python, Rust) but:

1. **No agent** has `rules.yaml` in their `focus` area
2. The file is **blocked by** `protect-templates.sh` hook — cannot be edited at all, even for legitimate updates
3. **No governance workflow** for proposing, reviewing, or approving rule changes
4. Rules **drift over time** without active stewardship — new tech stacks may need new rules, existing rules may become outdated

---

## Implementation Plan

### Step 1: Assign ownership to `maintenance-coordinator` (~5 min)

Already handled in #002 — `maintenance-coordinator` agent includes `rules.yaml` in its focus area.

### Step 2: Update `protect-templates.sh` to allow rules.yaml edits via PR (~30 min)

Current hook blocks ALL writes to `.agentkit/` files. Modify to allow `rules.yaml` edits when a specific condition is met:

In `.agentkit/templates/claude/hooks/protect-templates.sh`, add an exception:

```bash
# Allow rules.yaml edits (governed by PR review, not hook)
if [[ "$FILE_PATH" == *".agentkit/spec/rules.yaml"* ]]; then
  exit 0  # Allow — governance is via PR review, not hook
fi
```

The protection shifts from "hook blocks all edits" to "PR review blocks unauthorized changes" via CODEOWNERS.

### Step 3: Add CODEOWNERS entry (~5 min)

In `.github/CODEOWNERS`:

```
# Rules governance — requires maintenance-coordinator review
.agentkit/spec/rules.yaml  @maintenance-team
```

### Step 4: Create rule change proposal template (~30 min)

Create `.github/ISSUE_TEMPLATE/rule-change-proposal.md`:

```markdown
---
name: Rule Change Proposal
about: Propose adding, modifying, or removing a domain rule
labels: governance, rules
---

## Rule Change Type

- [ ] Add new rule
- [ ] Modify existing rule
- [ ] Remove/deprecate rule

## Affected Section

<!-- Which rules.yaml section? e.g., typescript, dotnet, python, rust -->

## Current Rule (if modifying/removing)

<!-- Copy the current rule text -->

## Proposed Change

<!-- What should the rule say/do? -->

## Rationale

<!-- Why is this change needed? Link to ADRs, incidents, or best practices -->

## Impact Assessment

- Files affected: <!-- estimate -->
- Breaking change: <!-- yes/no -->
- Migration needed: <!-- yes/no, describe if yes -->
```

### Step 5: Add doctor.mjs rules staleness check (~1 hour)

In `doctor.mjs`, add a phase 5 check:

```javascript
// 5) Rules staleness
const rulesPath = resolve(specRoot, 'spec', 'rules.yaml');
if (existsSync(rulesPath)) {
  const rulesStat = statSync(rulesPath);
  const daysSinceModified = (Date.now() - rulesStat.mtimeMs) / (1000 * 60 * 60 * 24);
  if (daysSinceModified > 90) {
    findings.push({
      severity: 'warning',
      message: `rules.yaml last modified ${Math.floor(daysSinceModified)} days ago. Consider a quarterly review.`,
    });
  }
}
```

### Step 6: Document review cadence (~30 min)

Add to `CONTRIBUTING.md` or create `docs/RULES_GOVERNANCE.md`:

- Quarterly review schedule
- How to propose changes (use issue template)
- Who reviews (maintenance-coordinator + affected team lead)
- How to add rules for new tech stacks
- Rule severity levels (error vs warning)

---

## Acceptance Criteria

- [ ] `maintenance-coordinator` agent has `rules.yaml` in focus area
- [ ] `protect-templates.sh` allows `rules.yaml` edits
- [ ] CODEOWNERS requires review for `rules.yaml` changes
- [ ] Rule change proposal issue template exists
- [ ] `doctor.mjs` warns when `rules.yaml` hasn't been reviewed in 90+ days
- [ ] Governance process documented

---

## Note

**Status: Reduced priority — P3** (2026-03-21, downgraded from P2)

Kit-based domain filtering (PR #432) significantly reduces the governance burden for `rules.yaml`. Because irrelevant domains are no longer generated for projects (a JS-only project no longer gets dotnet/rust/python rule files), rules.yaml only needs active stewardship for domains that are actually in use. This removes the urgency of the full governance workflow described above.

The ownership and review process is still valuable long-term, but the immediate risk of rule drift affecting end users is lower. Full implementation (protect-templates hook change, CODEOWNERS, staleness check, governance docs) can proceed at reduced priority when bandwidth allows.

---

## Related

- Umbrella: `.github/ISSUES/agent-maintainer-proposal.md`
- Depends-on: #002
- Related: `.github/ISSUES/025-trae-rules-revisit.md` (domain filtering reduces noise)
