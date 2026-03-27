# Brand & Theming Guide

This guide explains how Retort generates editor themes and design tokens
from the brand specification.

## Brand Spec Structure

The brand spec lives at `.agentkit/spec/brand.yaml` and defines:

| Section         | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `identity`      | Name, mission, product promise, brand attributes        |
| `colors`        | Primary, secondary, semantic, neutral, dark mode colors |
| `typography`    | Font families, weights, type scale                      |
| `spacing`       | Base unit and scale (xs through xl)                     |
| `layout`        | Max width, grid, border radius, component dimensions    |
| `motion`        | Animation durations and easing curves                   |
| `accessibility` | WCAG standard, contrast ratios, touch targets           |

### Color Formats

Colors support two formats:

```yaml
# Simple hex string
success: '#1EDB90'

# Detailed object with metadata
brand:
  hex: '#1976D2'
  role: 'Core brand color'
  rationale: 'Vivid blue conveying trust'
  usage: 'Primary CTAs, brand marks'
```

The `resolveColor()` function handles both — it extracts the hex value
regardless of format.

## Editor Theme Generation

### Color Flow

```
brand.yaml (colors)
    ↓ resolveColor() — handles hex string or {hex, role} object
editor-theme.yaml (mapping)
    ↓ resolveThemeMapping() — maps VS Code slots to brand paths
    ↓ filterByTier() — minimal/medium/full density
synchronize.mjs
    ↓ mergeThemeIntoSettings() — deep-merge into existing settings
.vscode/settings.json, .cursor/settings.json, .windsurf/settings.json
```

### Editor Theme Spec

The mapping lives at `.agentkit/spec/editor-theme.yaml`:

```yaml
enabled: true
mode: both # dark | light | both
scheme: dark # which mode wins on conflict
tier: full # full | medium | minimal
outputs:
  vscode: .vscode/settings.json
  cursor: .cursor/settings.json
  windsurf: .windsurf/settings.json
dark:
  titleBar.activeBackground: colors.primary.dark
  statusBar.background: colors.primary.brand
  # ... 77 total slots
light:
  titleBar.activeBackground: colors.primary.surface
  # ...
```

### Brand Density Tiers

| Tier      | Surfaces                                                   | Slots |
| --------- | ---------------------------------------------------------- | ----- |
| `minimal` | Title bar only                                             | ~3    |
| `medium`  | Title bar, activity bar, status bar, sidebar               | ~15   |
| `full`    | All of the above plus editor, tabs, badges, lists, buttons | ~77   |

### Scaffold Mode

Editor theme uses **managed mode** — it always regenerates on sync. The
`mergeThemeIntoSettings()` function does a JSON-aware deep merge that:

1. Preserves all user-added settings outside the theme section
2. Updates `workbench.colorCustomizations` with brand colors
3. Sets the `_agentkit_theme` metadata sentinel
4. Optionally sets `workbench.colorTheme` (base theme)
5. Optionally sets `editor.fontFamily` from brand typography

## Design Tokens

When the `design-tokens` feature is enabled, sync generates platform-agnostic
design token files from `brand.yaml`.

### Enabling Design Tokens

1. Enable the feature in your overlay `settings.yaml`:

   ```yaml
   enabledFeatures:
     - design-tokens
   ```

2. Optionally configure the output directory in `project.yaml`:

   ```yaml
   designTokens:
     outputDir: tokens # default
   ```

3. Run sync:
   ```bash
   pnpm --dir .agentkit agentkit:sync
   ```

### Output Formats

Three files are generated in the configured output directory:

| File          | Format                                                              | Usage                         |
| ------------- | ------------------------------------------------------------------- | ----------------------------- |
| `tokens.css`  | CSS custom properties (`:root { --color-primary-brand: #1976D2; }`) | Web applications              |
| `tokens.json` | Flat JSON object                                                    | Build tools, Style Dictionary |
| `tokens.scss` | SCSS variables (`$color-primary-brand: #1976D2;`)                   | SCSS preprocessor             |

### Token Naming Convention

Tokens follow a hierarchical kebab-case naming:

```
color-primary-brand      → #1976D2
color-semantic-success   → #1EDB90
color-darkMode-background → #18232A
font-primary             → Inter
font-weight-regular      → 400
font-size-h1             → 24px
spacing-base             → 8px
spacing-m                → 16px
layout-max-width         → 1200px
radius-m                 → 8px
```

### Token Sources

| Brand Section          | Token Prefix                   | Example                                    |
| ---------------------- | ------------------------------ | ------------------------------------------ |
| `colors.*`             | `color-*`                      | `color-primary-brand`, `color-neutral-900` |
| `typography.primary`   | `font-primary`                 | `Inter`                                    |
| `typography.weights.*` | `font-weight-*`                | `font-weight-semiBold`                     |
| `typography.scale.*`   | `font-size-*`, `line-height-*` | `font-size-h1`                             |
| `spacing.scale.*`      | `spacing-*`                    | `spacing-xl`                               |
| `layout.radius.*`      | `radius-*`                     | `radius-m`                                 |
| `layout.maxWidth`      | `layout-max-width`             | `1200px`                                   |

## Brand Validation

The `validateBrandSpec()` function checks:

**Errors (block generation):**

- Missing `identity.name`
- Missing `colors.primary.brand`
- Invalid hex color values

**Warnings (logged only):**

- Missing semantic colors (success, warning, error, info)
- Missing `colors.darkMode` section

## Customization

### Adding a New Color

Add the color to `brand.yaml` under the appropriate section:

```yaml
colors:
  primary:
    newColor:
      hex: '#FF5722'
      role: 'New accent'
```

Then map it in `editor-theme.yaml` if you want it in the editor theme:

```yaml
dark:
  badge.background: colors.primary.newColor
```

Run sync to regenerate all outputs.

### Overriding Per-Tool

Each tool in `editor-theme.yaml` can have its own color overrides:

```yaml
cursor:
  titleBar.activeBackground: colors.secondary.lilac
```

This overrides the default mapping only for Cursor.
