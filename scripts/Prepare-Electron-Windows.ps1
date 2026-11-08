$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPackage = Join-Path $taskRoot 'node_modules\electron'
$taskVersion = (Get-Content (Join-Path $taskPackage 'package.json') -Raw | ConvertFrom-Json).version
$taskPinned = (Get-Content (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).devDependencies.electron
if ($taskVersion -ne $taskPinned -or $taskVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Electron must match the exact pinned stable dependency version.' }
$taskName = "electron-v$taskVersion-win32-x64.zip"
$taskChecksums = Get-Content (Join-Path $taskPackage 'checksums.json') -Raw | ConvertFrom-Json
$taskExpected = $taskChecksums.PSObject.Properties[$taskName].Value
if ($taskExpected -notmatch '^[a-f0-9]{64}$') { throw 'The pinned npm package does not contain an Electron archive checksum.' }
$taskCache = Join-Path $taskRoot "node_modules\.cache\dragonstrap-electron\$taskVersion"
New-Item -ItemType Directory -Force $taskCache | Out-Null
$taskArchive = Join-Path $taskCache $taskName
if (-not (Test-Path -LiteralPath $taskArchive)) {
    $taskDownloaded = $false
    for ($taskAttempt = 1; $taskAttempt -le 3; $taskAttempt++) {
        & gh release download "v$taskVersion" --repo electron/electron --pattern $taskName --dir $taskCache --clobber
        if ($LASTEXITCODE -eq 0) { $taskDownloaded = $true; break }
        if ($taskAttempt -lt 3) { Start-Sleep -Seconds (2 * $taskAttempt) }
    }
    if (-not $taskDownloaded) { throw 'Official Electron release-asset download failed.' }
}
$taskActual = (Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($taskActual -cne $taskExpected) { throw 'Electron archive checksum mismatch; refusing to install the runtime.' }
$taskDist = Join-Path $taskPackage 'dist'
Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskDist -Force
$taskInstalledVersion = (Get-Content (Join-Path $taskDist 'version') -Raw).Trim().TrimStart('v')
if ($taskInstalledVersion -ne $taskVersion -or -not (Test-Path -LiteralPath (Join-Path $taskDist 'electron.exe'))) { throw 'Extracted Electron runtime is incomplete or the wrong version.' }
[IO.File]::WriteAllText((Join-Path $taskPackage 'path.txt'), 'electron.exe', [Text.Encoding]::ASCII)
Write-Host "Verified official Electron $taskVersion Windows x64 runtime: $taskActual"
