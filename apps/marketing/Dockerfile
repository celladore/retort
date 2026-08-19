# Serves apps/marketing/index.html as-is — no build step, matches the
# "no build step, no framework, no dependencies" design of this page (see
# README.md). Caddy just serves the static file; nothing here compiles or
# bundles anything.
FROM caddy:2-alpine

COPY index.html /usr/share/caddy/index.html
COPY Caddyfile /etc/caddy/Caddyfile
