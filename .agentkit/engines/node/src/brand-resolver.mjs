/**
 * AgentKit Forge — Brand Resolver
 * Resolves brand.yaml color references and validates brand specs.
 * Pure functions — no file I/O.
 */
import { get } from './project-mapping.mjs';

// ---------------------------------------------------------------------------
// Brand tier definitions — which VS Code slots belong to each density tier
// ---------------------------------------------------------------------------

/**
 * VS Code color keys grouped by brand density tier.
 * - minimal: title bar only — one glanceable surface to identify the project
 * - medium:  key chrome — title bar, activity bar, status bar, sidebar
 * - full:    everything — all of the above plus editor, tabs, badges, lists, buttons
 */
const TIER_PREFIXES = {
  minimal: [
    'titleBar.',
  ],
  medium: [
    'titleBar.',
    'activityBar.',
    'activityBarBadge.',
    'statusBar.',
    'statusBarItem.',
    'sideBar.',
    'sideBarSectionHeader.',
  ],
  // full includes everything — no filtering needed
};

const VALID_TIERS = new Set(['full', 'medium', 'minimal']);
const VALID_SCHEMES = new Set(['dark', 'light']);

/**
 * Filters a resolved color customizations object by brand density tier.
 *
 * @param {object} colorCustomizations - { "titleBar.activeBackground": "#hex", ... }
 * @param {'full'|'medium'|'minimal'} tier - Brand density tier
 * @returns {object} Filtered color customizations
 */
