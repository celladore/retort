# AgentKit Forge Onboarding Guide

A comprehensive step-by-step guide for adopting AgentKit Forge in a new repository.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Customization](#customization)
4. [Testing](#testing)
5. [CI Integration](#ci-integration)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up AgentKit Forge, ensure the following requirements are met:

### System Requirements

- **Node.js** v22.x LTS (>=22.0.0) installed and available on your PATH  
  Azure Functions 4.x and Azure Static Web Apps support Node 22. See [Azure Functions supported versions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions) and [Static Web Apps runtimes](https://learn.microsoft.com/en-us/azure/static-web-apps/languages-runtimes).
- **Git** v2.30 or later
- **PowerShell** v7+ (for Windows-first workflows) or a POSIX-compatible shell (bash/zsh)

### Repository Requirements

- A Git repository (initialized with `git init` or cloned from a remote)
- **When targeting Azure:** Ensure `package.json` `engines` and workflow `node-version` use Node 22 to align with Azure Functions 4.x and Static Web Apps.
- A `package.json` at the repository root (or willingness to create one)
- Write access to the repository for adding configuration files

### Recommended Knowledge

- Familiarity with YAML configuration files
- Basic understanding of your repository's tech stack (language, framework, build tools)
- Awareness of which AI coding assistants your team uses (Claude, Cursor, Windsurf, Copilot, etc.)

---

## Initial Setup

### Step 1: Add AgentKit Forge as a Submodule

Add the AgentKit Forge repository as a Git submodule in your project:

```bash
git submodule add https://github.com/your-org/agentkit-forge.git agentkit-forge
git submodule update --init --recursive
```

### Step 2: Run the Init Command

The `init` command bootstraps AgentKit Forge for your repository. It copies the overlay template and generates initial configuration files.

**On Linux/macOS:**

```bash
node agentkit-forge/.agentkit/engines/node/src/cli.mjs init
```

**On Windows (PowerShell):**

```powershell
.\agentkit-forge\.agentkit\bin\init.ps1
```

**On Windows (Command Prompt):**

```cmd
agentkit-forge\.agentkit\bin\init.cmd
```

This command will:

- Copy the `__TEMPLATE__` overlay into a new overlay directory named after your repository
- Prompt you for basic configuration (repo name, default branch, primary stack)
- Generate render targets for your chosen AI assistants

### Step 3: Review Generated Configuration

After initialization, review the files created in your overlay directory:

```
agentkit-forge/.agentkit/overlays/<your-repo>/
  settings.yaml    # Core settings (repo name, branch, stack, render targets)
  commands.yaml    # Command overrides
  rules.yaml       # Rule overrides
```

Open `settings.yaml` and verify:

- `repoName` matches your repository name
- `defaultBranch` matches your primary branch (e.g., `main`, `master`, `develop`)
- `primaryStack` is set correctly (or leave as `auto` for auto-detection)
- `renderTargets` lists only the AI assistants your team uses

### Step 4: Run the Sync Command

After configuring your overlay, run the sync command to generate the AI assistant configuration files:

```bash
node agentkit-forge/.agentkit/engines/node/src/cli.mjs sync
```

This renders the spec and overlay into the configuration formats expected by each AI assistant (e.g., `.claude/`, `.cursor/`, `.windsurf/`, `.github/copilot/`).

### Step 5: Commit the Configuration

```bash
git add agentkit-forge/ .claude/ .cursor/ .windsurf/ .github/
git commit -m "feat: add AgentKit Forge configuration"
```

### Step 6: Configure Branch Protection (Optional)

AgentKit Forge generates a setup script that configures GitHub branch protection
rules using the GitHub CLI. This enforces PR reviews, status checks, and prevents
force pushes to your default branch.

```bash
# Preview what will be applied
.github/scripts/setup-branch-protection.sh --dry-run

# Apply branch protection
.github/scripts/setup-branch-protection.sh
```

See [.github/scripts/README.md](../../.github/scripts/README.md) for details on what
gets configured and how to customize the status check names.

**Prerequisites:** [GitHub CLI](https://cli.github.com/) installed and authenticated,
with admin access to the repository.

---

## Customization

### Customizing Settings

Edit `overlays/<your-repo>/settings.yaml` to adjust global behavior:

```yaml
repoName: my-project
defaultBranch: main
primaryStack: typescript
windowsFirst: false
renderTargets:
  - claude
  - cursor
```

### Adding Custom Commands

Edit `overlays/<your-repo>/commands.yaml` to define repository-specific commands:

```yaml
overrides:
  build:
    run: npm run build
    description: Build the project for production
  lint:
    run: npm run lint -- --fix
    description: Run linter with auto-fix enabled
  db-migrate:
    run: npx prisma migrate dev
    description: Run database migrations in development
```

Commands defined here take precedence over the defaults in `.agentkit/spec/commands.yaml`.

### Adding Custom Rules

Edit `overlays/<your-repo>/rules.yaml` to define repository-specific rules for AI assistants:

```yaml
overrides:
  code-style:
    description: Always use single quotes for strings in TypeScript files
    scope: '*.ts'
  testing:
    description: Every new function must have a corresponding unit test
    scope: 'src/**/*.ts'
  security:
    description: Never log sensitive data such as tokens, passwords, or API keys
    scope: '**/*'
```

### Running Discovery

The `discover` command scans your repository to detect tech stacks, project structure,
and existing conventions:

```bash
node agentkit-forge/.agentkit/engines/node/src/cli.mjs discover
```

---

## Testing

### Validate Configuration

Use the `validate` command to check generated outputs for correctness:

```bash
node agentkit-forge/.agentkit/engines/node/src/cli.mjs validate
```

This will report:

- Missing required directories and files
- Invalid JSON in configuration files
- Missing command or hook files
- Forbidden patterns (hardcoded secrets)

### Test with an AI Assistant

After syncing, open your repository in one of your configured AI assistants and verify:

1. The assistant recognizes the project structure correctly
2. Custom commands are available and functional
3. Rules and guidelines are being followed in generated code
4. The assistant can navigate and understand the codebase

The `review` and `plan` CLI subcommands are available for automated pre-review checks
and plan status display. They also exist as slash commands for richer AI-driven workflows.

---

## CI Integration

### GitHub Actions

Add AgentKit Forge validation to your CI pipeline to ensure configuration stays consistent:

```yaml
# .github/workflows/agentkit-check.yml
name: AgentKit Forge Check

on:
  pull_request:
    paths:
      - 'agentkit-forge/**'
      - '.claude/**'
      - '.cursor/**'
      - '.windsurf/**'
      - '.github/copilot/**'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Validate AgentKit configuration
        run: node agentkit-forge/.agentkit/engines/node/src/cli.mjs validate

      - name: Verify sync is up to date
        run: |
          node agentkit-forge/.agentkit/engines/node/src/cli.mjs sync
          git diff --exit-code || (echo "AgentKit config is out of sync. Run 'agentkit sync' and commit." && exit 1)
```

### GitLab CI

```yaml
# .gitlab-ci.yml
agentkit-check:
  image: node:22
  stage: test
  only:
    changes:
      - agentkit-forge/**
      - .claude/**
      - .cursor/**
      - .windsurf/**
  before_script:
    - git submodule sync --recursive
    - git submodule update --init --recursive
  script:
    - node agentkit-forge/.agentkit/engines/node/src/cli.mjs validate
    - node agentkit-forge/.agentkit/engines/node/src/cli.mjs sync
    - git diff --exit-code || (echo "AgentKit config is out of sync. Run 'agentkit sync' and commit." && exit 1)
```

### Azure Pipelines

```yaml
# azure-pipelines.yml
trigger:
  paths:
    include:
      - agentkit-forge/*
      - .claude/*
      - .cursor/*
      - .windsurf/*

pool:
  vmImage: 'ubuntu-latest'

steps:
  - checkout: self
    submodules: recursive

  - task: NodeTool@0
    inputs:
      versionSpec: '22.x'

  - script: node agentkit-forge/.agentkit/engines/node/src/cli.mjs validate
    displayName: 'Validate AgentKit configuration'

  - script: |
      node agentkit-forge/.agentkit/engines/node/src/cli.mjs sync
      git diff --exit-code || (echo "AgentKit config is out of sync. Run 'agentkit sync' and commit." && exit 1)
    displayName: 'Verify sync is up to date'
```

### Pre-commit Hook

Add a Git pre-commit hook to catch configuration drift early:

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Check if any agentkit overlay files changed
if git diff --cached --name-only | grep -q "agentkit-forge/.agentkit/overlays/"; then
  echo "AgentKit overlay files changed. Running validation..."
  node agentkit-forge/.agentkit/engines/node/src/cli.mjs validate
  if [ $? -ne 0 ]; then
    echo "AgentKit validation failed. Fix issues before committing."
    exit 1
  fi
fi
```

### Automated Sync on Submodule Update

When updating the AgentKit Forge submodule, re-run sync to pick up any spec changes:

```bash
git submodule update --remote agentkit-forge
node agentkit-forge/.agentkit/engines/node/src/cli.mjs sync
git add .
git commit -m "chore: update AgentKit Forge and re-sync configuration"
```

---

## Troubleshooting

### Common Issues

**"Command not found" when running bin scripts**

Ensure Node.js is installed and available on your PATH. Verify with `node --version`.

**YAML parse errors during validation**

Validate your YAML files with an online YAML validator or run `node -e "require('yaml').parse(require('fs').readFileSync('file.yaml','utf8'))"`.

**Sync produces no output**

Ensure `renderTargets` in `settings.yaml` contains at least one valid target. Valid targets are: `claude`, `cursor`, `windsurf`, `copilot`, `ai`.

**Submodule not initialized**

Run `git submodule update --init --recursive` to ensure the submodule is properly cloned.

### Getting Help

- Run any command with `--help` for usage information
- Check the `agentkit-forge/.agentkit/logs/` directory for detailed execution logs
- Use the `orchestrate` command for guided multi-step workflows
- Use the `handoff` command to generate context summaries for passing work between sessions or team members
