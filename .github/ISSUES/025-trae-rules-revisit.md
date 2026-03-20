# feat(rules): Revisit rules strategy for TRAE compatibility and ergonomics

**Priority:** P2 — Medium
**Labels:** `enhancement`, `rules`, `trae`, `governance`
**Blocked by:** None

---

## Problem

TRAE exposes explicit rules behavior, and Retort should revisit whether its current rule generation strategy best fits that environment.

Reference:

- https://docs.trae.ai/ide/rules?_lang=en

Areas to revisit:

- rule granularity
- platform-specific rule projection
- rule discoverability
- rule conflicts and precedence
- prompt-length and maintenance cost

---

## Proposed Subtasks

- Audit current rules output against TRAE-oriented expectations
- Review rule precedence and composition model
- Reduce duplication across generated rule sets
- Identify opportunities for simpler or more context-sensitive rules

---

## Acceptance Criteria

- [ ] Current rules approach is audited against TRAE expectations
- [ ] Simplification opportunities are documented
- [ ] Platform-specific projection strategy is reviewed
- [ ] Follow-up implementation tasks are identified if needed

## Implementation Notes (2026-03-20)

The `feat/kit-domain-selection-onboarding` branch introduces stack-based domain filtering
(`filterDomainsByStack` in `template-utils.mjs`) which directly reduces rule noise: only
domains relevant to the declared stack are generated. A TypeScript-only project now gets
typescript + universal domains — not dotnet/rust/python/blockchain. This partially addresses
the redundancy and platform noise concerns raised here. The TRAE-specific rule format audit
remains outstanding.

---

## Related

- TRAE docs: https://docs.trae.ai/ide/rules?_lang=en
- Existing rules governance work: `.github/ISSUES/004-rules-yaml-ownership.md`
