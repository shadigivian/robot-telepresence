[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$Status,
    [switch]$RetryShare,
    [ValidateRange(5, 120)][int]$StartupTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$serverPath = Join-Path $repoRoot 'server.js'
$privateDirectory = Join-Path $repoRoot 'data'
$runtimePath = Join-Path $privateDirectory 'server-runtime.json'
$outputLog = Join-Path $privateDirectory 'server-output.log'
$errorLog = Join-Path $privateDirectory 'server-error.log'
$controlPath = Join-Path $privateDirectory 'server-control.json'
$launcherLock = $null

function Get-Health {
    param([string]$Base)
    try {
        $result = Invoke-RestMethod -Uri ($Base + '/api/health') -TimeoutSec 2 -Proxy $null
        if ($result.ok -eq $true -and $result.version -eq 2) { return $result }
    } catch { }
    return $null
}

function Get-ShareInfo {
    param([string]$Base)
    try {
        $result = Invoke-RestMethod -Uri ($Base + '/share-info') -TimeoutSec 2 -Proxy $null
        if ($result.state -in @('off', 'starting', 'ready', 'error', 'blocked')) { return $result }
    } catch { }
    return $null
}

function Get-ProcessDetails {
    param([int]$ProcessId)
    try { return Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ProcessId) }
    catch { return $null }
}

function Test-RepositoryServer {
    param($Details, [string]$NodeExecutable)
    if (-not $Details -or -not $Details.CommandLine -or -not $Details.ExecutablePath) { return $false }
    if (-not [string]::Equals($Details.ExecutablePath, $NodeExecutable, [StringComparison]::OrdinalIgnoreCase)) { return $false }
    $pattern = '(?i)(?:^|\s)"?' + [regex]::Escape($serverPath) + '"?(?:\s|$)'
    return [regex]::IsMatch($Details.CommandLine, $pattern)
}

function Write-Runtime {
    param([int]$ProcessId, [int]$Port, [string]$NodeExecutable)
    $record = @{ version = 1; pid = $ProcessId; port = $Port; serverPath = $serverPath; nodePath = $NodeExecutable }
    $record | ConvertTo-Json -Compress | Set-Content -LiteralPath $runtimePath -Encoding UTF8
}

function Request-ShareRecovery {
    param([string]$Base, [int]$Port, [int]$KnownProcessId, [string]$NodeExecutable)
    # The private key is never read for an unknown compatible server. Recheck
    # both the exact process and its local listener immediately before using it.
    if ($KnownProcessId -le 0 -or -not (Test-RepositoryServer (Get-ProcessDetails $KnownProcessId) $NodeExecutable)) {
        Write-Host 'Public recovery was skipped because the repository server could not be verified.'
        return $false
    }
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if (-not ($listeners | Where-Object { $_.OwningProcess -eq $KnownProcessId })) {
        Write-Host 'Public recovery was skipped because the local listener changed.'
        return $false
    }
    if (-not (Test-Path -LiteralPath $controlPath -PathType Leaf)) {
        Write-Host 'This running server needs a manual restart to enable public-connection recovery.'
        return $false
    }
    try {
        $control = Get-Content -LiteralPath $controlPath -Raw | ConvertFrom-Json
        if ($control.version -ne 1 -or $control.key -isnot [string] -or $control.key -notmatch '^[A-Za-z0-9_-]{32,128}$') {
            Write-Host 'The private local recovery settings are unavailable. Restart this repository server manually.'
            return $false
        }
        $requestHeaders = @{ 'X-Robot-Local-Key' = $control.key }
        $response = Invoke-RestMethod -Uri ($Base + '/share-retry') -Method Post -ContentType 'application/json' -Body '{}' -Headers $requestHeaders -TimeoutSec 3 -Proxy $null
        if ($response.accepted -ne $true) {
            Write-Host 'The running server did not accept public-connection recovery; the local backend remains available.'
            return $false
        }
        Write-Host 'Public-connection recovery was requested once. The local backend stays running.'
        return $true
    } catch {
        # Do not expose a key, response body, headers, or provider error text.
        Write-Host 'Public-connection recovery is unavailable in the running server. Check private logs or restart this repository server manually.'
        return $false
    } finally {
        $control = $null
        $requestHeaders = $null
    }
}

