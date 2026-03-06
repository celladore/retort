#!/bin/sh
# Shortcut script for AgentKit Forge setup

# Install dependencies
pnpm -C .agentkit install

# Sync tool configs
pnpm -C .agentkit agentkit:sync

# Validate setup
pnpm -C .agentkit agentkit:validate
