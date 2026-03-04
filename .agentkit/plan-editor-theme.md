# Plan: Brand-Driven Editor Theme Generation

## Context

AgentKit Forge already has:
- **`project.yaml`** — project metadata with `documentation.hasDesignSystem`, `designSystemPath`, `designTokensPath`
- **`discover.mjs`** — auto-detects design tokens, Figma tokens, component libraries, Storybook
- **`templates/vscode/`** — scaffold-once VS Code settings (currently just editor prefs)
- **`synchronize.mjs`** — sync engine that copies `templates/vscode/` → `.vscode/` (always-on, not render-target-gated)
- **`template-utils.mjs`** — Handlebars-lite template engine with `{{#if}}`, `{{#each}}`, `{{key}}` rendering
- **`project-mapping.mjs`** — declarative mapping from `project.yaml` fields to template vars

## Goal

When a repo has a brand guide with color definitions, the sync engine should **optionally generate** a `.vscode/settings.json` that includes `workbench.colorCustomizations` derived from the brand palette — so every developer opening the repo instantly sees a distinctive editor theme.

---

## Architecture: Two New Artifacts

### 1. Brand Spec File: `.agentkit/spec/brand.yaml`

A new spec file (peer to `project.yaml`, `agents.yaml`, etc.) that captures the brand guide in a structured, reusable format.

```yaml
# .agentkit/spec/brand.yaml
version: 1

identity:
  name: ChaufHER
  mission: "Empower women with safe, reliable, and dignified mobility"
  attributes: [confident, protective, empowering, modern, clear, professional]

colors:
  primary:
    brand: "#E0007F"
    gradientEnd: "#8C1D6F"
    deep: "#5C0F49"
    charcoal: "#2B2B2B"
    white: "#FFFFFF"
    surface: "#F7F2F5"
  semantic:
    success: "#1F9D55"
    warning: "#F59E0B"
    error: "#DC2626"
    info: "#2563EB"
  neutral:
    900: "#111111"
    800: "#1F1F1F"
    700: "#2B2B2B"
    600: "#4B4B4B"
    500: "#6B6B6B"
    400: "#9CA3AF"
    300: "#D1D5DB"
    200: "#E5E7EB"
    100: "#F3F4F6"
    50: "#FAFAFA"
  darkMode:
    background: "#111111"
    surface: "#1F1F1F"
    textPrimary: "#FFFFFF"
    textSecondary: "#D1D5DB"

typography:
  primary: "Inter"         # or Sora, etc.
  fallback: "sans-serif"
  display: { weight: 700, letterSpacing: "-0.02em" }
  h1: { weight: 700, scale: "48-56px" }
  h2: { weight: 600, scale: "32-40px" }
  h3: { weight: 600, scale: "24-28px" }
  bodyLarge: { weight: 500, scale: "18px" }
  body: { weight: 400, scale: "16px" }
  small: { weight: 400, scale: "14px" }
  lineHeight: "1.4-1.6"

spacing:
  base: 4
  scale: [4, 8, 12, 16, 24, 32, 48, 64, 96]

layout:
  maxWidth: 1280
  contentWidth: 1140
  gridColumns: 12
  cardRadius: "20-24px"
  buttonRadius: "16-20px"

motion:
  fast: "150ms"
  standard: "250ms"
  emphasis: "350ms"
  easing: "cubic-bezier(0.4, 0, 0.2, 1)"

accessibility:
  standard: "WCAG AA"
  bodyContrast: "4.5:1"
  largeTextContrast: "3:1"
  minTouchTarget: "44px"
```

**Why a separate file?**
- Brand data is reusable across many outputs (VS Code theme, Tailwind config, CSS vars, Storybook, etc.)
- Not every repo has a brand — keeping it separate avoids bloating `project.yaml`
- It can be versioned and validated independently

### 2. Editor Theme Mapping: `.agentkit/spec/editor-theme.yaml`

