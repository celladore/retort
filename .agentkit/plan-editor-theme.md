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

A new spec file (peer to `project.yaml`, `agents.yaml`, etc.) that captures the brand guide in a structured, reusable format. The schema must be **product-agnostic** — it should represent any brand (ChaufHER, AgentKit Forge, or a future product) with equal fidelity.

```yaml
# .agentkit/spec/brand.yaml — Full Schema Definition
version: "1.0.0"
specDate: "2024-06-12"          # When this spec was last authored
author: "Brand Systems Team"    # Who maintains this spec

# ─────────────────────────────────────────────────────────────────────────────
# Identity — Who is this brand?
# ─────────────────────────────────────────────────────────────────────────────
identity:
  name: ""                      # Formal product/brand name
  mission: ""                   # One-sentence mission statement
  productPromise: ""            # Extended value proposition (optional)
  attributes: []                # Core brand personality traits (3-8 keywords)
  # attributes drive palette rationale — each color should map to an attribute
  desiredPerception:            # How different audiences should perceive the brand
    developers: ""
    operations: ""
    endUsers: ""

# ─────────────────────────────────────────────────────────────────────────────
# Colors — Full palette with rationale
# ─────────────────────────────────────────────────────────────────────────────
# Each color entry can be:
#   Simple:   key: "#HEXVAL"
#   Detailed: key: { hex: "#HEXVAL", role: "...", rationale: "...", usage: "..." }
#
# The detailed form is recommended for primary/secondary colors to capture
# design intent. The sync engine resolves both forms identically for
# theme generation (reads .hex or the string directly).
# ─────────────────────────────────────────────────────────────────────────────

colors:
  primary:
    brand: { hex: "", role: "", rationale: "", usage: "" }
    # Additional primary slots — names are brand-specific:
    # coral, teal, deep, dark, accent, gradientEnd, charcoal, white, surface, etc.

  secondary:
    # Named secondary colors with rationale
    # lilac, mint, etc.

  semantic:
    success: { hex: "", rationale: "" }
    warning: { hex: "", rationale: "" }
    error:   { hex: "", rationale: "" }
    info:    { hex: "", rationale: "" }

  neutral:
    # Named scale: 900, 800, 700, ... 50
    # Each entry: "#HEXVAL" or { hex: "#HEXVAL", role: "..." }
    900: ""
    700: ""
    400: ""
    100: ""

  darkMode:
    background: ""
    surface: ""
    textPrimary: ""
    textSecondary: ""

  # Optional: gradient definitions
  gradients:
    primary: { from: "colors.primary.brand", to: "colors.primary.gradientEnd" }

  # Palette guidance notes (free text, for documentation generation)
  guidance: ""

# ─────────────────────────────────────────────────────────────────────────────
# Typography
# ─────────────────────────────────────────────────────────────────────────────

typography:
  primary: ""                   # Primary font family name
  fallback: ""                  # Full fallback stack (CSS format)
  mono: ""                      # Monospace font for code/config
  weights:
    regular: 400
    medium: 500
    semiBold: 600
    bold: 700
  scale:                        # Type scale with named entries
    displayXl: { size: 48, weight: 600, lineHeight: 1.15 }
    sectionTitle: { size: 32, weight: 600, lineHeight: 1.2 }
    h1: { size: 24, weight: 600, lineHeight: 1.3 }
    h2: { size: 20, weight: 500, lineHeight: 1.3 }
    subtitle: { size: 17, weight: 500, lineHeight: 1.4 }
    bodyLarge: { size: 16, weight: 400, lineHeight: 1.5 }
    body: { size: 14, weight: 400, lineHeight: 1.5 }
    small: { size: 14, weight: 400, lineHeight: 1.4 }
    codeInline: { size: 14, weight: null, lineHeight: 1.45, font: "mono" }
  intent: ""                    # Design intent note for typography choices

# ─────────────────────────────────────────────────────────────────────────────
# Spacing & Layout
# ─────────────────────────────────────────────────────────────────────────────

spacing:
  base: 8                      # Base grid unit (px)
  scale:                        # Named spacing tokens
    xs: 4
    s: 8
    m: 16
    l: 24
    xl: 32

layout:
  maxWidth: 1200
  contentWidth: 1140
  gridColumns: 12
  radius:
    s: 4                        # Input/button
    m: 8                        # Card/block
    l: 16                       # Modal/dialog
  card:
    padding: 16
    radius: "radius.m"          # Reference to radius scale
  button:
    paddingX: 16
    paddingY: 8
    radius: "radius.s"

# ─────────────────────────────────────────────────────────────────────────────
# Motion
# ─────────────────────────────────────────────────────────────────────────────

motion:
  micro: "80-120ms"             # Button press, toggle
  standard: "250ms"             # Modal, fade, slide
  emphasis: "350ms"             # Hero transitions (optional)
  easing: "cubic-bezier(0.4, 0, 0.2, 1)"
  principles:
    - "Purposeful, minimal — only where they clarify, not distract"
    - "Honors OS/browser reduce-motion preferences"

# ─────────────────────────────────────────────────────────────────────────────
# Accessibility
# ─────────────────────────────────────────────────────────────────────────────

accessibility:
  standard: "WCAG AA"
  bodyContrast: "4.5:1"
  largeTextContrast: "3:1"
  focusOutline: "2px"           # Minimum focus ring thickness
  minTouchTarget: "44px"
  reducedMotion: true           # Honors prefers-reduced-motion
  principles:
    - "No communicative information depends solely on color"
    - "Keyboard navigation, skip links, error recovery baked in"
    - "All icons, buttons, alerts have aria-labels/roles"
    - "Accessible forms with clear labels and error messaging"
```

