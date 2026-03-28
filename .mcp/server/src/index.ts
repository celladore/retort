// @ts-nocheck — McpServer generic inference in SDK 1.27.1 exhausts tsc heap.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Request, Response } from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';

const PORT = Number(process.env.PORT ?? 3000);
const REPO_ROOT = resolve(process.env.REPO_ROOT ?? join(__dirname, '../../..'));
const REPO = process.env.REPO ?? 'phoenixvc/retort';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function readYaml(filename: string): unknown {
  const filePath = join(REPO_ROOT, filename);
  if (!existsSync(filePath)) return null;
  try {
    return yaml.load(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function getPipelineStatus(): Promise<unknown> {
  if (!GITHUB_TOKEN) return { error: 'GITHUB_TOKEN not configured' };
  const [owner, repo] = REPO.split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=5`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return { error: `GitHub API ${res.status}` };
  const data = await res.json() as { workflow_runs: unknown[] };
  return data.workflow_runs.map((r: any) => ({
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    branch: r.head_branch,
    url: r.html_url,
    created_at: r.created_at,
  }));
}

function mcpError(tool: string, err: unknown) {
  console.error(`[MCP:${tool}]`, String(err));
  return { content: [{ type: 'text' as const, text: `Tool error: ${String(err)}` }], isError: true };
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  const todo = readYaml('.todo.yaml');
  const roadmap = readYaml('.roadmap.yaml');
  res.json({
    status: 'ok',
    repo: REPO,
    todoLoaded: todo !== null,
    roadmapLoaded: roadmap !== null,
  });
});

app.post('/mcp', async (req: Request, res: Response) => {
  const secret = process.env.MCP_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'MCP_SECRET not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const server = new McpServer({ name: `mcp-${REPO.split('/')[1]}`, version: '0.1.0' });

  server.registerTool('get_tasks', {
    description: `Get tasks and todo items from ${REPO}`,
    inputSchema: z.object({
      status: z.enum(['todo', 'inprogress', 'done', 'blocked']).optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
    }),
  }, async ({ status, priority }) => {
    try {
      const todo = readYaml('.todo.yaml') as any;
      if (!todo) return { content: [{ type: 'text', text: 'No .todo.yaml found in repo' }] };
      let tasks = todo.tasks ?? [];
      if (status) tasks = tasks.filter((t: any) => t.status === status);
      if (priority) tasks = tasks.filter((t: any) => t.priority === priority);
      return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    } catch (err) { return mcpError('get_tasks', err); }
  });

  server.registerTool('get_roadmap', {
    description: `Get the roadmap for ${REPO}`,
    inputSchema: z.object({
      status: z.string().optional(),
    }),
  }, async ({ status }) => {
    try {
      const roadmap = readYaml('.roadmap.yaml') as any;
      if (!roadmap) return { content: [{ type: 'text', text: 'No .roadmap.yaml found in repo' }] };
      let items = roadmap.milestones ?? roadmap.items ?? roadmap.roadmap ?? [];
      if (status) items = items.filter((i: any) => i.status === status);
      return { content: [{ type: 'text', text: JSON.stringify({ meta: roadmap.meta ?? {}, items }, null, 2) }] };
    } catch (err) { return mcpError('get_roadmap', err); }
  });

  server.registerTool('get_pipeline_status', {
    description: `Get the latest GitHub Actions run status for ${REPO}`,
    inputSchema: z.object({}),
  }, async () => {
    try {
      const runs = await getPipelineStatus();
      return { content: [{ type: 'text', text: JSON.stringify(runs, null, 2) }] };
    } catch (err) { return mcpError('get_pipeline_status', err); }
  });

  server.registerTool('get_project_info', {
    description: `Get combined project context for ${REPO} — tasks, roadmap, and pipeline in one call`,
    inputSchema: z.object({}),
  }, async () => {
    try {
      const todo = readYaml('.todo.yaml') as any;
      const roadmap = readYaml('.roadmap.yaml') as any;
      const pipeline = await getPipelineStatus();
      const summary = {
        repo: REPO,
        tasks: {
          total: todo?.tasks?.length ?? 0,
          todo: todo?.tasks?.filter((t: any) => t.status === 'todo').length ?? 0,
          inprogress: todo?.tasks?.filter((t: any) => t.status === 'inprogress').length ?? 0,
          done: todo?.tasks?.filter((t: any) => t.status === 'done').length ?? 0,
          high_priority_open: todo?.tasks?.filter((t: any) => t.priority === 'high' && t.status !== 'done').map((t: any) => t.title) ?? [],
        },
        roadmap: {
          total: (roadmap?.milestones ?? roadmap?.items ?? []).length,
          inprogress: (roadmap?.milestones ?? roadmap?.items ?? []).filter((i: any) => i.status === 'inprogress').map((i: any) => i.title),
        },
        pipeline,
      };
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
    } catch (err) { return mcpError('get_project_info', err); }
  });

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`[retort-mcp] listening on :${PORT}`);
  console.log(`[retort-mcp] repo: ${REPO}`);
  console.log(`[retort-mcp] repo_root: ${REPO_ROOT}`);
});
