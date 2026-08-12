# MCP Server and A2A Protocol Guide

This document explains the Model Context Protocol (MCP) server configuration and
the Agent-to-Agent (A2A) protocol templates shipped with AgentKit Forge.

## Overview

AgentKit Forge includes two template files under `.agentkit/templates/mcp/` that
configure how AI agents interact with external tools and with each other:

| File              | Purpose                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `servers.json`    | MCP server definitions for tool-level capabilities                  |
| `a2a-config.json` | Agent-to-Agent protocol configuration for inter-agent communication |

Both files are rendered by the sync engine and written to the `mcp/` directory in
the project root during `agentkit sync`.

---

## MCP Server Configuration (`servers.json`)

The `servers.json` file declares MCP servers that AI agents can invoke as tools
during a session. Each entry maps a server name to a command and its arguments.

### Default Servers

```json
{
  "mcpServers": {
    "git": { "command": "git", "args": [] },
    "puppeteer": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-puppeteer"] },
    "memory": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] },
    "fetch": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-fetch"] }
  }
}
```

#### Server descriptions

- **git** -- Provides git operations as MCP tools. Invokes the `git` binary
  directly with no additional arguments.
- **puppeteer** -- Launches a headless browser via the
  `@modelcontextprotocol/server-puppeteer` package. Useful for screenshot
  capture, page interaction, and web scraping within agent workflows.
- **memory** -- Provides a persistent key-value memory store via
  `@modelcontextprotocol/server-memory`. Agents can store and retrieve context
  across tool invocations within a session.
- **fetch** -- Enables HTTP fetching via `@modelcontextprotocol/server-fetch`.
  Agents can retrieve web content, APIs, and remote resources.

### Adding Custom MCP Servers

To add a new MCP server, add an entry to the `mcpServers` object in
`.agentkit/templates/mcp/servers.json` and run `agentkit sync`:

```json
{
  "mcpServers": {
    "my-server": { "command": "npx", "args": ["-y", "my-mcp-server-package"] }
  }
}
```

The `command` field is the executable to run, and `args` is an array of
arguments passed to `spawnSync`. The `-y` flag for `npx` auto-installs the
package if it is not already present.

---

## A2A Protocol Configuration (`a2a-config.json`)

The `a2a-config.json` file defines how agents communicate with each other using
the Agent-to-Agent (A2A) protocol. This enables the orchestrator to delegate
tasks to team agents and aggregate their results.

### Protocol Settings

```json
{
  "a2a": {
    "enabled": true,
    "protocol_version": "1.0.0",
    "task_format": "json",
    "context_transfer": "memory",
    "result_aggregation": "orchestrator"
  }
}
```

| Field                | Description                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `enabled`            | Whether A2A communication is active. Set to `false` to disable inter-agent messaging.                      |
| `protocol_version`   | Version of the A2A protocol in use.                                                                        |
| `task_format`        | Serialization format for task payloads. Currently `"json"`.                                                |
| `context_transfer`   | How context is shared between agents. `"memory"` uses the MCP memory server.                               |
| `result_aggregation` | Which agent collects and merges results. `"orchestrator"` means the coordinator agent handles aggregation. |

### Agent Definitions

Each agent in the `agents` array declares its identity, role, domain, and
capabilities:

```json
{
  "id": "orchestrator",
  "role": "coordinator",
  "capabilities": ["delegate", "aggregate", "monitor"]
}
```

```json
{
  "id": "team-backend",
  "role": "executor",
  "domain": "api,services",
  "capabilities": ["implement", "test", "review"]
}
```

#### Roles

- **coordinator** -- The orchestrator agent. Delegates tasks to executor agents,
  aggregates their results, and monitors overall progress. There is exactly one
  coordinator.
- **executor** -- A team agent that performs work within its domain. Receives
  tasks from the coordinator and reports results back.

#### Registered agents

| Agent ID        | Role        | Domain             | Capabilities                 |
| --------------- | ----------- | ------------------ | ---------------------------- |
| `orchestrator`  | coordinator | (all)              | delegate, aggregate, monitor |
| `team-backend`  | executor    | api, services      | implement, test, review      |
| `team-frontend` | executor    | ui, components     | implement, test, review      |
| `team-data`     | executor    | database, models   | implement, test, review      |
| `team-infra`    | executor    | iac, cloud         | implement, test, review      |
| `team-devops`   | executor    | ci, cd, automation | implement, test, review      |
| `team-testing`  | executor    | tests, quality     | implement, test, review      |
| `team-security` | executor    | auth, compliance   | implement, test, review      |
| `team-docs`     | executor    | documentation      | implement, review            |
| `team-product`  | executor    | features, prd      | implement, review            |
| `team-quality`  | executor    | review, refactor   | implement, test, review      |

