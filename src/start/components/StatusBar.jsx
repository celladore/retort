/**
 * StatusBar — persistent single-line status strip at the bottom of the TUI.
 *
 * Renders a compact, tmux-style bar showing repo state at a glance.
 * Each segment is color-coded: green = good, yellow = attention, dim = inactive.
 *
 * Layout:
 *   AK ✓ │ Phase: — │ 📋 3 │ main │ clean ✓
 */

import React from 'react';
import { Box, Text } from 'ink';

/** Max displayed branch name length before truncation. */
const MAX_BRANCH_LENGTH = 24;

/**
 * @param {{ ctx: import('../lib/detect.js').RepoContext }} props
 */
export default function StatusBar({ ctx }) {
  if (!ctx) return null;
  const forgeOk = ctx.forgeInitialised && ctx.syncRun;

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      flexDirection="row"
      gap={0}
    >
      {/* Forge status */}
      <Segment
        color={forgeOk ? 'green' : 'yellow'}
        bold
      >
        {forgeOk ? 'AK ✓' : 'AK ✗'}
      </Segment>

      <Divider />

      {/* Phase */}
      <Segment color={ctx.phaseName ? 'cyan' : 'gray'}>
        {ctx.phaseName ? `Phase ${ctx.orchestratorPhase}: ${ctx.phaseName}` : 'Phase: —'}
      </Segment>

      <Divider />

      {/* Backlog */}
      <Segment color={ctx.hasBacklog ? 'white' : 'gray'}>
        {ctx.hasBacklog ? `📋 ${ctx.backlogCount}` : '📋 0'}
      </Segment>

      {ctx.activeTaskCount > 0 && (
        <>
          <Divider />
          <Segment color="magenta">
            {`⚡ ${ctx.activeTaskCount} task${ctx.activeTaskCount === 1 ? '' : 's'}`}
          </Segment>
        </>
      )}

      <Divider />

      {/* Branch */}
      <Segment color="blue">
        {truncate(ctx.branch, MAX_BRANCH_LENGTH)}
      </Segment>

      <Divider />

      {/* Working tree */}
      <Segment color={ctx.isClean ? 'green' : 'yellow'}>
        {ctx.isClean ? 'clean ✓' : `${ctx.uncommittedCount} changed`}
      </Segment>

      {ctx.lockHeld && (
        <>
          <Divider />
          <Segment color="red">🔒 locked</Segment>
        </>
      )}
    </Box>
  );
}

function Segment({ color, bold, children }) {
  return (
    <Text color={color} bold={bold}>
      {` ${children} `}
    </Text>
  );
}

function Divider() {
  return <Text color="gray">│</Text>;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
