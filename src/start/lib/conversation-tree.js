/**
 * Conversation tree definition for the guided dialogue flow.
 *
 * Each node has a question and an array of options.
 * Options either point to a `next` node (branching) or a `command` (leaf).
 *
 * @typedef {Object} FlowNode
 * @property {string} question  The question to ask
 * @property {Array<{label: string, value: string, next?: string, command?: string, hint?: string}>} options
 */

/** @type {Record<string, FlowNode>} */
export const TREE = {
  root: {
    question: 'What brings you here today?',
    options: [
      { label: '🔨  Build something new', value: 'build', next: 'build-what' },
      { label: '🔧  Fix or improve something', value: 'fix', next: 'fix-where' },
      { label: '🔍  Explore & understand', value: 'explore', next: 'explore-how' },
      { label: '🚀  Ship or deploy', value: 'ship', next: 'ship-ready' },
    ],
  },

  'build-what': {
    question: 'What kind of thing?',
    options: [
      {
        label: '⚙️   API / backend service',
        value: 'api',
        command: '/team-backend',
        hint: 'Backend team handles API, services, core logic',
      },
      {
        label: '🖥️   UI / frontend feature',
        value: 'ui',
        command: '/team-frontend',
        hint: 'Frontend team handles UI, components, PWA',
      },
      {
        label: '🗄️   Database / data model',
        value: 'data',
        command: '/team-data',
        hint: 'Data team handles DB, models, migrations',
      },
      {
        label: '☁️   Infrastructure',
        value: 'infra',
        command: '/team-infra',
        hint: 'Infra team handles IaC, cloud, Terraform',
      },
    ],
  },

  'fix-where': {
    question: 'Where does the problem live?',
    options: [
      { label: '🐛  I know which file/module', value: 'known', next: 'fix-scope' },
      {
        label: '🤷  Not sure — need to investigate',
        value: 'unknown',
        command: '/discover',
        hint: 'Discover scans the codebase to help you find it',
      },
      {
        label: '🧪  Tests are failing',
        value: 'tests',
        command: '/check',
        hint: 'Check runs quality gates to identify failures',
      },
      {
        label: '🔒  Security issue',
        value: 'security',
        command: '/security',
        hint: 'Security audit scans deps, secrets, OWASP',
      },
    ],
  },

  'fix-scope': {
    question: 'How big is the fix?',
    options: [
      {
        label: '📌  Small — single file or function',
        value: 'small',
        command: '/plan',
        hint: 'Plan helps you scope even small changes',
      },
      {
        label: '📦  Medium — touches a few modules',
        value: 'medium',
        command: '/orchestrate',
        hint: 'Orchestrate coordinates multi-module work',
      },
      {
        label: '🏗️   Large — cross-cutting refactor',
        value: 'large',
        command: '/orchestrate',
        hint: 'Orchestrate manages the full lifecycle',
      },
    ],
  },

  'explore-how': {
    question: 'What do you want to learn?',
    options: [
      {
        label: '🗺️   What is this project?',
        value: 'overview',
        command: '/discover',
        hint: 'Discover builds a complete project inventory',
      },
      {
        label: '📊  How healthy is the codebase?',
        value: 'health',
        command: '/healthcheck',
        hint: 'Healthcheck verifies build, lint, tests',
      },
      {
        label: '📋  What work is pending?',
        value: 'work',
        command: '/backlog',
        hint: 'Backlog shows all known work items',
      },
      {
        label: '🔎  Deep architecture review',
        value: 'review',
        command: '/project-review',
        hint: 'Project Review does a comprehensive audit',
      },
    ],
  },

  'ship-ready': {
    question: 'Where are you in the process?',
    options: [
      {
        label: '✅  Code is done, need to verify',
        value: 'verify',
        command: '/check',
        hint: 'Check runs lint + test + build gates',
      },
      {
        label: '👀  Need a code review',
        value: 'review',
        command: '/review',
        hint: 'Review evaluates quality, security, coverage',
      },
      {
        label: '📦  Ready to deploy',
        value: 'deploy',
        command: '/deploy',
        hint: 'Deploy triggers the deployment pipeline',
      },
      {
        label: '📝  Need to document what was done',
        value: 'docs',
        command: '/document-history',
        hint: 'Creates a history doc for the work',
      },
    ],
  },
};
