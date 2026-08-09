/**
 * Retort — conservative Agent Harnessing manifest onboarding.
 *
 * This generator distributes a provider-neutral, schema-valid starting point.
 * It deliberately grants no external-effect or merge authority.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, relative, resolve, sep } from 'path';
import { loadAgentsSpec, readYaml } from './spec-loader.mjs';
import { loadHarnessContract, validateHarnessValue } from './harness-contract.mjs';

const DEFAULT_OUTPUT = '.agentkit/harness/manifest.json';
const PROVENANCE_KEY = 'retort.neuralliquid.dev/provenance';
const API_VERSION = 'harness.neuralliquid.dev/v1alpha1';
const PROHIBITED_EFFECTS = [
  'write-workspace',
  'credential-use',
  'external-write',
  'deploy',
  'merge',
  'delete',
  'publish',
  'message-person',
];

function normalizedText(path) {
  return readFileSync(path, 'utf-8').replace(/\r\n/g, '\n');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeAlias(value, fallback) {
  const alias = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  const prefixed = /^[a-z]/.test(alias) ? alias : `harness-${alias}`;
  return (prefixed.length >= 2 ? prefixed : fallback).slice(0, 80).replace(/-+$/g, '');
}

function boundedText(value, fallback, maximum) {
  const text = String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maximum).trim();
}

function resolveInsideProject(projectRoot, requestedPath) {
  const root = resolve(projectRoot);
  const outputPath = resolve(root, requestedPath || DEFAULT_OUTPUT);
  if (outputPath === root || !outputPath.startsWith(`${root}${sep}`)) {
    throw new Error(`harness output escapes project root: ${requestedPath}`);
  }
  return outputPath;
}

function readExistingManifest(outputPath) {
  if (!existsSync(outputPath)) return null;
  let existing;
  try {
    existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
  } catch (error) {
    throw new Error(`refusing to overwrite invalid harness manifest: ${error.message}`);
  }
  if (existing?.kind !== 'HarnessManifest') {
    throw new Error('refusing to overwrite a document that is not a HarnessManifest');
  }
  return existing;
}

function sourceFiles(agentkitRoot) {
  const files = [resolve(agentkitRoot, 'spec', 'project.yaml')];
  const agentsDirectory = resolve(agentkitRoot, 'spec', 'agents');
  if (existsSync(agentsDirectory)) {
    for (const name of readdirSync(agentsDirectory).sort()) {
      if (/\.ya?ml$/i.test(name)) files.push(resolve(agentsDirectory, name));
    }
  } else {
    files.push(resolve(agentkitRoot, 'spec', 'agents.yaml'));
  }
  return files.filter(existsSync);
}

function specProvenance(agentkitRoot, contract) {
  const files = sourceFiles(agentkitRoot);
  const sourcePaths = files.map((path) => relative(agentkitRoot, path).replace(/\\/g, '/'));
  const digestInput = files
    .map((path, index) => `${sourcePaths[index]}\n${normalizedText(path)}`)
    .join('\n');
  let generatorVersion = '0.0.0';
  try {
    generatorVersion = JSON.parse(
      readFileSync(resolve(agentkitRoot, 'package.json'), 'utf-8')
    ).version;
  } catch {
    // A copied contract-only fixture has no package metadata. Keep an explicit fallback.
  }
  return {
    generator: 'retort',
    generatorVersion,
    contract: contract.lock.contract,
    contractSchemaVersion: contract.lock.schemaVersion,
    contractSourceRevision: contract.lock.sourceRevision,
    specDigest: sha256(digestInput),
    sourcePaths,
    authorityPromotion: false,
  };
}

function existingExtensionsById(items = [], key) {
  return new Map(
    items.filter((item) => item?.extensions).map((item) => [item[key], item.extensions])
  );
}

function buildRoles(agentkitRoot, existing) {
  const agentsSpec = loadAgentsSpec(agentkitRoot);
  const previousExtensions = existingExtensionsById(existing?.roles, 'stableAlias');
  const roles = [];
  for (const [category, agents] of Object.entries(agentsSpec.agents || {})) {
    for (const agent of agents || []) {
      const stableAlias = safeAlias(agent.id, 'agent');
      const capabilities = [
        ...new Set((agent.accepts || []).map((value) => safeAlias(value, 'inspect'))),
      ];
      const role = {
        stableAlias,
        displayName: boundedText(agent.name, stableAlias, 80),
        axis: 'horizontal',
        purpose: boundedText(agent.role, `Perform ${category} work.`, 500),
        capabilities: capabilities.length > 0 ? capabilities : ['inspect'],
        authority: {
          ceiling: 'read-only',
          allowedTools: [],
          allowedEffects: ['read-repository'],
          workspaceRoots: ['.'],
          networkAllowlist: [],
          dataClasses: ['internal'],
          externalEffectPolicy: 'deny',
          mergePolicy: 'deny',
          budget: { maxDurationSeconds: 900, maxAttempts: 1 },
        },
        prohibitedEffects: PROHIBITED_EFFECTS,
      };
      if (previousExtensions.has(stableAlias)) {
        role.extensions = previousExtensions.get(stableAlias);
      }
      roles.push(role);
    }
  }
  roles.sort((left, right) => left.stableAlias.localeCompare(right.stableAlias));
  const aliases = roles.map((role) => role.stableAlias);
  if (roles.length === 0) throw new Error('cannot generate a harness manifest without agent roles');
  if (new Set(aliases).size !== aliases.length) {
    throw new Error('agent specs produce duplicate stable role aliases');
  }
  return roles;
}

export function buildHarnessManifest({ agentkitRoot, existing = null, now }) {
  const contract = loadHarnessContract(agentkitRoot);
  if (!contract.ok) {
    throw new Error(contract.errors?.join('; ') || 'unable to load harness contract');
  }
  const project = readYaml(resolve(agentkitRoot, 'spec', 'project.yaml')) || {};
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(project.githubSlug || '')) {
    throw new Error('spec/project.yaml must define a valid githubSlug for harness ownership');
  }
  const provenance = specProvenance(agentkitRoot, contract);
  const roles = buildRoles(agentkitRoot, existing);
  const actorRole = roles.some((role) => role.stableAlias === 'spec-compliance-auditor')
    ? 'spec-compliance-auditor'
    : roles[0].stableAlias;
  const previousWorkflowExtensions = existingExtensionsById(existing?.workflows, 'id');
  const workflow = {
    id: 'validate-harness',
    purpose: 'Validate the generated repository harness against the pinned offline contract.',
    complexityTiers: [0],
    executionPattern: 'deterministic',
    gates: [],
    steps: [
      {
        id: 'validate-contract',
        actorRole,
        operation: 'Validate the manifest and report contract or semantic errors.',
        dependsOn: [],
        authority: 'read-only',
        retry: {
          maxAttempts: 1,
          backoff: 'none',
          overallDeadlineSeconds: 900,
          ambiguousOutcomePolicy: 'stop',
        },
        idempotencyRequired: true,
        gateRefs: [],
      },
    ],
  };
  if (previousWorkflowExtensions.has(workflow.id)) {
    workflow.extensions = previousWorkflowExtensions.get(workflow.id);
  }
  const extensions = { ...(existing?.extensions || {}), [PROVENANCE_KEY]: provenance };
  const createdAt = existing?.metadata?.createdAt || now || new Date().toISOString();
  const metadata = {
    id: `${safeAlias(project.name, 'repository')}-harness`,
    version: contract.lock.schemaVersion,
    createdAt,
    ownerRepository: project.githubSlug,
  };
  if (existing?.metadata?.updatedAt) metadata.updatedAt = existing.metadata.updatedAt;
  return {
    manifest: {
      apiVersion: API_VERSION,
      kind: 'HarnessManifest',
      metadata,
      lifecycleState: 'specified',
      ownership: {
        doctrine: 'org-meta',
        ledger: 'baton',
        distribution: 'retort',
        runtime: 'cognitive-mesh',
        modelPolicy: 'sluice',
        costAttribution: 'docket',
        reviewEvidence: 'codeflow',
        product: safeAlias(project.name, 'repository'),
      },
      roles,
      skills: [],
      commands: [],
      hooks: [],
      teams: [],
      workflows: [workflow],
      promotionPolicy: {
        lifecycle: ['proposed', 'specified', 'harnessed', 'verified', 'promoted'],
        humanDecisionRequiredFor: ['merge'],
        evidenceRetentionDays: 90,
        restrictionTriggers: ['authority expansion', 'external effects', 'contract drift'],
      },
      extensions,
    },
    provenance,
  };
}

export function createLineDiff(before, after) {
  if (before === after) return '';
  const oldLines = before ? before.replace(/\n$/, '').split('\n') : [];
  const newLines = after.replace(/\n$/, '').split('\n');
  const lengths = Array.from(
    { length: oldLines.length + 1 },
    () => new Uint32Array(newLines.length + 1)
  );
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex--) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex--) {
      lengths[oldIndex][newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? lengths[oldIndex + 1][newIndex + 1] + 1
          : Math.max(lengths[oldIndex + 1][newIndex], lengths[oldIndex][newIndex + 1]);
    }
  }
  const lines = ['--- existing', '+++ generated'];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === newLines[newIndex]
    ) {
      lines.push(` ${oldLines[oldIndex]}`);
      oldIndex++;
      newIndex++;
    } else if (
      newIndex < newLines.length &&
      (oldIndex === oldLines.length ||
        lengths[oldIndex][newIndex + 1] >= lengths[oldIndex + 1][newIndex])
    ) {
      lines.push(`+${newLines[newIndex++]}`);
    } else {
      lines.push(`-${oldLines[oldIndex++]}`);
    }
  }
  return lines.join('\n');
}

export function generateHarnessManifest({ agentkitRoot, projectRoot, flags = {}, now }) {
  try {
    const outputPath = resolveInsideProject(projectRoot, flags.output || DEFAULT_OUTPUT);
    const existing = readExistingManifest(outputPath);
    const timestamp = now || new Date().toISOString();
    const built = buildHarnessManifest({ agentkitRoot, existing, now: timestamp });
    let serialized = `${JSON.stringify(built.manifest, null, 2)}\n`;
    const previous = existing ? `${JSON.stringify(existing, null, 2)}\n` : '';
    let changed = previous !== serialized;
    if (changed && existing) {
      built.manifest.metadata.updatedAt = timestamp;
      serialized = `${JSON.stringify(built.manifest, null, 2)}\n`;
      changed = previous !== serialized;
    }
    const validation = validateHarnessValue(agentkitRoot, built.manifest);
    if (!validation.ok) {
      return { ...validation, changed: false, written: false, outputPath };
    }
    const dryRun = Boolean(flags['dry-run']);
    if (changed && !dryRun) {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, serialized, 'utf-8');
    }
    const preservedExtensionKeys = Object.keys(existing?.extensions || {}).filter(
      (key) => key !== PROVENANCE_KEY
    );
    return {
      ...validation,
      ok: true,
      changed,
      written: changed && !dryRun,
      outputPath,
      relativeOutputPath: relative(projectRoot, outputPath).replace(/\\/g, '/'),
      preservedExtensionKeys,
      provenance: built.provenance,
      diff: flags.diff && changed ? createLineDiff(previous, serialized) : '',
    };
  } catch (error) {
    return { ok: false, errors: [error.message], changed: false, written: false };
  }
}