Maps brand colors to specific VS Code (and Cursor/Windsurf) color customizations. This is the **mapping layer** between brand semantics and editor UI slots.

```yaml
# .agentkit/spec/editor-theme.yaml
enabled: true          # Master toggle

# Which editor theme mode to generate
mode: dark             # light | dark | both

# Mapping: brand color paths → VS Code colorCustomization keys
# Uses dot-notation refs into brand.yaml colors
light:
  titleBar.activeBackground: colors.primary.brand
  titleBar.activeForeground: colors.primary.white
  titleBar.inactiveBackground: colors.primary.deep
  activityBar.background: colors.primary.deep
  activityBar.foreground: colors.primary.white
  statusBar.background: colors.primary.brand
  statusBar.foreground: colors.primary.white
  statusBar.debuggingBackground: colors.semantic.warning
  sideBar.background: colors.primary.surface
  # Optional: deeper customization
  # editor.background: colors.primary.white
  # tab.activeBackground: colors.primary.surface

dark:
  titleBar.activeBackground: colors.primary.deep
  titleBar.activeForeground: colors.primary.white
  activityBar.background: colors.darkMode.background
  activityBar.foreground: colors.primary.brand
  activityBar.activeBorder: colors.primary.brand
  statusBar.background: colors.primary.brand
  statusBar.foreground: colors.primary.white
  sideBar.background: colors.darkMode.surface
  # editor.background: colors.darkMode.background

# Optional: set a base color theme per workspace
# baseTheme:
#   light: "Default Light Modern"
#   dark: "Default Dark Modern"
```

**Why a separate mapping file?**
- The brand guide defines *what* colors exist
- The editor theme defines *where* to apply them in the editor
- Users can customize the mapping without touching the brand spec
- Different repos sharing the same brand can have different editor intensity

---

## Changes to Existing Files

### 3. `project.yaml` — New toggles

```yaml
documentation:
  hasDesignSystem: true
  designSystemPath: "docs/brand/"
  designTokensPath: "styles/tokens/"
  hasBrandGuide: true              # NEW — signals brand.yaml exists
  brandGuidePath: ".agentkit/spec/brand.yaml"  # NEW

# New top-level section
editorTheme:
  enabled: true                    # NEW — master toggle for .vscode theme generation
  source: brand                    # brand | custom | none
```

### 4. `project-mapping.mjs` — New mappings

Add declarative mappings for the new fields:
```js
{ src: 'documentation.hasBrandGuide',   dest: 'hasBrandGuide',   type: 'boolean' },
{ src: 'editorTheme.enabled',           dest: 'editorThemeEnabled', type: 'boolean' },
{ src: 'editorTheme.source',            dest: 'editorThemeSource' },
```

### 5. `discover.mjs` — Detect brand artifacts

Add detection for:
- `brand.yaml` / `brand.json` in `.agentkit/spec/`
- `tokens/colors.*` files
- Tailwind config with custom brand colors
- `editor-theme.yaml` in `.agentkit/spec/`

### 6. `synchronize.mjs` — New `syncEditorTheme()` function

```
async function syncEditorTheme(
  agentkitRoot, templatesDir, tmpDir, vars, version, repoName
)
```

Logic:
1. Check `vars.editorThemeEnabled` — bail if false
2. Read `.agentkit/spec/brand.yaml`
3. Read `.agentkit/spec/editor-theme.yaml` (or use sensible defaults)
4. Resolve color references: walk the mapping, dereference `colors.primary.brand` → `#E0007F`
5. Build `workbench.colorCustomizations` JSON object
6. **Merge** into the existing `.vscode/settings.json` template output (not replace)
7. Write to `tmpDir/.vscode/settings.json`

This function runs **after** the existing `syncDirectCopy('vscode', ...)` so it can merge into the base settings.

### 7. `templates/vscode/settings.json` — Becomes a merge base

The existing template stays as-is (editor prefs). The theme generator **merges** `workbench.colorCustomizations` into it during sync, so:
- Non-themed repos get the current clean settings
- Themed repos get settings + color customizations

