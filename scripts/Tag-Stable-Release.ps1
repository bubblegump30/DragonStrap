param([string]$Version = "2.0.4")
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$expected = (Get-Content '.\VERSION' -Raw).Trim()
if ($Version -ne $expected) { throw "Requested tag version $Version does not match VERSION $expected." }
if (-not (Test-Path '.git')) { throw 'This source directory is not a Git repository.' }
if (git status --porcelain) { throw 'Working tree is not clean. Commit and push the stable release before tagging it.' }

$tag = "v$Version"
if (git tag --list $tag) { throw "Tag $tag already exists locally." }

git tag -a $tag -m "DragonStrap $tag - Stable Release"
git push origin $tag
Write-Host "Published stable tag $tag." -ForegroundColor Green
