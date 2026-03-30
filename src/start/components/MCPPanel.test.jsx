import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { waitFor } from '../test-utils.js';

// Mock fs/promises at the module boundary — MCPPanel reads settings.json via readFile
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'fs/promises';
import MCPPanel from './MCPPanel.jsx';

// Fixture: a settings.json with two MCP servers
const FIXTURE_TWO_SERVERS = JSON.stringify({
  mcpServers: {
    'my-server': { command: 'node', args: ['server.js'] },
    'another-tool': { command: 'python', args: ['tool.py'] },
  },
});

// Fixture: a settings.json with an empty mcpServers map
const FIXTURE_EMPTY_SERVERS = JSON.stringify({
  mcpServers: {},
});

// Fixture: settings.json with no mcpServers key at all
const FIXTURE_NO_SERVERS_KEY = JSON.stringify({
  permissions: { allow: [] },
});

describe('MCPPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render each configured server name', async () => {
    // Arrange
    readFile.mockResolvedValue(FIXTURE_TWO_SERVERS);

    // Act
    const { lastFrame } = render(React.createElement(MCPPanel));

    // Assert
    await waitFor(() => {
      const frame = lastFrame();
      expect(frame).toContain('my-server');
      expect(frame).toContain('another-tool');
    });
  });

  it('should render the MCP Servers title when servers exist', async () => {
    // Arrange
    readFile.mockResolvedValue(FIXTURE_TWO_SERVERS);

    // Act
    const { lastFrame } = render(React.createElement(MCPPanel));

    // Assert
    await waitFor(() => {
      expect(lastFrame()).toContain('MCP Servers');
    });
  });

  it('should render a green dot indicator for each server', async () => {
    // Arrange
    readFile.mockResolvedValue(FIXTURE_TWO_SERVERS);

    // Act
    const { lastFrame } = render(React.createElement(MCPPanel));

    // Assert — two servers means exactly two green dot characters
    await waitFor(() => {
      const dots = (lastFrame().match(/●/g) || []).length;
      expect(dots).toBe(2);
    });
  });

  it('should render nothing while settings file is still loading', async () => {
    // Arrange — promise that never resolves (simulates slow read)
    readFile.mockReturnValue(new Promise(() => {}));

    // Act
    const { lastFrame } = render(React.createElement(MCPPanel));

    // Assert — servers === null branch: renders nothing immediately
    expect(lastFrame()).toBe('');
  });

  it('should render nothing when the settings file is missing', async () => {
    // Arrange
    readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    // Act
    const { lastFrame } = render(React.createElement(MCPPanel));

    // Assert — after async effect resolves, output should be empty
    await waitFor(() => {
      expect(lastFrame()).toBe('');
    });
  });

  it('should render nothing when mcpServers is an empty object', async () => {
    // Arrange
    readFile.mockResolvedValue(FIXTURE_EMPTY_SERVERS);

    // Act
    const { lastFrame } = render(React.createElement(MCPPanel));

    // Assert
    await waitFor(() => {
      expect(lastFrame()).toBe('');
    });
  });

  it('should render nothing when settings has no mcpServers key', async () => {
    // Arrange
    readFile.mockResolvedValue(FIXTURE_NO_SERVERS_KEY);

    // Act
    const { lastFrame } = render(React.createElement(MCPPanel));

    // Assert
    await waitFor(() => {
      expect(lastFrame()).toBe('');
    });
  });

  it('should render nothing when settings.json contains malformed JSON', async () => {
    // Arrange
    readFile.mockResolvedValue('{ not valid json ,,, }');

    // Act
    const { lastFrame } = render(React.createElement(MCPPanel));

    // Assert
    await waitFor(() => {
      expect(lastFrame()).toBe('');
    });
  });
});
