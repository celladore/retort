# AgentKit Forge Security Model

This document describes the security controls built into AgentKit Forge to protect
against threats arising from AI-driven code generation, automated command execution,
and multi-agent orchestration workflows.

## 1. Threat Model Overview

AgentKit Forge operates in an environment where AI agents issue shell commands, write
files, and modify project state with limited human supervision. The primary threats are:

- **Shell injection** -- Malicious or malformed commands from spec files or template
  variables that exploit shell metacharacters to execute unintended operations.
- **Path traversal** -- Rendered templates or user-supplied file paths that escape the
  project root to overwrite system files or read sensitive data.
- **Secret exposure** -- Credentials, API keys, or private keys accidentally committed
  to version control through generated output or changed files.
- **Destructive operations** -- Force-pushes, recursive deletes, database drops, or
  infrastructure teardown commands executed without confirmation.
- **Session conflicts** -- Concurrent orchestrator sessions corrupting shared state files.
- **Supply chain poisoning** -- Malformed YAML spec files injecting invalid commands or
  referencing nonexistent tools, leading to undefined behavior at runtime.

## 2. Shell Injection Prevention

All external command execution flows through `runner.mjs`, which uses two layers of
defense:

**Argument-array execution.** Commands are parsed into `[executable, ...args]` by
`parseCommand()` and passed to `spawnSync` as an argument array rather than a shell
string. On non-Windows platforms, `shell` is set to `false`, so metacharacters in
arguments have no special meaning.

```js
// runner.mjs -- spawnSync with argument array, shell disabled on non-Windows
const [executable, ...args] = parseCommand(cmd);
spawnSync(executable, args, { shell: process.platform === 'win32' });
```

