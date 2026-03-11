/**
 * ConversationFlow — first-run guided dialogue tree.
 *
 * A branching conversation rendered as a visual flow.
 * Each step is a question with selectable options.
 * The path the user takes determines the command suggestion.
 *
 * This replaces the traditional wizard/onboarding with something
 * that feels like a choose-your-own-adventure.
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

/**
 * A single node in the conversation tree.
 * @typedef {Object} FlowNode
 * @property {string}   question  The question to ask
 * @property {Array<{label: string, value: string, next?: string, command?: string, hint?: string}>} options
 */

/** @type {Record<string, FlowNode>} */
const TREE = {
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
      { label: '⚙️   API / backend service', value: 'api', command: '/team-backend', hint: 'Backend team handles API, services, core logic' },
      { label: '🖥️   UI / frontend feature', value: 'ui', command: '/team-frontend', hint: 'Frontend team handles UI, components, PWA' },
      { label: '🗄️   Database / data model', value: 'data', command: '/team-data', hint: 'Data team handles DB, models, migrations' },
      { label: '☁️   Infrastructure', value: 'infra', command: '/team-infra', hint: 'Infra team handles IaC, cloud, Terraform' },
    ],
  },

  'fix-where': {
    question: 'Where does the problem live?',
    options: [
      { label: '🐛  I know which file/module', value: 'known', next: 'fix-scope' },
      { label: '🤷  Not sure — need to investigate', value: 'unknown', command: '/discover', hint: 'Discover scans the codebase to help you find it' },
      { label: '🧪  Tests are failing', value: 'tests', command: '/check', hint: 'Check runs quality gates to identify failures' },
      { label: '🔒  Security issue', value: 'security', command: '/security', hint: 'Security audit scans deps, secrets, OWASP' },
    ],
  },

  'fix-scope': {
    question: 'How big is the fix?',
    options: [
      { label: '📌  Small — single file or function', value: 'small', command: '/plan', hint: 'Plan helps you scope even small changes' },
      { label: '📦  Medium — touches a few modules', value: 'medium', command: '/orchestrate', hint: 'Orchestrate coordinates multi-module work' },
      { label: '🏗️   Large — cross-cutting refactor', value: 'large', command: '/orchestrate', hint: 'Orchestrate manages the full lifecycle' },
    ],
  },

  'explore-how': {
    question: 'What do you want to learn?',
    options: [
      { label: '🗺️   What is this project?', value: 'overview', command: '/discover', hint: 'Discover builds a complete project inventory' },
      { label: '📊  How healthy is the codebase?', value: 'health', command: '/healthcheck', hint: 'Healthcheck verifies build, lint, tests' },
      { label: '📋  What work is pending?', value: 'work', command: '/backlog', hint: 'Backlog shows all known work items' },
      { label: '🔎  Deep architecture review', value: 'review', command: '/project-review', hint: 'Project Review does a comprehensive audit' },
    ],
  },

  'ship-ready': {
    question: 'Where are you in the process?',
    options: [
      { label: '✅  Code is done, need to verify', value: 'verify', command: '/check', hint: 'Check runs lint + test + build gates' },
      { label: '👀  Need a code review', value: 'review', command: '/review', hint: 'Review evaluates quality, security, coverage' },
      { label: '📦  Ready to deploy', value: 'deploy', command: '/deploy', hint: 'Deploy triggers the deployment pipeline' },
      { label: '📝  Need to document what was done', value: 'docs', command: '/document-history', hint: 'Creates a history doc for the work' },
    ],
  },
};

/**
 * @param {{ onSelect: (command: string) => void, ctx: import('../lib/detect.js').RepoContext }} props
 */
export default function ConversationFlow({ onSelect }) {
  const [path, setPath] = useState(['root']);
  const [selected, setSelected] = useState(null);

  const currentNodeId = path[path.length - 1];
  const currentNode = TREE[currentNodeId];

  if (!currentNode) {
    return <Text color="red">Flow error: unknown node "{currentNodeId}"</Text>;
  }

  function handleSelect(item) {
    const option = currentNode.options.find((o) => o.value === item.value);
    if (!option) return;

    if (option.command) {
      setSelected(option);
    } else if (option.next) {
      setPath([...path, option.next]);
    }
  }

  // Show the trail of questions answered so far
  const breadcrumbs = path.slice(0, -1).map((nodeId) => {
    const node = TREE[nodeId];
    const chosenValue = path[path.indexOf(nodeId) + 1];
    // Find which option led to the next node
    const chosen = node?.options.find((o) => o.next === chosenValue || o.value === chosenValue);
    return chosen ? chosen.label.replace(/^[^\s]+\s+/, '') : '?';
  });

  if (selected) {
    return (
      <Box flexDirection="column" gap={1}>
        {breadcrumbs.length > 0 && (
          <Text color="gray" dimColor>
            {'  '}
            {breadcrumbs.join(' → ')}
          </Text>
        )}

        <Box flexDirection="column" paddingX={2} gap={1}>
          <Text color="green" bold>
            ✓ Got it.
          </Text>

          <Box flexDirection="column">
            <Text>
              <Text color="white" bold>Suggested command: </Text>
              <Text color="cyan" bold>{selected.command}</Text>
            </Text>
            {selected.hint && (
              <Text color="gray" dimColor>
                {selected.hint}
              </Text>
            )}
          </Box>

          <Text color="gray" dimColor>
            Copy the command above into your Claude session to begin.
          </Text>
          <Text color="gray" dimColor>
            Press <Text color="white">Tab</Text> to open the command palette instead.
          </Text>
        </Box>
      </Box>
    );
  }

  const items = currentNode.options.map((o) => ({
    label: o.label,
    value: o.value,
  }));

  return (
    <Box flexDirection="column" gap={1}>
      {breadcrumbs.length > 0 && (
        <Text color="gray" dimColor>
          {'  '}
          {breadcrumbs.join(' → ')}
        </Text>
      )}

      <Box paddingX={2} flexDirection="column" gap={1}>
        <Text color="white" bold>
          {currentNode.question}
        </Text>

        <SelectInput items={items} onSelect={handleSelect} />
      </Box>
    </Box>
  );
}
