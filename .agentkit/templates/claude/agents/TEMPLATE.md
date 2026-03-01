<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown agent persona definition. -->
<!-- Docs: https://docs.anthropic.com/en/docs/claude-code/memory -->
# {{agentName}}

## Role

{{agentRole}}

## Repository Context

{{#if stackLanguages}}- **Tech stack:** {{stackLanguages}}{{/if}}
{{#if stackFrontendFrameworks}}- **Frontend:** {{stackFrontendFrameworks}}{{/if}}
{{#if stackBackendFrameworks}}- **Backend:** {{stackBackendFrameworks}}{{/if}}
{{#if stackDatabase}}- **Database:** {{stackDatabase}}{{/if}}
{{#if architecturePattern}}- **Architecture:** {{architecturePattern}}{{/if}}
{{#if defaultBranch}}- **Default branch:** {{defaultBranch}}{{/if}}

Always scan the codebase within your focus area (the repo folders and modules you're assigned or listed under 'Focus Areas') before making changes.

## Shared State

- **`AGENT_BACKLOG.md`** — Read for existing items; update when completing or
  adding tasks in your scope.
- **`AGENT_TEAMS.md`** — Read for team boundaries and ownership.
- **`.claude/state/events.log`** — Append findings and significant work updates.
- **`.claude/state/orchestrator.json`** — Read for project context; update your
  team status entry after meaningful progress.
- **Do NOT** acquire `.claude/state/orchestrator.lock` — use the orchestrator
  API (e.g., `/orchestrate` endpoint or orchestrator-owned helper) to perform
  writes or request a lock. The orchestrator owns the lock exclusively.

### Concurrency Controls

Shared files are accessed by multiple agents. To prevent race conditions:

1. **Per-resource file locks**: Use `.lock` files with atomic file creation (O_EXCL or equivalent) for writes
2. **Orchestrator-mediated updates**: For critical state changes, route through orchestrator API
3. **Append-only operations**: Use line-based newline-terminated appends for events.log
4. **Lock ownership**: orchestrator.lock remains solely owned by the orchestrator

**Lock Acquisition Protocol:**
- Attempt atomic creation of `.lock` file with a 30s total timeout. The 30s is
  a hard ceiling that includes all retries, exponential backoff delays (initial
  1s, then 2s, then 4s), and the time spent in each creation attempt. Up to 3
  retries within that 30s window. If creation fails, retry with that backoff.
- **Stale-lock takeover:**
  - **(A) flock+conditional-unlink:** Open the canonical lock path to get `fd`, immediately acquire `flock(fd)`, then perform `stat(path)` and `fstat(fd)` and compare device/inode to ensure the fd still refers to the canonical path (if mismatch, abort/backoff). Only after identity matches, check `expiresAt` on the file contents to determine staleness. If stale: truncate+write new lock contents to the same fd (preferred) or, if you must unlink, perform the unlink only after the identity check and with the flock still held, then write the new lock and release flock. Reference `flock`, `stat`, `fstat`, `fd`, `path`, `unlink`, and `expiresAt` in that order.
  - **(B) rename-based replacement:** First read and verify the canonical lock is stale (use existing read/flock logic if present). Create a uniquely-named temp (e.g., `temp.*`), write the new lock data to that temp, and finally atomically rename the temp to `canonical.lock` to replace it. Do not rename the canonical stale lock to temp first — use atomic rename temp → canonical for the actual replacement to avoid overwriting another agent's freshly-created lock.
  - Prefer (A) on POSIX; use (B) on platforms without flock.
- Always release locks in a finally block
- On repeated failure, escalate to orchestrator via `/orchestrate` endpoint

**Special Cases:**
- `orchestrator.lock` remains exclusively owned by orchestrator
- Append-only `events.log` writes:
  - Guarantee applies only to local POSIX filesystems; relies on O_APPEND and newline-terminated line-based writes.
  - PIPE_BUF is a pipe/FIFO atomicity guarantee and does not apply to regular files. O_APPEND atomicity for regular files is different and may depend on the filesystem and kernel. Platform- and filesystem-dependent atomicity limits apply to write size.
  - NFS/SMB/distributed stores may not guarantee atomic appends.
  - When filesystem type is uncertain or `.claude/state/` may be network-mounted, use the orchestrator API to append (do NOT acquire `orchestrator.lock` directly — route through `/orchestrate` or orchestrator-owned helper) to avoid interleaved writes.

- **Append-only vs lock pattern:** Append-only operations to `events.log` are coordinated and do not require the Acquire lock → modify → release lock in finally pattern. Non-append writes or modifications to shared mutable state must use that pattern.

Protocol: Acquire lock → modify → release lock in finally. Never write directly without coordination.

## Category

{{agentCategory}}

## Focus Areas

{{agentFocusList}}

## Responsibilities

{{agentResponsibilitiesList}}

## Preferred Tools

{{agentToolsList}}

{{#if agentDomainRules}}

## Domain Rules

{{agentDomainRules}}
{{/if}}

{{#if agentConventions}}

## Conventions

{{agentConventions}}
{{/if}}

{{#if agentExamples}}

## Examples

{{agentExamples}}
{{/if}}

{{#if agentAntiPatterns}}

## Anti-Patterns

{{agentAntiPatterns}}
{{/if}}

## Guidelines

- Follow all project coding standards and domain rules in `AGENTS.md` and `QUALITY_GATES.md`
- Coordinate with other agents through the orchestrator; use `/orchestrate` for cross-team work
- Document decisions and rationale in comments or ADRs
- Escalate blockers to the orchestrator immediately
- Update team progress in `.claude/state/orchestrator.json` after completing significant work
- See `COMMAND_GUIDE.md` for when to use `/plan`, `/project-review`, or `/orchestrate`
