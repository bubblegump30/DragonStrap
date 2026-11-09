$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskBuilder=(Get-Content (Join-Path $taskRoot 'node_modules\electron-builder\package.json') -Raw|ConvertFrom-Json).version
if($taskBuilder -ne '26.18.0'){throw 'Revalidate installer-tool pins before changing electron-builder.'}
$taskCache=Join-Path $taskRoot 'node_modules\.cache\dragonstrap-installer-tools'
New-Item -ItemType Directory -Force $taskCache|Out-Null
# SHA-256 pins are from the exact installed app-builder-lib 26.18.0 toolsets.
$taskTools=@(
 @{Tag='7zip@1.0.0';Name='7zip-win-x64.tar.gz';Hash='be071f15bd6da2f78fe81c6ddef2009b0c4d8a51f36b780cb806c7e6df95e1b3';Folder='7zip';Check='7zip\bin\7za.exe';Variable='ELECTRON_BUILDER_7ZIP_PATH'},
 @{Tag='nsis-3.0.4.1';Name='nsis-3.0.4.1.7z';Hash='9877df902530f96357d13a7a31ae2b9df67f48b11ffc9a1700a7c961574ec5fa';Folder='nsis';Check='Bin\makensis.exe';Variable='ELECTRON_BUILDER_NSIS_DIR'},
 @{Tag='nsis-resources-3.4.1';Name='nsis-resources-3.4.1.7z';Hash='593a9a92ef958321293ac6a2ee61e64bf1bd543142a5bd6b3d310709cc924103';Folder='resources';Check='plugins';Variable='ELECTRON_BUILDER_NSIS_RESOURCES_DIR'}
)
foreach($taskTool in $taskTools){
 $taskArchive=Join-Path $taskCache $taskTool.Name
 if(-not(Test-Path -LiteralPath $taskArchive)){
  $taskDownloaded=$false
  for($taskAttempt=1;$taskAttempt -le 3;$taskAttempt++){
   & gh release download $taskTool.Tag --repo electron-userland/electron-builder-binaries --pattern $taskTool.Name --dir $taskCache --clobber
   if($LASTEXITCODE -eq 0){$taskDownloaded=$true;break}
   if($taskAttempt -lt 3){Start-Sleep -Seconds (2*$taskAttempt)}
  }
  if(-not $taskDownloaded){throw "Official installer-tool download failed: $($taskTool.Name)"}
 }
 if((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskTool.Hash){throw "Installer-tool checksum mismatch: $($taskTool.Name)"}
 $taskDestination=Join-Path $taskCache $taskTool.Folder
 New-Item -ItemType Directory -Force $taskDestination|Out-Null
 & tar.exe -xf $taskArchive -C $taskDestination
 if($LASTEXITCODE -ne 0 -or -not(Test-Path -LiteralPath (Join-Path $taskDestination $taskTool.Check))){throw "Installer-tool extraction failed: $($taskTool.Name)"}
 $taskValue=if($taskTool.Variable -eq 'ELECTRON_BUILDER_7ZIP_PATH'){Join-Path $taskDestination $taskTool.Check}else{$taskDestination}
 [Environment]::SetEnvironmentVariable($taskTool.Variable,$taskValue,'Process')
 if($env:GITHUB_ENV){"$($taskTool.Variable)=$taskValue"|Out-File -LiteralPath $env:GITHUB_ENV -Append -Encoding utf8}
 Write-Host "Verified official installer tool: $($taskTool.Name) $($taskTool.Hash)"
}
