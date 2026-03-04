/**
 * AgentKit Forge — Agent Integration Engine
 * Cross-agent notification processing, auto-delegation, coverage tracking,
 * and acceptance criteria enforcement.
 *
 * Addresses gaps in agent coordination:
 * - Gap 1: Processes `notifies` field from agents.yaml
 * - Gap 2: Auto-creates test tasks after engineering task completion
 * - Gap 3: Coverage threshold enforcement integration
 * - Gap 4: Auto-triggers integration-tester when backend+frontend complete
 * - Gap 7: Routes test failures to testing team in Phase 4
 * - Gap 8: Enforces test acceptance criteria on task completion
 */
import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'path';
import { createTask, listTasks, TERMINAL_STATES } from './task-protocol.mjs';
import { appendEvent } from './events.mjs';

// ---------------------------------------------------------------------------
// Agent notification map
// ---------------------------------------------------------------------------

/**
 * Load the notifies map from agents.yaml.
 * Returns a map of agent-id → string[] of agent-ids to notify on task completion.
 * @param {string} agentkitRoot
 * @returns {{ agentNotifies: Record<string, string[]>, teamToAgents: Record<string, string[]> }}
 */
export function loadAgentNotifies(agentkitRoot) {
  const agentNotifies = {};
  const teamToAgents = {};

  const agentsPath = resolve(agentkitRoot, 'spec', 'agents.yaml');
  if (!existsSync(agentsPath)) {
    return { agentNotifies, teamToAgents };
  }

  try {
    const spec = yaml.load(readFileSync(agentsPath, 'utf-8'));
    if (!spec?.agents || typeof spec.agents !== 'object') {
      return { agentNotifies, teamToAgents };
    }

    for (const [category, agents] of Object.entries(spec.agents)) {
      if (!Array.isArray(agents)) continue;
      for (const agent of agents) {
        if (!agent?.id) continue;

        // Build notifies map
        if (Array.isArray(agent.notifies) && agent.notifies.length > 0) {
          agentNotifies[agent.id] = [...agent.notifies];
        }

        // Build category → agents map
        if (!teamToAgents[category]) {
          teamToAgents[category] = [];
        }
        teamToAgents[category].push(agent.id);
      }
    }
  } catch (err) {
    console.warn(
      `[agentkit:integration] Could not load agents.yaml: ${err?.message ?? String(err)}`
    );
  }

  return { agentNotifies, teamToAgents };
}

/**
 * Load handoff-chain from teams.yaml.
 * Returns a map of team-id → string[] of downstream team-ids.
 * @param {string} agentkitRoot
 * @returns {Record<string, string[]>}
 */
export function loadTeamHandoffChains(agentkitRoot) {
  const chains = {};
  const teamsPath = resolve(agentkitRoot, 'spec', 'teams.yaml');
  if (!existsSync(teamsPath)) return chains;

  try {
    const spec = yaml.load(readFileSync(teamsPath, 'utf-8'));
    if (!Array.isArray(spec?.teams)) return chains;

    for (const team of spec.teams) {
      if (!team?.id) continue;
      if (Array.isArray(team['handoff-chain']) && team['handoff-chain'].length > 0) {
        chains[team.id] = [...team['handoff-chain']];
      }
    }
  } catch (err) {
    console.warn(
      `[agentkit:integration] Could not load teams.yaml: ${err?.message ?? String(err)}`
    );
  }

  return chains;
}

// ---------------------------------------------------------------------------
// Notification processing (Gap 1)
// ---------------------------------------------------------------------------

/**
 * Process notifications for a completed task.
 * Creates lightweight review/notification tasks for agents in the notifies list.
 *
 * @param {string} projectRoot
 * @param {object} completedTask - The task that just completed
 * @param {Record<string, string[]>} agentNotifies - Agent-id → notifies map
 * @returns {Promise<{ created: object[], errors: string[] }>}
 */
