# Cost Ops Web Intake & Crawler Expansion

**Team:** T13-Cost-Ops + T5-DevOps | **Priority:** P2 | **Phase:** Discovery | **Status:** Todo

## Context

Phase A (this PR) added `WebSearch` and `WebFetch` to the cost-ops command and three
agent personas (Model Economist, Vendor Arbitrage Analyst, Grant Hunter). This enables
ad-hoc web research during agent sessions.

This ticket tracks expansion beyond native tools toward structured, automated, and
MCP-driven web intake for cost intelligence.

## Problem Statement

Native `WebFetch`/`WebSearch` tools are sufficient for one-off research but lack:

1. **Structured extraction** — fetching a pricing page returns raw HTML/text, not a pricing table
2. **Scheduled refresh** — pricing data goes stale; no automated re-crawl mechanism
3. **JavaScript rendering** — some provider pricing pages require JS execution
4. **Rate limiting and caching** — no deduplication or throttling across sessions
5. **Cross-session persistence** — research findings are lost between sessions

## Current Capabilities

| Layer | Tool | What It Does | Limitation |
| ----- | ---- | ------------ | ---------- |
| Native | `WebFetch` | HTTP GET, returns text content | No JS rendering, no structured extraction |
| Native | `WebSearch` | Web search via provider | Results only, no deep crawl |
| MCP | `puppeteer` | Full browser automation | Configured but not wired to cost-ops agents |
| MCP | `fetch` | HTTP fetch server | Basic, similar to native WebFetch |
| MCP | `context7` | Library doc retrieval | Scoped to code library docs only |

## Proposed Expansion Phases

### Phase B — Puppeteer Integration for JS-Rendered Pages

- [ ] Add `puppeteer` MCP tools to cost-ops agent preferred-tools list
- [ ] Create scraping scripts for key pricing pages:
  - `scripts/scrape-anthropic-pricing.mjs` — parse anthropic.com/pricing
  - `scripts/scrape-openai-pricing.mjs` — parse openai.com/pricing
  - `scripts/scrape-google-pricing.mjs` — parse cloud.google.com/vertex-ai/pricing
- [ ] Output structured YAML matching `config/pricing/provider-schema.yaml`
- [ ] Store last-scraped timestamp for staleness detection

### Phase C — MCP Crawler Server

Evaluate and integrate a dedicated crawler MCP server for structured web extraction.

**Candidates to evaluate:**

| MCP Server | Capability | License | Notes |
| ---------- | ---------- | ------- | ----- |
| [Firecrawl MCP](https://github.com/mendableai/firecrawl) | Crawl + structured extraction | MIT | Best structured output, requires API key |
| [Crawl4AI MCP](https://github.com/unclecode/crawl4ai) | LLM-optimised crawling | Apache 2.0 | Good markdown output, self-hosted |
| [Browserbase MCP](https://github.com/browserbase/mcp-server-browserbase) | Cloud browser sessions | Commercial | Managed infrastructure, anti-bot handling |
| Custom (Puppeteer-based) | Tailored to pricing pages | Internal | Full control, no external dependency |

**Evaluation criteria:**
- [ ] Structured data extraction quality (can it parse pricing tables accurately?)
- [ ] Self-hosted vs API key dependency (prefer no external API keys)
- [ ] Rate limiting and caching support
- [ ] Cost (free tier sufficient for monthly pricing refreshes?)
- [ ] Integration effort with existing `.mcp/servers.json` config

### Phase D — Automated Pricing Refresh Pipeline

- [ ] Create GitHub Action or scheduled script for monthly pricing refresh
- [ ] Crawl all 9 provider pricing pages
- [ ] Diff against current `config/pricing/*.yaml` files
- [ ] Auto-create PR with pricing changes for human review
- [ ] Alert on price increases > 10% or new model launches
- [ ] Store historical pricing data for trend analysis

### Phase E — Cross-Session Research Persistence

- [ ] Use `memory` MCP server to persist research findings across sessions
- [ ] Create knowledge graph entities for: providers, models, pricing tiers, credits, grants
- [ ] Grant Hunter findings persist as structured entities (not just session notes)
- [ ] Vendor Arbitrage Analyst can query historical comparisons

## Integration with Existing MCP Issues

This ticket aligns with three open issues tracking MCP expansion:

- **#013** — MCP support umbrella (master tracking)
- **#016** — Browser/DevTools MCP category (Puppeteer evaluation)
- **#017** — Repo/Data/Research MCP category (Exa, Tavily, Context7)

Cost-ops is a concrete use case that can drive evaluation decisions for these
broader MCP categories.

## Dependencies

- **Phase B:** Puppeteer MCP already configured in `.mcp/servers.json`
- **Phase C:** Requires MCP server evaluation (aligns with issue #017)
- **Phase D:** Requires Phase 2 of multi-provider cost ticket (pricing YAML files must exist)
- **Phase E:** Memory MCP already configured in `.mcp/servers.json`

## Acceptance Criteria

- [ ] Cost-ops agents can fetch and parse provider pricing pages during sessions
- [ ] At least 3 provider pricing scrapers produce structured YAML output
- [ ] MCP crawler evaluation completed with recommendation documented
- [ ] Monthly automated pricing refresh pipeline creates PRs with diffs
- [ ] Research findings persist across sessions via memory MCP

## Estimated Effort

| Phase | Duration | Dependency |
| ----- | -------- | ---------- |
| Phase B (Puppeteer) | 1 sprint | None — Puppeteer MCP already configured |
| Phase C (Crawler MCP) | 1 sprint | Evaluation only; implementation in Phase D |
| Phase D (Automation) | 2 sprints | Pricing YAMLs from multi-provider ticket Phase 2 |
| Phase E (Persistence) | 1 sprint | Memory MCP already configured |
