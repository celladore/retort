---
name: end-session
description: Mandatory session exit protocol for all agents before concluding work or notifying the user. Mirrors traces, persists history, verifies changes, and outputs a structured summary.
---

# End-Session Protocol

Before concluding work or calling `notify_user`, all agents should follow these steps.

## 1. Change Summary

Output a structured summary of all changes made:

- **Files modified** — include `+/-` line counts where available
- **External effects** — memories, MCP/tool calls, git operations, other side effects
- **Categorized by type** — code, config, docs, external

## 2. Trace Mirroring

Identify any high-complexity findings, investigations, or gotchas discovered during the session.

- Create a trace file in `.agents/traces/YYYY-MM-DD-context.md`
- Include:
  - what was found
  - why it matters
  - what to watch for next
- Follow the trace standard defined in `.agents/skills/trace-standard/SKILL.md` when applicable

## 3. History Persistence

Update the current conversation's history in the neutral hub.

Mirror session context to `.agents/history/{conversation_id}/`:

- `task.md` — what the task was, what was accomplished
- `walkthrough.md` — important execution notes, decisions, and flow
- links to any traces, roadmap updates, or related artifacts

Ensure history artifacts reference the current repository state and file paths.

## 4. Handoff Notes

If work is incomplete or follow-up is needed:

- Write to `$HOME/repos/.todo/handoffs/YYYY-MM-DD-topic.md` (or `$HANDOFF_DIR/YYYY-MM-DD-topic.md` if set)
- Include:
  - what happened
  - what is next
  - watch-outs
  - relevant memory/context pointers

## 5. Verification & Cleanup

If code or configuration was changed:

- Run `dotnet build` or equivalent verification commands
- Run relevant tests/build checks
- Check for and fix any lint errors introduced
- Delete temporary `.tmp`, scratch scripts, or other transient files

## 6. Structured Notification

Call `notify_user` with:

- a clear **Achievements** list
- a concise **Change Summary**
- **Next steps** for the next agent/session, if applicable
- links to modified files, traces, handoff notes, and history artifacts

## 7. Outstanding Work Review

Before closing, surface any open threads to avoid losing context:

- Check `~/.roadmaps/` for active roadmap files — list any with outstanding high-priority tasks
- List any open TODOs or blockers discovered this session
- Reference active branches (`git branch --list`) that are not yet merged
- If `.agents/tasks/` exists, list unresolved task entries

Format:

```
**Open Roadmaps:** [repo] → [highest-priority next action]
**Unmerged Branches:** [list]
**Blockers:** [list or "none"]
```

## 8. User Recommendations

Surface 2–3 personalized recommendations for the user based on this session's work.
Draw from:

- Patterns of friction observed (repeated manual steps, missed automation)
- Tool/agent capabilities the user did not use but would benefit from
- LLM workflow improvements (prompt structure, context management, etc.)

Format each as a "Tip" with context:

```
**Tip [N]: [title]**
> [one-sentence context — why this matters for them specifically]
> Try: [concrete action or command]
```

Standard tips to consider:

- `/dispatching-parallel-agents` skill for multi-repo work
- `/subagent-driven-development` for structured autonomous execution
- `/writing-plans` + `/executing-plans` pair for large tasks
- Using worktrees (`feat/` branches) to prevent cross-session interference
- Running `validate-agent-infra.sh` after any `.agents/` changes

## 9. Did You Know (One Interesting Tidbit)

Each session, surface one non-obvious fact about a part of the repo or ecosystem
the user was NOT directly involved in this session. Purpose: build the user's mental
model of the full workspace over time.

Select from:

- An architectural detail from another repo in `~/repos/`
- An unused feature or capability in the current repo
- A dependency or integration the user may not be aware of
- A noteworthy pattern from the agent history/traces

Format:

```
**Did you know?** [one striking sentence]
[1–2 sentences of useful context. Why it matters or how it connects to their work.]
**Explore:** [specific file or command to learn more]
```

## 10. Session Startup Reminder

At the end of every session, remind the user:

> **Next session:** Run the `session-startup` skill at the beginning to get
> contextual guidance, recent history, and your current roadmap status.
> Reference: `.agents/skills/session-startup/SKILL.yaml`

## 11. Sync Companion Markdown Files

> **Subagents skip this step.** Only the root/primary agent runs step 11.

For each `.yaml` file in `.agents/` that was touched this session:

1. Check the `must_sync` field
2. If `must_sync: true` — verify the `.md` companion reflects the current YAML state
3. If structural content changed (new fields, removed sections, renamed steps), update the `.md`
4. Minor wording drift in `.md` is acceptable and can wait; structural changes are not

Reference: `.agents/SYNC.md`
