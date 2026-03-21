# Database — retort

This repository (**retort**) is the Retort framework. It has **no database** and no ORM (see root `CLAUDE.md`: Database: none, ORM: none).

## For adopters

- **Schema design:** Adopter projects own their database schema. Define models and migrations in your repo under `db/`, `prisma/`, or `migrations/` per your stack.
- **API dependency:** Schema design typically follows API and domain needs; align with your backend API route structure (see `docs/api/07_framework-api-conventions.md`).
- **Conventions:** When adding a database, follow project conventions in your repo’s CLAUDE.md and AGENTS.md (e.g. PostgreSQL, Prisma or Drizzle as in backlog examples).

This directory exists as a placeholder for adopters who add a database to their project; the framework itself does not use it.
