# feat(platform): Add support matrix for requested IDEs and agent platforms

**Priority:** P1 — High
**Labels:** `enhancement`, `platform`, `ide`, `dx`
**Blocked by:** None

---

## Problem

The following requested platforms need an explicit support matrix and recommendation:

- Qoder
- TRAE
- Antigravity
- Factory
- Nimbalist
- Claude Code

Some are clear IDE/editor targets, while others are closer to agent execution environments or adjacent tooling surfaces.

---

## Implementation Plan

### Step 1: Define matrix dimensions

For each platform, evaluate:

- platform type
- current support status
- generated output target needed
- MCP relevance
- agent/rules/skills compatibility
- import/export opportunities
- maintenance cost

### Step 2: Triage each requested platform

Document a recommendation for each:

- first-class support
- adapter/export support
- docs-only support
- experimental
- defer

### Step 3: Clarify Claude Code status

Explicitly document what is already supported, what is partially supported, and what remains missing.

### Step 4: Classify Factory

Document whether Factory should be treated as:

- IDE/editor target
- agent platform
- orchestration surface
- non-target integration

---

## Acceptance Criteria

- [ ] A support matrix exists for all requested platforms
- [ ] Claude Code status is explicitly documented
- [ ] Factory classification is documented with rationale
- [ ] Follow-up implementation work is identified where appropriate

---

## Related

- Umbrella: `.github/ISSUES/029-platform-support-umbrella.md`