**Why a separate file?**
- Brand data is reusable across many outputs (VS Code theme, Tailwind config, CSS vars, Storybook, etc.)
- Not every repo has a brand — keeping it separate avoids bloating `project.yaml`
- It can be versioned and validated independently
- The `rationale` fields serve as living documentation for design decisions

### Color Resolution Rules

The sync engine must handle two formats for color values:

```yaml
# Simple string — resolve directly
brand: "#1976D2"

# Detailed object — extract .hex
brand:
  hex: "#1976D2"
  role: "Core brand color"
  rationale: "Vivid blue conveying empowerment and trust"
  usage: "Primary CTAs, brand marks, key interactive states"
```

Resolution function:
```
resolveColor(value) → if typeof value === 'string' → value
                      if typeof value === 'object' → value.hex
```

---

### 2. Editor Theme Mapping: `.agentkit/spec/editor-theme.yaml`

Maps brand colors to specific VS Code (and Cursor/Windsurf) color customizations. This is the **mapping layer** between brand semantics and editor UI slots.

```yaml
# .agentkit/spec/editor-theme.yaml
enabled: true          # Master toggle

# Which editor theme mode to generate
mode: dark             # light | dark | both

# Mapping: brand color paths → VS Code colorCustomization keys
# Uses dot-notation refs into brand.yaml colors
# The resolver calls resolveColor() on each referenced value
light:
  titleBar.activeBackground: colors.primary.brand
  titleBar.activeForeground: colors.neutral.100
  titleBar.inactiveBackground: colors.primary.dark
  activityBar.background: colors.primary.dark
  activityBar.foreground: colors.neutral.100
  statusBar.background: colors.primary.brand
  statusBar.foreground: colors.neutral.100
  statusBar.debuggingBackground: colors.semantic.warning
  sideBar.background: colors.primary.surface
  # tab.activeBackground: colors.primary.surface

dark:
  titleBar.activeBackground: colors.primary.dark
  titleBar.activeForeground: colors.darkMode.textPrimary
  activityBar.background: colors.darkMode.background
  activityBar.foreground: colors.primary.brand
  activityBar.activeBorder: colors.primary.brand
  statusBar.background: colors.primary.brand
  statusBar.foreground: colors.darkMode.textPrimary
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

## Concrete Examples: Two Brands

### AgentKit Forge Brand (`brand.yaml`)

```yaml
version: "1.0.0"
specDate: "2024-06-12"
author: "AgentKit Brand Systems"