export async function processNotifications(projectRoot, completedTask, agentNotifies) {
  const created = [];
  const errors = [];

  if (!completedTask || completedTask.status !== 'completed') {
    return { created, errors };
  }

  const assignees = Array.isArray(completedTask.assignees) ? completedTask.assignees : [];

  // Collect all agents that should be notified based on the task's assignees
  const toNotify = new Set();
  for (const assignee of assignees) {
    // Try direct agent ID match (e.g., "backend" agent notifies "test-lead")
    const agentId = assignee.replace(/^team-/, '');
    if (agentNotifies[agentId]) {
      for (const target of agentNotifies[agentId]) {
        toNotify.add(target);
      }
    }
  }

  if (toNotify.size === 0) {
    return { created, errors };
  }

  // Check for existing notification tasks to avoid duplicates
  const { tasks: existingTasks } = await listTasks(projectRoot);
  const existingNotifTargets = new Set();
  for (const t of existingTasks) {
    if (t.context?.notificationFrom === completedTask.id) {
      for (const a of t.assignees || []) {
        existingNotifTargets.add(a);
      }
    }
  }

  for (const targetAgent of toNotify) {
    // Map agent-id to team-id for task assignment
    const teamId = targetAgent.startsWith('team-') ? targetAgent : `team-${targetAgent}`;

    // Skip if already notified
    if (existingNotifTargets.has(teamId)) continue;

    // Don't notify the same team that completed the task
    if (assignees.includes(teamId)) continue;

    const result = await createTask(projectRoot, {
      type: 'review',
      delegator: 'orchestrator',
      assignees: [teamId],
      title: `[Notification] Review: ${completedTask.title}`,
      description:
        `Task ${completedTask.id} completed by ${assignees.join(', ')}. ` +
        `Review the changes and provide feedback.\n\n` +
        `Original task: ${completedTask.title}\n` +
        `Artifacts: ${(completedTask.artifacts || []).length} items`,
      priority: completedTask.priority || 'P2',
      context: {
        notificationFrom: completedTask.id,
        notificationFromTeam: assignees.join(', '),
        previousArtifacts: completedTask.artifacts || [],
      },
    });

    if (result.error) {
      errors.push(`Failed to notify ${targetAgent}: ${result.error}`);
    } else {
      created.push(result.task);
    }
  }

  return { created, errors };
}

// ---------------------------------------------------------------------------
// Auto test delegation (Gap 2, Gap 4)
// ---------------------------------------------------------------------------

/**
 * Auto-create test tasks when engineering tasks complete.
 * Creates test tasks for the testing team based on the completed task's scope.
 *
 * @param {string} projectRoot
 * @param {object} completedTask - The task that just completed
 * @param {Record<string, string[]>} handoffChains - Team handoff chain map
 * @returns {Promise<{ created: object|null, error?: string }>}
 */
export async function autoCreateTestTask(projectRoot, completedTask, handoffChains) {
  if (!completedTask || completedTask.status !== 'completed') {
    return { created: null };
  }

  const assignees = Array.isArray(completedTask.assignees) ? completedTask.assignees : [];

  // Only auto-create test tasks for engineering teams (not for testing/docs/security teams)
  const engineeringTeams = [
    'team-backend',
    'team-frontend',
    'team-data',
    'team-infra',
    'team-devops',
    'backend',
    'frontend',
    'data',
    'infra',
    'devops',
  ];
  const isEngineeringTask = assignees.some((a) => engineeringTeams.includes(a));
  if (!isEngineeringTask) {
    return { created: null };
  }

  // Check if a test task already exists for this completed task
  const { tasks: existingTasks } = await listTasks(projectRoot);
  const existingTestTask = existingTasks.find(
    (t) => t.context?.testFor === completedTask.id && t.type === 'test'
  );
  if (existingTestTask) {
    return { created: null };
  }

  // Also check if handoffTo already includes testing
  if (
    Array.isArray(completedTask.handoffTo) &&
    completedTask.handoffTo.some((h) => h === 'testing' || h === 'team-testing')
  ) {
    return { created: null };
  }

  // Extract changed files from artifacts
  const changedFiles = [];
  for (const artifact of completedTask.artifacts || []) {
    if (artifact.type === 'files-changed' && Array.isArray(artifact.paths)) {
      changedFiles.push(...artifact.paths);
    }
  }

  const result = await createTask(projectRoot, {
    type: 'test',
    delegator: 'orchestrator',
    assignees: ['team-testing'],
    title: `[Auto-test] Verify: ${completedTask.title}`,
    description:
      `Automatically created test task for completed engineering work.\n\n` +
      `Source task: ${completedTask.id} (${completedTask.title})\n` +
      `Completed by: ${assignees.join(', ')}\n` +
      `Changed files: ${changedFiles.length > 0 ? changedFiles.join(', ') : 'See artifacts'}\n\n` +
      `Requirements:\n` +
      `1. Verify tests exist for all changed behavior\n` +
      `2. Run the test suite and confirm all tests pass\n` +
      `3. Check coverage on changed files\n` +
      `4. Add missing tests if coverage is insufficient`,
    priority: completedTask.priority || 'P2',
    dependsOn: [completedTask.id],
    scope: completedTask.scope || [],
    context: {
      testFor: completedTask.id,
      testForTeam: assignees.join(', '),
      changedFiles,
      previousArtifacts: completedTask.artifacts || [],
    },
  });

  return result.error ? { created: null, error: result.error } : { created: result.task };
}

/**
 * Check if both backend and frontend tasks for a feature are complete,
 * and auto-create an integration test task if so.
 *
 * @param {string} projectRoot
 * @param {object} completedTask - The task that just completed
 * @returns {Promise<{ created: object|null, error?: string }>}
 */
