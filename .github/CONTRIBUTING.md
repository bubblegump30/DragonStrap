# Contributing to DragonStrap

Thank you for considering a contribution to DragonStrap.

DragonStrap is a Windows Roblox bootstrapper and launcher built with Electron. Contributions should preserve reliability, security boundaries, update integrity, and the established Purple Dragon UI/UX.

## Development requirements

- Windows 10 or Windows 11
- Node.js
- npm
- Git
- Windows `tar.exe` for the Roblox package engine

## Set up a development copy

1. Fork the repository on GitHub.
2. Clone your fork.
3. Open PowerShell in the repository directory.
4. Install dependencies:

```powershell
npm install
```

5. Start the application:

```powershell
npm start
```

For development mode:

```powershell
npm run dev
```

Source/dev mode intentionally disables binary self-application. Use a packaged build when testing Portable or Setup update paths.

## Required validation

For code changes, run:

```powershell
npm run check
npm test
npm run release:verify
```

For packaging changes, test an unpacked Windows build when applicable:

```powershell
npm run pack:win
```

For release/distribution work:

```powershell
npm run dist:win
```

Documentation-only pull requests do not need unrelated runtime or packaging tests.

## Contribution guidelines

- Keep each pull request focused on one logical change.
- Explain what changed and why.
- Include the testing you performed.
- Include screenshots for meaningful UI changes.
- Note compatibility, privilege, update, recovery, or security implications when relevant.
- Avoid unrelated refactoring in feature and bug-fix pull requests.
- Update documentation when behavior changes.
- Preserve the established Purple Dragon visual language and navigation patterns.
- Prefer root-cause fixes over temporary patches.
- Keep status information tied to real application or Roblox state rather than decorative or fabricated values.

## Architecture and security boundaries

DragonStrap intentionally keeps privileged process and filesystem work in the Electron main process. The renderer is sandboxed with context isolation enabled and Node integration disabled.

Contributions must preserve these boundaries:

- Keep privileged filesystem, process, install, update, and recovery operations out of the renderer.
- Expose renderer functionality through constrained preload APIs.
- Do not accept arbitrary executable paths, shell commands, or unrestricted configuration paths from the renderer.
- Do not weaken coordinated destructive-operation locking.
- Preserve staged validation before Roblox package installation is committed.
- Preserve SHA-256 verification for self-updates and release artifacts.
- Keep recovery operations restricted to allowlisted locations and transactional restore behavior.
- Do not enable execution of untrusted third-party plugin code without a separately reviewed security design.

Never commit passwords, API keys, access tokens, signing keys, private certificates, or sensitive diagnostic data.

## Bug reports

When opening a bug report, include:

- DragonStrap version
- Windows version and architecture
- Roblox channel/build information when relevant
- clear reproduction steps
- expected behavior
- observed behavior
- sanitized logs or screenshots when useful

Do not include account credentials, authentication cookies, tokens, private keys, or other secrets.

## Pull requests

Before submitting a pull request:

- base the branch on the current default branch;
- verify DragonStrap starts when your change affects runtime behavior;
- run the relevant checks listed above;
- review the diff for accidental files, credentials, build output, or unrelated edits;
- explain any changes to bootstrap, update, recovery, FastFlag, server-intelligence, or preload behavior;
- keep release-related changes especially narrow and well tested.

Maintainers may request revisions, additional testing, or a narrower scope before merging.

## Release-related changes

Changes to the bootstrap pipeline, update system, hashes, installer, portable package, release verification, rollback, or recovery paths require extra review because failures can affect installation integrity.

Do not weaken release-verification or recovery safeguards for convenience.

## Project documentation

For architecture and API details, see:

- `docs/ARCHITECTURE.md`
- `docs/CORE-API-v2.md`
- `THIRD_PARTY_NOTICES.md`
