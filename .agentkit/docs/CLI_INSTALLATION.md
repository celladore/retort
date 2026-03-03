# AgentKit Forge -- CLI Installation Guide

> How to install, configure, and run the AgentKit Forge CLI on any platform.

---

## Prerequisites

| Requirement | Minimum Version     | Check Command    |
| ----------- | ------------------- | ---------------- |
| Node.js     | 22.x LTS (>=22.0.0) | `node --version` |
| pnpm        | 9+                  | `pnpm --version` |
| Git         | 2.30+               | `git --version`  |

> **Azure compatibility:** Azure Functions 4.x and Azure Static Web Apps support Node 22. See [Node.js release schedule](https://nodejs.org/en/about/releases/) and [Azure Functions supported versions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions).

If you do not have pnpm installed, install it globally:

```bash
npm install -g pnpm
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/agentkit-forge.git
cd agentkit-forge
```

Or, if adding AgentKit Forge to an existing project, see the
[Adoption Guide for Existing Repos](../../README.md#adoption-guide-existing-repos).

### 2. Install runtime dependencies

```bash
pnpm -C .agentkit install
```

This installs the Node.js dependencies (including `js-yaml`) required by the
sync engine. The `-C .agentkit` flag tells pnpm to run inside the `.agentkit/`
directory.

### 3. Verify the installation

```bash
node .agentkit/engines/node/src/cli.mjs --help
```

You should see the AgentKit Forge version banner and a list of available
commands.

---

## Running Commands

### Canonical invocation

All CLI commands follow this pattern:

```bash
node .agentkit/engines/node/src/cli.mjs <command> [options]
```

### Using package.json scripts

Several commands have shorthand scripts defined in `.agentkit/package.json`:

```bash
pnpm -C .agentkit agentkit:sync           # equivalent to: cli.mjs sync
pnpm -C .agentkit agentkit:init           # equivalent to: cli.mjs init
pnpm -C .agentkit agentkit:validate       # equivalent to: cli.mjs validate
pnpm -C .agentkit agentkit:discover       # equivalent to: cli.mjs discover
pnpm -C .agentkit agentkit:spec-validate  # equivalent to: cli.mjs spec-validate
```

### Flag syntax

Both of these forms are supported for all flags:

```bash
node .agentkit/engines/node/src/cli.mjs init --repoName my-project
node .agentkit/engines/node/src/cli.mjs init --repoName=my-project
```

Boolean flags do not require a value:

```bash
node .agentkit/engines/node/src/cli.mjs check --fix --fast
```

### Debug mode

Set the `DEBUG` environment variable to see full stack traces on errors:

```bash
DEBUG=1 node .agentkit/engines/node/src/cli.mjs sync
```

---

## Available Commands

### Setup Commands

| Command         | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `init`          | Initialize a repo overlay from the template       |
| `sync`          | Render all AI tool configs from spec and overlay  |
| `validate`      | Validate generated outputs for correctness        |
| `spec-validate` | Validate YAML spec files against the schema       |
| `discover`      | Scan the repo to detect tech stacks and structure |

**Sync flags:** `--overlay <name>`, `--only <targets>`, `--dry-run`, `--overwrite` (or `--force`), `-q`/`--quiet`, `-v`/`--verbose`, `--no-clean`, `--diff`. By default, project-owned files (`docs/`, `.vscode/`, `CONTRIBUTING.md`, etc.) are written only on first sync; use `--overwrite` to regenerate them. Use `--quiet` for CI, `--verbose` to list each file, `--no-clean` to keep orphaned files, and `--diff` to preview changes.

### Workflow Commands

| Command       | Purpose                                             |
| ------------- | --------------------------------------------------- |
| `orchestrate` | Multi-team coordination with state persistence      |
| `plan`        | Structured implementation planning                  |
| `check`       | Run quality gates (format, lint, typecheck, test)   |
| `review`      | Automated code review (secrets, large files, TODOs) |
| `handoff`     | Generate a session handoff document                 |
| `healthcheck` | Pre-flight validation of repo health                |

### Utility Commands

| Command | Purpose                         |
| ------- | ------------------------------- |
| `cost`  | Session cost and usage tracking |

### Tool Management

| Command  | Purpose                                      |
| -------- | -------------------------------------------- |
| `add`    | Enable one or more render targets/tools      |
| `remove` | Disable tools (`--clean` also removes files) |
| `list`   | Show enabled and available tools             |

### Task Delegation

| Command    | Purpose                                       |
| ---------- | --------------------------------------------- |
| `tasks`    | List and inspect delegated task state         |
| `delegate` | Create a delegated task for one or more teams |

### Diagnostics

| Command  | Purpose                                      |
| -------- | -------------------------------------------- |
| `doctor` | Run diagnostics and setup consistency checks |

### Slash-command-only

Slash commands are single-line commands invoked in chat or IDE chat inputs (e.g., `/project-review` in Claude Code, Cursor, or Windsurf). They work in chat assistants and supported IDE extensions, and require an authenticated session with an open workspace.

| Command          | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| `project-review` | Comprehensive project audit (slash workflow)    |
| `scaffold`       | Convention-aligned skeleton generation workflow |
| `preflight`      | Enhanced release-readiness workflow             |

Run any command with `--help` to see its specific flags.

---

## Common Workflows

### First-time setup

```bash
# 1. Install dependencies
pnpm -C .agentkit install

# 2. Initialize for your repository
node .agentkit/engines/node/src/cli.mjs init --repoName my-project

# 3. Customize your overlay
#    Edit .agentkit/overlays/my-project/settings.yaml

# 4. Generate all AI tool configs
node .agentkit/engines/node/src/cli.mjs sync

# 5. Validate the output
node .agentkit/engines/node/src/cli.mjs validate
```

### Daily development

```bash
# After pulling changes that modified .agentkit/spec or overlays
node .agentkit/engines/node/src/cli.mjs sync

# Run quality checks before committing
node .agentkit/engines/node/src/cli.mjs check

# Review your changes
node .agentkit/engines/node/src/cli.mjs review --range HEAD~3..HEAD

# Generate a handoff document at the end of a session
node .agentkit/engines/node/src/cli.mjs handoff --save
```

### CI integration

Add a validation step to your CI pipeline to ensure spec files and generated
outputs stay consistent:

```bash
pnpm -C .agentkit install
node .agentkit/engines/node/src/cli.mjs spec-validate
node .agentkit/engines/node/src/cli.mjs validate
node .agentkit/engines/node/src/cli.mjs check --bail
```

The `check` command exits with a non-zero status code on failure, making it
suitable for CI gates. Use `--bail` to stop on the first failing check.

---

## Troubleshooting

### "Unknown command" error

```
Unknown command: "foo"
Valid commands: init, sync, validate, discover, spec-validate, orchestrate, plan, check, review, handoff, healthcheck, cost, add, remove, list, tasks, delegate, doctor
```

Note: project-review, scaffold, and preflight are slash-command-only and cannot be invoked from the CLI. They are available via supported IDE extensions or chat assistants with authenticated sessions and open workspaces.

Verify you are using one of the valid CLI commands listed above.

### "Cannot find module" or import errors

Make sure you installed dependencies first:

```bash
pnpm -C .agentkit install
```

If the error persists, verify your Node.js version is 22.0.0 or higher:

```bash
node --version
```

### Sync produces no output

Check that your overlay's `settings.yaml` has at least one entry in
`renderTargets`. If the file does not exist, run `init` first:

```bash
node .agentkit/engines/node/src/cli.mjs init --repoName my-project
```

### Unrecognised flag warnings

```
[agentkit:check] Warning: unrecognised flag --unknown (ignored)
```

The CLI warns on flags it does not recognise but continues execution. Check the
command's `--help` output for the list of valid flags.

### Permission errors on Linux/macOS

If you see `EACCES` errors, avoid running with `sudo`. Instead, fix your npm
global directory permissions or use a Node version manager like `nvm`.

---

## Further Reading

- [Quick Start](./QUICK_START.md) -- First 15 minutes walkthrough
- [Command Reference](./COMMAND_REFERENCE.md) -- Full flag and output documentation
- [Workflows](./WORKFLOWS.md) -- Worked examples for common scenarios
- [Troubleshooting](./TROUBLESHOOTING.md) -- Extended error catalog and recovery steps