function Show-Server {
    param([string]$Base, $Health, [switch]$WaitForShare, [int]$KnownProcessId = 0, [string]$NodeExecutable, [switch]$AllowRecovery)
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    $recoveryAttempted = $false
    $shareInfo = Get-ShareInfo $Base
    if ($WaitForShare -and $AllowRecovery -and $shareInfo -and ($shareInfo.state -in @('error', 'off') -or ($RetryShare -and $shareInfo.state -eq 'blocked'))) {
        $recoveryAttempted = $true
        if (Request-ShareRecovery $Base ([Uri]$Base).Port $KnownProcessId $NodeExecutable) { $shareInfo = Get-ShareInfo $Base }
    }
    if ($WaitForShare -and $shareInfo -and $shareInfo.state -eq 'starting') {
        while ($shareInfo.state -eq 'starting' -and [DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Milliseconds 500
            $current = Get-ShareInfo $Base
            if ($current) { $shareInfo = $current }
            if ($AllowRecovery -and -not $recoveryAttempted -and $shareInfo.state -in @('error', 'off')) {
                $recoveryAttempted = $true
                if (Request-ShareRecovery $Base ([Uri]$Base).Port $KnownProcessId $NodeExecutable) { $shareInfo = Get-ShareInfo $Base }
            }
        }
    }
    Write-Host 'Local backend is ready. These pages work on this laptop:'
    Write-Host ('Local Robot Station: ' + $Base + '/robot')
    Write-Host ('Local operator: ' + $Base + '/user')
    Write-Host ('Local staff and administration: ' + $Base + '/portal.html')
    if (-not $Health.initialized) { Write-Host 'Initial administrator setup is required. Follow npm run setup in README.md.' }
    if ($shareInfo -and $shareInfo.state -eq 'ready' -and $shareInfo.url) {
        $publicUri = $null
        if ([Uri]::TryCreate([string]$shareInfo.url, [UriKind]::Absolute, [ref]$publicUri) -and $publicUri.Scheme -eq 'https' -and -not $publicUri.UserInfo -and -not $publicUri.Query -and -not $publicUri.Fragment) {
            Write-Host 'Public connection: ready.'
            Write-Host ('Remote Robot Station: ' + $shareInfo.url.TrimEnd('/') + '/robot')
            Write-Host ('Remote operator: ' + $shareInfo.url.TrimEnd('/') + '/user')
            Write-Host ('Remote staff and administration: ' + $shareInfo.url.TrimEnd('/') + '/portal.html')
            Write-Host 'Use the Robot Station to create a single-use guest invitation.'
        } else { Write-Host 'Public connection: unavailable. The tunnel did not supply a valid HTTPS address; remote pages cannot connect yet.' }
    } elseif ($shareInfo -and $shareInfo.state -eq 'off') {
        Write-Host 'Public connection: off. This server was started without sharing; remote pages cannot connect.'
        Write-Host 'This launcher preserves existing processes. Check private logs or manually restart this repository server to enable sharing.'
    } else {
        $state = if ($shareInfo) { [string]$shareInfo.state } else { 'unknown' }
        Write-Host ('Public connection: ' + $state + '. Remote pages cannot connect yet; the local backend remains available.')
        Write-Host 'Run start-robot.bat -Status again to check the current public connection.'
    }
    Write-Host ('Private logs: ' + $outputLog + ' and ' + $errorLog)
    if (-not $NoBrowser -and -not $Status) {
        try { Start-Process ($Base + '/robot') | Out-Null }
        catch { Write-Host 'Open the Robot Station address above in Chrome or Edge.' }
    }
}

try {
    $nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $nodeCommand) { throw 'Node.js is not installed. Install Node 22 LTS from https://nodejs.org.' }
    $nodeExecutable = $nodeCommand.Source
    if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) { throw 'server.js is missing from this repository.' }
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules/socket.io') -PathType Container)) { throw 'Dependencies are missing. Run npm ci in the repository first.' }

    # Use the shared parser, not PowerShell evaluation. Only nonsecret port and
    # loopback information leave Node; neither credentials nor environment dump.
    $settingsScript = @'
