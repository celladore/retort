# Branch Plan: docs/consolidate-pending-items

## Objective

Consolidate all scattered pending/upcoming work items into the `docs/planning/` registry. Currently work items are spread across 5+ locations: `plan.md`, `.agentkit/docs/ROADMAP.md`, `.agentkit/docs/FOLLOW_UP_ISSUES.md`, `AGENT_BACKLOG.md`, and various "Coming Soon"/"Incoming" markers throughout docs.

## Steps

### Step 1: Triage plan.md

Read `plan.md` (root, ~28 KB). Extract discrete proposals into individual planning items:

1. **CLI & Packaging Team (T11)** → `docs/planning/cli-packaging/cli-team-proposal.md`
   - ID: `CLI-001`, Priority: P1, Status: not-started
   - Scope: Add `cli` team to teams.yaml, `cli-engineer` agent to agents.yaml, generate /team-cli command

2. **Intake Agent + /intake Command** → `docs/planning/intake/intake-agent-proposal.md`
   - ID: `INT-001`, Priority: P2, Status: not-started
   - Scope: Add intake-analyst agent, /intake command, document extractors

3. **PRD Detector Bug** → `docs/planning/bugs/prd-detector-path.md`
   - ID: `BUG-001`, Priority: P0, Status: not-started
   - Scope: Add `docs/product` to detector dirs in discover.mjs:215

### Step 2: Archive plan.md

```bash
git mv plan.md docs/planning/archive/plan-cli-intake-proposal.md
```

Add reference in `docs/planning/archive/README.md`.

### Step 3: Scan for "Coming Soon" / "Incoming" markers

Files to check:
- `.agentkit/docs/QUICK_START.md` — "Coming Soon" command table
- `.agentkit/docs/COMMAND_REFERENCE.md` — "Incoming Commands" section
- `.agentkit/docs/AGENTS_REFERENCE.md` — "Incoming Agents" section
- `.agentkit/docs/AGENTS_VS_TEAMS.md` — "Incoming Agents" section
- `.agentkit/docs/WORKFLOWS.md` — "(Incoming)" workflow scenarios
- `.agentkit/docs/ROADMAP.md` — future work items
- `.agentkit/docs/FOLLOW_UP_ISSUES.md` — tracked follow-ups

For each item found:
- If already in planning index → add cross-reference
- If new → create planning item with appropriate ID and category

### Step 4: Update planning index

Update `docs/planning/README.md` with new categories:

```markdown
## CLI & Packaging
| CLI-001 | CLI & Packaging Team (T11) + cli-engineer agent | P1 | not-started | ... |

## Intake & Automation
| INT-001 | Intake Agent + /intake command | P2 | not-started | ... |

## Bugs
| BUG-001 | PRD detector path bug (discover.mjs) | P0 | not-started | ... |
```

Update dependency graph to include new items.

### Step 5: Cross-reference existing items

Ensure all items from ROADMAP.md and FOLLOW_UP_ISSUES.md that aren't already in the planning index are either:
- Added as new planning items
- Marked as duplicates of existing items
- Noted as out-of-scope with reasoning

## Files to Create

- `docs/planning/cli-packaging/cli-team-proposal.md`
- `docs/planning/intake/intake-agent-proposal.md`
- `docs/planning/bugs/prd-detector-path.md`

## Files to Modify

- `docs/planning/README.md` — add 3+ new categories
- `docs/planning/archive/README.md` — add plan.md entry

## Files to Move

- `plan.md` → `docs/planning/archive/plan-cli-intake-proposal.md`

## Verification

```bash
test ! -f plan.md  # plan.md no longer at root
grep -c "not-started\|partial\|blocked" docs/planning/README.md  # all items have valid status
```
