---
description: "Comprehensive production-grade project review and assessment"
allowed-tools: Read, Glob, Grep, Bash, WebSearch, WebFetch
generated_by: "{{lastAgent}}"
last_model: "{{lastModel}}"
last_updated: "{{syncDate}}"
# Format: YAML frontmatter + Markdown body. Claude slash command.
# Docs: https://docs.anthropic.com/en/docs/claude-code/memory#slash-commands
---

# /project-review — Comprehensive Project Assessment

You are an expert software architect and code reviewer performing a **production-grade review** of this project. Systematically analyze and improve code quality, architecture, security, performance, documentation, and feature completeness.

## Global Rules

1. **Be honest about scope.** Only analyze files visible in current context. State what is out of scope.
2. **Prioritize high-impact areas.** Focus on: entrypoints, core business logic, security-sensitive code, performance-critical paths, and core user flows.
3. **Quality over quantity.** For each category, identify **1-10 high-impact items** you can justify from code in scope. Never pad.
4. **Feature rule.** Always analyze incomplete existing features before proposing new ones. Prefer finishing `FEAT-INC-*` over adding `FEAT-NEW-*`.
5. **Use multiple modalities.** If screenshots or design assets exist, analyze them alongside code.
6. **Don't stall.** Work with what you have. Only ask for clarification on high-risk ambiguous decisions.
7. **Item IDs.** Use prefixes: `BUG-*`, `UX-*`, `PERF-*`, `REF-*`, `FEAT-INC-*`, `FEAT-NEW-*`, `DOC-*`, `TASK-*`.

---

## Phase -1: Scope Snapshot

List the directories and key files in scope. If the project is large (>50 files), state your initial focus areas.

## Phase 0: Project Context Discovery

Extract or infer:
- Project purpose and primary business goals
- Target users and primary use cases
- Core value proposition
- Key constraints

If no README exists, infer from code patterns and state your confidence level.

## Phase 0.5: Design & Visual Identity

Search for design assets, style guides, theme files, and UI libraries. If missing, reverse-engineer a basic design system from the UI code: color palette, typography, spacing, and component patterns.

## Phase 1a: Technology Assessment

Document the tech stack: languages, frameworks, frontend/backend, build tools, test frameworks, deployment, and third-party integrations.

## Phase 1b: Best Practices Benchmarking

Use web browsing to verify current framework versions, WCAG standards, and OWASP guidance. Produce a concise best-practices baseline.

## Phase 1c: Core Analysis

For each category below, find **1-10 high-impact items** with: ID, title, severity (Critical/High/Medium/Low), effort (S/M/L), location, description, impact, and recommendation.

1. **Bugs** — Functional errors, logic flaws, security vulnerabilities
2. **UI/UX** — Usability issues, accessibility gaps, design inconsistencies
3. **Performance/Structural** — N+1 queries, tight coupling, scalability risks
4. **Refactoring** — Complex/duplicated code, poor naming, missing abstractions
5. **Incomplete Features (FEAT-INC-*)** — Partially implemented features, missing edge paths
6. **New Features (FEAT-NEW-*, aim 2-3)** — Only after documenting FEAT-INC items
7. **Missing Documentation (DOC-*)** — Technical, user-facing, PRDs, and operational docs

## Phase 1d: Additional Tasks

Propose **5-7** context-specific analysis or hardening tasks (TASK-*): security audit, test coverage analysis, dependency audit, accessibility review, etc.

## Phase 2: Summary & Plan

### Detailed Report Structure

1. **Executive Summary** (3-7 bullets: health, risks, opportunities)
2. **Project Context Recap** (from Phase 0)
3. **Design System Summary** (from Phase 0.5)
4. **Tech Stack Overview** (from Phase 1a/1b)
5. **Findings by Category** (from Phase 1c, ordered by severity)
6. **Additional Tasks** (from Phase 1d)
7. **Implementation Roadmap** organized into waves:
   - Wave 1: Critical bugs, security, blocking UX, highest-impact FEAT-INC completions
   - Wave 2: Core refactors, remaining FEAT-INC, feature PRDs
   - Wave 3: FEAT-NEW features, polish, remaining documentation

### Master Summary Table

| ID  | Category | Title | Severity | Effort | Status | Location | Impact | Notes |
| --- | -------- | ----- | -------- | ------ | ------ | -------- | ------ | ----- |

### Confirmation

Ask the user:
- Whether to modify priorities or add constraints
- Which items to implement in Phase 3
- Whether FEAT-INC should be prioritized over FEAT-NEW

