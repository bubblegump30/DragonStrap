param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host '== DragonStrap Windows Stable Release Build ==' -ForegroundColor Magenta

if (-not $SkipInstall) { npm install }

npm run check
npm test
npm run release:verify
npm run release:prepare

if ($env:CSC_LINK) {
    Write-Host 'Windows code-signing input detected. electron-builder will attempt signing.' -ForegroundColor Green
} else {
    Write-Warning 'No CSC_LINK signing input detected. Windows release artifacts will be unsigned unless another signing provider is configured.'
}

npm run dist:win

$hashFile = Join-Path $PWD 'dist\SHA256SUMS.txt'
Get-ChildItem 'dist' -File | Where-Object { $_.Extension -in '.exe','.zip','.blockmap','.yml' } | ForEach-Object {
    $hash=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $($_.Name)"
} | Set-Content -Encoding ascii $hashFile

Write-Host "Release hashes written to $hashFile" -ForegroundColor Green
Write-Host 'Review the generated artifacts, signature state, and SHA256SUMS.txt before publishing a GitHub Release.' -ForegroundColor Cyan
