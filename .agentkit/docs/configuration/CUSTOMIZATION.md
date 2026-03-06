# Customization

How to configure agentkit-forge for your project using overlays and settings.

## How Overlays Work

Agentkit-forge uses a layered configuration system:

1. **Spec files** in `.agentkit/spec/` are the canonical source of truth. These define the default slash commands, rules, settings, and templates that ship with agentkit-forge.

2. **Overlays** in `.agentkit/overlays/<repoName>/` customize the spec on a per-project basis. Each repository gets its own overlay directory.

3. On **`agentkit init`**, the `__TEMPLATE__` overlay is copied to a new directory named after your repository. This gives you a starting point for customization.

### Project-Owned vs Always-Regenerate Files

Sync treats some outputs as **project-owned** (scaffold-once): `docs/`, `.vscode/`, `CONTRIBUTING.md`, `AGENT_BACKLOG.md`, and similar. These are written on first sync; subsequent syncs skip them if they already exist, so you can edit them without losing changes. Use `agentkit sync --overwrite` (or `--force`) to regenerate them from templates. AI tool configs (`.claude/`, `.cursor/`, etc.) are always regenerated. Other sync flags: `-q`/`--quiet` (reduce output), `-v`/`--verbose` (list each file), `--no-clean` (don't delete orphaned files), `--diff` (preview changes without writing).

### Merge Semantics

When the spec and overlay are merged during `agentkit sync`:

- **Templates** (`.md` files, command definitions): File-level replace. If the overlay contains a file with the same name as a spec file, the overlay version completely replaces the spec version.
- **Settings** (`.yaml` configuration): Data-level union. Overlay settings are merged into spec settings. For permission lists, **deny wins** -- if a command appears in both `allow` and `deny`, it is denied.

### Directory Structure

```
.agentkit/
  spec/               # Canonical defaults (YAML spec files)
    commands.yaml
    teams.yaml
    rules.yaml
    settings.yaml
    agents.yaml
    docs.yaml
  templates/           # Template files rendered by sync
    claude/
    cursor/
    windsurf/
    ...
  overlays/
    __TEMPLATE__/      # Copied on init
    my-project/        # Your project-specific overlay
      commands.yaml    # Additional/override commands
      rules.yaml       # Additional/override rules
      settings.yaml    # Project-specific settings
```

## Render Targets

Render targets control which AI tool configs are generated during `sync`. They
are defined in your overlay's `settings.yaml`:

```yaml
renderTargets:
  - claude # Claude Code — CLAUDE.md, .claude/
  - cursor # Cursor IDE — .cursor/
  - windsurf # Windsurf IDE — .windsurf/
  - copilot # GitHub Copilot — .github/ (prompts, agents, chatmodes)
  - gemini # Gemini CLI — GEMINI.md, .gemini/
  - codex # OpenAI Codex — .agents/skills/
  - warp # Warp terminal — WARP.md
  - cline # Cline — .clinerules/
  - roo # Roo Code — .roo/rules/
  - ai # Continue — .ai/
  - mcp # MCP/A2A — mcp/
```

`AGENTS.md` and root docs are always generated regardless of render targets.

Manage targets incrementally after init:

```bash
agentkit add cursor windsurf    # Enable tools and sync
agentkit remove mcp --clean     # Disable tool and delete generated files
agentkit list                   # Show enabled / available tools
```

## Presets

The `init` command supports `--preset` to quickly configure render targets:

- **`minimal`** — Claude Code only (`claude`). Good for solo developers.
- **`full`** — All 11 tools. Maximum compatibility.
- **`team`** — The big four: Claude, Cursor, Copilot, Windsurf.

```bash
agentkit init --preset team --non-interactive
```

## project.yaml

`project.yaml` in `.agentkit/spec/` provides project-level metadata that feeds
into every generated config. It is populated automatically by `agentkit init`
(via discovery + wizard) and can be edited manually afterward.

Key sections:

- **Identity** — `name`, `description`, `phase` (greenfield/active/maintenance/legacy)
- **Stack** — `languages`, `frameworks` (frontend/backend/css), `orm`, `database`
- **Architecture** — `pattern` (clean/hexagonal/mvc/etc.), `apiStyle`, `monorepo`
- **Documentation** — Paths to existing PRDs, ADRs, API specs, design systems
- **Deployment** — `cloudProvider`, `containerized`, `iacTool`, `environments`
- **Process** — `branchStrategy`, `commitConvention`, `teamSize`
- **Testing** — `unit`, `integration`, `e2e` tool arrays, `coverage` target
- **Cross-cutting** — Logging, auth, caching, error handling, feature flags, DB, API patterns

See [PROJECT_YAML_REFERENCE.md](./PROJECT_YAML_REFERENCE.md) for full schema.

During sync, `flattenProjectYaml()` converts this nested structure into flat
template variables (e.g., `stackLanguages`, `hasAuth`, `loggingFramework`) that
are injected into every template.

## Common Customization Patterns

### 1. Adding a Custom Slash Command

Add command definitions to your overlay's `commands.yaml`:

```yaml
# .agentkit/overlays/<repoName>/commands.yaml
commands:
  - name: my-command
    description: 'My custom command'
```

Or create a template `.md` file in the templates directory. When you run `agentkit sync`, the command will be generated into `.claude/commands/`.

### 2. Adding Domain-Specific Rules

Add rules to `rules.yaml` in your overlay directory:

```yaml
# .agentkit/overlays/<repoName>/rules.yaml
rules:
  - id: use-repository-pattern
    description: 'All data access must go through repository classes'
    scope: 'src/data/**'

  - id: no-direct-sql
    description: 'Never write raw SQL; use the ORM query builder'
    scope: 'src/**'
```

These rules are injected into the AI agent context and guide code generation and review.

### 3. Restricting Permissions

Add commands to the deny list in your overlay's `settings.yaml`:

```yaml
# .agentkit/overlays/<repoName>/settings.yaml
permissions:
  deny:
    - 'rm -rf /'
    - 'docker system prune'
    - 'git push --force'
    - 'DROP DATABASE'
```

Because deny wins during merge, these restrictions cannot be overridden by the base spec's allow list.

### 4. Changing the Primary Tech Stack

Set `primaryStack` in your overlay settings to influence how agents generate code and select tools:

```yaml
# .agentkit/overlays/<repoName>/settings.yaml
primaryStack: 'dotnet'
```

This affects template selection, default linting rules, and which build/test commands the agents prefer.

## Settings Reference

### Permissions

```yaml
permissions:
  allow:
    - 'npm test'
    - 'npm run build'
    - 'dotnet test'
  deny:
    - 'rm -rf'
    - 'git push --force'
```

- `permissions.allow` -- List of bash commands and patterns that agents are permitted to run.
- `permissions.deny` -- List of bash commands and patterns that agents are forbidden from running. **Deny always wins** over allow.

### Hooks

```yaml
hooks:
  sessionStart: '.claude/hooks/session-start.sh'
  preToolUse: '.claude/hooks/pre-tool-use.sh'
  postToolUse: '.claude/hooks/post-tool-use.sh'
  stop: '.claude/hooks/stop.sh'
```

- `hooks.sessionStart` -- Runs when a new Claude Code session begins.
- `hooks.preToolUse` -- Runs before each tool invocation. Can block tool use by returning a non-zero exit code.
- `hooks.postToolUse` -- Runs after each tool invocation. Useful for logging and validation.
- `hooks.stop` -- Runs when the agent is about to stop. Used to enforce continuation or trigger handoff generation.

### Cost Tracking

```yaml
costTracking:
  enabled: true
  logDir: '.claude/costs/'
  retentionDays: 30
```

- `costTracking.enabled` -- Whether to log token usage and estimated costs.
- `costTracking.logDir` -- Directory where cost log files are written.
- `costTracking.retentionDays` -- Number of days to retain cost logs before automatic cleanup.

## Example Overlays

### Web App (Node.js)

```yaml
# .agentkit/overlays/my-web-app/settings.yaml
primaryStack: 'node'

permissions:
  allow:
    - 'npm test'
    - 'npm run build'
    - 'npm run lint'
    - 'npx next build'
  deny:
    - 'npm publish'

hooks:
  postToolUse: '.claude/hooks/post-tool-use.sh'

costTracking:
  enabled: true
  logDir: '.claude/costs/'
  retentionDays: 14
```

### API Service (.NET)

```yaml
# .agentkit/overlays/my-api-service/settings.yaml
primaryStack: 'dotnet'

permissions:
  allow:
    - 'dotnet test'
    - 'dotnet build'
    - 'dotnet run'
    - 'dotnet ef migrations'
  deny:
    - 'dotnet ef database drop'
    - 'rm -rf bin/'

hooks:
  preToolUse: '.claude/hooks/pre-tool-use.sh'
  stop: '.claude/hooks/stop.sh'

costTracking:
  enabled: true
  logDir: '.claude/costs/'
  retentionDays: 30
```

### Monorepo (pnpm Workspaces)

```yaml
# .agentkit/overlays/my-monorepo/settings.yaml
primaryStack: 'node'

permissions:
  allow:
    - 'pnpm test'
    - 'pnpm build'
    - 'pnpm lint'
    - 'pnpm --filter'
    - 'turbo run build'
    - 'turbo run test'
  deny:
    - 'pnpm publish'
    - 'npm publish'

hooks:
  sessionStart: '.claude/hooks/session-start.sh'
  preToolUse: '.claude/hooks/pre-tool-use.sh'
  postToolUse: '.claude/hooks/post-tool-use.sh'
  stop: '.claude/hooks/stop.sh'

costTracking:
  enabled: true
  logDir: '.claude/costs/'
  retentionDays: 7
```
