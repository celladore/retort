import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import {
  loadFullAgentGraph,
  renderAgentTeamMembership,
  renderTeamHandoffIncoming,
  renderTeamHandoffOutgoing,
  renderAgentDependencyIncoming,
  renderAgentDependencyOutgoing,
  renderAgentNotificationIncoming,
  renderAgentNotificationOutgoing,
  renderAgentTeamCrossBoundary,
  renderAllMatrices,
  renderMatrix,
  renderAllAsJson,
  detectOrphans,
  detectCircularDeps,
  findTeamCoverageGaps,
  computeCrossteamCoupling,
  findConsolidationOpps,
  rankHubAgents,
  rankBottleneckAgents,
  computeTeamFanIn,
  computeTeamFanOut,
  computeAgentReachability,
  findCriticalPath,
  findNotificationAmplifiers,
} from '../agent-analysis.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTKIT_ROOT = resolve(__dirname, '..', '..', '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpAgentkit() {
  const dir = mkdtempSync(resolve(tmpdir(), 'agentkit-analysis-test-'));
  mkdirSync(resolve(dir, 'spec'), { recursive: true });
  return dir;
}

function writeYaml(dir, filename, content) {
  writeFileSync(resolve(dir, 'spec', filename), content, 'utf-8');
}

const MINIMAL_AGENTS = `
agents:
  engineering:
    - id: backend
      category: engineering
      name: Backend Engineer
      role: Backend development
      depends-on:
        - data
      notifies:
        - test-lead
      accepts: [implement]
    - id: frontend
      category: engineering
      name: Frontend Engineer
      role: Frontend development
      depends-on:
        - backend
      notifies: []
      accepts: [implement]
  data:
    - id: data
      category: data
      name: Data Engineer
      role: Data layer
      depends-on: []
      notifies:
        - backend
      accepts: [implement]
  testing:
    - id: test-lead
      category: testing
      name: Test Lead
      role: Testing
      depends-on: []
      notifies: []
      accepts: [test]
`;

const MINIMAL_TEAMS = `
teams:
  - id: backend
    name: BACKEND
    scope: ['apps/api/**']
    accepts: [implement]
    handoff-chain: [testing, docs]
    agents: [backend]
  - id: frontend
    name: FRONTEND
    scope: ['apps/web/**']
    accepts: [implement]
    handoff-chain: [testing, docs]
    agents: [frontend]
  - id: data
    name: DATA
    scope: ['db/**']
    accepts: [implement]
    handoff-chain: [backend, testing]
  - id: testing
    name: TESTING
    scope: ['**/*.test.*']
    accepts: [test]
    handoff-chain: [quality]
  - id: docs
    name: DOCS
    scope: ['docs/**']
    accepts: [document]
    handoff-chain: []
  - id: quality
    name: QUALITY
    scope: ['**/*']
    accepts: [review]
    handoff-chain: []
`;

// ---------------------------------------------------------------------------
// Tests — Graph loading
// ---------------------------------------------------------------------------

