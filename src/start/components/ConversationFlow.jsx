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
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { TREE } from '../lib/conversation-tree.js';

/**
 * @param {{ onSelect: (command: string) => void, ctx: import('../lib/detect.js').RepoContext }} props
 */
export default function ConversationFlow({ ctx, onSelect }) {
  const [path, setPath] = useState(['root']);
  const [selected, setSelected] = useState(null);

  const currentNodeId = path[path.length - 1];
  const currentNode = TREE[currentNodeId];

  // Back-navigation: Escape pops the last path segment
  useInput((input, key) => {
    if (key.escape && !selected && path.length > 1) {
      setPath((p) => p.slice(0, -1));
    }
  });

  if (!currentNode) {
    return <Text color="red">Flow error: unknown node &quot;{currentNodeId}&quot;</Text>;
  }

  function handleSelect(item) {
    const option = currentNode.options.find((o) => o.value === item.value);
    if (!option) return;

    if (option.command) {
      setSelected(option);
      onSelect(option.command);
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

        {path.length > 1 && (
          <Text color="gray" dimColor>
            Press esc to go back
          </Text>
        )}
      </Box>
    </Box>
  );
}