export function filterByTier(colorCustomizations, tier) {
  if (!tier || tier === 'full') return colorCustomizations;

  const prefixes = TIER_PREFIXES[tier];
  if (!prefixes) return colorCustomizations;

  const filtered = {};
  for (const [key, value] of Object.entries(colorCustomizations)) {
    if (prefixes.some(prefix => key.startsWith(prefix))) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Validates editor-theme.yaml tier and scheme values.
 *
 * @param {object} themeSpec - The parsed editor-theme.yaml object
 * @returns {{ warnings: string[] }}
 */
export function validateThemeSpec(themeSpec) {
  const warnings = [];
  if (!themeSpec || typeof themeSpec !== 'object') return { warnings };

  if (themeSpec.tier && !VALID_TIERS.has(themeSpec.tier)) {
    warnings.push(`tier "${themeSpec.tier}" is not valid — expected one of: full, medium, minimal`);
  }
  if (themeSpec.scheme && !VALID_SCHEMES.has(themeSpec.scheme)) {
    warnings.push(`scheme "${themeSpec.scheme}" is not valid — expected one of: dark, light`);
  }
  return { warnings };
}

// ---------------------------------------------------------------------------
// Color resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a color value from brand.yaml.
 * Handles both simple hex strings and detailed objects with { hex, role, rationale }.
 *
 * @param {string|object} value - A hex string or { hex: string, ... } object
 * @returns {string|null} The resolved hex color or null if unresolvable
 */
export function resolveColor(value) {
  if (typeof value === 'string') {
    return isValidHex(value) ? value : null;
  }
  if (value && typeof value === 'object' && typeof value.hex === 'string') {
    return isValidHex(value.hex) ? value.hex : null;
  }
  return null;
}

/**
 * Traverses a brand spec object using a dot-notation path and resolves the color.
 *
 * @param {object} brand - The full brand.yaml object
 * @param {string} path - Dot-notation path, e.g. "colors.primary.brand"
 * @returns {string|null} The resolved hex color or null
 */
export function resolveBrandColor(brand, path) {
  if (!brand || !path || typeof path !== 'string') return null;

  const value = getNestedValue(brand, path);
  if (value === undefined || value === null) return null;

  return resolveColor(value);
}

/**
 * Resolves an editor theme mapping against a brand spec.
 * Takes a mapping object (VS Code key → brand path) and returns
 * a resolved object (VS Code key → hex color).
 *
 * @param {object} mapping - { "titleBar.activeBackground": "colors.primary.brand", ... }
 * @param {object} brand - The full brand.yaml object
 * @returns {{ resolved: object, warnings: string[] }}
 */
export function resolveThemeMapping(mapping, brand) {
  const resolved = {};
  const warnings = [];

  if (!mapping || typeof mapping !== 'object') {
    return { resolved, warnings };
  }

  for (const [vscodeKey, brandPath] of Object.entries(mapping)) {
    if (typeof brandPath !== 'string') {
      warnings.push(`Skipping "${vscodeKey}": value is not a string path`);
      continue;
    }

    const hex = resolveBrandColor(brand, brandPath);
    if (hex) {
      resolved[vscodeKey] = hex;
    } else {
      warnings.push(`Could not resolve "${vscodeKey}" from brand path "${brandPath}"`);
    }
  }

  return { resolved, warnings };
}

// ---------------------------------------------------------------------------
// Brand validation
// ---------------------------------------------------------------------------

/**
 * Validates a brand.yaml spec and returns errors and warnings.
 *
 * @param {object} brand - The parsed brand.yaml object
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateBrandSpec(brand) {
  const errors = [];
  const warnings = [];

  if (!brand || typeof brand !== 'object') {
    errors.push('brand.yaml is empty or not an object');
    return { errors, warnings };
  }

  // Required: identity.name
  if (!brand.identity?.name) {
    errors.push('identity.name is required');
  }

  // Required: colors.primary.brand
  const primaryBrand = brand.colors?.primary?.brand;
  if (!primaryBrand) {
    errors.push('colors.primary.brand is required');
  } else {
    const hex = resolveColor(primaryBrand);
    if (!hex) {
      errors.push('colors.primary.brand is not a valid hex color');
    }
  }

  // Warning: semantic colors should be complete
  const semanticKeys = ['success', 'warning', 'error', 'info'];
  for (const key of semanticKeys) {
    const val = brand.colors?.semantic?.[key];
    if (!val) {
      warnings.push(`colors.semantic.${key} is missing (recommended)`);
    } else {
      const hex = resolveColor(val);
      if (!hex) {
        warnings.push(`colors.semantic.${key} has an invalid hex value`);
      }
    }
  }

  // Warning: dark mode colors if applicable
  if (!brand.colors?.darkMode) {
    warnings.push('colors.darkMode section is missing (needed for dark editor themes)');
  } else {
    const dmKeys = ['background', 'surface', 'textPrimary', 'textSecondary'];
    for (const key of dmKeys) {
      const val = brand.colors.darkMode[key];
      if (!val) {
        warnings.push(`colors.darkMode.${key} is missing`);
      }
    }
  }

  // Validate all hex colors in the spec
  validateColorTree(brand.colors, 'colors', errors);

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Settings merge
// ---------------------------------------------------------------------------

/**
 * Deep-merges theme customizations into an existing VS Code settings object.
 * Only merges specific managed keys; preserves all user-defined settings.
 *
 * @param {object} existingSettings - Current .vscode/settings.json content
 * @param {object} colorCustomizations - Resolved { "titleBar.activeBackground": "#hex", ... }
 * @param {object} meta - { brand: string, mode: string, version: string }
 * @returns {object} Merged settings object
 */
export function mergeThemeIntoSettings(existingSettings, colorCustomizations, meta) {
  const settings = { ...existingSettings };

  if (Object.keys(colorCustomizations).length > 0) {
    // Preserve any existing user-defined colorCustomizations, brand colors win on conflict
    settings['workbench.colorCustomizations'] = {
      ...(existingSettings['workbench.colorCustomizations'] || {}),
      ...colorCustomizations,
    };
  }

  if (meta) {
    settings['_agentkit_theme'] = {
      brand: meta.brand || 'unknown',
      mode: meta.mode || 'dark',
      scheme: meta.scheme || 'dark',
      tier: meta.tier || 'minimal',
      version: meta.version || '1.0.0',
    };
  }

  return settings;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely accesses a nested property using dot-notation.
 * Delegates to the canonical `get()` from project-mapping.mjs.
 */
export function getNestedValue(obj, path) {
  return get(obj, path);
}

/**
 * Validates a hex color string (#RGB, #RRGGBB, or #RRGGBBAA).
 * VS Code supports 8-char hex with alpha channel (e.g. #1976D280).
 */
export function isValidHex(value) {
  if (typeof value !== 'string') return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value);
}

/**
 * Recursively walks a color tree and validates all hex values.
 * Adds errors for invalid hex strings.
 */
function validateColorTree(obj, path, errors) {
  if (!obj || typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = `${path}.${key}`;

    if (typeof value === 'string') {
      // Simple hex string
      if (value.startsWith('#') && !isValidHex(value)) {
        errors.push(`${currentPath}: invalid hex color "${value}"`);
      }
    } else if (typeof value === 'object' && value !== null) {
      if (typeof value.hex === 'string') {
        // Detailed color object
        if (!isValidHex(value.hex)) {
          errors.push(`${currentPath}.hex: invalid hex color "${value.hex}"`);
        }
      } else if (!value.hex && !Array.isArray(value)) {
        // Nested group — recurse
        validateColorTree(value, currentPath, errors);
      }
    }
  }
}
