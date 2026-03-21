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

## Note

**Status: In progress / follow-up needed** (2026-03-21)

Kit-based domain filtering (PR #432) reduces generated output volume by only activating domains relevant to the project's declared stack. The same principle applies to skill generation — language-specific skills should only be emitted for active language kits. This is a natural follow-up to the domain filtering work.

The TRAE-specific skill format audit (naming, discoverability, platform differences) remains outstanding and should be scheduled in the next sprint.

---

## Related

- TRAE docs: https://docs.trae.ai/ide/skills?_lang=en
- Related: `.github/ISSUES/025-trae-rules-revisit.md` (same filtering principle)