describe('loadFullAgentGraph', () => {
  it('should load graph from real spec files', () => {
    const graph = loadFullAgentGraph(AGENTKIT_ROOT);

    expect(graph.agents.length).toBeGreaterThan(0);
    expect(graph.teams.length).toBeGreaterThan(0);
    expect(graph.categories.length).toBeGreaterThan(0);
    expect(graph.agentMap.size).toBe(graph.agents.length);
    expect(graph.teamMap.size).toBe(graph.teams.length);
  });

  it('should correctly resolve strategic-ops agents to their team', () => {
    const graph = loadFullAgentGraph(AGENTKIT_ROOT);

    const strategicOpsAgents = graph.relationships.teamToAgents.get('strategic-ops') || [];
    expect(strategicOpsAgents).toContain('portfolio-analyst');
    expect(strategicOpsAgents).toContain('governance-advisor');
    expect(strategicOpsAgents).toContain('release-coordinator');
    expect(strategicOpsAgents.length).toBe(5);
  });

  it('should correctly resolve forge agents to their team', () => {
    const graph = loadFullAgentGraph(AGENTKIT_ROOT);

    const forgeAgents = graph.relationships.teamToAgents.get('forge') || [];
    expect(forgeAgents).toContain('input-clarifier');
    expect(forgeAgents).toContain('team-validator');
    expect(forgeAgents.length).toBe(6);
  });

  it('should load minimal spec from temp directory', () => {
    const dir = makeTmpAgentkit();
    try {
      writeYaml(dir, 'agents.yaml', MINIMAL_AGENTS);
      writeYaml(dir, 'teams.yaml', MINIMAL_TEAMS);

      const graph = loadFullAgentGraph(dir);
      expect(graph.agents.length).toBe(4);
      expect(graph.teams.length).toBe(6);
      expect(graph.categories).toEqual(['engineering', 'data', 'testing']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should handle missing spec files gracefully', () => {
    const dir = makeTmpAgentkit();
    try {
      const graph = loadFullAgentGraph(dir);
      expect(graph.agents.length).toBe(0);
      expect(graph.teams.length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — Matrix rendering
// ---------------------------------------------------------------------------

describe('matrix rendering', () => {
  let graph;

  function loadMinimalGraph() {
    const dir = makeTmpAgentkit();
    writeYaml(dir, 'agents.yaml', MINIMAL_AGENTS);
    writeYaml(dir, 'teams.yaml', MINIMAL_TEAMS);
    const g = loadFullAgentGraph(dir);
    rmSync(dir, { recursive: true, force: true });
    return g;
  }

  it('should render agent-team membership matrix', () => {
    graph = loadMinimalGraph();
    const md = renderAgentTeamMembership(graph);
    expect(md).toContain('Matrix 1');
    expect(md).toContain('backend');
    expect(md).toContain('engineering');
  });

  it('should render team handoff incoming', () => {
    graph = loadMinimalGraph();
    const md = renderTeamHandoffIncoming(graph);
    expect(md).toContain('Matrix 2');
    expect(md).toContain('testing');
  });

  it('should render team handoff outgoing', () => {
    graph = loadMinimalGraph();
    const md = renderTeamHandoffOutgoing(graph);
    expect(md).toContain('Matrix 3');
    expect(md).toContain('testing');
  });

  it('should render agent dependency incoming', () => {
    graph = loadMinimalGraph();
    const md = renderAgentDependencyIncoming(graph);
    expect(md).toContain('Matrix 4');
    expect(md).toContain('data');
  });

  it('should render agent dependency outgoing', () => {
    graph = loadMinimalGraph();
    const md = renderAgentDependencyOutgoing(graph);
    expect(md).toContain('Matrix 5');
    expect(md).toContain('backend');
  });

  it('should render agent notification incoming', () => {
    graph = loadMinimalGraph();
    const md = renderAgentNotificationIncoming(graph);
    expect(md).toContain('Matrix 6');
  });

  it('should render agent notification outgoing', () => {
    graph = loadMinimalGraph();
    const md = renderAgentNotificationOutgoing(graph);
    expect(md).toContain('Matrix 7');
  });

  it('should render cross-team interactions', () => {
    graph = loadMinimalGraph();
    const md = renderAgentTeamCrossBoundary(graph);
    expect(md).toContain('Matrix 8');
    // backend depends-on data → cross-team
    expect(md).toContain('backend');
  });

  it('should render all matrices as a single document', () => {
    graph = loadMinimalGraph();
    const md = renderAllMatrices(graph);
    expect(md).toContain('# Agent/Team Relationship Matrix');
    expect(md).toContain('Matrix 1');
    expect(md).toContain('Matrix 8');
    expect(md).toContain('Supplementary Analyses');
  });

  it('should render specific matrix by number', () => {
    graph = loadMinimalGraph();
    const md = renderMatrix(graph, '3');
    expect(md).toContain('Matrix 3');
    expect(md).not.toContain('Matrix 1');
  });

  it('should return error for invalid matrix number', () => {
    graph = loadMinimalGraph();
    const md = renderMatrix(graph, '99');
    expect(md).toContain('Unknown matrix');
  });
});

// ---------------------------------------------------------------------------
// Tests — Supplementary analyses
// ---------------------------------------------------------------------------

describe('supplementary analyses', () => {
  function loadMinimalGraph() {
    const dir = makeTmpAgentkit();
    writeYaml(dir, 'agents.yaml', MINIMAL_AGENTS);
    writeYaml(dir, 'teams.yaml', MINIMAL_TEAMS);
    const g = loadFullAgentGraph(dir);
    rmSync(dir, { recursive: true, force: true });
    return g;
  }

  it('should detect orphan agents', () => {
    const graph = loadMinimalGraph();
    const orphans = detectOrphans(graph);
    // All 4 agents in minimal spec have at least one connection
    // test-lead has notifiedBy: backend, so it's not an orphan
    expect(Array.isArray(orphans)).toBe(true);
  });

  it('should detect no circular deps in minimal spec', () => {
    const graph = loadMinimalGraph();
    const cycles = detectCircularDeps(graph);
    expect(cycles.length).toBe(0);
  });

  it('should detect circular deps when present', () => {
    const dir = makeTmpAgentkit();
    const agentsWithCycle = `
agents:
  engineering:
    - id: a
      category: engineering
      depends-on: [b]
      notifies: []
    - id: b
      category: engineering
      depends-on: [a]
      notifies: []
`;
    writeYaml(dir, 'agents.yaml', agentsWithCycle);
    writeYaml(dir, 'teams.yaml', 'teams: []');

    try {
      const graph = loadFullAgentGraph(dir);
      const cycles = detectCircularDeps(graph);
      expect(cycles.length).toBeGreaterThan(0);
      // Cycle should contain both a and b
      const flat = cycles.flat();
      expect(flat).toContain('a');
      expect(flat).toContain('b');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should find team coverage gaps', () => {
    const graph = loadMinimalGraph();
    const gaps = findTeamCoverageGaps(graph);
    expect(gaps.teamsWithNoAgents).toContain('docs');
    expect(gaps.teamsWithNoAgents).toContain('quality');
  });

  it('should rank hub agents by connection count', () => {
    const graph = loadMinimalGraph();
    const hubs = rankHubAgents(graph);
    expect(hubs.length).toBeGreaterThan(0);
    // backend has most connections: depends-on data, depended-on-by frontend, notifies test-lead
    expect(hubs[0].id).toBe('backend');
  });

  it('should rank bottleneck agents', () => {
    const graph = loadMinimalGraph();
    const bottlenecks = rankBottleneckAgents(graph);
    expect(bottlenecks.length).toBeGreaterThan(0);
  });

  it('should compute team fan-in', () => {
    const graph = loadMinimalGraph();
    const fanIn = computeTeamFanIn(graph);
    expect(fanIn.length).toBe(graph.teams.length);
    // testing receives handoffs from backend, frontend, data → fanIn = 3
    const testingFanIn = fanIn.find((f) => f.id === 'testing');
    expect(testingFanIn.fanIn).toBe(3);
  });

  it('should compute team fan-out', () => {
    const graph = loadMinimalGraph();
    const fanOut = computeTeamFanOut(graph);
    expect(fanOut.length).toBe(graph.teams.length);
  });

  it('should compute agent reachability (transitive closure)', () => {
    const graph = loadMinimalGraph();
    const reach = computeAgentReachability(graph);
    // frontend depends-on backend, backend depends-on data
    // so frontend can reach both backend and data
    const frontendReach = reach.get('frontend');
    expect(frontendReach).toBeDefined();
    expect(frontendReach.has('backend')).toBe(true);
    expect(frontendReach.has('data')).toBe(true);
  });

  it('should find critical path', () => {
    const graph = loadMinimalGraph();
    const path = findCriticalPath(graph);
    // frontend → backend → data = length 3
    expect(path.length).toBe(3);
    expect(path[0]).toBe('frontend');
    expect(path[2]).toBe('data');
  });

  it('should find notification amplifiers', () => {
    const graph = loadMinimalGraph();
    const amplifiers = findNotificationAmplifiers(graph);
    // data notifies backend, backend notifies test-lead
    // So data has transitive reach of 2
    const dataAmp = amplifiers.find((a) => a.id === 'data');
    expect(dataAmp).toBeDefined();
    expect(dataAmp.reach).toBe(2); // backend + test-lead
  });

  it('should find consolidation opportunities (overlapping scope)', () => {
    const graph = loadMinimalGraph();
    const opps = findConsolidationOpps(graph);
    // quality has scope '**/*' which overlaps with testing '**/*.test.*'
    // but exact string match only — no overlap in our minimal spec
    expect(Array.isArray(opps)).toBe(true);
  });

  it('should compute cross-team coupling', () => {
    const graph = loadMinimalGraph();
    const coupling = computeCrossteamCoupling(graph);
    // backend depends-on data → cross-team
    expect(coupling.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — JSON output
// ---------------------------------------------------------------------------

describe('JSON output', () => {
  it('should render all as JSON', () => {
    const dir = makeTmpAgentkit();
    writeYaml(dir, 'agents.yaml', MINIMAL_AGENTS);
    writeYaml(dir, 'teams.yaml', MINIMAL_TEAMS);

    try {
      const graph = loadFullAgentGraph(dir);
      const json = renderAllAsJson(graph);
      expect(json.meta.agentCount).toBe(4);
      expect(json.meta.teamCount).toBe(6);
      expect(json.membership.length).toBe(4);
      expect(Array.isArray(json.orphans)).toBe(true);
      expect(Array.isArray(json.cycles)).toBe(true);
      expect(Array.isArray(json.hubs)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — Real spec integration
// ---------------------------------------------------------------------------

describe('real spec integration', () => {
  it('should load the full agentkit-forge spec without errors', () => {
    const graph = loadFullAgentGraph(AGENTKIT_ROOT);
    const md = renderAllMatrices(graph);
    expect(md).toContain('# Agent/Team Relationship Matrix');
    expect(md).toContain('Matrix 1');
    expect(md.length).toBeGreaterThan(500);
  });

  it('should detect no circular dependencies in real spec', () => {
    const graph = loadFullAgentGraph(AGENTKIT_ROOT);
    const cycles = detectCircularDeps(graph);
    expect(cycles.length).toBe(0);
  });

  it('should produce valid JSON from real spec', () => {
    const graph = loadFullAgentGraph(AGENTKIT_ROOT);
    const json = renderAllAsJson(graph);
    // Should serialize without error
    const str = JSON.stringify(json);
    expect(str.length).toBeGreaterThan(100);
  });
});
