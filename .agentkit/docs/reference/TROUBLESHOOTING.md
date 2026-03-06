# Troubleshooting

Consolidated FAQ and error guide for agentkit-forge.

## Setup Errors

### "node: command not found"

Node.js is not installed or not on your PATH.

**Fix:** Install Node.js 22.x or later (recommend 22.x LTS or 24.x LTS for longer support). Verify with:

```bash
node --version
```

If you installed Node.js via a version manager (nvm, fnm), make sure it is activated in your current shell session.

### "Cannot find module 'js-yaml'"

Dependencies have not been installed. The CLI now auto-installs on first run; if you still see this error, the auto-install may have failed.

**Fix:** Run the package install from the .agentkit directory:

```bash
pnpm -C .agentkit install
```

If `pnpm` is not installed, install it first:

```bash
npm install -g pnpm
```

### Submodule Issues

If agentkit is included as a git submodule and files are missing or empty:

**Fix:**

```bash
git submodule update --init --recursive
```

This fetches all submodule content and checks out the correct commits.

## Sync Errors

### "No overlay found"

You ran `agentkit sync` before initializing your project overlay.

**Fix:** Run init first to create your project overlay from the template:

```bash
agentkit init
```

This copies the `__TEMPLATE__` overlay to `.agentkit/overlays/<your-repo-name>/` and then syncs.

### Template Rendering Failures

Template rendering failed during sync, typically due to malformed YAML in your overlay.

**Fix:**

1. Check the YAML syntax in your overlay files. Common issues include incorrect indentation, missing colons, and unquoted special characters.
2. Run the spec validator to identify the problem:
   ```bash
   agentkit spec-validate
   ```
3. Fix the reported issues and re-run `agentkit sync`.

## Runtime Errors

### Lock Stuck

The orchestrator refuses to start because a lock file exists from a previous session.

**Fix:**

```bash
node .agentkit/engines/node/src/cli.mjs orchestrate --force-unlock
```

Locks are normally auto-cleared after 30 minutes of inactivity. If you see this error within that window, the previous session may have crashed without releasing the lock. The `--force-unlock` flag is safe to use and only removes the lock file.

### State Corruption

The orchestrator fails to start or behaves unexpectedly because the state file contains invalid data.

**Fix:**

1. Delete the corrupted state file:
   ```bash
   rm .claude/state/orchestrator.json
   ```
2. Re-run `/orchestrate` to begin a fresh orchestration session.

The events log (`.claude/state/events.log`) is not affected by this operation and retains the full history of past actions.

### Hook Failures

Hooks are configured but not executing, or they fail with permission errors.

**Fix:** Ensure hook files are executable:

```bash
chmod +x .claude/hooks/*.sh
```

Also verify that the hook scripts have valid shebang lines (e.g., `#!/bin/bash` or `#!/usr/bin/env bash`) at the top of each file.

### "stop_hook_active" Loops

You see repeated `stop_hook_active` messages in logs or output.

**Explanation:** This is not an error. The stop hook includes a guard to prevent recursive invocation. If the stop hook is already running and something triggers it again, the guard catches this and prevents an infinite loop. No action is needed.

## AI Tool Integration

### Commands Not Found

Slash commands defined in your overlay are not available in Claude Code.

**Fix:** Run sync to regenerate the command files from your spec and overlay:

```bash
agentkit sync
```

This writes command files to `.claude/commands/` where Claude Code reads them from.

### Hooks Not Running

Hooks are configured in your overlay but Claude Code is not executing them.

**Fix:** Verify that `.claude/settings.json` contains the correct hook paths. After changing hook configuration in your overlay, you must run `agentkit sync` to regenerate `settings.json`:

```bash
agentkit sync
```

Then inspect the generated file:

```bash
cat .claude/settings.json
```

Confirm the `hooks` section points to the correct file paths.

### Wrong Permissions

Agents are running commands they should not, or are blocked from commands they need.

**Fix:** Check the `settings.yaml` in your overlay for the allow and deny lists:

```
.agentkit/overlays/<repoName>/settings.yaml
```

Remember that **deny wins** -- if a command pattern appears in both `allow` and `deny`, it will be denied. After making changes, run `agentkit sync` to apply them.

## Recovery Procedures

### Full Reset

If the orchestrator is in an unrecoverable state and you need to start completely fresh:

```bash
rm -rf .claude/state/
```

Then re-run `/orchestrate` to initialize a new state directory and begin from Phase 1 (Discovery).

This removes all state, events, and lock files. Handoff documents in `docs/ai_handoffs/` are not affected.

### Partial Reset

If you only need to reset the orchestrator phase tracking but want to preserve the events log:

```bash
rm .claude/state/orchestrator.json
```

The next `/orchestrate` run will create a fresh state file and resume from Phase 1, but the events log will continue to accumulate entries from the new session.