export async function autoCreateIntegrationTestTask(projectRoot, completedTask) {
  if (!completedTask || completedTask.status !== 'completed') {
    return { created: null };
  }

  const assignees = Array.isArray(completedTask.assignees) ? completedTask.assignees : [];
  const isBackendOrFrontend = assignees.some((a) =>
    ['team-backend', 'backend', 'team-frontend', 'frontend'].includes(a)
  );
  if (!isBackendOrFrontend) {
    return { created: null };
  }

  // Find if there's a complementary task (backend ↔ frontend) that's also completed
  const { tasks } = await listTasks(projectRoot);
  const isBackend = assignees.some((a) => a === 'team-backend' || a === 'backend');
  const complementTeam = isBackend ? 'team-frontend' : 'team-backend';

  // Look for a related completed task from the complement team
  const complementTask = tasks.find(
    (t) =>
      t.status === 'completed' &&
      Array.isArray(t.assignees) &&
      t.assignees.some((a) => a === complementTeam || a === complementTeam.replace('team-', ''))
  );

  if (!complementTask) {
    return { created: null };
  }

  // Check if integration test already exists
  const existingIntegrationTest = tasks.find(
    (t) =>
      t.context?.integrationTestFor &&
      (t.context.integrationTestFor.includes(completedTask.id) ||
        t.context.integrationTestFor.includes(complementTask.id))
  );
  if (existingIntegrationTest) {
    return { created: null };
  }

  const result = await createTask(projectRoot, {
    type: 'test',
    delegator: 'orchestrator',
    assignees: ['team-testing'],
    title: `[Integration test] Cross-team verification`,
    description:
      `Both backend and frontend tasks have completed. ` +
      `Run integration tests to verify cross-service interaction.\n\n` +
      `Backend task: ${isBackend ? completedTask.id : complementTask.id}\n` +
      `Frontend task: ${isBackend ? complementTask.id : completedTask.id}\n\n` +
      `Requirements:\n` +
      `1. Run E2E/integration test suite\n` +
      `2. Verify API contract compliance\n` +
      `3. Test user workflows that span both layers\n` +
      `4. Report any cross-team integration issues`,
    priority: 'P1',
    dependsOn: [completedTask.id, complementTask.id],
    context: {
      integrationTestFor: [completedTask.id, complementTask.id],
      integrationTestType: 'backend-frontend',
    },
  });

  return result.error ? { created: null, error: result.error } : { created: result.task };
}

// ---------------------------------------------------------------------------
// Auto documentation delegation (identified gap for docs agent)
// ---------------------------------------------------------------------------

/**
 * Auto-create documentation tasks when tasks with public-facing changes complete.
 *
 * @param {string} projectRoot
 * @param {object} completedTask - The task that just completed
 * @param {Record<string, string[]>} handoffChains - Team handoff chain map
 * @returns {Promise<{ created: object|null, error?: string }>}
 */
export async function autoCreateDocTask(projectRoot, completedTask, handoffChains) {
  if (!completedTask || completedTask.status !== 'completed') {
    return { created: null };
  }

  const assignees = Array.isArray(completedTask.assignees) ? completedTask.assignees : [];

  // Only create doc tasks for teams that have 'docs' in their handoff-chain
  const teamId = assignees[0]?.replace(/^team-/, '');
  const chain = handoffChains[teamId] || [];
  if (!chain.includes('docs')) {
    return { created: null };
  }

  // Check for existing doc task
  const { tasks: existingTasks } = await listTasks(projectRoot);
  const existingDocTask = existingTasks.find(
    (t) => t.context?.docFor === completedTask.id && t.type === 'document'
  );
  if (existingDocTask) {
    return { created: null };
  }

  // Check if the task's artifacts indicate public-facing changes
  const changedFiles = [];
  for (const artifact of completedTask.artifacts || []) {
    if (artifact.type === 'files-changed' && Array.isArray(artifact.paths)) {
      changedFiles.push(...artifact.paths);
    }
  }

  // Heuristic: only create doc tasks if changes touch API, public, or config files
  const publicPatterns = [
    /\bapi\b/i,
    /\broutes?\b/i,
    /\bcontrollers?\b/i,
    /\bendpoints?\b/i,
    /\bpublic\b/i,
    /\bconfig\b/i,
    /\bschema\b/i,
    /\.openapi\b/i,
    /\bswagger\b/i,
    /README/i,
    /CHANGELOG/i,
  ];
  const hasPublicChanges = changedFiles.some((f) => publicPatterns.some((p) => p.test(f)));

  if (changedFiles.length === 0 || !hasPublicChanges) {
    return { created: null };
  }

  const result = await createTask(projectRoot, {
    type: 'document',
    delegator: 'orchestrator',
    assignees: ['team-docs'],
    title: `[Auto-docs] Document: ${completedTask.title}`,
    description:
      `Automatically created documentation task for public-facing changes.\n\n` +
      `Source task: ${completedTask.id} (${completedTask.title})\n` +
      `Completed by: ${assignees.join(', ')}\n\n` +
      `Requirements:\n` +
      `1. Update API documentation if endpoints changed\n` +
      `2. Update README if user-facing behavior changed\n` +
      `3. Add ADR if architectural decisions were made\n` +
      `4. Update CHANGELOG with notable changes`,
    priority: completedTask.priority === 'P0' ? 'P1' : 'P2',
    dependsOn: [completedTask.id],
    context: {
      docFor: completedTask.id,
      docForTeam: assignees.join(', '),
      changedFiles,
    },
  });

  return result.error ? { created: null, error: result.error } : { created: result.task };
}

