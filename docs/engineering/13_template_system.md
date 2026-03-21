# Template System Guide

This guide explains how Retort's template engine works, including scaffold
modes, frontmatter, three-way merge, and the rendering pipeline.

## Template Rendering Pipeline

```
.agentkit/spec/*.yaml       ← Source of truth (project, teams, rules, etc.)
        ↓
flattenProjectYaml()        ← Transforms YAML into template variables
        ↓
.agentkit/templates/**      ← Handlebars-style templates
        ↓
replacePlaceholders()       ← Resolves {{vars}}, {{#if}}, {{#each}}
        ↓
tmp/ directory              ← Rendered output (staged)
        ↓
resolveScaffoldAction()     ← Determines write strategy per file
        ↓
project root                ← Final output (.claude/, .github/, docs/, etc.)
```

## Template Syntax

Templates use a Handlebars-inspired syntax:

### Variables

```
{{projectName}}                    → Simple substitution
{{githubSlug}}                     → Dot-path from project.yaml
```

### Conditionals

```
{{#if hasTeamOrchestration}}
Team orchestration is enabled.
{{/if}}

{{#unless hasAuth}}
No authentication configured.
{{/unless}}
```

### Iteration

```
{{#each integrations}}
- {{this.name}}: {{this.purpose}}
{{/each}}
```

### Whitespace Control

```
{{~#if hasAuth}}                   → Strips whitespace before tag
Content{{~/if}}                    → Strips whitespace after tag
```

## Scaffold Modes

Every template declares how it should be handled on subsequent syncs:

| Mode      | Frontmatter         | First Sync | Later Syncs                  | User Edits      |
| --------- | ------------------- | ---------- | ---------------------------- | --------------- |
| `always`  | `scaffold: always`  | Write      | **Overwrite**                | Lost            |
| `managed` | `scaffold: managed` | Write      | **Hash check → 3-way merge** | Preserved       |
| `once`    | `scaffold: once`    | Write      | **Skip**                     | Fully preserved |

### Declaring Scaffold Mode

Templates use YAML frontmatter:

```yaml
---
agentkit:
  scaffold: managed
---
# Template content here
```

The frontmatter is stripped during rendering — it never appears in output.

### Default Modes

When no frontmatter is present, defaults apply based on path:

| Path Pattern              | Default Mode |
| ------------------------- | ------------ |
| `docs/`                   | `once`       |
| `.vscode/`                | `once`       |
| `.github/ISSUE_TEMPLATE/` | `once`       |
| `AGENT_BACKLOG.md`        | `once`       |
| `CHANGELOG.md`            | `once`       |
| `CONTRIBUTING.md`         | `once`       |
| Everything else           | `always`     |

### Override via project.yaml

The `automation.languageProfile.scaffoldOverrides` section can override defaults:

```yaml
automation:
  languageProfile:
    scaffoldOverrides:
      alwaysRegenerate: ['docs/api/README.md'] # Force always mode
      scaffoldOnce: ['scripts/deploy.sh'] # Force once mode
```

## Three-Way Merge (Managed Files)

The managed scaffold mode uses a three-way merge to preserve user edits:

1. **Load disk file** and compute its hash
2. **Compare to manifest hash** (`.agentkit/.manifest.json`)
3. If hashes match → file is pristine → safe to overwrite
4. If hashes differ → user edited → perform three-way merge:
   - **Ours**: Current disk file (with user edits)
   - **Base**: Scaffold cache (`.agentkit/.scaffold-cache/`)
   - **Theirs**: New template output
5. Run `git merge-file --diff3` to produce merged result
6. Clean merge → apply; conflict → write with `<<<<<<< YOUR_EDITS` markers

### Scaffold Cache

The `.agentkit/.scaffold-cache/` directory stores the "base" version of each
managed file — the last template output before any user edits. This enables
the three-way merge to distinguish user changes from template changes.

## Manifest

The `.agentkit/.manifest.json` file tracks:

- File paths of all generated outputs
- SHA256 hashes of each file's content
- Used for change detection and stale file cleanup

After a sync, files that appear in the old manifest but not the new one are
candidates for cleanup (stale file removal).

## Security

### Sanitization

Template values are sanitized before substitution to prevent injection:

- Shell metacharacters (`$()`, backticks, `|`, `&&`, etc.) are stripped
- Variables in the `RAW_TEMPLATE_VARS` set bypass sanitization (pre-computed JSON)
- Variables ending with `Json` or starting with `shared_` are treated as raw

### Path Traversal Protection

All output paths are validated to stay within the project root:

```javascript
const resolvedPath = resolve(tmpDir, normalizedRel);
if (!resolvedPath.startsWith(resolvedRoot + sep)) {
  // BLOCKED: path traversal detected
}
```

### YAML Size Limit

The `readYaml()` function enforces a 5MB size limit to prevent denial-of-service
attacks via excessively large YAML files.

## Template Variables

Template variables come from multiple sources:

1. **project.yaml** → flattened via `PROJECT_MAPPING` in `project-mapping.mjs`
2. **teams.yaml** → team names, scopes, handoff chains
3. **rules.yaml** → coding conventions per domain
4. **features.yaml** → boolean flags (`hasTeamOrchestration`, etc.)
5. **Derived vars** → computed in `flattenProjectYaml()` (e.g., `githubOwner`, `installCmd`)
6. **Runtime vars** → set during sync (`repoName`, `version`, `defaultBranch`)

### Adding a New Template Variable

1. Add the field to the appropriate spec file (usually `project.yaml`)
2. Add a mapping entry in `project-mapping.mjs`
3. If validation is needed, add an enum entry in `spec-validator.mjs`
4. If complex derivation is needed, add logic in `flattenProjectYaml()`
5. Use `{{variableName}}` in templates
6. Run sync to verify
