<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Claude Code custom command. -->
<!-- Docs: https://docs.anthropic.com/en/docs/claude-code/tutorials#create-custom-slash-commands -->
# /brand — Brand Spec Validation & Theme Preview

Validate the project brand spec, preview the resolved editor theme palette,
and check accessibility contrast ratios.

## Brand Spec Location

{{#if hasBrandGuide}}- **Brand Guide**: `{{brandGuidePath}}`
- **Brand Name**: {{brandName}}
- **Primary Color**: `{{brandPrimaryColor}}`
{{else}}- No brand guide found. Run `agentkit init` to scaffold a `brand.yaml`.
{{/if}}
{{#if editorThemeEnabled}}- **Editor Theme**: `.agentkit/spec/editor-theme.yaml` (enabled, source: {{editorThemeSource}}){{/if}}

## Steps

### 1. Validate brand.yaml

Read `.agentkit/spec/brand.yaml` and check:

- [ ] `identity.name` is present and non-empty
- [ ] `colors.primary.brand` is a valid hex color (`#RGB`, `#RRGGBB`, or `#RRGGBBAA`)
- [ ] All four semantic colors are defined (`success`, `warning`, `error`, `info`)
- [ ] `colors.darkMode` section exists with `background`, `surface`, `textPrimary`, `textSecondary`
- [ ] All color values (simple strings and `.hex` fields in objects) are valid hex
- [ ] `typography.primary` and `typography.mono` are defined
- [ ] `accessibility.standard` is declared (e.g., WCAG AA)

Report errors (blockers) and warnings (recommendations) separately.

### 2. Show Resolved Palette (if `--palette`)

Read brand.yaml and display a table of all resolved colors:

| Section | Key | Hex | Role |
|---------|-----|-----|------|
| primary | brand | #1976D2 | Core brand color |
| ... | ... | ... | ... |

For each color entry, resolve both simple hex strings and `{ hex, role, rationale }` objects.
Group by section: primary, secondary, semantic, neutral, darkMode.

### 3. Show Editor Theme Mapping (if `--theme`)

Read `.agentkit/spec/editor-theme.yaml` and resolve each mapping against brand.yaml.
Display a table per mode (light/dark):

| VS Code Slot | Brand Path | Resolved Hex |
|-------------|------------|--------------|
| titleBar.activeBackground | colors.primary.dark | #184A6C |
| ... | ... | ... |

Flag any unresolvable paths as warnings.
Show which output targets are configured (vscode, cursor, windsurf).

### 4. Check Contrast Ratios (if `--contrast`)

For key foreground/background pairs in the editor theme, compute relative luminance
and contrast ratio:

- `titleBar.activeForeground` vs `titleBar.activeBackground`
- `statusBar.foreground` vs `statusBar.background`
- `activityBar.foreground` vs `activityBar.background`
- `sideBar.foreground` vs `sideBar.background`
- `editor.foreground` vs `editor.background`

Compare against the declared `accessibility.bodyContrast` threshold (default 4.5:1).
Flag pairs that fail as warnings with the computed ratio.

### 5. Summary

Output a concise report:
- **Status**: PASS / WARN / FAIL
- **Errors**: count and list
- **Warnings**: count and list
- **Palette coverage**: X primary, Y secondary, Z semantic, N neutral colors defined
- **Theme coverage**: X of Y VS Code slots resolved successfully
