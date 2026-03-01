import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDoctor } from '../doctor.mjs';
import * as fs from 'fs';

// Mock fs and spec-validator
vi.mock('fs');
vi.mock('../spec-validator.mjs');

describe('runDoctor', () => {
  const mockAgentkitRoot = '/mock/agentkit';
  const mockProjectRoot = '/mock/project';

  beforeEach(() => {
    vi.resetAllMocks();
    // Default fs mocks
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('');
    // console spy
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should report error if spec validation throws', async () => {
    const { validateSpec } = await import('../spec-validator.mjs');
    validateSpec.mockImplementation(() => {
      throw new Error('Validation exploded');
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('Spec validation failed: Validation exploded'),
        }),
      ])
    );
  });

  it('should report error if spec is invalid', async () => {
    const { validateSpec } = await import('../spec-validator.mjs');
    validateSpec.mockReturnValue({
      valid: false,
      errors: ['Invalid field X'],
      warnings: [],
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('FAIL');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', message: expect.stringContaining('Spec validation failed') }),
        expect.objectContaining({ severity: 'error', message: 'Invalid field X' }),
      ])
    );
  });

  it('should pass spec validation if valid', async () => {
    const { validateSpec } = await import('../spec-validator.mjs');
    validateSpec.mockReturnValue({
      valid: true,
      errors: [],
      warnings: ['Deprecation warning'],
    });

    // Mock overlay settings to avoid other errors
    vi.spyOn(fs, 'readFileSync').mockImplementation((path) => {
        if (path.includes('overlays') && path.includes('settings.yaml')) {
            return 'renderTargets: ["claude"]';
        }
        return '';
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    // It might fail later due to other checks, but we check for spec success message
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'info', message: expect.stringContaining('Spec validation passed') }),
        expect.objectContaining({ severity: 'warning', message: 'Deprecation warning' }),
      ])
    );
  });

  it('should report warning if overlay settings file is missing', async () => {
    const { validateSpec } = await import('../spec-validator.mjs');
    validateSpec.mockReturnValue({ valid: true, errors: [], warnings: [] });

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      // overlay settings missing
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) return false;
      return true;
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.findings).toEqual(
        expect.arrayContaining([
             expect.objectContaining({ severity: 'warning', message: expect.stringContaining('No renderTargets defined') })
        ])
    );
  });

  it('should report error if overlay settings file is invalid yaml', async () => {
    const { validateSpec } = await import('../spec-validator.mjs');
    validateSpec.mockReturnValue({ valid: true, errors: [], warnings: [] });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return ': invalid yaml';
      }
      return '';
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', message: expect.stringContaining('Failed to parse overlay settings') }),
      ])
    );
  });

  it('should report warning if no renderTargets are defined', async () => {
    const { validateSpec } = await import('../spec-validator.mjs');
    validateSpec.mockReturnValue({ valid: true, errors: [], warnings: [] });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return 'renderTargets: []';
      }
      return '';
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'warning', message: expect.stringContaining('No renderTargets defined') }),
      ])
    );
  });

  it('should check for missing template roots', async () => {
    const { validateSpec } = await import('../spec-validator.mjs');
    validateSpec.mockReturnValue({ valid: true, errors: [], warnings: [] });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('overlays') && p.includes('settings.yaml')) {
        return 'renderTargets: ["claude", "cursor"]';
      }
      return '';
    });

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      const pStr = String(p);
      // More robust check: check for template directory in path
      if (pStr.includes('templates/cursor') || pStr.includes('templates\\cursor')) return false;
      return true;
    });

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', message: expect.stringContaining("Missing template root for target 'cursor'") }),
      ])
    );
  });

  it('should validate project.yaml completeness', async () => {
    const { validateSpec } = await import('../spec-validator.mjs');
    validateSpec.mockReturnValue({ valid: true, errors: [], warnings: [] });

    // Mock overlay to be valid
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
        if (typeof p === 'string') {
            if (p.includes('overlays') && p.includes('settings.yaml')) {
                return 'renderTargets: ["claude"]';
            }
            if (p.endsWith('project.yaml')) {
                return `
name: Test Project
description: A test
phase: active
stack:
  languages: [javascript]
`;
            }
        }
        return '';
    });

    // existSync must return true for project.yaml
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

    // It should calculate completeness
    expect(result.findings).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ severity: 'info', message: expect.stringContaining('project.yaml completeness') })
        ])
    );
  });

  it('should report warning if project.yaml is missing', async () => {
      const { validateSpec } = await import('../spec-validator.mjs');
      validateSpec.mockReturnValue({ valid: true, errors: [], warnings: [] });

      // Overlay valid
      vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
          if (p.includes('overlays') && p.includes('settings.yaml')) return 'renderTargets: ["claude"]';
          return '';
      });

      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
          if (typeof p === 'string' && p.endsWith('project.yaml')) return false;
          return true;
      });

      const result = await runDoctor({ agentkitRoot: mockAgentkitRoot, projectRoot: mockProjectRoot });

      expect(result.findings).toEqual(
          expect.arrayContaining([
              expect.objectContaining({ severity: 'warning', message: expect.stringContaining('project.yaml not found') })
          ])
      );
  });
});
