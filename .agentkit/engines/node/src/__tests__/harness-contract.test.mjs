import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadHarnessContract, validateHarnessDocument } from '../harness-contract.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const temporaryDirectories = [];

function temporaryDirectory(prefix) {
  const directory = mkdtempSync(resolve(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function minimalManifest() {
  return {
    apiVersion: 'harness.neuralliquid.dev/v1alpha1',
    kind: 'HarnessManifest',
    metadata: {
      id: 'synthetic-minimal-manifest',
      version: '0.1.0',
      createdAt: '2026-08-09T12:00:00Z',
      ownerRepository: 'phoenixvc/retort',
    },
    lifecycleState: 'specified',
    ownership: {
      doctrine: 'org-meta',
      ledger: 'baton',
      distribution: 'retort',
      runtime: 'cognitive-mesh',
      modelPolicy: 'sluice',
      costAttribution: 'docket',
      reviewEvidence: 'codeflow',
      product: 'convolens',
    },
    roles: [
      {
        stableAlias: 'dispatcher',
        displayName: 'Dispatcher',
        axis: 'horizontal',
        purpose: 'Route a synthetic validation task.',
        capabilities: ['route'],
        authority: {
          ceiling: 'read-only',
          allowedTools: [],
          allowedEffects: ['read-repository'],
          workspaceRoots: ['.'],
          networkAllowlist: [],
          dataClasses: ['internal'],
          externalEffectPolicy: 'deny',
          mergePolicy: 'deny',
          budget: { maxDurationSeconds: 60, maxAttempts: 1 },
        },
        prohibitedEffects: ['write-workspace', 'merge'],
      },
    ],
    skills: [],
    commands: [],
    hooks: [],
    teams: [],
    workflows: [
      {
        id: 'validate-contract',
        purpose: 'Validate a synthetic contract.',
        complexityTiers: [0],
        executionPattern: 'deterministic',
        gates: [],
        steps: [
          {
            id: 'validate',
            actorRole: 'dispatcher',
            operation: 'Validate the contract.',
            dependsOn: [],
            authority: 'read-only',
            retry: {
              maxAttempts: 1,
              backoff: 'none',
              overallDeadlineSeconds: 60,
              ambiguousOutcomePolicy: 'stop',
            },
            idempotencyRequired: true,
            gateRefs: [],
          },
        ],
      },
    ],
    promotionPolicy: {
      lifecycle: ['proposed', 'specified', 'harnessed', 'verified', 'promoted'],
      humanDecisionRequiredFor: ['merge'],
      evidenceRetentionDays: 30,
    },
  };
}

function promotionDecision() {
  return {
    apiVersion: 'harness.neuralliquid.dev/v1alpha1',
    kind: 'PromotionDecision',
    metadata: {
      id: 'synthetic-promotion-decision',
      version: '0.1.0',
      createdAt: '2026-08-09T12:00:00Z',
      ownerRepository: 'phoenixvc/retort',
    },
    target: { type: 'workflow', id: 'synthetic', version: '0.1.0' },
    fromState: 'verified',
    requestedState: 'promoted',
    authorityCeiling: 'read-only',
    decision: 'promote',
    decidedAt: '2026-08-09T12:00:00Z',
    decidedBy: [
      {
        id: 'reviewer@example.test',
        type: 'human',
        roleAlias: 'reviewer',
        authenticated: true,
      },
    ],
    gateResults: [
      {
        gateId: 'authority-gate',
        status: 'pass',
        critical: true,
        evidenceRefs: ['synthetic-evidence'],
      },
    ],
    rationale: 'Synthetic valid promotion fixture.',
  };
}

function validateDocument(document) {
  const projectRoot = temporaryDirectory('retort-harness-project-');
  const documentPath = resolve(projectRoot, 'harness.json');
  writeFileSync(documentPath, JSON.stringify(document), 'utf-8');
  return validateHarnessDocument(AGENTKIT_ROOT, documentPath);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Agent Harnessing contract', () => {
  it('verifies the vendored schema revision, identity, digest, and meta-schema', () => {
    const result = loadHarnessContract(AGENTKIT_ROOT);
    expect(result.ok, result.errors.join('\n')).toBe(true);
    expect(result.lock.sourceRevision).toBe('f916826fa77519ae15e3e1c82d2e009cbd9ca3d0');
    expect(result.lock.authorityPromotion).toBe(false);
  });

  it('rejects a tampered vendored schema', () => {
    const root = temporaryDirectory('retort-harness-contract-');
    cpSync(resolve(AGENTKIT_ROOT, 'contracts'), resolve(root, 'contracts'), {
      recursive: true,
    });
    writeFileSync(
      resolve(root, 'contracts', 'agent-harnessing-v1.schema.json'),
      '{"tampered":true}',
      'utf-8'
    );
    const result = loadHarnessContract(root);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('schema digest mismatch');
  });

  it('accepts a valid synthetic HarnessManifest', () => {
    const result = validateDocument(minimalManifest());
    expect(result.ok, result.errors.join('\n')).toBe(true);
  });

  it('rejects effects above the declared authority ceiling', () => {
    const manifest = minimalManifest();
    manifest.roles[0].authority.allowedEffects.push('merge');
    const result = validateDocument(manifest);
    expect(result.ok).toBe(false);
  });

  it('rejects workflow actors that are not declared roles', () => {
    const manifest = minimalManifest();
    manifest.workflows[0].steps[0].actorRole = 'missing-role';
    const result = validateDocument(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('actorRole missing-role is not declared');
  });

  it('rejects promotion while a critical gate is not passing', () => {
    const decision = promotionDecision();
    decision.gateResults[0].status = 'pending';
    const result = validateDocument(decision);
    expect(result.ok).toBe(false);
  });
});
