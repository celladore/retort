/**
 * Retort — Agent Harnessing v1 contract consumer.
 *
 * org-meta owns the canonical contract. Retort ships an immutable, digest-locked
 * snapshot so validation works on clean machines and in CI without network access.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve, sep } from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const LOCK_PATH = 'contracts/agent-harnessing-v1.lock.json';
const EXPECTED_CONTRACT = 'harness.neuralliquid.dev/v1alpha1';

function readJson(path) {
  try {
    return { value: JSON.parse(readFileSync(path, 'utf-8')), error: null };
  } catch (error) {
    return { value: null, error: `${path}: ${error.message}` };
  }
}

function normalizedSha256(path) {
  const bytes = readFileSync(path);
  const normalized = Buffer.from(bytes.toString('utf-8').replace(/\r\n/g, '\n'), 'utf-8');
  return createHash('sha256').update(normalized).digest('hex');
}

function resolveInside(root, relativePath) {
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, relativePath);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`contract path escapes .agentkit: ${relativePath}`);
  }
  return target;
}

function formatAjvErrors(errors = []) {
  return errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ');
}

function validateDocumentSemantics(document) {
  const errors = [];

  if (document.kind === 'HarnessManifest') {
    const aliases = document.roles.map((role) => role.stableAlias);
    const declaredRoles = new Set(aliases);
    if (declaredRoles.size !== aliases.length) {
      errors.push('HarnessManifest contains duplicate role stableAlias values');
    }
    for (const workflow of document.workflows) {
      for (const step of workflow.steps) {
        if (!declaredRoles.has(step.actorRole)) {
          errors.push(
            `${workflow.id}/${step.id}: actorRole ${step.actorRole} is not declared in roles`
          );
        }
      }
    }
  }

  if (document.kind === 'PromotionDecision' && document.decision === 'promote') {
    const failedCritical = document.gateResults
      .filter((gate) => gate.critical === true && gate.status !== 'pass')
      .map((gate) => gate.gateId);
    if (failedCritical.length > 0) {
      errors.push(`promotion has non-passing critical gates: ${failedCritical.join(', ')}`);
    }
  }

  return errors;
}

export function loadHarnessContract(agentkitRoot) {
  const lockFile = resolve(agentkitRoot, LOCK_PATH);
  if (!existsSync(lockFile)) {
    return { ok: false, errors: [`contract lock missing: ${lockFile}`] };
  }

  const lockResult = readJson(lockFile);
  if (lockResult.error) return { ok: false, errors: [lockResult.error] };
  const lock = lockResult.value;
  const errors = [];

  if (lock.contract !== EXPECTED_CONTRACT) errors.push(`unexpected contract: ${lock.contract}`);
  if (lock.lifecycle !== 'specified') errors.push(`unexpected lifecycle: ${lock.lifecycle}`);
  if (lock.authorityPromotion !== false) errors.push('contract lock cannot promote authority');

  let schemaFile;
  try {
    schemaFile = resolveInside(agentkitRoot, lock.vendoredPath);
  } catch (error) {
    errors.push(error.message);
    return { ok: false, errors, lock };
  }

  if (!existsSync(schemaFile)) {
    errors.push(`vendored schema missing: ${schemaFile}`);
    return { ok: false, errors, lock, schemaFile };
  }

  const digest = normalizedSha256(schemaFile);
  if (digest !== lock.sha256) {
    errors.push(`schema digest mismatch: expected ${lock.sha256}, got ${digest}`);
    return { ok: false, errors, lock, schemaFile, digest };
  }

  const schemaResult = readJson(schemaFile);
  if (schemaResult.error) {
    errors.push(schemaResult.error);
    return { ok: false, errors, lock, schemaFile, digest };
  }
  const schema = schemaResult.value;
  if (schema.$id !== lock.canonicalId) {
    errors.push(`schema id mismatch: expected ${lock.canonicalId}, got ${schema.$id}`);
  }

  let validate;
  try {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    validate = ajv.compile(schema);
  } catch (error) {
    errors.push(`schema compile failed: ${error.message}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    lock,
    schema,
    schemaFile,
    digest,
    validate,
  };
}

export function validateHarnessDocument(agentkitRoot, documentPath) {
  const contract = loadHarnessContract(agentkitRoot);
  if (!contract.ok) return contract;

  const documentResult = readJson(documentPath);
  if (documentResult.error) {
    return { ...contract, ok: false, errors: [documentResult.error], documentPath };
  }

  const document = documentResult.value;
  const schemaValid = contract.validate(document);
  const errors = schemaValid ? [] : [formatAjvErrors(contract.validate.errors)];
  if (schemaValid) errors.push(...validateDocumentSemantics(document));

  return {
    ...contract,
    ok: errors.length === 0,
    errors,
    document,
    documentPath,
  };
}

export async function runHarness({ agentkitRoot, projectRoot, flags = {} }) {
  const action = flags._args?.[0] || 'doctor';
  let result;

  if (action === 'doctor') {
    result = loadHarnessContract(agentkitRoot);
  } else if (action === 'validate') {
    const requestedPath = flags.document || flags._args?.[1];
    if (!requestedPath) {
      result = { ok: false, errors: ['harness validate requires --document <path>'] };
    } else {
      result = validateHarnessDocument(agentkitRoot, resolve(projectRoot, requestedPath));
    }
  } else {
    result = { ok: false, errors: [`unknown harness action: ${action}`] };
  }

  const output = {
    status: result.ok ? 'passed' : 'failed',
    action,
    expectedContract: EXPECTED_CONTRACT,
    contract: result.lock?.contract ?? null,
    sourceRevision: result.lock?.sourceRevision ?? null,
    lifecycle: result.lock?.lifecycle ?? null,
    authorityPromotion: result.lock?.authorityPromotion ?? null,
    errors: result.errors,
  };

  if (flags.json) {
    console.log(JSON.stringify(output));
  } else if (result.ok) {
    console.log(
      `[retort:harness] ${action} passed — ${output.contract} @ ${output.sourceRevision}`
    );
  } else {
    console.error(`[retort:harness] ${action} failed`);
    for (const error of result.errors) console.error(`  - ${error}`);
  }

  return { ...result, output };
}
