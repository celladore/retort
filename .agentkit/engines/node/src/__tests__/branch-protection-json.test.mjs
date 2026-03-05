import { describe, it, expect } from 'vitest';
import { buildBranchProtectionJson } from '../synchronize.mjs';

describe('buildBranchProtectionJson', () => {
  // ---------------------------------------------------------------------------
  // bpRequiredStatusChecksJson
  // ---------------------------------------------------------------------------
  describe('statusChecksJson', () => {
    it('returns empty array when no status checks defined', () => {
      const { statusChecksJson } = buildBranchProtectionJson({});
      expect(JSON.parse(statusChecksJson)).toEqual([]);
    });

    it('passes through string entries', () => {
      const { statusChecksJson } = buildBranchProtectionJson({
        bpRequiredStatusChecks: ['ci/build', 'ci/test'],
      });
      expect(JSON.parse(statusChecksJson)).toEqual(['ci/build', 'ci/test']);
    });

    it('filters out non-string entries', () => {
      const { statusChecksJson } = buildBranchProtectionJson({
        bpRequiredStatusChecks: ['ci/build', null, 42, { name: 'obj' }, 'ci/test'],
      });
      expect(JSON.parse(statusChecksJson)).toEqual(['ci/build', 'ci/test']);
    });

    it('returns empty array when value is not an array', () => {
      const { statusChecksJson } = buildBranchProtectionJson({
        bpRequiredStatusChecks: 'not-an-array',
      });
      expect(JSON.parse(statusChecksJson)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // bpCodeScanningToolsJson
  // ---------------------------------------------------------------------------
  describe('scanningToolsJson', () => {
    it('returns empty array when no tools defined', () => {
      const { scanningToolsJson } = buildBranchProtectionJson({});
      expect(JSON.parse(scanningToolsJson)).toEqual([]);
    });

    it('maps valid tool entries to API format', () => {
      const { scanningToolsJson } = buildBranchProtectionJson({
        bpCodeScanningTools: [
          { name: 'CodeQL', securityAlertThreshold: 'high_or_higher', alertThreshold: 'errors' },
        ],
      });
      expect(JSON.parse(scanningToolsJson)).toEqual([
        { tool: 'CodeQL', security_alerts_threshold: 'high_or_higher', alerts_threshold: 'errors' },
      ]);
    });

    it('defaults thresholds to none when missing', () => {
      const { scanningToolsJson } = buildBranchProtectionJson({
        bpCodeScanningTools: [{ name: 'Semgrep' }],
      });
      const tools = JSON.parse(scanningToolsJson);
      expect(tools[0].security_alerts_threshold).toBe('none');
      expect(tools[0].alerts_threshold).toBe('none');
    });

    it('filters out entries with empty name', () => {
      const { scanningToolsJson } = buildBranchProtectionJson({
        bpCodeScanningTools: [
          { name: '', securityAlertThreshold: 'all', alertThreshold: 'all' },
          { name: 'CodeQL', securityAlertThreshold: 'all', alertThreshold: 'all' },
        ],
      });
      const tools = JSON.parse(scanningToolsJson);
      expect(tools).toHaveLength(1);
      expect(tools[0].tool).toBe('CodeQL');
    });

    it('filters out entries with whitespace-only name', () => {
      const { scanningToolsJson } = buildBranchProtectionJson({
        bpCodeScanningTools: [{ name: '   ' }],
      });
      expect(JSON.parse(scanningToolsJson)).toEqual([]);
    });

    it('trims whitespace from tool names', () => {
      const { scanningToolsJson } = buildBranchProtectionJson({
        bpCodeScanningTools: [{ name: '  CodeQL  ' }],
      });
      expect(JSON.parse(scanningToolsJson)[0].tool).toBe('CodeQL');
    });

    it('filters out null and scalar entries', () => {
      const { scanningToolsJson } = buildBranchProtectionJson({
        bpCodeScanningTools: [null, 'string-entry', 42, { name: 'CodeQL' }],
      });
      const tools = JSON.parse(scanningToolsJson);
      expect(tools).toHaveLength(1);
      expect(tools[0].tool).toBe('CodeQL');
    });

    it('returns empty array when value is not an array', () => {
      const { scanningToolsJson } = buildBranchProtectionJson({
        bpCodeScanningTools: 'not-an-array',
      });
      expect(JSON.parse(scanningToolsJson)).toEqual([]);
    });

    it('ignores non-string threshold values', () => {
      const { scanningToolsJson } = buildBranchProtectionJson({
        bpCodeScanningTools: [
          { name: 'CodeQL', securityAlertThreshold: 123, alertThreshold: null },
        ],
      });
      const tools = JSON.parse(scanningToolsJson);
      expect(tools[0].security_alerts_threshold).toBe('none');
      expect(tools[0].alerts_threshold).toBe('none');
    });
  });
});
