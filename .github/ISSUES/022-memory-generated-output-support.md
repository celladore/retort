# feat(memory): Integrate memory guidance into generated outputs

**Priority:** P2 — Medium
**Labels:** `enhancement`, `memory`, `templates`, `sync`
**Blocked by:** #020, #021

---

## Problem

If AgentKit Forge adds memory support, generated outputs need to reflect that consistently across supported platforms.

This includes:

- platform instructions
- rules and safety guidance
- agent and skill templates
- docs and onboarding materials

---

## Implementation Plan

- Identify generated outputs impacted by memory support
- Define memory-related template variables and sections
- Update docs/rules/agent templates where appropriate
- Ensure memory guidance is platform-sensitive rather than globally overreaching

---

## Acceptance Criteria

- [ ] Impacted generated outputs are inventoried
- [ ] Template changes are scoped and documented
- [ ] Memory guidance appears consistently where intended
- [ ] Non-memory platforms degrade gracefully

---

## Related

- Umbrella: `.github/ISSUES/019-trae-memory-support-umbrella.md`