identity:
  name: "AgentKit Forge"
  mission: "Empowering teams to orchestrate, configure, and unify AI toolchains with simplicity and confidence."
  productPromise: >
    The fastest, most reliable, and transparent AI agent infrastructure—
    delivering power, trust, and clarity from prototype to production.
  attributes: [empowering, collaborative, inviting, flexible, approachable, modern]
  desiredPerception:
    developers: "A platform I can trust at production scale."
    operations: "Lets us move faster and with more clarity than legacy tools."
    endUsers: "Thoughtful, modern, and just works."

colors:
  primary:
    brand:
      hex: "#1976D2"
      role: "Core brand color"
      rationale: "Vivid, uplifting blue conveying empowerment, reliability, and technical trust"
      usage: "Primary CTAs, brand marks, key interactive states"
    coral:
      hex: "#FD8369"
      role: "Collaboration warmth"
      rationale: "Approachable warm coral to signal collaboration and human-centered flows"
      usage: "Onboarding cues, collaborative affordances"
    teal:
      hex: "#23BFAA"
      role: "Inviting accent"
      rationale: "Friendly and flexible teal for success states"
      usage: "Success states, badges, secondary CTAs"
    surface:
      hex: "#F7F9FB"
      role: "Light surface"
      rationale: "Near-white surface reducing intimidation for onboarding"
      usage: "Content backgrounds, form fields"
    dark:
      hex: "#184A6C"
      role: "Dark mode brand"
      rationale: "Deep professional blue preserving brand recognition in dark contexts"
      usage: "Dark-mode surfaces, technical panels"
    accent:
      hex: "#FFD54F"
      role: "Highlight"
      rationale: "Optimistic yellow for highlights and interactive prompts"
      usage: "Attention-drawing, non-alarmist highlights"

  secondary:
    lilac:
      hex: "#B39DDB"
      role: "Modern accent"
      rationale: "Professional but friendly edge for illustrations and empty states"
      usage: "Feature highlights, empty states"
    mint:
      hex: "#A7EDCE"
      role: "Inclusive touch"
      rationale: "Gentle tone for supportive UI elements and less technical flows"
      usage: "Supportive elements, onboarding"

  semantic:
    success:
      hex: "#1EDB90"
      rationale: "Empowering success tone — positive and actionable"
    warning:
      hex: "#FBC02D"
      rationale: "Friendly warning for non-blocking cautions"
    error:
      hex: "#ED2F4B"
      rationale: "Clear error hue — decisive but fits the expressive palette"
    info:
      hex: "#1976D2"
      rationale: "Aligns informational states with core brand color"

  neutral:
    900: { hex: "#222A30", role: "Deep neutral — headings, critical UI chrome" }
    700: { hex: "#474E57", role: "Body text, secondary UI elements" }
    400: { hex: "#B4BAC2", role: "Dividers, subtle borders, disabled states" }
    100: { hex: "#F4F6F8", role: "Softest background — airy, reduces complexity" }

  darkMode:
    background: { hex: "#18232A", role: "Deep muted background for focus" }
    surface: { hex: "#23303A", role: "Layered surface for cards/panels" }
    textPrimary: { hex: "#F7F9FB", role: "High-contrast text aligned with light surfaces" }
    textSecondary: { hex: "#B4BAC2", role: "Muted hints and meta information" }

  guidance: >
    All colors AA-compliant minimum contrast ratios against adjacent type/background.
    Surface colors reserved for backgrounds; brand blue never as text on light surface for legibility.

