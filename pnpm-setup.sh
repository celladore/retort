#!/usr/bin/env bash
set -euo pipefail
# Shortcut script for Retort setup

# Install dependencies
pnpm -C .agentkit install

# Sync tool configs
pnpm -C .agentkit agentkit:sync

# Validate setup
pnpm -C .agentkit agentkit:validate