// ---------------------------------------------------------------------------
// Auto security review delegation (identified gap for security agent)
// ---------------------------------------------------------------------------

/**
 * Auto-create security review tasks when infra/devops/auth-related tasks complete.
 *
 * @param {string} projectRoot
 * @param {object} completedTask - The task that just completed
 * @param {Record<string, string[]>} handoffChains - Team handoff chain map
 * @returns {Promise<{ created: object|null, error?: string }>}
 */
export async function autoCreateSecurityReviewTask(projectRoot, completedTask, handoffChains) {
  if (!completedTask || completedTask.status !== 'completed') {
    return { created: null };
  }

  const assignees = Array.isArray(completedTask.assignees) ? completedTask.assignees : [];

  // Only create security tasks for teams that have 'security' in their handoff-chain
  const teamId = assignees[0]?.replace(/^team-/, '');
  const chain = handoffChains[teamId] || [];
  if (!chain.includes('security')) {
    return { created: null };
  }

  // Check for existing security task
  const { tasks: existingTasks } = await listTasks(projectRoot);
  const existingSecTask = existingTasks.find(
    (t) => t.context?.securityReviewFor === completedTask.id && t.type === 'review'
  );
  if (existingSecTask) {
    return { created: null };
  }

  const changedFiles = [];
  for (const artifact of completedTask.artifacts || []) {
    if (artifact.type === 'files-changed' && Array.isArray(artifact.paths)) {
      changedFiles.push(...artifact.paths);
    }
  }

  const result = await createTask(projectRoot, {
    type: 'review',
    delegator: 'orchestrator',
    assignees: ['team-security'],
    title: `[Security review] ${completedTask.title}`,
    description:
      `Automatically created security review for infrastructure/auth changes.\n\n` +
      `Source task: ${completedTask.id} (${completedTask.title})\n` +
      `Completed by: ${assignees.join(', ')}\n\n` +
      `Requirements:\n` +
      `1. Review IAM/permission changes for least-privilege compliance\n` +
      `2. Check for hardcoded secrets or credentials\n` +
      `3. Verify encryption configurations\n` +
      `4. Audit CI/CD pipeline security (if applicable)`,
    priority: 'P1',
    dependsOn: [completedTask.id],
    context: {
      securityReviewFor: completedTask.id,
      securityReviewForTeam: assignees.join(', '),
      changedFiles,
    },
  });

  return result.error ? { created: null, error: result.error } : { created: result.task };
}

// ---------------------------------------------------------------------------
// Auto dependency audit (identified gap for dependency-watcher)
// ---------------------------------------------------------------------------

/**
 * Auto-create dependency audit tasks when lock files or manifests change.
 *
 * @param {string} projectRoot
 * @param {object} completedTask - The task that just completed
 * @returns {Promise<{ created: object|null, error?: string }>}
 */
export async function autoCreateDependencyAuditTask(projectRoot, completedTask) {
  if (!completedTask || completedTask.status !== 'completed') {
    return { created: null };
  }

  const changedFiles = [];
  for (const artifact of completedTask.artifacts || []) {
    if (artifact.type === 'files-changed' && Array.isArray(artifact.paths)) {
      changedFiles.push(...artifact.paths);
    }
  }

  // Detect dependency file changes
  const depFilePatterns = [
    /package\.json$/,
    /pnpm-lock\.yaml$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /Cargo\.toml$/,
    /Cargo\.lock$/,
    /pyproject\.toml$/,
    /requirements.*\.txt$/,
    /Pipfile\.lock$/,
    /\.csproj$/,
    /Directory\.Packages\.props$/,
    /go\.mod$/,
    /go\.sum$/,
  ];

  const depFilesChanged = changedFiles.filter((f) => depFilePatterns.some((p) => p.test(f)));

  if (depFilesChanged.length === 0) {
    return { created: null };
  }

  // Check for existing audit task
  const { tasks: existingTasks } = await listTasks(projectRoot);
  const existingAudit = existingTasks.find(
    (t) => t.context?.dependencyAuditFor === completedTask.id
  );
  if (existingAudit) {
    return { created: null };
  }

  const assignees = Array.isArray(completedTask.assignees) ? completedTask.assignees : [];

  const result = await createTask(projectRoot, {
    type: 'investigate',
    delegator: 'orchestrator',
    assignees: ['team-devops'],
    title: `[Dependency audit] Review dependency changes`,
    description:
      `Dependency files were modified. Audit for security vulnerabilities and compatibility.\n\n` +
      `Source task: ${completedTask.id} (${completedTask.title})\n` +
      `Changed by: ${assignees.join(', ')}\n` +
      `Dependency files changed:\n${depFilesChanged.map((f) => `  - ${f}`).join('\n')}\n\n` +
      `Requirements:\n` +
      `1. Run dependency vulnerability scan (npm audit, cargo audit, etc.)\n` +
      `2. Review new dependency additions for quality and license\n` +
      `3. Check for breaking changes in updated dependencies\n` +
      `4. Verify lock file integrity`,
    priority: 'P2',
    dependsOn: [completedTask.id],
    context: {
      dependencyAuditFor: completedTask.id,
      depFilesChanged,
    },
  });

  return result.error ? { created: null, error: result.error } : { created: result.task };
}