---

## Generated Output Example

For a repo with ChaufHER brand + dark mode editor theme:

```json
// .vscode/settings.json (generated)
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  "search.exclude": {
    ".claude/": true,
    ".cursor/": true,
    ".windsurf/": true,
    ".ai/": true
  },
  "workbench.colorCustomizations": {
    "titleBar.activeBackground": "#5C0F49",
    "titleBar.activeForeground": "#FFFFFF",
    "activityBar.background": "#111111",
    "activityBar.foreground": "#E0007F",
    "activityBar.activeBorder": "#E0007F",
    "statusBar.background": "#E0007F",
    "statusBar.foreground": "#FFFFFF",
    "sideBar.background": "#1F1F1F"
  }
}
```

---

## Scaffold-Once Consideration

`.vscode/settings.json` is currently **scaffold-once** (line 449 of `template-utils.mjs`). Two options:

**Option A: Split the file** (Recommended)
- Keep `.vscode/settings.json` as scaffold-once (user editor prefs)
- Generate a new `.vscode/agentkit-theme.json` that gets referenced or merged
- Problem: VS Code doesn't support split settings files natively

**Option B: Hybrid approach** (Recommended)
- `.vscode/settings.json` remains scaffold-once for editor prefs
- The theme generator **reads the existing `.vscode/settings.json`** from the target repo, merges `workbench.colorCustomizations` into it, and writes back
- This respects user customizations while injecting/updating only the theme block
- A sentinel comment or JSON key `"_agentkit_theme_version"` marks the managed section

**Option C: Make theme a separate sync target**
- Generate `.vscode/settings.json` as a two-phase operation:
  1. Scaffold-once: base editor settings (skip if exists)
  2. Always-sync: merge `workbench.colorCustomizations` key only (always update)

---

## Future Extensibility

This architecture naturally supports generating:
- **Tailwind config** (`tailwind.config.ts`) from `brand.yaml` colors/spacing/typography
- **CSS custom properties** (`:root { --color-primary: #E0007F; }`)
- **Design token JSON** (Style Dictionary format) from `brand.yaml`
- **Storybook theme** from `brand.yaml`
- **Cursor/Windsurf themes** (same VS Code settings format, different output paths)

All share the same `brand.yaml` source, different mapping/output targets.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `.agentkit/spec/brand.yaml` | **Create** | Brand guide spec (new artifact) |
| `.agentkit/spec/editor-theme.yaml` | **Create** | Brand→editor color mapping |
| `.agentkit/spec/project.yaml` | **Modify** | Add `hasBrandGuide`, `editorTheme` section |
| `.agentkit/engines/node/src/project-mapping.mjs` | **Modify** | Add new field mappings |
| `.agentkit/engines/node/src/discover.mjs` | **Modify** | Detect brand/theme files |
| `.agentkit/engines/node/src/synchronize.mjs` | **Modify** | Add `syncEditorTheme()` |
| `.agentkit/engines/node/src/template-utils.mjs` | **Modify** | Add JSON merge utility |
| `.agentkit/engines/node/src/__tests__/` | **Create** | Tests for brand resolution + theme merge |
| `.agentkit/overlays/__TEMPLATE__/brand.yaml` | **Create** | Overlay template for brand |
| `.agentkit/overlays/__TEMPLATE__/editor-theme.yaml` | **Create** | Overlay template for editor theme |
| `.agentkit/docs/BRAND_YAML_REFERENCE.md` | **Create** | Reference docs for brand spec |

---

## Open Questions

1. **Cursor/Windsurf output paths** — Should we also generate `.cursor/settings.json` and `.windsurf/settings.json` with the same color customizations? (They support the same VS Code format.)
2. **Theme inheritance** — If an org has a shared brand across repos, should `brand.yaml` support `extends: @org/brand`?
3. **Preview command** — Should `agentkit theme:preview` generate a temporary VS Code settings override for testing before committing?
