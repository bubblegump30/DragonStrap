param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host '== DragonStrap Windows Release Build =='
if (-not $SkipInstall) { npm install }
npm run check
npm test
npm run release:verify
npm run release:prepare
npm run dist:win
$hashFile = Join-Path $PWD 'dist\SHA256SUMS.txt'
Get-ChildItem 'dist' -File | Where-Object { $_.Extension -in '.exe','.zip','.blockmap','.yml' } | ForEach-Object {
  $hash=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $($_.Name)"
} | Set-Content -Encoding ascii $hashFile
Write-Host "Release hashes written to $hashFile"