// ---------------------------------------------------------------------------
// Auto quality review (identified gap for quality team)
// ---------------------------------------------------------------------------

/**
 * Auto-create quality review tasks for the quality team when testing
 * team completes their test tasks, completing the testing→quality handoff-chain.
 *
 * @param {string} projectRoot
 * @param {object} completedTask - The task that just completed
 * @param {Record<string, string[]>} handoffChains - Team handoff chain map
 * @returns {Promise<{ created: object|null, error?: string }>}
 */
export async function autoCreateQualityReviewTask(projectRoot, completedTask, handoffChains) {
  if (!completedTask || completedTask.status !== 'completed') {
    return { created: null };
  }

  const assignees = Array.isArray(completedTask.assignees) ? completedTask.assignees : [];

  // Only route from testing team (testing→quality per handoff-chain)
  const teamId = assignees[0]?.replace(/^team-/, '');
  const chain = handoffChains[teamId] || [];
  if (!chain.includes('quality')) {
    return { created: null };
  }

  // Check for existing quality task
  const { tasks: existingTasks } = await listTasks(projectRoot);
  const existingQuality = existingTasks.find(
    (t) => t.context?.qualityReviewFor === completedTask.id
  );
  if (existingQuality) {
    return { created: null };
  }

  const result = await createTask(projectRoot, {
    type: 'review',
    delegator: 'orchestrator',
    assignees: ['team-quality'],
    title: `[Quality review] Post-test review: ${completedTask.title}`,
    description:
      `Testing complete. Quality review of implementation and test coverage.\n\n` +
      `Source task: ${completedTask.id} (${completedTask.title})\n` +
      `Completed by: ${assignees.join(', ')}\n\n` +
      `Requirements:\n` +
      `1. Review code quality and adherence to project patterns\n` +
      `2. Check for refactoring opportunities\n` +
      `3. Verify test quality (not just coverage)\n` +
      `4. Flag reliability concerns`,
    priority: completedTask.priority === 'P0' ? 'P1' : 'P2',
    dependsOn: [completedTask.id],
    context: {
      qualityReviewFor: completedTask.id,
      qualityReviewForTeam: assignees.join(', '),
    },
  });

  return result.error ? { created: null, error: result.error } : { created: result.task };
}

// ---------------------------------------------------------------------------
// Test failure routing (Gap 7)
// ---------------------------------------------------------------------------

/**
 * Route test/quality failures to the testing team instead of (or in addition to)
 * the engineering team that made the change.
 *
 * @param {string} projectRoot
 * @param {object} failedCheckResult - Result from runCheck
 * @param {string[]} changedFileTeams - Team IDs responsible for the changes
 * @returns {Promise<{ created: object|null, error?: string }>}
 */
export async function routeTestFailureToTestingTeam(
  projectRoot,
  failedCheckResult,
  changedFileTeams
) {
  if (!failedCheckResult || failedCheckResult.overallPassed) {
    return { created: null };
  }

  // Find which steps failed
  const failedSteps = [];
  for (const stack of failedCheckResult.stacks || []) {
    for (const step of stack.steps || []) {
      if (step.status === 'FAIL') {
        failedSteps.push({ stack: stack.stack, step: step.step, stderr: step.stderr });
      }
    }
  }

  // Only route to testing team if test or quality-related steps failed
  const testRelatedFailures = failedSteps.filter((f) =>
    ['test', 'lint', 'typecheck'].includes(f.step)
  );

  if (testRelatedFailures.length === 0) {
    return { created: null };
  }

  // Check for existing test failure task
  const { tasks: existingTasks } = await listTasks(projectRoot);
  const existingFailureTask = existingTasks.find(
    (t) => t.context?.testFailureRouting === true && !TERMINAL_STATES.includes(t.status)
  );
  if (existingFailureTask) {
    return { created: null };
  }

  const failureSummary = testRelatedFailures.map((f) => `${f.stack}:${f.step} — FAIL`).join('\n');

  const result = await createTask(projectRoot, {
    type: 'test',
    delegator: 'orchestrator',
    assignees: ['team-testing'],
    title: `[Test failure] Fix quality gate failures`,
    description:
      `Quality gate failed during validation phase.\n\n` +
      `Failed steps:\n${failureSummary}\n\n` +
      `Responsible teams: ${changedFileTeams.join(', ')}\n\n` +
      `Requirements:\n` +
      `1. Diagnose the test/quality failures\n` +
      `2. Determine if failures are from recent changes or pre-existing\n` +
      `3. Fix test failures or coordinate with the responsible engineering team\n` +
      `4. Ensure all quality gates pass`,
    priority: 'P1',
    context: {
      testFailureRouting: true,
      failedSteps: testRelatedFailures.map((f) => `${f.stack}:${f.step}`),
      responsibleTeams: changedFileTeams,
    },
  });

  return result.error ? { created: null, error: result.error } : { created: result.task };
}