typography:
  primary: "Inter"
  fallback: '"Inter", "Segoe UI", "Roboto", Arial, sans-serif'
  mono: "IBM Plex Mono"
  weights:
    regular: 400
    medium: 500
    semiBold: 600
  scale:
    displayXl: { size: 48, weight: 600, lineHeight: 1.15 }
    sectionTitle: { size: 32, weight: 600, lineHeight: 1.2 }
    h1: { size: 24, weight: 600, lineHeight: 1.3 }
    h2: { size: 20, weight: 500, lineHeight: 1.3 }
    subtitle: { size: 17, weight: 500, lineHeight: 1.4 }
    bodyLarge: { size: 16, weight: 400, lineHeight: 1.5 }
    body: { size: 14, weight: 400, lineHeight: 1.5 }
    small: { size: 14, weight: 400, lineHeight: 1.4 }
    codeInline: { size: 14, weight: null, lineHeight: 1.45, font: "mono" }
  intent: >
    Sans-serif clarity for technical content, with mono for configuration/UI outputs
    and live-editing states. Supports internationalization glyphs.

spacing:
  base: 8
  scale:
    xs: 4
    s: 8
    m: 16
    l: 24
    xl: 32

layout:
  maxWidth: 1200
  contentWidth: 1140
  gridColumns: 12
  radius:
    s: 4
    m: 8
    l: 16
  card:
    padding: 16
    radius: "radius.m"
  button:
    paddingX: 16
    paddingY: 8
    radius: "radius.s"

motion:
  micro: "80-120ms"
  standard: "250ms"
  easing: "cubic-bezier(0.4, 0, 0.2, 1)"
  principles:
    - "Purposeful, minimal — clarify, not distract"
    - "Honors OS/browser reduce-motion preferences"

accessibility:
  standard: "WCAG AA"
  bodyContrast: "4.5:1"
  largeTextContrast: "3:1"
  focusOutline: "2px"
  minTouchTarget: "44px"
  reducedMotion: true
  principles:
    - "No communicative information depends solely on color"
    - "Keyboard navigation, skip links, error recovery baked in"
    - "All icons, buttons, alerts have aria-labels/roles"
    - "Screen reader support — status changes announced politely"
```

### ChaufHER Brand (`brand.yaml`)

```yaml
version: "1.0.0"
specDate: "2024-06-12"
author: "ChaufHER Design"

identity:
  name: "ChaufHER"
  mission: "Empower women with safe, reliable, and dignified mobility."
  productPromise: "A mobility ecosystem built by women, for women — trusted, secure, and modern."
  attributes: [confident, protective, empowering, modern, clear, professional]
  desiredPerception:
    developers: "A codebase with safety-first engineering and clear architecture."
    operations: "Reliable, auditable, and security-hardened platform."
    endUsers: "Trusted, safe, and modern ride experience."

colors:
  primary:
    brand:
      hex: "#E0007F"
      role: "Primary Pink"
      rationale: "Bold, confident pink representing empowerment and femininity"
      usage: "Primary CTAs, brand marks, feature badges"
    gradientEnd:
      hex: "#8C1D6F"
      role: "Gradient terminus"
      usage: "Primary gradient overlays"
    deep:
      hex: "#5C0F49"
      role: "Deep Plum"
      rationale: "Authority and depth — protective but sophisticated"
      usage: "Dark-mode brand surfaces, emphasis areas"
    charcoal: "#2B2B2B"
    white: "#FFFFFF"
    surface:
      hex: "#F7F2F5"
      role: "Soft surface"
      rationale: "Warm-tinted white creating an inviting, safe feel"
      usage: "Card backgrounds, content surfaces"

  semantic:
    success: { hex: "#1F9D55", rationale: "Clear confirmation — safe completion" }
    warning: { hex: "#F59E0B", rationale: "Cautionary but not alarming" }
    error: { hex: "#DC2626", rationale: "Urgent — safety-critical alerts" }
    info: { hex: "#2563EB", rationale: "Informational — neutral trust blue" }

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

  gradients:
    primary: { from: "colors.primary.brand", to: "colors.primary.gradientEnd" }

