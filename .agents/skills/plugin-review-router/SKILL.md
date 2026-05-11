---
name: plugin-review-router
description: Unified Claude plugin review router — selects the right review tool based on context (PR, local changes, feature, Sanity, security). Use instead of calling pr-review-toolkit, coderabbit, or feature-dev review agents directly.
---

# Unified Review Router

Routes to the right review tool based on context. Never manually pick between `pr-review-toolkit`, `coderabbit`, `feature-dev`, or `code-simplifier` — just invoke this skill and it selects for you.

## Decision Tree

```
What are you reviewing?
│
├── A pull request (GitHub PR URL or PR number)
│   └── Deep multi-angle analysis → /review-pr  (pr-review-toolkit)
│
├── Local changes (no PR yet — uncommitted, committed, or branch diff)
│   └── Security/quality/bug-focused → /coderabbit:review
│
├── A feature you just implemented
│   └── /feature-dev → code-reviewer agent  (feature-dev)
│
├── Code you just wrote in this session (not yet a PR)
│   ├── Simplify/refactor focus → /simplify
│   └── Standards/bugs focus → pr-review-toolkit:code-reviewer agent
│
├── Security-specific review
│   └── security-guidance hooks + pr-review-toolkit:silent-failure-hunter
│
├── Sanity CMS (schemas, GROQ, Visual Editing)
│   └── /sanity-plugin:review
│
└── Design / types / test coverage gaps
    ├── Types → pr-review-toolkit:type-design-analyzer
    ├── Tests → pr-review-toolkit:pr-test-analyzer
    └── Silent failures → pr-review-toolkit:silent-failure-hunter
```

## Tier 1 — Full PR Review

**Use when:** You have a PR open on GitHub and want the most thorough analysis.

**Tool:** `/review-pr` (pr-review-toolkit)

**What it does:** Dispatches 6 specialized agents in sequence:
- `code-reviewer` — style, bugs, project conventions
- `code-simplifier` — unnecessary complexity
- `comment-analyzer` — existing review comments to address
- `pr-test-analyzer` — test coverage gaps
- `silent-failure-hunter` — swallowed errors, missing error handling
- `type-design-analyzer` — TypeScript/C# type safety issues

**Trigger phrase examples:**
- "review PR #123"
- "review my pull request before I merge"
- "full review of this PR"

---

## Tier 2 — CodeRabbit Review (Local CLI)

**Use when:** You want CodeRabbit's AI review running against your local changes — works on uncommitted, committed, or branch diffs without needing an open PR.

**Tool:** `/coderabbit:review`

**Prerequisites:** CodeRabbit CLI must be installed and authenticated:
```bash
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
coderabbit auth login
```

**Options:**
```bash
/review                    # all changes
/review committed          # committed only
/review uncommitted        # staged/unstaged only
/review --base main        # diff against main
```

**When to prefer over Tier 1 (`/review-pr`):**
- No open PR yet — you want review before pushing
- Want security/bug-focused analysis (CodeRabbit categorizes: Critical → Suggestions → Positive)
- Want autonomous fix-review cycles (implement → review → fix → re-review)
- Want a second model's opinion after `/review-pr`

**Trigger phrase examples:**
- "coderabbit review"
- "review my uncommitted changes"
- "check for security issues in what I just wrote"

---

## Tier 3 — Feature/Session Review

**Use when:** You just implemented a feature or fixed a bug in this session and haven't opened a PR yet.

**Tool:** `feature-dev:code-reviewer` agent

**What it does:** Reviews files changed in the current feature branch against project conventions in CLAUDE.md. Focused on correctness and architecture, not PR-level nits.

**Trigger phrase examples:**
- "review what I just built"
- "check my feature before I commit"
- "is this implementation correct?"

---

## Tier 4 — Quick In-Session Simplification

**Use when:** You just wrote a chunk of code and want it cleaned up before committing.

**Tool:** `/simplify` → delegates to `code-simplifier` agent

**What it does:** Refactors recently written code for clarity, removes unnecessary complexity, normalizes to project patterns. Does NOT change behaviour — purely structural.

**Trigger phrase examples:**
- `/simplify`
- `/simplify src/MyService.cs`
- "simplify the code I just wrote"

---

## Tier 5 — Sanity CMS Review

**Use when:** You're working in a Sanity project and want to check schemas, GROQ queries, or frontend integration.

**Tool:** `/sanity-plugin:review` (sanity-plugin)

**What it checks:**
- Schema: `defineType`/`defineField` syntax, data modeling, references vs nested objects
- Queries: `defineQuery` wrapping, TypeGen compatibility, no string interpolation
- Frontend: `_key` usage, `stegaClean`, Visual Editing integration
- Type safety: using generated types from `sanity.types.ts`

**Trigger phrase examples:**
- "review my Sanity schema"
- "check my GROQ queries"
- "review my Sanity frontend integration"

---

## Tier 6 — Focused Spot Reviews

Use individual pr-review-toolkit agents for targeted analysis:

| Focus | Agent/Command | When |
|-------|--------------|------|
| Type safety | `pr-review-toolkit:type-design-analyzer` | TypeScript `any`, missing generics, C# nullability |
| Test gaps | `pr-review-toolkit:pr-test-analyzer` | Before merging untested code |
| Silent failures | `pr-review-toolkit:silent-failure-hunter` | Error handling audit |
| Review comments | `pr-review-toolkit:comment-analyzer` | Addressing existing PR feedback |
| Sanity schemas/GROQ | `/sanity-plugin:review` | Sanity CMS projects only |

---

## Quick Reference

| Situation | Command / Agent |
|-----------|----------------|
| Full PR on GitHub | `/review-pr` |
| Local changes (pre-push, security/bug focus) | `/review` (coderabbit CLI) |
| Post-feature check | `feature-dev:code-reviewer` |
| Just wrote code, clean it up | `code-simplifier` |
| Sanity schema / GROQ / frontend | `/sanity-plugin:review` |
| Type safety audit | `pr-review-toolkit:type-design-analyzer` |
| Test coverage check | `pr-review-toolkit:pr-test-analyzer` |
| Error handling audit | `pr-review-toolkit:silent-failure-hunter` |

---

## What Was Disabled

- `code-review@claude-plugins-official` — redundant with `pr-review-toolkit`
- `serena@claude-plugins-official` — redundant with direct `mcpServers.serena` config
- `superpowers@claude-plugins-official` — empty/no components
