#!/usr/bin/env bash
set -euo pipefail
# Shortcut script for Retort setup

# Install dependencies
pnpm --dir .agentkit install

# Sync tool configs
pnpm --dir .agentkit agentkit:sync

# Validate setup
pnpm --dir .agentkit agentkit:validate