typography:
  primary: "Inter"
  fallback: "sans-serif"
  mono: null
  weights:
    regular: 400
    medium: 500
    semiBold: 600
    bold: 700
  scale:
    display: { size: 48, weight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" }
    h1: { size: 52, weight: 700, lineHeight: 1.2 }
    h2: { size: 36, weight: 600, lineHeight: 1.25 }
    h3: { size: 26, weight: 600, lineHeight: 1.3 }
    bodyLarge: { size: 18, weight: 500, lineHeight: 1.5 }
    body: { size: 16, weight: 400, lineHeight: 1.5 }
    small: { size: 14, weight: 400, lineHeight: 1.5 }

spacing:
  base: 4
  scale: { xs: 4, s: 8, m: 16, l: 24, xl: 32, xxl: 48, xxxl: 64 }

layout:
  maxWidth: 1280
  contentWidth: 1140
  gridColumns: 12
  radius:
    s: 4
    m: 16
    l: 24
  card:
    padding: 24
    radius: "radius.l"
  button:
    paddingX: 20
    paddingY: 12
    radius: "radius.m"

motion:
  micro: "150ms"
  standard: "250ms"
  emphasis: "350ms"
  easing: "cubic-bezier(0.4, 0, 0.2, 1)"
  principles:
    - "Subtle, never distracting"
    - "Reinforces safety and confidence"

accessibility:
  standard: "WCAG AA"
  bodyContrast: "4.5:1"
  largeTextContrast: "3:1"
  focusOutline: "2px"
  minTouchTarget: "44px"
  reducedMotion: true
  principles:
    - "Safety information never depends solely on color"
    - "Clear focus states on all interactive elements"
```

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
4. Resolve color references: walk the mapping, call `resolveColor()` on each value
   - String → use directly
   - Object with `.hex` → extract hex value
   - Dot-notation path (`colors.primary.brand`) → traverse brand.yaml, then resolve
5. Build `workbench.colorCustomizations` JSON object
6. Optionally add `workbench.colorTheme` if `baseTheme` is specified
7. Optionally add `editor.fontFamily` / `editor.fontLigatures` from brand typography
8. **Merge** into the existing `.vscode/settings.json` template output (not replace)
9. Write to `tmpDir/.vscode/settings.json`

This function runs **after** the existing `syncDirectCopy('vscode', ...)` so it can merge into the base settings.

### 7. `templates/vscode/settings.json` — Becomes a merge base

The existing template stays as-is (editor prefs). The theme generator **merges** `workbench.colorCustomizations` into it during sync, so:
- Non-themed repos get the current clean settings
- Themed repos get settings + color customizations

---

## Generated Output Examples

### AgentKit Forge (dark mode)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.fontFamily": "'IBM Plex Mono', 'Fira Code', monospace",
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
    "titleBar.activeBackground": "#184A6C",
    "titleBar.activeForeground": "#F7F9FB",
    "activityBar.background": "#18232A",
    "activityBar.foreground": "#1976D2",
    "activityBar.activeBorder": "#1976D2",
    "statusBar.background": "#1976D2",
    "statusBar.foreground": "#F7F9FB",
    "statusBar.debuggingBackground": "#FBC02D",
    "sideBar.background": "#23303A"
  },
  "_agentkit_theme": {
    "brand": "AgentKit Forge",
    "mode": "dark",
    "version": "1.0.0"
  }
}
```

### ChaufHER (dark mode)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.eol": "\n",
  "workbench.colorCustomizations": {
    "titleBar.activeBackground": "#5C0F49",
    "titleBar.activeForeground": "#FFFFFF",
    "activityBar.background": "#111111",
    "activityBar.foreground": "#E0007F",
    "activityBar.activeBorder": "#E0007F",
    "statusBar.background": "#E0007F",
    "statusBar.foreground": "#FFFFFF",
    "sideBar.background": "#1F1F1F"
  },
  "_agentkit_theme": {
    "brand": "ChaufHER",
    "mode": "dark",
    "version": "1.0.0"
  }
}
```

---

## Scaffold-Once Consideration

`.vscode/settings.json` is currently **scaffold-once** (line 449 of `template-utils.mjs`). Two options:

**Option A: Split the file**
- Keep `.vscode/settings.json` as scaffold-once (user editor prefs)
- Generate a new `.vscode/agentkit-theme.json` that gets referenced or merged
- Problem: VS Code doesn't support split settings files natively

**Option B: Hybrid approach** (Recommended)
- `.vscode/settings.json` remains scaffold-once for editor prefs
- The theme generator **reads the existing `.vscode/settings.json`** from the target repo, merges `workbench.colorCustomizations` into it, and writes back
- This respects user customizations while injecting/updating only the theme block
- A sentinel key `"_agentkit_theme"` marks the managed section with brand name, mode, and version

**Option C: Make theme a separate sync target**
- Generate `.vscode/settings.json` as a two-phase operation:
  1. Scaffold-once: base editor settings (skip if exists)
  2. Always-sync: merge `workbench.colorCustomizations` key only (always update)

---

## Brand Spec Validation

The sync engine should validate `brand.yaml` at sync time:

| Rule | Severity | Description |
|------|----------|-------------|
| `identity.name` required | error | Brand must have a name |
| `colors.primary.brand` required | error | At minimum, a primary brand color is needed |
| `colors.semantic` complete | warning | All four semantic colors recommended |
| Hex format valid | error | All color values must be valid `#RRGGBB` or `#RGB` |
| Dark mode colors present if `editor-theme.mode` includes dark | warning | Missing dark mode colors will cause fallback |
| Contrast ratios meet accessibility spec | warning | Check brand+white, brand+dark against `accessibility.bodyContrast` |

