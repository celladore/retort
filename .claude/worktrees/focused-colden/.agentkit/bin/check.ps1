#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
node (Join-Path $Root "engines/node/src/cli.mjs") check @args
