#!/usr/bin/env pwsh
# ---------------------------------------------------------------------------
# Hook: Stop
# Purpose: Best-effort build / lint / test validation before Claude stops.
#          If the build fails the hook returns a "block" decision so Claude
#          can attempt to fix the problem before finishing.
# Stdin:   JSON with session_id, cwd, hook_event_name, stop_hook_active, ...
# Stdout:  JSON with decision "block" + reason on failure, empty on success
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"

# -- Read JSON payload from stdin ------------------------------------------
try {
    $rawInput = @($input) -join ""
    $data = $rawInput | ConvertFrom-Json
} catch {
    $data = $null
}

$cwd = if ($data -and $data.PSObject.Properties['cwd'] -and -not [string]::IsNullOrWhiteSpace($data.cwd)) {
    $data.cwd
} else {
    $PWD.Path
}

# Guard against infinite loops: if stop_hook_active is already true the hook
# was re-invoked after a previous block -- let it through this time.
$stopHookActive = $false
if ($data -and $data.PSObject.Properties['stop_hook_active']) {
    $stopHookActive = $data.stop_hook_active
}
if ($stopHookActive -eq $true) {
    exit 0
}

# -- Helper: run a command and capture failure -----------------------------
function Invoke-Check {
    param(
        [string]$Label,
        [string]$Command,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    try {
        $prevDir = $PWD.Path
        if ($WorkingDirectory) { Set-Location $WorkingDirectory }
        try {
            $output = & $Command @Arguments 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0) {
                return @{ Success = $false; Output = "$Label failed:`n$output" }
            }
            return @{ Success = $true; Output = "" }
        } finally {
            Set-Location $prevDir
        }
    } catch {
        return @{ Success = $false; Output = "$Label failed:`n$($_.Exception.Message)" }
    }
}

function Send-Block {
    param([string]$Reason)
    $result = @{
        decision = "block"
        reason   = $Reason
    } | ConvertTo-Json -Depth 5
    Write-Output $result
    exit 0
}

# -- Auto-detect stack and run checks --------------------------------------
$ranCheck = $false

# Node.js / JavaScript / TypeScript
$packageJsonPath = Join-Path $cwd "package.json"
if (Test-Path $packageJsonPath) {
    $ranCheck = $true

    # Determine the package manager.
    $pm = "npm"
    if ((Test-Path (Join-Path $cwd "pnpm-lock.yaml")) -and (Get-Command "pnpm" -ErrorAction SilentlyContinue)) {
        $pm = "pnpm"
    } elseif ((Test-Path (Join-Path $cwd "yarn.lock")) -and (Get-Command "yarn" -ErrorAction SilentlyContinue)) {
        $pm = "yarn"
    }

    # Read package.json to check for scripts.
    try {
        $pkgJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    } catch {
        $pkgJson = $null
    }

    $scripts = @()
    if ($pkgJson -and $pkgJson.PSObject.Properties['scripts']) {
        $scripts = $pkgJson.scripts.PSObject.Properties.Name
    }

    # Each package manager uses a different flag to set the working directory.
    function Invoke-PmRun {
        param([string]$Script)
        if ($pm -eq "pnpm") {
            return Invoke-Check -Label "$pm $Script" -Command $pm -Arguments @("-C", $cwd, "run", $Script)
        } elseif ($pm -eq "yarn") {
            return Invoke-Check -Label "$pm $Script" -Command $pm -Arguments @("--cwd", $cwd, "run", $Script)
        } else {
            return Invoke-Check -Label "$pm $Script" -Command $pm -Arguments @("--prefix", $cwd, "run", $Script)
        }
    }

    if ($scripts -contains "lint") {
        $result = Invoke-Check -Label "$pm lint" -Command $pm -Arguments @("run", "lint") -WorkingDirectory $cwd
        if (-not $result.Success) { Send-Block -Reason $result.Output }
    }

    if ($scripts -contains "test") {
        $result = Invoke-Check -Label "$pm test" -Command $pm -Arguments @("run", "test") -WorkingDirectory $cwd
        if (-not $result.Success) { Send-Block -Reason $result.Output }
    }

    if ($scripts -contains "build") {
        $result = Invoke-Check -Label "$pm build" -Command $pm -Arguments @("run", "build") -WorkingDirectory $cwd
        if (-not $result.Success) { Send-Block -Reason $result.Output }
    }
}

# .NET
$slnFiles = Get-ChildItem -Path $cwd -Recurse -Depth 2 -Include "*.sln", "*.csproj" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($slnFiles -and (Get-Command "dotnet" -ErrorAction SilentlyContinue)) {
    $ranCheck = $true
    $slnPath = $slnFiles.FullName

    $result = Invoke-Check -Label "dotnet build" -Command "dotnet" -Arguments @("build", $slnPath, "--nologo", "--verbosity", "quiet") -WorkingDirectory $cwd
    if (-not $result.Success) { Send-Block -Reason $result.Output }

    $result = Invoke-Check -Label "dotnet test" -Command "dotnet" -Arguments @("test", $slnPath, "--nologo", "--verbosity", "quiet", "--no-build") -WorkingDirectory $cwd
    if (-not $result.Success) { Send-Block -Reason $result.Output }
}

# Rust / Cargo
$cargoTomlPath = Join-Path $cwd "Cargo.toml"
if ((Test-Path $cargoTomlPath) -and (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    $ranCheck = $true

    $result = Invoke-Check -Label "cargo check" -Command "cargo" -Arguments @("check", "--manifest-path", $cargoTomlPath, "--quiet") -WorkingDirectory $cwd
    if (-not $result.Success) { Send-Block -Reason $result.Output }

    $result = Invoke-Check -Label "cargo test" -Command "cargo" -Arguments @("test", "--manifest-path", $cargoTomlPath, "--quiet") -WorkingDirectory $cwd
    if (-not $result.Success) { Send-Block -Reason $result.Output }
}

# Python
$pyprojectPath = Join-Path $cwd "pyproject.toml"
if (Test-Path $pyprojectPath) {
    $ranCheck = $true

    if (Get-Command "pytest" -ErrorAction SilentlyContinue) {
        $result = Invoke-Check -Label "pytest" -Command "pytest" -Arguments @("--rootdir", $cwd, "-q") -WorkingDirectory $cwd
        if (-not $result.Success) { Send-Block -Reason $result.Output }
    } elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
        $result = Invoke-Check -Label "python -m pytest" -Command "python3" -Arguments @("-m", "pytest", "--rootdir", $cwd, "-q") -WorkingDirectory $cwd
        if (-not $result.Success) { Send-Block -Reason $result.Output }
    } elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
        $result = Invoke-Check -Label "python -m pytest" -Command "python" -Arguments @("-m", "pytest", "--rootdir", $cwd, "-q") -WorkingDirectory $cwd
        if (-not $result.Success) { Send-Block -Reason $result.Output }
    }
}

# If no build tools were found, or all checks passed -- allow stop.
exit 0
