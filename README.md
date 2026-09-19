# DragonStrap

**v0.9.5 — Reliability / Updater / Release Polish**

DragonStrap is a Windows Roblox bootstrapper with the Purple Dragon UI/UX.

## Current features

- Purple Dragon desktop UI/UX
- Roblox Player and Studio detection
- Roblox Launch Center
- Performance+
- FastFlag Manager 2.0
- Server Intelligence with optional RoValra enrichment
- Roblox Studio Center
- Channel & Version Manager
- Repair, Cache & Diagnostics
- Single-instance protection and local reliability logging
- Configurable GitHub release update checks
- Windows release verification/build scripts
- Persistent DragonStrap settings and launch history

## Run from source

Requirements: Windows 10/11, Node.js, and npm.

```powershell
npm install
```

For normal use, launch `scripts\Start-DragonStrap.vbs` or `scripts\Start-DragonStrap.bat`. Both avoid leaving an attached command window open. `npm start` remains the development/debugging path and stays attached to its terminal.

## Validation

```powershell
npm run check
npm test
npm run release:verify
```

## Windows release build

```powershell
.\scripts\Build-Windows-Release.ps1
```

The release script builds x64 Portable and NSIS artifacts and writes SHA-256 hashes. The GitHub update checker is configured for `bubblegump30/DragonStrap` and checks official GitHub Releases from the main process.

## Version

`0.9.5`

## Official repository

`https://github.com/bubblegump30/DragonStrap`