const path = require('node:path');
const root = process.argv[1];
require(path.join(root, 'lib/env.js')).loadEnv(path.join(root, '.env'));
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) process.exit(1);
if (!['127.0.0.1', 'localhost', '0.0.0.0', '::', '::1'].includes(host)) process.exit(1);
const localHost = host === '::' || host === '::1' ? '[::1]' : host === 'localhost' ? 'localhost' : '127.0.0.1';
process.stdout.write(JSON.stringify({ port, localHost }));
'@
    $settingsText = & $nodeExecutable -e $settingsScript $repoRoot 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $settingsText) { throw 'Cannot read local server settings. Check private .env syntax, PORT, and a loopback/wildcard HOST.' }
    $settings = ($settingsText -join '') | ConvertFrom-Json
    $portNumber = [int]$settings.port
    $localBase = 'http://' + $settings.localHost + ':' + $portNumber
    $health = Get-Health $localBase

    if ($Status) {
        if (-not $health) { throw ('No ready robot server was found at ' + $localBase + '. Run start-robot.bat to start it.') }
        Show-Server $localBase $health
        exit 0
    }

    New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null
    try {
        $launcherLock = [IO.File]::Open((Join-Path $privateDirectory 'server-launcher.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch { throw 'Another robot launcher is running. Wait for it to finish, then try again.' }

    # Recheck after acquiring the launch lock. Never stop an existing process.
    $health = Get-Health $localBase
    if ($health) {
        $shareInfo = Get-ShareInfo $localBase
        if (-not $shareInfo) { throw ('Port ' + $portNumber + ' is in use by an unrecognized server. It was left running.') }
        $listeners = @(Get-NetTCPConnection -LocalPort $portNumber -State Listen -ErrorAction SilentlyContinue)
        $knownServer = $false
        $knownProcessId = 0
        foreach ($listener in $listeners) {
            if (Test-RepositoryServer (Get-ProcessDetails $listener.OwningProcess) $nodeExecutable) {
                Write-Runtime $listener.OwningProcess $portNumber $nodeExecutable
                $knownServer = $true
                $knownProcessId = [int]$listener.OwningProcess
                break
            }
        }
        if ($knownServer) { Write-Host 'Using the existing server from this repository.' }
        else { Write-Host 'Using the existing compatible robot server. No new process was started.' }
        Show-Server $localBase $health -WaitForShare -KnownProcessId $knownProcessId -NodeExecutable $nodeExecutable -AllowRecovery:$knownServer
        exit 0
    }

    $managedProcess = $null
    if (Test-Path -LiteralPath $runtimePath -PathType Leaf) {
        try {
            $record = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
            if ($record.version -eq 1 -and $record.pid -gt 0) {
                $candidate = Get-ProcessDetails ([int]$record.pid)
                if (Test-RepositoryServer $candidate $nodeExecutable) { $managedProcess = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue }
            }
        } catch { }
    }
    if (-not $managedProcess) {
        $listeners = @(Get-NetTCPConnection -LocalPort $portNumber -State Listen -ErrorAction SilentlyContinue)
        if ($listeners.Count) { throw ('Port ' + $portNumber + ' is already in use. The existing process was left running; close it manually or choose a different private PORT.') }
        $arguments = @(('"' + $serverPath + '"'), '--share')
        $managedProcess = Start-Process -FilePath $nodeExecutable -ArgumentList $arguments -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog
        Write-Runtime $managedProcess.Id $portNumber $nodeExecutable
    }

    $deadline = [DateTime]::UtcNow.AddSeconds($StartupTimeoutSeconds)
    do {
        $health = Get-Health $localBase
        if ($health) { break }
        $managedProcess.Refresh()
        if ($managedProcess.HasExited) { throw 'The robot server exited during startup. Check the private server logs.' }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $health) { throw 'The robot server did not become ready in time. Check the private logs; its process was left running for inspection.' }
    Show-Server $localBase $health -WaitForShare -KnownProcessId $managedProcess.Id -NodeExecutable $nodeExecutable -AllowRecovery
    exit 0
} catch {
    # These messages are launcher-authored and contain no provider keys. Do not
    # dump process environments, Node parser errors, or private log contents.
    $message = $_.Exception.Message
    $knownMessage = $message -match '^(Node\.js is not installed|server\.js is missing|Dependencies are missing|Cannot read local server settings|No ready robot server was found|Another robot launcher is running|Port [0-9]+ is|The robot server exited|The robot server did not become ready)'
    if ($knownMessage) { Write-Host ('ERROR: ' + $message) }
    else { Write-Host 'ERROR: Could not start the robot server. Check repository permissions and the private server logs.' }
    Write-Host ('Inspect locally: ' + $outputLog + ' and ' + $errorLog)
    exit 1
} finally {
    if ($launcherLock) { $launcherLock.Dispose() }
}
