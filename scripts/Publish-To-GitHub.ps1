$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/bubblegump30/DragonStrap.git"
$CommitMessage = "DragonStrap v0.9.5 - initial public repository baseline"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "== DragonStrap GitHub Publisher ==" -ForegroundColor Magenta

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed or is not available in PATH. Install Git for Windows, reopen PowerShell, and run this script again."
}

# Verify the source before publishing.
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "Running source verification..." -ForegroundColor Cyan
    node .\scripts\check-source.js
    if ($LASTEXITCODE -ne 0) { throw "DragonStrap source verification failed." }

    Write-Host "Running tests..." -ForegroundColor Cyan
    node --test .\tests\*.test.js
    if ($LASTEXITCODE -ne 0) { throw "DragonStrap tests failed." }
} else {
    Write-Warning "Node.js was not found. Git publishing can continue, but local source/tests were not re-run."
}

if (-not (Test-Path ".git")) {
    git init -b main
    if ($LASTEXITCODE -ne 0) { throw "git init failed." }
}

# Ensure main is the branch we publish.
git branch -M main

# A freshly initialized repository has no remotes. Query the remote names first so
# Git never has to emit an expected "No such remote" error under ErrorActionPreference=Stop.
$remoteNames = @(git remote)
if ($LASTEXITCODE -ne 0) { throw "Unable to read Git remotes." }

if ($remoteNames -contains "origin") {
    $existing = (git remote get-url origin).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Unable to read the origin remote." }

    if ($existing -ne $RepoUrl) {
        git remote set-url origin $RepoUrl
        if ($LASTEXITCODE -ne 0) { throw "Unable to update the origin remote." }
    }
} else {
    git remote add origin $RepoUrl
    if ($LASTEXITCODE -ne 0) { throw "Unable to add the origin remote." }
}

# Refuse to commit generated/dependency directories even if they were created locally.
if (Test-Path "node_modules") { Write-Host "node_modules is ignored by .gitignore." -ForegroundColor DarkGray }
if (Test-Path "dist") { Write-Host "dist is ignored by .gitignore." -ForegroundColor DarkGray }

git add --all
if ($LASTEXITCODE -ne 0) { throw "git add failed." }

$pending = git status --porcelain
if ([string]::IsNullOrWhiteSpace(($pending -join ""))) {
    Write-Host "Nothing new to commit." -ForegroundColor Yellow
} else {
    git commit -m $CommitMessage
    if ($LASTEXITCODE -ne 0) {
        throw "git commit failed. If Git asks for your identity, configure user.name and user.email and run this script again."
    }
}

Write-Host "Pushing main to $RepoUrl ..." -ForegroundColor Cyan
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    throw "git push failed. Complete GitHub authentication in Git Credential Manager/browser if prompted, then run this script again."
}

Write-Host "DragonStrap v0.9.5 is published to GitHub." -ForegroundColor Green
