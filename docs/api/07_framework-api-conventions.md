# Framework API Conventions (Adopter Guide)

This repository (**agentkit-forge**) is the AgentKit Forge framework. It does **not** ship an application API or run an HTTP server. Adopters of the framework implement their own APIs in their repositories.

## Recommended API Route Structure

Adopter applications should follow these conventions (aligned with project conventions in CLAUDE.md and AGENTS.md):

- **Base path:** `/api`
- **Versioning:** URL-segment (e.g. `/api/v1/...`). Breaking changes are introduced in new versions.
- **Response format:** Envelope (e.g. `{ "data": ..., "meta": ... }`).
- **Pagination:** Cursor-based via `?cursor=` and `?limit=`.

Example layout:

```text
/api/v1/...          # Versioned application endpoints
/api/health          # Health check (see below)
```

## Health Check Endpoint

Adopters should implement a **health check endpoint** for load balancers and readiness probes:

- **Path:** `GET /api/health` or `GET /health`
- **Response:** `200 OK` with a JSON body indicating status (e.g. `{"status":"ok"}` or `{"status":"healthy"}`).
- **Use:** Readiness probes, load balancer health checks, and operational monitoring.

This satisfies the P1 backlog item "Implement health check endpoint" for adopter projects; no implementation exists in this repo because the framework has no application server.

## References

- [API Overview](./01_overview.md)
- [Versioning](./06_versioning.md)
- Project conventions: root `CLAUDE.md`, `AGENTS.md`
