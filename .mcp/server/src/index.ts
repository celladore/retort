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

async function fetchGitHubContent(path: string): Promise<string | null> {
  if (!GITHUB_TOKEN) throw new Error(`Missing GITHUB_TOKEN — cannot fetch ${path} from GitHub API`);
  const [owner, repo] = REPO.split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    clearTimeout(timeout);
    // Return null only for genuine 404 "file not found" responses
    if (res.status === 404) return null;
    // For other non-OK responses (rate limits, auth failures, 5xx), throw an error
    if (!res.ok) {
      const responseText = await res.text();
      throw new Error(
        `GitHub API error: status ${res.status} for ${url}. Response: ${responseText}`
      );
    }
    const data = (await res.json()) as { content: string; encoding: string };
    if (data.encoding === 'base64') {
      return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
    }
    return null;
  } catch (err) {
    clearTimeout(timeout);
    // Rethrow with context instead of swallowing exceptions
    if (err instanceof Error) {
      throw new Error(`Failed to fetch GitHub content from ${url}: ${err.message}`, { cause: err });
    }
    throw err;
  }
}

async function readYaml(filename: string): Promise<unknown> {
  // Try filesystem first (local dev where REPO_ROOT points to full repo)
  const filePath = join(REPO_ROOT, filename);
  if (existsSync(filePath)) {
    try {
      return yaml.load(readFileSync(filePath, 'utf8'));
    } catch (err) {
      // Rethrow with context instead of swallowing exceptions
      if (err instanceof Error) {
        throw new Error(`Failed to read or parse YAML from ${filePath}: ${err.message}`, { cause: err });
      }
      throw err;
    }
  }
  // Fall back to GitHub API (Railway production — rootDirectory builds only
  // deploy .mcp/server/ contents to /app, so repo root files aren't on disk)
  const content = await fetchGitHubContent(filename);
  if (!content) return null;
  try {
    return yaml.load(content);
  } catch (err) {
    // Rethrow with context instead of swallowing exceptions
    if (err instanceof Error) {
      throw new Error(`Failed to parse YAML content from ${filename}: ${err.message}`, { cause: err });
    }
    throw err;
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
  res.json({
    status: 'ok',
    repo: REPO,
  });
});

app.get('/ready', async (_req, res) => {
  try {
    const [todo, roadmap] = await Promise.all([
      readYaml('.todo.yaml'),
      readYaml('.roadmap.yaml'),
    ]);
    res.json({
      status: 'ok',
      repo: REPO,
      todoLoaded: todo !== null,
      roadmapLoaded: roadmap !== null,
    });
  } catch (err) {
    console.error('[ready]', err);
    res.status(503).json({ status: 'error', repo: REPO });
  }
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
      const todo = (await readYaml('.todo.yaml')) as any;
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
      const roadmap = (await readYaml('.roadmap.yaml')) as any;
      if (!roadmap) return { content: [{ type: 'text', text: 'No .roadmap.yaml found in repo' }] };
      let items = roadmap.tasks ?? roadmap.milestones ?? roadmap.items ?? [];
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
      const [todo, roadmap, pipeline] = await Promise.all([
        readYaml('.todo.yaml'),
        readYaml('.roadmap.yaml'),
        getPipelineStatus(),
      ]) as [any, any, any];
      const roadmapItems = roadmap?.tasks ?? roadmap?.milestones ?? roadmap?.items ?? [];
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
          total: roadmapItems.length,
          inprogress: roadmapItems.filter((i: any) => i.status === 'inprogress').map((i: any) => i.title),
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