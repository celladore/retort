/**
 * AgentKit Forge — Spec Validator
 * Validates YAML spec files against expected schemas before sync.
 * Catches malformed configs early — before they produce broken output.
 */
import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import { resolve } from 'path';
import { VALID_TASK_TYPES } from './task-types.mjs';

// ---------------------------------------------------------------------------
// Schema definitions (lightweight — no external deps needed)
// ---------------------------------------------------------------------------

/**
 * Validates a value against a simple schema descriptor.
 * Returns an array of error strings (empty = valid).
 */
function validate(value, schema, path = '') {
  const errors = [];

  if (schema.required && (value === undefined || value === null)) {
    errors.push(`${path}: required but missing`);
    return errors;
  }
  if (value === undefined || value === null) return errors;

  if (schema.type === 'string' && typeof value !== 'string') {
    errors.push(`${path}: expected string, got ${typeof value}`);
  }
  if (schema.type === 'number' && typeof value !== 'number') {
    errors.push(`${path}: expected number, got ${typeof value}`);
  } else if (schema.type === 'number') {
    if (typeof schema.min === 'number' && value < schema.min) {
      errors.push(`${path}: must be >= ${schema.min}, got ${value}`);
    }
    if (typeof schema.max === 'number' && value > schema.max) {
      errors.push(`${path}: must be <= ${schema.max}, got ${value}`);
    }
  }

  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    errors.push(`${path}: expected boolean, got ${typeof value}`);
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array, got ${typeof value}`);
    } else if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        errors.push(...validate(value[i], schema.items, `${path}[${i}]`));
      }
    }
  }

  if (schema.type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path}: expected object, got ${Array.isArray(value) ? 'array' : typeof value}`);
    } else if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        errors.push(...validate(value[key], propSchema, `${path}.${key}`));
      }
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: must be one of [${schema.enum.join(', ')}], got "${value}"`);
  }

  if (schema.minLength && typeof value === 'string' && value.length < schema.minLength) {
    errors.push(`${path}: must be at least ${schema.minLength} characters`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Schema: teams.yaml
// ---------------------------------------------------------------------------
const teamSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', required: true, minLength: 1 },
    name: { type: 'string', required: true, minLength: 1 },
    focus: { type: 'string', required: true },
    scope: { type: 'array', required: true, items: { type: 'string' } },
  },
};

const techStackSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    buildCommand: { type: 'string', required: true },
    testCommand: { type: 'string', required: true },
    detect: { type: 'array', required: true, items: { type: 'string' } },
  },
};

// ---------------------------------------------------------------------------
// Schema: agents.yaml
// ---------------------------------------------------------------------------
const agentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', required: true, minLength: 1 },
    name: { type: 'string', required: true, minLength: 1 },
    role: { type: 'string', required: true },
    focus: { type: 'array', required: true, items: { type: 'string' } },
    responsibilities: { type: 'array', required: true, items: { type: 'string' } },
  },
};

// ---------------------------------------------------------------------------
// Schema: commands.yaml
// ---------------------------------------------------------------------------
const VALID_COMMAND_TYPES = ['workflow', 'team', 'utility'];
const VALID_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'];

const commandSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', required: true, minLength: 1 },
    type: { type: 'string', required: true, enum: VALID_COMMAND_TYPES },
    description: { type: 'string', required: true },
  },
};

// ---------------------------------------------------------------------------
// Schema: rules.yaml
// ---------------------------------------------------------------------------
const ruleConventionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', required: true, minLength: 1 },
    rule: { type: 'string', required: true },
    severity: { type: 'string', required: true, enum: ['critical', 'error', 'warning', 'info'] },
  },
};

const ruleDomainSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', required: true, minLength: 1 },
    description: { type: 'string', required: true },
    'applies-to': { type: 'array', required: true, items: { type: 'string' } },
    conventions: { type: 'array', required: true, items: ruleConventionSchema },
  },
};

// ---------------------------------------------------------------------------
// Schema: settings.yaml
// ---------------------------------------------------------------------------
const settingsSchema = {
  type: 'object',
  properties: {
    permissions: {
      type: 'object',
      required: true,
      properties: {
        allow: { type: 'array', required: true, items: { type: 'string' } },
        deny: { type: 'array', required: true, items: { type: 'string' } },
      },
    },
    hooks: { type: 'object', required: true },
  },
};

// ---------------------------------------------------------------------------
// Schema: project.yaml — enum value sets
// ---------------------------------------------------------------------------
const PROJECT_ENUMS = {
  phase: ['greenfield', 'active', 'maintenance', 'legacy'],
  architecturePattern: ['clean', 'hexagonal', 'mvc', 'microservices', 'monolith', 'serverless'],
  apiStyle: ['rest', 'graphql', 'grpc', 'mixed'],
  cloudProvider: ['aws', 'azure', 'gcp', 'vercel', 'netlify', 'self-hosted', 'none'],
  iacTool: ['terraform', 'bicep', 'pulumi', 'cdk', 'terragrunt', 'none'],
  branchStrategy: ['trunk-based', 'github-flow', 'gitflow'],
  commitConvention: ['conventional', 'semantic', 'none'],
  codeReview: ['required-pr', 'optional', 'none'],
  teamSize: ['solo', 'small', 'medium', 'large'],
  loggingFramework: [
    'serilog',
    'winston',
    'pino',
    'bunyan',
    'python-logging',
    'log4net',
    'nlog',
    'none',
  ],
  loggingLevel: ['trace', 'debug', 'information', 'warning', 'error', 'critical'],
  errorStrategy: ['problem-details', 'custom-envelope', 'raw', 'none'],
  authProvider: [
    'azure-ad',
    'azure-ad-b2c',
    'auth0',
    'firebase',
    'cognito',
    'keycloak',
    'custom-jwt',
    'none',
  ],
  authStrategy: ['jwt-bearer', 'cookie', 'session', 'api-key', 'oauth2-code'],
  cachingProvider: ['redis', 'memcached', 'in-memory', 'none'],
  apiVersioning: ['url-segment', 'header', 'query-string', 'media-type', 'none'],
  apiPagination: ['cursor', 'offset', 'keyset', 'none'],
  apiResponseFormat: ['envelope', 'raw', 'json-api', 'hal'],
  dbMigrations: ['code-first', 'sql-scripts', 'auto', 'none'],
  dbTransactionStrategy: ['unit-of-work', 'per-request', 'manual', 'none'],
  featureFlagProvider: [
    'launchdarkly',
    'azure-app-config',
    'unleash',
    'flagsmith',
    'custom',
    'none',
  ],
  envConfigStrategy: ['env-vars', 'config-files', 'vault', 'app-config', 'none'],
  monorepoTool: ['turborepo', 'nx', 'lerna', 'pnpm-workspaces'],
  // Infrastructure
  infraStateBackend: ['azurerm', 's3', 'gcs', 'consul', 'local', 'none'],
  infraLockProvider: ['blob-lease', 'dynamodb', 'consul', 'none'],
  // Observability
  monitoringProvider: [
    'azure-monitor',
    'datadog',
    'prometheus',
    'grafana-cloud',
    'cloudwatch',
    'none',
  ],
  alertingProvider: ['azure-monitor', 'pagerduty', 'opsgenie', 'grafana', 'none'],
  tracingProvider: ['application-insights', 'jaeger', 'zipkin', 'otel-collector', 'none'],
  // Compliance
  complianceFramework: ['soc2', 'iso27001', 'pci-dss', 'hipaa', 'gdpr', 'internal', 'none'],
  backupSchedule: ['daily', 'weekly', 'continuous', 'none'],
  auditEventBus: ['service-bus', 'event-hub', 'sns', 'none'],
};

// ---------------------------------------------------------------------------
// Schema: project.yaml
// ---------------------------------------------------------------------------
const projectSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    phase: { type: 'string', enum: PROJECT_ENUMS.phase },
    stack: {
      type: 'object',
      properties: {
        languages: { type: 'array', items: { type: 'string' } },
        frameworks: {
          type: 'object',
          properties: {
            frontend: { type: 'array', items: { type: 'string' } },
            backend: { type: 'array', items: { type: 'string' } },
            css: { type: 'array', items: { type: 'string' } },
          },
        },
        database: { type: 'array', items: { type: 'string' } },
        messaging: { type: 'array', items: { type: 'string' } },
      },
    },
    architecture: {
      type: 'object',
      properties: {
        pattern: { type: 'string', enum: PROJECT_ENUMS.architecturePattern },
        apiStyle: { type: 'string', enum: PROJECT_ENUMS.apiStyle },
        monorepoTool: { type: 'string', enum: PROJECT_ENUMS.monorepoTool },
      },
    },
    patterns: {
      type: 'object',
      properties: {
        repository: { type: 'boolean' },
        cqrs: { type: 'boolean' },
        eventSourcing: { type: 'boolean' },
        mediator: { type: 'boolean' },
        unitOfWork: { type: 'boolean' },
      },
    },
    deployment: {
      type: 'object',
      properties: {
        cloudProvider: { type: 'string', enum: PROJECT_ENUMS.cloudProvider },
        environments: { type: 'array', items: { type: 'string' } },
        iacTool: { type: 'string', enum: PROJECT_ENUMS.iacTool },
      },
    },
    infrastructure: {
      type: 'object',
      properties: {
        iacToolchain: { type: 'array', items: { type: 'string' } },
        stateBackend: { type: 'string', enum: PROJECT_ENUMS.infraStateBackend },
        lockProvider: { type: 'string', enum: PROJECT_ENUMS.infraLockProvider },
        tagging: {
          type: 'object',
          properties: {
            mandatory: { type: 'array', items: { type: 'string' } },
            optional: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    observability: {
      type: 'object',
      properties: {
        monitoring: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: PROJECT_ENUMS.monitoringProvider },
          },
        },
        alerting: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: PROJECT_ENUMS.alertingProvider },
            channels: { type: 'array', items: { type: 'string' } },
          },
        },
        tracing: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: PROJECT_ENUMS.tracingProvider },
            samplingRate: { type: 'number', min: 0, max: 1 },
          },
        },
        logging: {
          type: 'object',
          properties: {
            retentionDays: { type: 'number', min: 1 },
          },
        },
      },
    },
    compliance: {
      type: 'object',
      properties: {
        framework: { type: 'string', enum: PROJECT_ENUMS.complianceFramework },
        disasterRecovery: {
          type: 'object',
          properties: {
            rpoHours: { type: 'number' },
            rtoHours: { type: 'number' },
            backupSchedule: { type: 'string', enum: PROJECT_ENUMS.backupSchedule },
          },
        },
        audit: {
          type: 'object',
          properties: {
            eventBus: { type: 'string', enum: PROJECT_ENUMS.auditEventBus },
          },
        },
      },
    },
    process: {
      type: 'object',
      properties: {
        branchStrategy: { type: 'string', enum: PROJECT_ENUMS.branchStrategy },
        commitConvention: { type: 'string', enum: PROJECT_ENUMS.commitConvention },
        codeReview: { type: 'string', enum: PROJECT_ENUMS.codeReview },
        teamSize: { type: 'string', enum: PROJECT_ENUMS.teamSize },
      },
    },
    testing: {
      type: 'object',
      properties: {
        unit: { type: 'array', items: { type: 'string' } },
        integration: { type: 'array', items: { type: 'string' } },
        e2e: { type: 'array', items: { type: 'string' } },
        coverage: { type: 'number', min: 0, max: 100 },
      },
    },
    integrations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', required: true },
          purpose: { type: 'string', required: true },
        },
      },
    },
    crosscutting: {
      type: 'object',
      properties: {
        logging: {
          type: 'object',
          properties: {
            framework: { type: 'string', enum: PROJECT_ENUMS.loggingFramework },
            level: { type: 'string', enum: PROJECT_ENUMS.loggingLevel },
            sink: { type: 'array', items: { type: 'string' } },
          },
        },
        errorHandling: {
          type: 'object',
          properties: {
            strategy: { type: 'string', enum: PROJECT_ENUMS.errorStrategy },
          },
        },
        authentication: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: PROJECT_ENUMS.authProvider },
            strategy: { type: 'string', enum: PROJECT_ENUMS.authStrategy },
          },
        },
        caching: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: PROJECT_ENUMS.cachingProvider },
            patterns: { type: 'array', items: { type: 'string' } },
          },
        },
        api: {
          type: 'object',
          properties: {
            versioning: { type: 'string', enum: PROJECT_ENUMS.apiVersioning },
            pagination: { type: 'string', enum: PROJECT_ENUMS.apiPagination },
            responseFormat: { type: 'string', enum: PROJECT_ENUMS.apiResponseFormat },
          },
        },
        database: {
          type: 'object',
          properties: {
            migrations: { type: 'string', enum: PROJECT_ENUMS.dbMigrations },
            transactionStrategy: { type: 'string', enum: PROJECT_ENUMS.dbTransactionStrategy },
          },
        },
        featureFlags: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: PROJECT_ENUMS.featureFlagProvider },
          },
        },
        environments: {
          type: 'object',
          properties: {
            naming: { type: 'array', items: { type: 'string' } },
            configStrategy: { type: 'string', enum: PROJECT_ENUMS.envConfigStrategy },
          },
        },
      },
    },
  },
};

/**
 * Validates project.yaml against expected schema.
 * All fields are optional — returns errors only for values that are present but invalid.
 * @param {object} project - Parsed project.yaml content
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateProjectYaml(project) {
  const errors = [];
  const warnings = [];
  if (!project || typeof project !== 'object') return { errors, warnings };

  errors.push(...validate(project, projectSchema, 'project.yaml'));

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Cross-spec validation
// ---------------------------------------------------------------------------

function validateCrossReferences(specs) {
  const errors = [];

  const { teams, commands, agents } = specs;

  // Verify team commands reference valid team IDs
  const teamIds = new Set((teams?.teams || []).map((t) => t.id));
  for (const cmd of commands?.commands || []) {
    if (cmd.type === 'team' && cmd.team && !teamIds.has(cmd.team)) {
      errors.push(
        `commands.yaml: command "${cmd.name}" references team "${cmd.team}" which is not defined in teams.yaml`
      );
    }
  }

  // Check for duplicate team IDs
  const seenTeamIds = new Set();
  for (const team of teams?.teams || []) {
    if (seenTeamIds.has(team.id)) {
      errors.push(`teams.yaml: duplicate team id "${team.id}"`);
    }
    seenTeamIds.add(team.id);
  }

  // Check for duplicate command names
  const seenCommandNames = new Set();
  for (const cmd of commands?.commands || []) {
    if (seenCommandNames.has(cmd.name)) {
      errors.push(`commands.yaml: duplicate command name "${cmd.name}"`);
    }
    seenCommandNames.add(cmd.name);
  }

  // Check for duplicate agent IDs (across all categories) and collect all IDs
  const seenAgentIds = new Set();
  if (agents?.agents) {
    for (const [category, agentList] of Object.entries(agents.agents)) {
      if (!Array.isArray(agentList)) continue;
      for (const agent of agentList) {
        if (seenAgentIds.has(agent.id)) {
          errors.push(`agents.yaml: duplicate agent id "${agent.id}" (in category "${category}")`);
        }
        seenAgentIds.add(agent.id);
      }
    }
  }

  // Validate agent accepts, depends-on, notifies fields
  if (agents?.agents) {
    for (const [category, agentList] of Object.entries(agents.agents)) {
      if (!Array.isArray(agentList)) continue;
      for (const agent of agentList) {
        // accepts: optional array of valid task types
        if (agent.accepts !== undefined && agent.accepts !== null) {
          if (!Array.isArray(agent.accepts)) {
            errors.push(`agents.yaml: agent "${agent.id}" accepts must be an array`);
          } else {
            for (const t of agent.accepts) {
              if (!VALID_TASK_TYPES.includes(t)) {
                errors.push(
                  `agents.yaml: agent "${agent.id}" accepts invalid task type "${t}". Valid: ${VALID_TASK_TYPES.join(', ')}`
                );
              }
            }
          }
        }
        // depends-on: optional array of agent IDs
        const depsOn = agent['depends-on'];
        if (depsOn !== undefined && depsOn !== null) {
          if (!Array.isArray(depsOn)) {
            errors.push(`agents.yaml: agent "${agent.id}" depends-on must be an array`);
          } else {
            for (const dep of depsOn) {
              if (!seenAgentIds.has(dep)) {
                errors.push(
                  `agents.yaml: agent "${agent.id}" depends-on references unknown agent "${dep}"`
                );
              }
              if (dep === agent.id) {
                errors.push(`agents.yaml: agent "${agent.id}" depends-on cannot reference itself`);
              }
            }
          }
        }
        // notifies: optional array of agent IDs
        if (agent.notifies !== undefined && agent.notifies !== null) {
          if (!Array.isArray(agent.notifies)) {
            errors.push(`agents.yaml: agent "${agent.id}" notifies must be an array`);
          } else {
            for (const n of agent.notifies) {
              if (!seenAgentIds.has(n)) {
                errors.push(
                  `agents.yaml: agent "${agent.id}" notifies references unknown agent "${n}"`
                );
              }
              if (n === agent.id) {
                errors.push(`agents.yaml: agent "${agent.id}" notifies cannot reference itself`);
              }
            }
          }
        }
      }
    }
  }

  // Validate team accepts and handoff-chain fields
  const teamHandoffMap = new Map();
  for (const team of teams?.teams || []) {
    if (team.accepts !== undefined && team.accepts !== null) {
      if (!Array.isArray(team.accepts)) {
        errors.push(`teams.yaml: team "${team.id}" accepts must be an array`);
      } else {
        for (const t of team.accepts) {
          if (!VALID_TASK_TYPES.includes(t)) {
            errors.push(
              `teams.yaml: team "${team.id}" accepts invalid task type "${t}". Valid: ${VALID_TASK_TYPES.join(', ')}`
            );
          }
        }
      }
    }
    const chain = team['handoff-chain'];
    if (chain !== undefined && chain !== null) {
      if (!Array.isArray(chain)) {
        errors.push(`teams.yaml: team "${team.id}" handoff-chain must be an array`);
      } else {
        // Validate each element and collect errors for non-strings
        const validChain = [];
        chain.forEach((target, index) => {
          if (typeof target !== 'string') {
            errors.push(
              `teams.yaml: team "${team.id}" handoff-chain element at index ${index} must be a string`
            );
          } else {
            validChain.push(target);
          }
        });
        teamHandoffMap.set(team.id, validChain);
        for (const target of validChain) {
          if (!teamIds.has(target)) {
            errors.push(
              `teams.yaml: team "${team.id}" handoff-chain references unknown team "${target}"`
            );
          }
          if (target === team.id) {
            errors.push(`teams.yaml: team "${team.id}" handoff-chain cannot reference itself`);
          }
        }
      }
    }
  }

  // Detect transitive cycles in team handoff chains (A -> ... -> A)
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function detectHandoffCycle(teamId) {
    if (visiting.has(teamId)) {
      const cycleStart = stack.indexOf(teamId);
      const cycle = [...stack.slice(cycleStart), teamId];
      errors.push(`teams.yaml: handoff-chain cycle detected: ${cycle.join(' -> ')}`);
      return;
    }
    if (visited.has(teamId)) return;

    visiting.add(teamId);
    stack.push(teamId);
    const next = teamHandoffMap.get(teamId) || [];
    for (const target of next) {
      if (!teamIds.has(target)) continue;
      if (target === teamId) continue;
      detectHandoffCycle(target);
    }
    stack.pop();
    visiting.delete(teamId);
    visited.add(teamId);
  }

  for (const teamId of teamIds) {
    detectHandoffCycle(teamId);
  }

  // Check for duplicate rule convention IDs
  const seenRuleIds = new Set();
  for (const domain of specs.rules?.rules || []) {
    for (const conv of domain.conventions || []) {
      if (seenRuleIds.has(conv.id)) {
        errors.push(
          `rules.yaml: duplicate convention id "${conv.id}" (in domain "${domain.domain}")`
        );
      }
      seenRuleIds.add(conv.id);
    }
  }

  // Validate that allowed-tools in commands only reference known tools
  for (const cmd of commands?.commands || []) {
    for (const tool of cmd['allowed-tools'] || []) {
      if (!VALID_TOOLS.includes(tool)) {
        errors.push(`commands.yaml: command "${cmd.name}" references unknown tool "${tool}"`);
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates all spec YAML files and returns a structured result.
 * @param {string} agentkitRoot - Path to the .agentkit/ directory
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateSpec(agentkitRoot) {
  const errors = [];
  const warnings = [];
  const specDir = resolve(agentkitRoot, 'spec');

  // Helper to load and validate a YAML file
  function loadYaml(filename) {
    const filePath = resolve(specDir, filename);
    if (!existsSync(filePath)) {
      errors.push(`${filename}: file not found at ${filePath}`);
      return null;
    }
    try {
      return yaml.load(readFileSync(filePath, 'utf-8'));
    } catch (err) {
      errors.push(`${filename}: YAML parse error — ${err.message}`);
      return null;
    }
  }

  // Load all spec files
  const teams = loadYaml('teams.yaml');
  const agents = loadYaml('agents.yaml');
  const commands = loadYaml('commands.yaml');
  const rules = loadYaml('rules.yaml');
  const settings = loadYaml('settings.yaml');
  const aliases = loadYaml('aliases.yaml');
  const docs = loadYaml('docs.yaml');

  // project.yaml is optional — only validate if present
  const projectPath = resolve(specDir, 'project.yaml');
  if (existsSync(projectPath)) {
    try {
      const project = yaml.load(readFileSync(projectPath, 'utf-8'));
      if (project && typeof project === 'object') {
        const projectResult = validateProjectYaml(project);
        errors.push(...projectResult.errors);
        warnings.push(...projectResult.warnings);
      }
    } catch (err) {
      errors.push(`project.yaml: YAML parse error — ${err.message}`);
    }
  }

  // Validate teams.yaml
  if (teams) {
    if (!teams.teams || !Array.isArray(teams.teams)) {
      errors.push('teams.yaml: missing or invalid "teams" array');
    } else {
      for (let i = 0; i < teams.teams.length; i++) {
        errors.push(...validate(teams.teams[i], teamSchema, `teams.yaml.teams[${i}]`));
      }
    }
    if (teams.techStacks) {
      if (!Array.isArray(teams.techStacks)) {
        errors.push('teams.yaml: "techStacks" must be an array');
      } else {
        for (let i = 0; i < teams.techStacks.length; i++) {
          errors.push(
            ...validate(teams.techStacks[i], techStackSchema, `teams.yaml.techStacks[${i}]`)
          );
        }
      }
    }
  }

  // Validate agents.yaml
  if (agents) {
    if (!agents.agents || typeof agents.agents !== 'object') {
      errors.push('agents.yaml: missing or invalid "agents" object');
    } else {
      for (const [category, agentList] of Object.entries(agents.agents)) {
        if (!Array.isArray(agentList)) {
          errors.push(`agents.yaml.agents.${category}: expected array, got ${typeof agentList}`);
          continue;
        }
        for (let i = 0; i < agentList.length; i++) {
          errors.push(
            ...validate(agentList[i], agentSchema, `agents.yaml.agents.${category}[${i}]`)
          );
        }
      }
    }
  }

  // Validate commands.yaml
  if (commands) {
    if (!commands.commands || !Array.isArray(commands.commands)) {
      errors.push('commands.yaml: missing or invalid "commands" array');
    } else {
      for (let i = 0; i < commands.commands.length; i++) {
        errors.push(
          ...validate(commands.commands[i], commandSchema, `commands.yaml.commands[${i}]`)
        );
      }
    }
  }

  // Validate rules.yaml
  if (rules) {
    if (!rules.rules || !Array.isArray(rules.rules)) {
      errors.push('rules.yaml: missing or invalid "rules" array');
    } else {
      for (let i = 0; i < rules.rules.length; i++) {
        errors.push(...validate(rules.rules[i], ruleDomainSchema, `rules.yaml.rules[${i}]`));
      }
    }
  }

  // Validate settings.yaml
  if (settings) {
    errors.push(...validate(settings, settingsSchema, 'settings.yaml'));
  }

  // Validate aliases.yaml
  if (aliases) {
    if (!aliases.aliases || typeof aliases.aliases !== 'object') {
      errors.push('aliases.yaml: missing or invalid "aliases" object');
    } else {
      const commandNames = new Set((commands?.commands || []).map((c) => `/${c.name}`));
      for (const [alias, target] of Object.entries(aliases.aliases)) {
        // Extract base command from target (e.g., "/orchestrate --assess-only" → "/orchestrate")
        const baseTarget = target.split(' ')[0];
        if (!commandNames.has(baseTarget)) {
          warnings.push(
            `aliases.yaml: alias "${alias}" targets "${baseTarget}" which is not a known command`
          );
        }
      }
    }
  }

  // Cross-spec validation
  if (teams && commands && agents && rules) {
    errors.push(...validateCrossReferences({ teams, commands, agents, rules }));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * CLI-friendly runner — prints results and exits with appropriate code.
 */
export function runSpecValidation(agentkitRoot) {
  console.log('[agentkit:spec-validate] Validating spec files...');
  const result = validateSpec(agentkitRoot);

  for (const err of result.errors) {
    console.error(`  FAIL: ${err}`);
  }
  for (const warn of result.warnings) {
    console.warn(`  WARN: ${warn}`);
  }

  if (result.valid) {
    console.log(`[agentkit:spec-validate] PASSED (${result.warnings.length} warning(s))`);
  } else {
    console.error(
      `[agentkit:spec-validate] FAILED: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`
    );
  }

  return result;
}

// Export validate for testing
export { PROJECT_ENUMS, validate, validateCrossReferences, validateProjectYaml };