**Do not start Phase 3 until confirmed.**

## Phase 3: Implementation

After user confirms:
1. Implement POC-level changes for highest-impact approved items (up to 5-7)
2. Provide concrete code snippets or diffs
3. Include TODO comments where production handling is needed
4. For UI changes, follow the design system from Phase 0.5
5. For features, reference or create PRD outlines

## Phase 4: Documentation Enhancement

Propose updates to:
1. **README** — Purpose, features, tech stack, quick links
2. **Master PRD** — Vision, personas, feature map, success metrics
3. **Feature PRDs** — For key FEAT-INC and FEAT-NEW items
4. **Technical docs** — Architecture, best practices, API docs
5. **Operational docs** — Runbooks, deployment, troubleshooting

---

## Shared State (read before review, write after)

- **Read:** `AGENT_BACKLOG.md` (for existing items), `.claude/state/orchestrator.json` (for project context)
- **Append to:** `.claude/state/events.log` — **ALLOWED EXCEPTION**: Appending newline-terminated, atomic entries to `.claude/state/events.log` is explicitly permitted as the only direct-write exception to the "do NOT mutate state directly" rule.
  - **Lock protocol:** Before acquiring `orchestrator.lock`, check if `.claude/state/orchestrator.lock` exists and, if present, read its owner (PID or owner identifier) or `.claude/state/orchestrator.json` for `{"active": true}`. If either indicates the orchestrator owns the lock, do not acquire `orchestrator.lock`; use `events.log.lock` only. Otherwise, acquire `events.log.lock` (or `orchestrator.lock` when orchestrator is not active) before appending. Timeout: 5s; use exponential backoff retries. Locks are advisory but must be respected by all agents. `events.log.lock` is the primary lock; OS-level flock/fcntl are optional fallback layers for defense-in-depth (not both required).
  - **Schema:** Each append must be a single-line JSON object (newline-terminated) with minimum schema: `{"timestamp":"<RFC3339>","event_type":"string","data":{}}`. Timestamp must be RFC3339/ISO8601 in UTC with millisecond precision and trailing 'Z' (e.g. `2023-01-01T12:34:56.789Z`).
  - **Large payloads:** If payload exceeds 10KB (10,240 bytes) or 10,000 characters, split into multiple atomic entries or store in a per-event file. Per-event files: naming `event-<UUID>.json`; default directory `./event_payloads` or `PAYLOAD_DIR` env. Surface path/filename in metadata entry.
  - **Retention:** Default TTL 30 days, max total size 100MB. Periodic pruning daily performed by the orchestrator's RetentionManager scheduled task (configurable in orchestrator settings).
  - **`/sync-backlog`:** Single-authority command for AGENT_BACKLOG.md updates. Best-effort optimistic locking with retries on conflict. On concurrent modification: retry/backoff and emit a synchronized event to events.log.
- **Do NOT** acquire `.claude/state/orchestrator.lock` when the orchestrator owns it. Commands must not mutate other state files directly unless explicitly documented.
- **Backlog changes:** Must use `/sync-backlog` command instead of direct `AGENT_BACKLOG.md` edits to avoid race conditions with the orchestrator.

## Output Format

Emit two required outputs:

1. **stdout (minimal):** Single-line JSON containing the canonical "orchestrator_state" (action, phase, findings). The **runner** is the process that reads stdout to capture orchestrator state for upstream coordination.
2. **events.log (envelope):** Append a full JSON envelope with metadata. Required metadata fields: `timestamp`, `event_type`, `command_id`, `user`, `execution_time` (integer, milliseconds), `data`. The minimal stdout payload maps into the `data` field.

**Example 1 — stdout (one-line minimal):**
```json
{"action":"project_review_completed","phase":"review","findings":{"bugs":0,"ux":0,"performance":0,"refactoring":0,"incomplete_features":0,"new_features":0,"documentation":0,"tasks":0}}
```

**Example 2 — events.log envelope:**
```json
{"timestamp":"2026-02-26T15:04:05.123Z","event_type":"project_review_completed","command_id":"review-abc123","user":"project-review","execution_time":45000,"data":{"action":"project_review_completed","phase":"review","findings":{"bugs":0,"ux":0,"performance":0,"refactoring":0,"incomplete_features":0,"new_features":0,"documentation":0,"tasks":0}}}
```
(Note: `execution_time` is in milliseconds; 45000 = 45 seconds.)