### Message Types

The A2A protocol supports four message types:

| Type        | Direction               | Purpose                                       |
| ----------- | ----------------------- | --------------------------------------------- |
| `delegate`  | coordinator to executor | Assign a task to a team agent                 |
| `report`    | executor to coordinator | Return results from a completed task          |
| `query`     | any to any              | Request information from another agent        |
| `broadcast` | coordinator to all      | Send information to all agents simultaneously |

### Message Payload Examples

> **Note:** The following JSON payloads are **illustrative examples** showing the intended message structure and content. They are not normative schemas — field names, nesting, and envelope structure may differ from the runtime implementation. Use these as a conceptual guide for understanding message flow, not as a wire-format specification.

Below are examples of each message type.

**`delegate` message** (coordinator to executor):

```json
{
  "type": "delegate",
  "id": "msg-001",
  "from": "orchestrator",
  "to": "team-backend",
  "timestamp": "2026-02-23T10:03:45.000Z",
  "payload": {
    "task_id": "TASK-001",
    "title": "Add rate limiting middleware",
    "description": "Create Express middleware that limits POST /api/auth/login to 5 requests per 15 minutes per IP address. Return HTTP 429 when exceeded.",
    "type": "implement",
    "priority": "P1",
    "scope": ["src/middleware/**", "src/routes/auth.ts"],
    "context": {
      "plan_ref": "plan-20260223-rate-limiting",
      "dependencies": [],
      "constraints": ["Must use Redis for rate limit state", "Must not break existing auth tests"]
    }
  }
}
```

**`report` message** (executor to coordinator):

```json
{
  "type": "report",
  "id": "msg-002",
  "from": "team-backend",
  "to": "orchestrator",
  "timestamp": "2026-02-23T10:08:30.000Z",
  "in_reply_to": "msg-001",
  "payload": {
    "task_id": "TASK-001",
    "status": "success",
    "summary": "Created rate limiting middleware with Redis backend. Applied to POST /api/auth/login.",
    "files_changed": [
      { "path": "src/middleware/rateLimit.ts", "action": "created" },
      { "path": "src/routes/auth.ts", "action": "modified" },
      { "path": "src/middleware/__tests__/rateLimit.test.ts", "action": "created" }
    ],
    "tests": { "added": 4, "passed": 4, "failed": 0 },
    "quality_gate": "pass",
    "handoff_to": "team-testing",
    "notes": "Redis connection retry logic not yet implemented -- logged as P2 follow-up."
  }
}
```

**`query` message** (any to any):

```json
{
  "type": "query",
  "id": "msg-003",
  "from": "team-frontend",
  "to": "team-backend",
  "timestamp": "2026-02-23T11:00:00.000Z",
  "payload": {
    "question": "What is the response shape for GET /api/notifications?unread=true?",
    "context": "Building NotificationBell component, need to know the API contract."
  }
}
```

**`broadcast` message** (coordinator to all):

```json
{
  "type": "broadcast",
  "id": "msg-004",
  "from": "orchestrator",
  "to": "*",
  "timestamp": "2026-02-23T10:12:01.000Z",
  "payload": {
    "event": "phase_transition",
    "from_phase": 3,
    "to_phase": 4,
    "message": "Implementation complete. Entering validation phase. All teams should finalize pending work."
  }
}
```

---

## How MCP and A2A Work Together

The MCP servers provide tool-level capabilities (git operations, web fetching,
browser automation, persistent memory), while the A2A protocol provides the
communication layer between agents.

A typical workflow:

1. The orchestrator receives a high-level task via `/orchestrate`.
2. It sends `delegate` messages to the appropriate team agents via A2A.
3. Each team agent uses MCP servers (git, fetch, memory) as tools while
   executing its assigned work.
4. Team agents send `report` messages back to the orchestrator with their
   results.
5. The orchestrator aggregates results using the `result_aggregation` strategy
   and advances the workflow phase.

The `memory` MCP server is particularly important for A2A because it enables
`context_transfer: "memory"` -- agents can write shared context to the memory
store that other agents can read, enabling coordination without direct message
passing.

---

## File Locations

After running `agentkit sync`, the rendered files appear at:

```text
<project-root>/
  mcp/
    servers.json        # MCP server configuration
    a2a-config.json     # A2A protocol configuration
```

The source templates live at:

```text
.agentkit/
  templates/
    mcp/
      servers.json      # MCP server template
      a2a-config.json   # A2A protocol template
```
