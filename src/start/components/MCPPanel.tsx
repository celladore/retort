/**
 * MCPPanel — shows configured MCP servers with a health indicator per server.
 *
 * Reads `.claude/settings.json` from process.cwd(), parses the `mcpServers`
 * map, and renders one row per server. Returns null if the file is missing,
 * unreadable, or if no servers are configured — so it is safe to render
 * unconditionally in App.
 *
 * Layout (bordered box, title "MCP Servers"):
 *   ● my-server   (green dot when configured)
 *   ● another-one
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Parse mcpServers from the raw settings.json content.
 * Returns an array of server name strings, or [] on any failure.
 */
function parseMcpServerNames(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as { mcpServers?: unknown };
    const servers = parsed?.mcpServers;
    if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
      return [];
    }
    return Object.keys(servers as Record<string, unknown>);
  } catch {
    return [];
  }
}

/**
 * MCPPanel reads `.claude/settings.json` and renders a list of MCP servers.
 * Returns null when no servers are configured or the file is unavailable.
 */
export default function MCPPanel() {
  const [servers, setServers] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const settingsPath = join(process.cwd(), '.claude', 'settings.json');

    readFile(settingsPath, 'utf8')
      .then((raw) => {
        if (!cancelled) setServers(parseMcpServerNames(raw));
      })
      .catch(() => {
        if (!cancelled) setServers([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (servers === null) return null;
  if (servers.length === 0) return null;

  return (
    <Box borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
      <Text color="gray" bold>
        MCP Servers
      </Text>
      {servers.map((name) => (
        <Box key={name} gap={1}>
          <Text color="green">●</Text>
          <Text>{name}</Text>
        </Box>
      ))}
    </Box>
  );
}
