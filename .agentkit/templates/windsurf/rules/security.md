<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown rule for Windsurf Cascade AI. -->
<!-- Docs: https://docs.windsurf.com/windsurf/cascade -->
# Security Rules

These rules apply to all AI-assisted development in this repository.

## Absolute Rules
- Never read, print, or commit secrets or tokens
- Prefer least privilege and deny-by-default for all access controls
- Never disable security checks to make tests pass
- Any authentication or authorization change requires both tests and documentation
- Never write to .env, .tfvars, or credential files

## Code Security
- Validate all external inputs at system boundaries
- Use parameterized queries for all database access
- Sanitize output to prevent injection attacks
- Apply rate limiting to public-facing endpoints
- Log security-relevant events without including sensitive data

## Dependency Security
- Review new dependencies before adding them
- Keep dependencies updated to patch known vulnerabilities
- Prefer well-maintained packages with active security response teams
- Pin dependency versions in production configurations

## Incident Response
- If a secret is accidentally committed, rotate it immediately
- Report security concerns through the designated escalation path
- Document security decisions in ADRs