**Command validation.** The `isValidCommand()` function rejects any command string
containing shell metacharacters (`$ \` | ; & < > ( ) { } !  \`). Every command sourced
from YAML spec files (formatter, linter, typecheck, test, build) is validated through
`isValidCommand()` before execution in `check.mjs`. Commands that fail validation are
skipped with a warning.

```js
// runner.mjs
export function isValidCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  return !/[$`|;&<>(){}!\\]/.test(cmd);
}
```

**Range parameter validation.** In `review-runner.mjs`, git commit range arguments
passed via `--range` are validated against a strict regex to prevent injection through
user-supplied flags:

```js
if (!/^[a-zA-Z0-9._\-/:^~]+(?:\.{2,3}[a-zA-Z0-9._\-/:^~]+)?$/.test(flags.range)) {
  throw new Error(`Invalid --range value: ${flags.range}`);
}
```

## 3. Path Traversal Protection

**Sync output confinement.** During `synchronize.mjs`, all rendered templates are first written
to a temporary directory, then copied to the project root. Before each copy, the
resolved destination path is checked against the project root boundary:

```js
const resolvedRoot = resolve(projectRoot) + sep;
if (!resolve(destFile).startsWith(resolvedRoot) && resolve(destFile) !== resolve(projectRoot)) {
  console.error(`[agentkit:sync] BLOCKED: path traversal detected -- ${relPath}`);
  continue;
}
```

Any template that resolves to a path outside the project root is blocked and logged.

**Review file confinement.** In `review-runner.mjs`, the `--file` flag is resolved
against the project root and rejected if it escapes:

```js
const abs = resolve(projectRoot, flags.file);
if (!abs.startsWith(resolve(projectRoot) + sep) && abs !== resolve(projectRoot)) {
  throw new Error(`--file must be within the project root: ${flags.file}`);
}
```

## 4. Secret Scanning

The review runner (`review-runner.mjs`) scans changed files against a set of high-signal
secret patterns:

| Pattern Name      | Detection Regex                                                 |
| ----------------- | --------------------------------------------------------------- |
| AWS Key           | `AKIA[0-9A-Z]{16}`                                              |
| Private Key       | `-----BEGIN (RSA \| EC \| DSA )?PRIVATE KEY-----`             |
| Generic Secret    | `(password \| secret \| api_key \| apikey \| token)\s*[:=]\s*'...'` |
| Connection String | `mongodb(+srv)?://...`                                          |
| JWT               | `eyJ...` (three Base64url segments)                             |

The validate command (`validate.mjs`) performs an additional scan of all generated
output directories, adding patterns for GitHub tokens (`ghp_`), OpenAI/Anthropic keys
(`sk-`), and AWS access keys. It strips code blocks and inline code before scanning
to reduce false positives from documentation examples.

Any HIGH-severity finding (secret detection) causes the review to return a FAIL status,
blocking the quality gate.

## 5. Hook-Based Guardrails

AgentKit Forge ships five lifecycle hooks that act as runtime guardrails within Claude
Code sessions. Each hook is provided in both Bash (`.sh`) and PowerShell (`.ps1`)
variants.

### protect-sensitive (PreToolUse -- Write|Edit)

Blocks file writes to sensitive paths before they execute. Matched patterns include:

- `.env`, `.env.*` files
- `.tfvars` files
- Paths containing `secrets`, `credential`, `private_key`, `id_rsa`
- `.pem` files

When a match is found, the hook returns a `permissionDecision: "deny"` response,
preventing the write.

### guard-destructive-commands (PreToolUse -- Bash)

Blocks destructive shell commands before execution. Two categories of patterns are
checked:

- **Fixed strings**: `rm -rf /`, `rm -rf ~`, `git push --force`, `git push -f`,
  `git reset --hard`, `terraform destroy`, `az group delete`, `gh repo delete`
- **Regex patterns**: `DROP TABLE`, `DROP DATABASE` (case-insensitive)

Blocked commands receive a `permissionDecision: "deny"` response with a reason
identifying the matched pattern.

### warn-uncommitted (PostToolUse -- Write|Edit)

After each file write or edit, counts uncommitted changes via `git status --porcelain`.
When the count exceeds the threshold (default: 10), it emits a `systemMessage` warning
prompting the user to commit their work.

### stop-build-check (Stop)

Runs before Claude ends a session. Auto-detects the project stack (Node.js, .NET, Rust,
Python) and runs lint, test, and build checks. If any check fails, the hook returns a
`decision: "block"` response so Claude can attempt to fix the issue before finishing.
Includes a re-entrancy guard: if `stop_hook_active` is already `true`, the hook allows
the stop to proceed, preventing infinite loops.

### session-start (SessionStart)

Detects installed toolchains and git status at session startup, providing Claude with
workspace context. Also writes a session-start event to the JSONL usage log for cost
tracking.

## 6. Template Sanitization

The `sanitizeTemplateValue()` function in `synchronize.mjs` strips shell metacharacters from
all string values before they are interpolated into templates:

```js
function sanitizeTemplateValue(value) {
  let s = value;
  s = s.replace(/\$\([^)]*\)/g, (m) => m.slice(2, -1));  // unwrap $(...) to inner content
  s = s.replace(/[`$\\;|&<>!{}]/g, '');
  return s;
}
```

This prevents injection when rendered output is later executed in a shell context
(for example, hook scripts or CI workflows). Shell substitution `$(...)` is unwrapped
to its inner content; other metacharacters (backticks, dollar signs, semicolons,
pipes, ampersands, angle brackets, exclamation marks, braces) are stripped.
Parentheses in non-injection context (e.g. "IO operations (file system, network, database)")
are preserved.

Template keys are sorted longest-first during rendering to prevent partial placeholder
collisions (for example, `{{versionInfo}}` being partially matched by `{{version}}`).

## 7. Lock File Security

The orchestrator (`orchestrator.mjs`) uses file-based session locking to prevent
concurrent sessions from corrupting shared state.

**Atomic creation.** Lock files are created with `writeFileSync` using the `wx` flag,
which fails atomically with `EEXIST` if the file already exists. This prevents race
conditions between competing sessions.

**Staleness detection.** Locks older than 30 minutes (`LOCK_STALE_MS = 30 * 60 * 1000`)
are considered stale and automatically reclaimed. This handles crashed sessions that
never released their lock.

**Corrupted lock recovery.** If the lock file exists but cannot be parsed as JSON, it is
deleted and a new lock is acquired. This handles partial writes from interrupted
processes.

**Manual override.** The `--force-unlock` flag allows users to clear a lock manually
when automatic staleness detection is insufficient. Force-unlock events are recorded in
the event log for auditability.

## 8. YAML Command Validation

The spec validator (`spec-validator.mjs`) validates all YAML configuration files before
they are used by the sync or check commands:

- **Schema validation**: Each spec file (teams, agents, commands, rules, settings) is
  validated against a lightweight schema that checks types, required fields, minimum
  lengths, and enum constraints.
- **Cross-reference validation**: Team commands must reference valid team IDs defined in
  `teams.yaml`. Agent IDs, team IDs, command names, and rule convention IDs are checked
  for uniqueness.
- **Tool allowlist**: Commands that declare `allowed-tools` are validated against a
  fixed list of known tools (`Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`,
  `WebSearch`, `WebFetch`). Unknown tool references produce errors.
- **Command type enforcement**: Command types must be one of `workflow`, `team`, or
  `utility`.

The `check.mjs` quality gate runner applies `isValidCommand()` to every command string
from tech stack definitions (formatter, linter, typecheck, testCommand, buildCommand)
before execution. Any command failing validation is skipped entirely.

## 9. Recommendations for Users

1. **Run `/check` and `/review` before every PR.** These commands enforce quality gates
   and scan for exposed secrets in changed files.

2. **Do not disable hooks.** The `protect-sensitive` and `guard-destructive-commands`
   hooks are critical safety nets. Removing them from `settings.json` eliminates
   runtime protection against accidental secret writes and destructive commands.

3. **Keep `.env` and credential files in `.gitignore`.** The secret scanner catches
   many patterns, but prevention through `.gitignore` is more reliable than detection
   after the fact.

4. **Validate specs after editing.** Run `pnpm -C agentkit agentkit:spec-validate`
   after modifying any YAML spec file. This catches schema errors and cross-reference
   problems before they propagate through sync.

5. **Pin dependency versions.** Use lockfiles (`pnpm-lock.yaml`, `Cargo.lock`,
   `poetry.lock`) and audit regularly with `npm audit`, `cargo audit`, or `pip-audit`.

6. **Review overlay settings.** When creating a new overlay in `.agentkit/overlays/`,
   review the merged permissions (allow/deny lists) to ensure the deny list covers
   sensitive operations for your project.

7. **Do not commit the lock file.** The orchestrator lock file
   (`.claude/state/orchestrator.lock`) is ephemeral and should not be committed. If a
   session crashes, use `--force-unlock` to clear it.

8. **Audit template variables.** When adding custom template variables to overlay
   `settings.yaml`, be aware that values are sanitized by stripping shell
   metacharacters. If your values require these characters, the sanitizer will remove
   them silently.