---

## Future Extensibility

This architecture naturally supports generating:
- **Tailwind config** (`tailwind.config.ts`) from `brand.yaml` colors/spacing/typography
- **CSS custom properties** (`:root { --color-primary: #1976D2; }`)
- **Design token JSON** (Style Dictionary format) from `brand.yaml`
- **Storybook theme** from `brand.yaml`
- **Cursor/Windsurf themes** (same VS Code settings format, different output paths)
- **Brand documentation page** (auto-generated `docs/brand/README.md` with color swatches)
- **Editor font configuration** from `typography.mono` → `editor.fontFamily`

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
| `.agentkit/engines/node/src/synchronize.mjs` | **Modify** | Add `syncEditorTheme()` + `resolveColor()` |
| `.agentkit/engines/node/src/template-utils.mjs` | **Modify** | Add JSON deep-merge utility |
| `.agentkit/engines/node/src/brand-resolver.mjs` | **Create** | Color resolution + brand validation logic |
| `.agentkit/engines/node/src/__tests__/brand-resolver.test.mjs` | **Create** | Tests for color resolution + validation |
| `.agentkit/engines/node/src/__tests__/editor-theme.test.mjs` | **Create** | Tests for theme merge into settings.json |
| `.agentkit/overlays/__TEMPLATE__/brand.yaml` | **Create** | Overlay template for brand |
| `.agentkit/overlays/__TEMPLATE__/editor-theme.yaml` | **Create** | Overlay template for editor theme |
| `.agentkit/docs/BRAND_YAML_REFERENCE.md` | **Create** | Reference docs for brand spec schema |

---

## Open Questions

1. **Cursor/Windsurf output paths** — Should we also generate `.cursor/settings.json` and `.windsurf/settings.json` with the same color customizations? (They support the same VS Code format.)
2. **Theme inheritance** — If an org has a shared brand across repos, should `brand.yaml` support `extends: @org/brand`?
3. **Preview command** — Should `agentkit theme:preview` generate a temporary VS Code settings override for testing before committing?
4. **Font injection** — Should `typography.mono` automatically set `editor.fontFamily` in VS Code settings?
5. **Rationale export** — Should the brand documentation generator produce a visual palette page with rationale text for each color?
