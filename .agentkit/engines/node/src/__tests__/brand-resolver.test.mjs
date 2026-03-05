import { describe, it, expect } from 'vitest';
import {
  resolveColor,
  resolveBrandColor,
  resolveThemeMapping,
  validateBrandSpec,
  validateThemeSpec,
  mergeThemeIntoSettings,
  filterByTier,
  isValidHex,
  getNestedValue,
} from '../brand-resolver.mjs';

// ---------------------------------------------------------------------------
// resolveColor
// ---------------------------------------------------------------------------
describe('resolveColor', () => {
  it('resolves a simple hex string', () => {
    expect(resolveColor('#1976D2')).toBe('#1976D2');
  });

  it('resolves a 3-char hex string', () => {
    expect(resolveColor('#F00')).toBe('#F00');
  });

  it('resolves an 8-char hex with alpha', () => {
    expect(resolveColor('#1976D280')).toBe('#1976D280');
  });

  it('resolves a detailed object with alpha hex', () => {
    expect(resolveColor({ hex: '#1976D280' })).toBe('#1976D280');
  });

  it('resolves a detailed object with hex', () => {
    expect(resolveColor({ hex: '#1976D2', role: 'brand' })).toBe('#1976D2');
  });

  it('returns null for invalid hex string', () => {
    expect(resolveColor('#ZZZZZZ')).toBeNull();
  });

  it('returns null for non-hex string', () => {
    expect(resolveColor('blue')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(resolveColor(null)).toBeNull();
    expect(resolveColor(undefined)).toBeNull();
  });

  it('returns null for object without hex', () => {
    expect(resolveColor({ role: 'brand' })).toBeNull();
  });

  it('returns null for object with invalid hex', () => {
    expect(resolveColor({ hex: 'notahex' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isValidHex
// ---------------------------------------------------------------------------
describe('isValidHex', () => {
  it('accepts 6-char hex', () => {
    expect(isValidHex('#1976D2')).toBe(true);
    expect(isValidHex('#ffffff')).toBe(true);
    expect(isValidHex('#000000')).toBe(true);
  });

  it('accepts 3-char hex', () => {
    expect(isValidHex('#F00')).toBe(true);
    expect(isValidHex('#abc')).toBe(true);
  });

  it('accepts 8-char hex with alpha', () => {
    expect(isValidHex('#1976D280')).toBe(true);
    expect(isValidHex('#ffffff00')).toBe(true);
    expect(isValidHex('#00000099')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isValidHex('#GGGGGG')).toBe(false);
    expect(isValidHex('1976D2')).toBe(false);
    expect(isValidHex('#1976D')).toBe(false);
    expect(isValidHex('#1976D2F')).toBe(false); // 7 chars — not valid
    expect(isValidHex('')).toBe(false);
    expect(isValidHex(null)).toBe(false);
    expect(isValidHex(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getNestedValue
// ---------------------------------------------------------------------------
describe('getNestedValue', () => {
  const obj = {
    colors: {
      primary: {
        brand: { hex: '#1976D2' },
        dark: '#184A6C',
      },
      neutral: { 900: '#222A30' },
    },
  };

  it('resolves nested dot paths', () => {
    expect(getNestedValue(obj, 'colors.primary.brand')).toEqual({ hex: '#1976D2' });
    expect(getNestedValue(obj, 'colors.primary.dark')).toBe('#184A6C');
  });

  it('returns undefined for missing paths', () => {
    expect(getNestedValue(obj, 'colors.primary.missing')).toBeUndefined();
    expect(getNestedValue(obj, 'does.not.exist')).toBeUndefined();
  });

  it('handles numeric keys', () => {
    expect(getNestedValue(obj, 'colors.neutral.900')).toBe('#222A30');
  });
});

// ---------------------------------------------------------------------------
// resolveBrandColor
// ---------------------------------------------------------------------------
describe('resolveBrandColor', () => {
  const brand = {
    colors: {
      primary: {
        brand: { hex: '#1976D2', role: 'Core brand' },
        dark: '#184A6C',
        surface: { hex: '#F7F9FB' },
      },
      semantic: {
        success: { hex: '#1EDB90' },
        warning: { hex: '#FBC02D' },
      },
      darkMode: {
        background: { hex: '#18232A' },
        textPrimary: { hex: '#F7F9FB' },
      },
      neutral: {
        900: { hex: '#222A30' },
        100: { hex: '#F4F6F8' },
      },
    },
  };

  it('resolves detailed object colors', () => {
    expect(resolveBrandColor(brand, 'colors.primary.brand')).toBe('#1976D2');
    expect(resolveBrandColor(brand, 'colors.semantic.success')).toBe('#1EDB90');
  });

  it('resolves simple string colors', () => {
    expect(resolveBrandColor(brand, 'colors.primary.dark')).toBe('#184A6C');
  });

  it('resolves dark mode colors', () => {
    expect(resolveBrandColor(brand, 'colors.darkMode.background')).toBe('#18232A');
  });

  it('resolves neutral scale colors', () => {
    expect(resolveBrandColor(brand, 'colors.neutral.900')).toBe('#222A30');
  });

  it('returns null for missing paths', () => {
    expect(resolveBrandColor(brand, 'colors.primary.missing')).toBeNull();
  });

  it('returns null for null brand', () => {
    expect(resolveBrandColor(null, 'colors.primary.brand')).toBeNull();
  });

  it('returns null for null path', () => {
    expect(resolveBrandColor(brand, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveThemeMapping
// ---------------------------------------------------------------------------
describe('resolveThemeMapping', () => {
  const brand = {
    colors: {
      primary: {
        brand: { hex: '#1976D2' },
        dark: '#184A6C',
      },
      darkMode: {
        background: { hex: '#18232A' },
        textPrimary: { hex: '#F7F9FB' },
      },
      semantic: {
        warning: { hex: '#FBC02D' },
      },
    },
  };

  it('resolves a full theme mapping', () => {
    const mapping = {
      'titleBar.activeBackground': 'colors.primary.dark',
      'titleBar.activeForeground': 'colors.darkMode.textPrimary',
      'statusBar.background': 'colors.primary.brand',
      'statusBar.debuggingBackground': 'colors.semantic.warning',
    };
    const { resolved, warnings } = resolveThemeMapping(mapping, brand);
    expect(resolved).toEqual({
      'titleBar.activeBackground': '#184A6C',
      'titleBar.activeForeground': '#F7F9FB',
      'statusBar.background': '#1976D2',
      'statusBar.debuggingBackground': '#FBC02D',
    });
    expect(warnings).toHaveLength(0);
  });

  it('warns on unresolvable paths', () => {
    const mapping = {
      'titleBar.activeBackground': 'colors.primary.brand',
      'activityBar.background': 'colors.does.not.exist',
    };
    const { resolved, warnings } = resolveThemeMapping(mapping, brand);
    expect(resolved).toEqual({
      'titleBar.activeBackground': '#1976D2',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('colors.does.not.exist');
  });

  it('handles empty mapping', () => {
    const { resolved, warnings } = resolveThemeMapping({}, brand);
    expect(resolved).toEqual({});
    expect(warnings).toHaveLength(0);
  });

  it('handles null mapping', () => {
    const { resolved, warnings } = resolveThemeMapping(null, brand);
    expect(resolved).toEqual({});
    expect(warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateBrandSpec
// ---------------------------------------------------------------------------
describe('validateBrandSpec', () => {
  it('validates a complete brand spec', () => {
    const brand = {
      identity: { name: 'Test Brand' },
      colors: {
        primary: { brand: '#1976D2' },
        semantic: {
          success: '#1EDB90',
          warning: '#FBC02D',
          error: '#ED2F4B',
          info: '#1976D2',
        },
        darkMode: {
          background: '#18232A',
          surface: '#23303A',
          textPrimary: '#F7F9FB',
          textSecondary: '#B4BAC2',
        },
      },
    };
    const { errors, warnings } = validateBrandSpec(brand);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('errors on missing identity.name', () => {
    const brand = {
      identity: {},
      colors: { primary: { brand: '#1976D2' } },
    };
    const { errors } = validateBrandSpec(brand);
    expect(errors).toContain('identity.name is required');
  });

  it('errors on missing colors.primary.brand', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: { primary: {} },
    };
    const { errors } = validateBrandSpec(brand);
    expect(errors).toContain('colors.primary.brand is required');
  });

  it('errors on invalid hex in colors.primary.brand', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: { primary: { brand: 'not-a-hex' } },
    };
    const { errors } = validateBrandSpec(brand);
    expect(errors.some((e) => e.includes('not a valid hex'))).toBe(true);
  });

  it('warns on missing semantic colors', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: {
        primary: { brand: '#1976D2' },
        semantic: { success: '#1EDB90' },
        darkMode: {
          background: '#18232A',
          surface: '#23303A',
          textPrimary: '#F7F9FB',
          textSecondary: '#B4BAC2',
        },
      },
    };
    const { warnings } = validateBrandSpec(brand);
    expect(warnings.some((w) => w.includes('semantic.warning'))).toBe(true);
    expect(warnings.some((w) => w.includes('semantic.error'))).toBe(true);
    expect(warnings.some((w) => w.includes('semantic.info'))).toBe(true);
  });

  it('warns on missing darkMode section', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: {
        primary: { brand: '#1976D2' },
        semantic: {
          success: '#1EDB90',
          warning: '#FBC02D',
          error: '#ED2F4B',
          info: '#1976D2',
        },
      },
    };
    const { warnings } = validateBrandSpec(brand);
    expect(warnings.some((w) => w.includes('darkMode'))).toBe(true);
  });

  it('errors on null brand', () => {
    const { errors } = validateBrandSpec(null);
    expect(errors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// mergeThemeIntoSettings
// ---------------------------------------------------------------------------
describe('mergeThemeIntoSettings', () => {
  it('merges color customizations into existing settings', () => {
    const existing = {
      'editor.formatOnSave': true,
      'files.eol': '\n',
    };
    const colors = {
      'titleBar.activeBackground': '#184A6C',
      'statusBar.background': '#1976D2',
    };
    const meta = { brand: 'AgentKit Forge', mode: 'dark', version: '1.0.0' };

    const result = mergeThemeIntoSettings(existing, colors, meta);

    expect(result['editor.formatOnSave']).toBe(true);
    expect(result['workbench.colorCustomizations']).toEqual(colors);
    expect(result['_agentkit_theme']).toEqual(meta);
  });

  it('preserves existing settings without overwriting', () => {
    const existing = {
      'editor.formatOnSave': true,
      'editor.tabSize': 2,
    };
    const colors = { 'titleBar.activeBackground': '#1976D2' };

    const result = mergeThemeIntoSettings(existing, colors, null);

    expect(result['editor.formatOnSave']).toBe(true);
    expect(result['editor.tabSize']).toBe(2);
  });

  it('skips colorCustomizations if empty', () => {
    const existing = { 'editor.formatOnSave': true };
    const result = mergeThemeIntoSettings(existing, {}, null);
    expect(result['workbench.colorCustomizations']).toBeUndefined();
  });

  it('preserves existing user-defined colorCustomizations', () => {
    const existing = {
      'editor.formatOnSave': true,
      'workbench.colorCustomizations': {
        'editorCursor.foreground': '#FF0000',
        'titleBar.activeBackground': '#OLD_VALUE',
      },
    };
    const colors = {
      'titleBar.activeBackground': '#1976D2',
      'statusBar.background': '#184A6C',
    };
    const result = mergeThemeIntoSettings(existing, colors, null);

    // Brand colors win on conflict
    expect(result['workbench.colorCustomizations']['titleBar.activeBackground']).toBe('#1976D2');
    // User's custom cursor color is preserved
    expect(result['workbench.colorCustomizations']['editorCursor.foreground']).toBe('#FF0000');
    // Brand's new color is added
    expect(result['workbench.colorCustomizations']['statusBar.background']).toBe('#184A6C');
  });

  it('does not mutate the original settings object', () => {
    const existing = { 'editor.formatOnSave': true };
    const colors = { 'titleBar.activeBackground': '#1976D2' };
    mergeThemeIntoSettings(existing, colors, null);
    expect(existing['workbench.colorCustomizations']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// filterByTier
// ---------------------------------------------------------------------------
describe('filterByTier', () => {
  const allColors = {
    'titleBar.activeBackground': '#184A6C',
    'titleBar.activeForeground': '#F7F9FB',
    'activityBar.background': '#184A6C',
    'activityBar.foreground': '#23BFAA',
    'activityBarBadge.background': '#FD8369',
    'statusBar.background': '#1976D2',
    'statusBar.foreground': '#F7F9FB',
    'statusBarItem.hoverBackground': '#2A4A6C',
    'sideBar.background': '#23303A',
    'sideBar.foreground': '#B4BAC2',
    'sideBarSectionHeader.background': '#1A2730',
    'editor.background': '#18232A',
    'editor.foreground': '#F7F9FB',
    'tab.activeBackground': '#23303A',
    'tab.inactiveBackground': '#18232A',
    'badge.background': '#23BFAA',
    'list.activeSelectionBackground': '#FD8369',
    'button.background': '#FD8369',
  };

  it('returns all colors for tier "full"', () => {
    const result = filterByTier(allColors, 'full');
    expect(result).toEqual(allColors);
  });

  it('returns all colors when tier is undefined', () => {
    const result = filterByTier(allColors, undefined);
    expect(result).toEqual(allColors);
  });

  it('filters to key chrome for tier "medium"', () => {
    const result = filterByTier(allColors, 'medium');
    expect(Object.keys(result)).toEqual([
      'titleBar.activeBackground',
      'titleBar.activeForeground',
      'activityBar.background',
      'activityBar.foreground',
      'activityBarBadge.background',
      'statusBar.background',
      'statusBar.foreground',
      'statusBarItem.hoverBackground',
      'sideBar.background',
      'sideBar.foreground',
      'sideBarSectionHeader.background',
    ]);
  });

  it('filters to title bar only for tier "minimal"', () => {
    const result = filterByTier(allColors, 'minimal');
    expect(Object.keys(result)).toEqual([
      'titleBar.activeBackground',
      'titleBar.activeForeground',
    ]);
  });

  it('returns all colors for unknown tier', () => {
    const result = filterByTier(allColors, 'unknown');
    expect(result).toEqual(allColors);
  });
});

// ---------------------------------------------------------------------------
// validateThemeSpec
// ---------------------------------------------------------------------------
describe('validateThemeSpec', () => {
  it('returns no warnings for valid spec', () => {
    const { warnings } = validateThemeSpec({ tier: 'medium', scheme: 'dark' });
    expect(warnings).toHaveLength(0);
  });

  it('returns no warnings when tier/scheme are absent', () => {
    const { warnings } = validateThemeSpec({ enabled: true });
    expect(warnings).toHaveLength(0);
  });

  it('warns on invalid tier', () => {
    const { warnings } = validateThemeSpec({ tier: 'extreme' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"extreme"');
    expect(warnings[0]).toContain('full, medium, minimal');
  });

  it('warns on invalid scheme', () => {
    const { warnings } = validateThemeSpec({ scheme: 'neon' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"neon"');
    expect(warnings[0]).toContain('dark, light');
  });

  it('warns on both invalid tier and scheme', () => {
    const { warnings } = validateThemeSpec({ tier: 'max', scheme: 'rainbow' });
    expect(warnings).toHaveLength(2);
  });

  it('handles null/undefined input', () => {
    expect(validateThemeSpec(null).warnings).toHaveLength(0);
    expect(validateThemeSpec(undefined).warnings).toHaveLength(0);
  });
});
