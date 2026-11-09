param([switch]$SkipInstall, [string]$ElectronDist)
$ErrorActionPreference = 'Stop'
# Native command failures must stop packaging on Windows PowerShell as well as pwsh.
function Invoke-Npm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArguments)
    & npm.cmd @NpmArguments
    if ($LASTEXITCODE -ne 0) { throw "npm failed with exit code $LASTEXITCODE" }
}
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host '== DragonStrap Windows Release Build ==' -ForegroundColor Magenta
$taskDirty=@(& git status --porcelain --untracked-files=normal | Where-Object { $_ -notmatch '^\?\? dist-meta/' })
if ($LASTEXITCODE -ne 0 -or $taskDirty.Count) { throw 'Commit release source before packaging so the source ZIP matches the application.' }


if (-not $SkipInstall) { Invoke-Npm ci }

Invoke-Npm run check
Invoke-Npm test
Invoke-Npm run release:verify
Invoke-Npm run release:prepare

if ($env:CSC_LINK) {
    Write-Host 'Windows code-signing input detected. electron-builder will attempt signing.' -ForegroundColor Green
} else {
    Write-Host 'Unsigned Windows release selected; no CSC_LINK code-signing input configured.' -ForegroundColor Cyan
}

if ($ElectronDist) { Invoke-Npm -NpmArguments @('run', 'dist:win', '--', "--config.electronDist=$ElectronDist") }
else { Invoke-Npm run dist:win }

$version = (Get-Content '.\VERSION' -Raw).Trim()
$portable = Join-Path $PWD "dist\DragonStrap-Portable-$version-x64.exe"
$setup = Join-Path $PWD "dist\DragonStrap-Setup-$version-x64.exe"
foreach ($artifact in @($portable, $setup)) {
    if (-not (Test-Path $artifact)) { throw "Required Update Center artifact was not produced: $artifact" }
}

& node scripts/prepare-folder-portable.js
if ($LASTEXITCODE -ne 0) { throw 'Folder Portable preparation failed' }
$folder = Join-Path $PWD "dist\DragonStrap-Folder-$version-x64"
$folderZip = Join-Path $PWD "dist\DragonStrap-FastFolder-$version-x64.zip"
Compress-Archive -LiteralPath $folder -DestinationPath $folderZip -CompressionLevel Fastest
$sourceZip = Join-Path $PWD "dist\DragonStrap-v$version-Source.zip"
& git archive --format=zip --output=$sourceZip HEAD
if ($LASTEXITCODE -ne 0) { throw 'Source archive creation failed' }
$hashFile = Join-Path $PWD 'dist\SHA256SUMS.txt'
@($portable,$setup,$folderZip,$sourceZip) | ForEach-Object {
    $hash=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([IO.Path]::GetFileName($_))"
} | Set-Content -Encoding ascii $hashFile

Write-Host "Release hashes written to $hashFile" -ForegroundColor Green
Write-Host 'Review the generated artifacts, signature state, and SHA256SUMS.txt before publishing a GitHub Release.' -ForegroundColor Cyan
