param(
    [string]$RepoUrl = "https://github.com/bubblegump30/DragonStrap.git",
    [string]$CommitMessage = "DragonStrap v2.0.4 - DragonStrap 2.0 Release + Hotfix Rollup"
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host '== DragonStrap GitHub Publisher ==' -ForegroundColor Magenta
npm run check
npm test
npm run release:verify

$wasNewRepository = -not (Test-Path '.git')
if ($wasNewRepository) {
    git init
    git branch -M main
}

$remoteNames = @(git remote)
if ($remoteNames -contains 'origin') {
    $existing = (git remote get-url origin).Trim()
    if ($existing -ne $RepoUrl) {
        git remote set-url origin $RepoUrl
    }
} else {
    git remote add origin $RepoUrl
}

# When this ZIP is extracted into a fresh directory, attach its first commit to
# the existing public main branch instead of creating an unrelated Git history.
if ($wasNewRepository) {
    git fetch origin main
    git reset --mixed origin/main

    # Preserve the repository funding configuration if a future source bundle
    # does not contain it. This prevents source publication from silently
    # removing GitHub Sponsors/PayPal metadata that lives on main.
    $fundingPath = '.github/FUNDING.yml'
    $fundingOnRemote = git ls-tree -r --name-only origin/main -- $fundingPath
    if ($fundingOnRemote -and -not (Test-Path $fundingPath)) {
        git checkout origin/main -- $fundingPath
    }
}

git branch -M main
git add --all
$pending = git status --porcelain
if ($pending) {
    git commit -m $CommitMessage
} else {
    Write-Host 'No local changes to commit.' -ForegroundColor Yellow
}

git push -u origin main
Write-Host 'DragonStrap main branch is synchronized with GitHub.' -ForegroundColor Green