// ---------------------------------------------------------------------------
// Test acceptance criteria enforcement (Gap 8)
// ---------------------------------------------------------------------------

/**
 * Validate that a completed task meets test acceptance criteria.
 * Returns warnings if tests appear to be missing from task artifacts.
 *
 * @param {object} task - The completed task to validate
 * @returns {{ passed: boolean, warnings: string[] }}
 */
export function validateTestAcceptanceCriteria(task) {
  const warnings = [];

  if (!task || task.status !== 'completed') {
    return { passed: true, warnings };
  }

  // Only enforce for implementation tasks
  if (task.type !== 'implement') {
    return { passed: true, warnings };
  }

  const artifacts = Array.isArray(task.artifacts) ? task.artifacts : [];

  // Check for test-results artifact
  const testResultArtifact = artifacts.find((a) => a.type === 'test-results');
  if (!testResultArtifact) {
    warnings.push(
      `Task ${task.id}: No test-results artifact. Implementation tasks should include test results.`
    );
  } else {
    // Check if tests were actually added
    if (testResultArtifact.added === 0 && testResultArtifact.testsAdded === 0) {
      warnings.push(
        `Task ${task.id}: No new tests added (testsAdded=0). Implementation should include tests for new behavior.`
      );
    }

    // Check for test failures
    if (testResultArtifact.failed > 0) {
      warnings.push(
        `Task ${task.id}: ${testResultArtifact.failed} test(s) failed. Task should not be marked complete with failing tests.`
      );
    }
  }

  // Check if files-changed artifact exists
  const filesChangedArtifact = artifacts.find((a) => a.type === 'files-changed');
  if (filesChangedArtifact && Array.isArray(filesChangedArtifact.paths)) {
    const sourceFiles = filesChangedArtifact.paths.filter(
      (p) => !p.includes('.test.') && !p.includes('.spec.') && !p.includes('__tests__')
    );
    const testFiles = filesChangedArtifact.paths.filter(
      (p) => p.includes('.test.') || p.includes('.spec.') || p.includes('__tests__')
    );

    if (sourceFiles.length > 0 && testFiles.length === 0) {
      warnings.push(
        `Task ${task.id}: ${sourceFiles.length} source file(s) changed but no test files modified. ` +
          `Consider adding tests for changed behavior.`
      );
    }
  }

  return {
    passed: warnings.length === 0,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Coverage threshold checking (Gap 3)
// ---------------------------------------------------------------------------

/**
 * Resolve the coverage command for a tech stack.
 * @param {object} stack - Stack config from teams.yaml techStacks
 * @param {string} [projectRoot] - Optional project root to inspect package.json for runner detection
 * @returns {{ command: string|null, parser: string }}
 */
export function resolveCoverageCommand(stack, projectRoot) {
  if (!stack?.testCommand) return { command: null, parser: 'unknown' };

  const testCmd = stack.testCommand;

  // Detect framework from explicit test command
  if (testCmd.includes('vitest')) {
    return {
      command: testCmd.replace(/vitest\s+run/, 'vitest run --coverage'),
      parser: 'vitest',
    };
  }
  if (testCmd.includes('jest')) {
    return { command: `${testCmd} --coverage`, parser: 'jest' };
  }
  if (testCmd.includes('pytest')) {
    return { command: `${testCmd} --cov=. --cov-report=json`, parser: 'pytest' };
  }
  if (testCmd.includes('cargo test')) {
    return { command: 'cargo tarpaulin --out json', parser: 'tarpaulin' };
  }
  if (testCmd.includes('dotnet test')) {
    return { command: `${testCmd} --collect:"XPlat Code Coverage"`, parser: 'dotnet' };
  }
  if (testCmd.includes('go test')) {
    return { command: `${testCmd} -coverprofile=coverage.out`, parser: 'go' };
  }

  // For generic commands like `pnpm test` or `npm test`, try to detect the
  // underlying runner from package.json devDependencies.
  if (testCmd.includes('pnpm test') || testCmd.includes('npm test')) {
    const runner = _detectTestRunner(projectRoot);
    if (runner === 'vitest') {
      return { command: `${testCmd} -- --coverage`, parser: 'vitest' };
    }
    if (runner === 'jest') {
      return { command: `${testCmd} -- --coverage`, parser: 'jest' };
    }
    // Unknown runner behind pnpm/npm test — skip rather than guessing
    return { command: null, parser: 'unknown' };
  }

  return { command: null, parser: 'unknown' };
}

/**
 * Detect the test runner from package.json devDependencies.
 * @param {string} [projectRoot]
 * @returns {'vitest'|'jest'|null}
 */
function _detectTestRunner(projectRoot) {
  if (!projectRoot) return null;
  try {
    const pkgPath = resolve(projectRoot, 'package.json');
    if (!existsSync(pkgPath)) return null;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const allDeps = {
      ...(pkg.devDependencies || {}),
      ...(pkg.dependencies || {}),
    };
    if (allDeps.vitest) return 'vitest';
    if (allDeps.jest) return 'jest';
    // Also check scripts.test for runner hints
    const testScript = pkg.scripts?.test || '';
    if (testScript.includes('vitest')) return 'vitest';
    if (testScript.includes('jest')) return 'jest';
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a coverage percentage from coverage output.
 * @param {string} stdout - Command output
 * @param {string} parser - Parser type from resolveCoverageCommand
 * @returns {number|null} Coverage percentage or null if unparseable
 */
export function parseCoveragePercentage(stdout, parser) {
  if (!stdout) return null;

  switch (parser) {
    case 'vitest':
    case 'jest': {
      // Look for "All files" line or "Statements" percentage
      const allFilesMatch = stdout.match(/All files\s*\|\s*([\d.]+)/);
      if (allFilesMatch) return parseFloat(allFilesMatch[1]);

      const stmtMatch = stdout.match(/Statements\s*:\s*([\d.]+)%/);
      if (stmtMatch) return parseFloat(stmtMatch[1]);
      return null;
    }
    case 'pytest': {
      const match = stdout.match(/TOTAL\s+\d+\s+\d+\s+([\d.]+)%/);
      return match ? parseFloat(match[1]) : null;
    }
    case 'tarpaulin': {
      const match = stdout.match(/([\d.]+)%\s*coverage/);
      return match ? parseFloat(match[1]) : null;
    }
    case 'go': {
      const match = stdout.match(/total:\s*\(statements\)\s*([\d.]+)%/);
      return match ? parseFloat(match[1]) : null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Incremental test validation (Gap 6)
// ---------------------------------------------------------------------------

/**
 * Match a file path against a simple glob pattern.
 * Supports double-star (any directory depth), single-star (any name segment),
 * and literal matches. E.g. "src/STAR-STAR/STAR.ts", "STAR.json", "Cargo.toml".
 *
 * @param {string} file
 * @param {string} pattern
 * @returns {boolean}
 */
function matchGlob(file, pattern) {
  // Exact match
  if (file === pattern) return true;

  // Convert glob pattern to regex
  // Escape regex-special characters except * and ?
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      // ** — match any path segment(s), including nested directories
      // Skip the optional trailing slash after **
      i += 2;
      if (pattern[i] === '/') i++;
      regex += '(?:.+/)?';
    } else if (ch === '*') {
      // * — match within a single path segment (no slashes)
      regex += '[^/]*';
      i++;
    } else if (ch === '?') {
      regex += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      regex += '\\' + ch;
      i++;
    } else {
      regex += ch;
      i++;
    }
  }

  // If pattern ends with /, match any file under that directory
  if (pattern.endsWith('/')) {
    return new RegExp('^' + regex).test(file);
  }

  return new RegExp('^' + regex + '$').test(file);
}

/**
 * Determine which test commands to run for a set of changed files.
 * Used for inter-round testing in Phase 3.
 *
 * @param {string[]} changedFiles - List of changed file paths
 * @param {object[]} techStacks - Tech stack configs from teams.yaml
 * @returns {{ stack: string, command: string }[]}
 */
export function getIncrementalTestCommands(changedFiles, techStacks) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return [];
  if (!Array.isArray(techStacks)) return [];

  const commands = [];
  for (const stack of techStacks) {
    if (!stack.testCommand) continue;

    // Check if any changed files match this stack's scope
    const scopes = Array.isArray(stack.scope) ? stack.scope : [];
    const matchesStack = changedFiles.some((file) =>
      scopes.some((scope) => matchGlob(file, scope))
    );

    if (matchesStack) {
      commands.push({ stack: stack.name, command: stack.testCommand });
    }
  }

  return commands;
}

// ---------------------------------------------------------------------------
// Unified post-completion processor
// ---------------------------------------------------------------------------

/**
 * Run all post-completion integrations for a completed task.
 * This is the main entry point called by the orchestrator after a task completes.
 *
 * @param {string} projectRoot
 * @param {string} agentkitRoot
 * @param {object} completedTask - The task that just completed
 * @returns {Promise<{ notifications: object[], testTasks: object[], docTasks: object[], securityTasks: object[], integrationTests: object[], warnings: string[], errors: string[] }>}
 */
export async function processTaskCompletion(projectRoot, agentkitRoot, completedTask) {
  const result = {
    notifications: [],
    testTasks: [],
    docTasks: [],
    securityTasks: [],
    integrationTests: [],
    dependencyAudits: [],
    qualityReviews: [],
    warnings: [],
    errors: [],
  };

  if (!completedTask || completedTask.status !== 'completed') {
    return result;
  }

  // Load configuration
  const { agentNotifies } = loadAgentNotifies(agentkitRoot);
  const handoffChains = loadTeamHandoffChains(agentkitRoot);

  // Gap 8: Validate test acceptance criteria
  const validation = validateTestAcceptanceCriteria(completedTask);
  if (!validation.passed) {
    result.warnings.push(...validation.warnings);
  }

  // Gap 1: Process notifications
  try {
    const notifResult = await processNotifications(projectRoot, completedTask, agentNotifies);
    result.notifications.push(...notifResult.created);
    result.errors.push(...notifResult.errors);
  } catch (err) {
    result.errors.push(`Notification processing failed: ${err?.message ?? String(err)}`);
  }

  // Gap 2: Auto-create test tasks
  try {
    const testResult = await autoCreateTestTask(projectRoot, completedTask, handoffChains);
    if (testResult.created) {
      result.testTasks.push(testResult.created);
    }
    if (testResult.error) {
      result.errors.push(testResult.error);
    }
  } catch (err) {
    result.errors.push(`Test task creation failed: ${err?.message ?? String(err)}`);
  }

  // Gap 4: Auto-create integration test tasks
  try {
    const intResult = await autoCreateIntegrationTestTask(projectRoot, completedTask);
    if (intResult.created) {
      result.integrationTests.push(intResult.created);
    }
    if (intResult.error) {
      result.errors.push(intResult.error);
    }
  } catch (err) {
    result.errors.push(`Integration test task creation failed: ${err?.message ?? String(err)}`);
  }

  // Auto-create documentation tasks (docs agent gap)
  try {
    const docResult = await autoCreateDocTask(projectRoot, completedTask, handoffChains);
    if (docResult.created) {
      result.docTasks.push(docResult.created);
    }
    if (docResult.error) {
      result.errors.push(docResult.error);
    }
  } catch (err) {
    result.errors.push(`Doc task creation failed: ${err?.message ?? String(err)}`);
  }

  // Auto-create security review tasks (security agent gap)
  try {
    const secResult = await autoCreateSecurityReviewTask(projectRoot, completedTask, handoffChains);
    if (secResult.created) {
      result.securityTasks.push(secResult.created);
    }
    if (secResult.error) {
      result.errors.push(secResult.error);
    }
  } catch (err) {
    result.errors.push(`Security task creation failed: ${err?.message ?? String(err)}`);
  }

  // Auto-create dependency audit tasks
  try {
    const depResult = await autoCreateDependencyAuditTask(projectRoot, completedTask);
    if (depResult.created) {
      result.dependencyAudits.push(depResult.created);
    }
    if (depResult.error) {
      result.errors.push(depResult.error);
    }
  } catch (err) {
    result.errors.push(`Dependency audit task creation failed: ${err?.message ?? String(err)}`);
  }

  // Auto-create quality review tasks (testing→quality chain)
  try {
    const qualResult = await autoCreateQualityReviewTask(projectRoot, completedTask, handoffChains);
    if (qualResult.created) {
      result.qualityReviews.push(qualResult.created);
    }
    if (qualResult.error) {
      result.errors.push(qualResult.error);
    }
  } catch (err) {
    result.errors.push(`Quality review task creation failed: ${err?.message ?? String(err)}`);
  }

  // Log the integration results as an event
  try {
    const totalCreated =
      result.notifications.length +
      result.testTasks.length +
      result.docTasks.length +
      result.securityTasks.length +
      result.integrationTests.length +
      result.dependencyAudits.length +
      result.qualityReviews.length;
    if (totalCreated > 0 || result.warnings.length > 0) {
      appendEvent(projectRoot, 'task_completion_processed', {
        sourceTaskId: completedTask.id,
        notificationsSent: result.notifications.length,
        testTasksCreated: result.testTasks.length,
        docTasksCreated: result.docTasks.length,
        securityTasksCreated: result.securityTasks.length,
        integrationTestsCreated: result.integrationTests.length,
        dependencyAuditsCreated: result.dependencyAudits.length,
        qualityReviewsCreated: result.qualityReviews.length,
        warnings: result.warnings.length,
        errors: result.errors.length,
      });
    }
  } catch {
    // Event logging is non-critical
  }

  return result;
}
