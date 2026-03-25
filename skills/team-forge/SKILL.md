---
name: team-forge
description: >
  This skill should be used when the user asks to "create a new agent team", "design a team spec",
  "add a team to retort", "scaffold a new agent team", "define a new team", or "forge a team".
  Guides design of a new agent team spec through a 6-persona pipeline: clarification, mission,
  roles, prompts, command design, and validation. Context-aware: works in retort repos (writes to
  .agentkit/spec/) and non-retort repos (produces standalone markdown specs).
version: 0.1.0
---

# Team Forge

Guided pipeline for designing new agent team specifications. Executes 6 sequential personas to
produce a complete, validated team definition. Works in retort repos and non-retort repos alike.

## Step 0: Detect Context

Before starting, check two things silently:

**Repo type:**

- `.agentkit/spec/` exists → **retort repo** — output targets `agents.yaml`, `teams.yaml`, `commands.yaml`
- Not found → **standalone repo** — output is a portable markdown spec in `docs/agents/` or similar

**Platform target** — ask the user explicitly:

> "Which AI platform(s) should this team target?
> (a) Claude Code only
> (b) Cursor only
> (c) Windsurf only
> (d) GitHub Copilot only
> (e) All platforms retort supports
> (f) Just the spec — I'll wire it up myself"

Store the answer. It affects Step 5 (Flow Designer).

---

## Step 1: Input Clarifier

**Goal:** Understand the request before designing anything. Ask:

1. What is the team's primary responsibility? (one sentence)
2. What files/paths will it own? (globs)
3. Are there existing teams that overlap with this scope? (read `AGENT_TEAMS.md` or `teams.yaml` if available)
4. What triggers this team? (explicit command, orchestrator delegation, or both)
5. Any known anti-patterns or things this team must never do?

If any answer is unclear, probe once. Don't proceed to Step 2 until the scope is unambiguous.

**Output:** A one-paragraph summary of the validated request.

---

## Step 2: Mission Definer

**Goal:** Lock the team's mission, scope, and delegation contract.

Produce:

```yaml
# teams.yaml entry
- id: <team-id> # kebab-case, unique
  name: <Display Name>
  mission: >
    <One sentence mission statement. Verb-first. E.g. "Manages X to ensure Y.">
  scope:
    - '<glob pattern>'
  accepts: # task types this team accepts from orchestrator
    - implement
    - review
    - plan
  handoff-chain: # default downstream teams after completion
    - quality
  max-task-turns: 15
  max-handoff-chain-depth: 7
```

Validate: no scope overlap with existing teams. If overlap found, flag it and propose resolution
before continuing.

---

## Step 3: Role Architect

**Goal:** Design the individual agent personas within the team.

For each agent (aim for 2–5 per team):

```yaml
# agents.yaml entry
- id: <agent-id>
  category: <team-id>
  name: <Agent Display Name>
  role: >
    <One paragraph. What this agent does, what decisions it owns.>
  focus:
    - '<glob>'
  responsibilities:
    - <Concrete responsibility, verb-first>
  accepts: [implement, review, plan] # subset of team's accepted types
  depends-on: []
  notifies: []
```

Each agent should own a distinct slice of the team's scope. Avoid overlap between agents in the
same team.

---

## Step 4: Prompt Engineer

**Goal:** Write the behavioural content for each agent — the parts that make prompts effective.

For each agent defined in Step 3, add:

```yaml
domain-rules:
  - 'Follow <rule-set> domain rules [<rule-ids>] — <plain English enforcement>'
conventions:
  - <One concrete coding/behaviour convention>
anti-patterns:
  - <One thing this agent must never do>
examples:
  - title: <Scenario name>
    description: <What the agent should do in this scenario>
```

Quality bar: each domain-rule must reference an existing rule ID from `rules.yaml` (or flag that a
new rule is needed). Each anti-pattern must be observable — something that could be detected in a
code review or output review.

---

## Step 5: Flow Designer

**Goal:** Design the team command and platform-specific output files.

### Command Definition

```yaml
# commands.yaml entry
- name: team-<team-id>
  type: team
  description: >
    <What this command does. First sentence is shown in /help.>
  flags:
    - name: assess-only
      description: Report findings without making changes
```

### Platform-Specific Output

Generate files based on the platform answer from Step 0:

| Platform       | File location                             | Format                                |
| -------------- | ----------------------------------------- | ------------------------------------- |
| Claude Code    | `.claude/commands/team-<id>.md`           | YAML frontmatter + Markdown           |
| Cursor         | `.cursor/rules/team-<id>.mdc`             | MDC format with frontmatter           |
| Windsurf       | `.windsurf/rules/team-<id>.md`            | Markdown rules file                   |
| GitHub Copilot | `.github/chatmodes/team-<id>.chatmode.md` | Chatmode format                       |
| All            | All of the above                          | Run retort sync after spec is written |

**For Claude Code output** — each command file must include:

- `allowed-tools` frontmatter listing only tools the team actually needs
- Clear scope statement at top
- The 5 workflow steps (Check Queue → Identify Work → Make Changes → Add Tests → Quality Gate)
- Output format section
- No distributed-systems locking machinery — the task protocol handles coordination

**For retort repos:** write the spec to `.agentkit/spec/` and remind the user to run:

```bash
pnpm -C .agentkit agentkit:sync
```

**For non-retort repos:** write the command file(s) directly to the target platform paths.

---

## Step 6: Team Validator

**Goal:** Quality gate before handing off.

Check:

- [ ] `team-id` is unique across `teams.yaml` (or existing team definitions)
- [ ] All agent `focus` globs are non-overlapping with other teams
- [ ] Every `depends-on` reference points to a real agent ID
- [ ] Every `notifies` reference points to a real agent ID
- [ ] `handoff-chain` teams all exist
- [ ] Command name matches `team-<team-id>` convention
- [ ] At least one agent per team
- [ ] No agent has empty `responsibilities`
- [ ] Platform output files match the Step 0 platform selection

Report: list each check as PASS/FAIL. Block on any FAIL — do not write files until all pass.

---

## Output

After all steps complete:

```
## Team Forge Report

**Team:** <team-id> — <Display Name>
**Target platform(s):** <from Step 0>
**Repo type:** retort | standalone

### Files to Write
- <path>: <purpose>

### Validation
- All checks: PASS / <N failures listed>

### Next Steps
- [ ] Review spec with user
- [ ] Run `pnpm -C .agentkit agentkit:sync` (retort repos only)
- [ ] Test command with `/team-<id>`
```
