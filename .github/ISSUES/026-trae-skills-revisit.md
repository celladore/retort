# feat(skills): Revisit skills strategy for TRAE compatibility and usability

**Priority:** P2 — Medium
**Labels:** `enhancement`, `skills`, `trae`, `dx`
**Blocked by:** None

---

## Problem

TRAE exposes skills as a first-class concept. AgentKit Forge should revisit whether its generated skills are scoped, named, and documented optimally for TRAE-style usage.

Reference:

- https://docs.trae.ai/ide/skills?_lang=en

Areas to revisit:

- skill naming and discoverability
- overlap between commands, skills, and workflows
- prompt size / redundancy inside generated skills
- skill ownership and maintenance burden
- platform-specific differences in how skills should be emitted

---

## Acceptance Criteria

- [ ] Skill strategy is audited against TRAE expectations
- [ ] Redundant or low-value skill generation is identified
- [ ] Naming/discoverability improvements are proposed
- [ ] Follow-up implementation tasks are identified if needed

---

## Related

- TRAE docs: https://docs.trae.ai/ide/skills?_lang=en
