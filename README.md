# DragonStrap

**v1.0.0 — Stable Release**

DragonStrap is a Windows Roblox bootstrapper and launcher with a custom Purple Dragon UI/UX. v1.0.0 marks the first stable release of the current feature set.

## Included in v1.0.0

- Purple Dragon desktop UI/UX
- Roblox Player and Studio detection
- Roblox Launch Center with Place ID / server-instance launch support
- Performance+ with reviewed Player configuration controls
- FastFlag Manager 2.0 with backup, import/export, presets, and queued changes
- Server Intelligence with optional RoValra enrichment and Roblox-only fallback
- Roblox Studio Center with validated local project launching
- Channel & Version Manager for Player and Studio deployment metadata
- Repair, Cache & Diagnostics Center
- Single-instance protection and structured reliability logging
- GitHub Releases update checking for the official repository
- Windows portable/installer release build tooling
- Persistent settings, launch history, Studio history, and FastFlag presets

## Stable-scope boundaries

DragonStrap v1.0.0 does **not** directly download or replace Roblox deployment packages when changing channels. The Channel & Version Manager validates and tracks public channels and compares installed/available builds; package installation will be implemented only with a dedicated installer/update engine.

Performance+ and FastFlag Manager are intentionally scoped to Roblox Player. DragonStrap does not write Roblox Studio FastFlags in v1.0.0.

## Run from source

Requirements: Windows 10/11, Node.js, and npm.

```powershell
npm install
```

For normal use, launch `scripts\Start-DragonStrap.vbs` or `scripts\Start-DragonStrap.bat`. Both avoid leaving an attached command window open. `npm start` is the development/debugging path and stays attached to its terminal.

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

The release script validates the source, runs the full test suite, builds x64 Portable and NSIS artifacts, and generates SHA-256 hashes. If no Windows code-signing identity is configured, electron-builder will produce unsigned artifacts and the build script will state that explicitly.

## Official releases

Official DragonStrap releases are published through this repository's GitHub Releases page. Verify downloaded artifacts against the accompanying `SHA256SUMS.txt` when provided. See `docs/RELEASE-POLICY.md`.

## Version

`1.0.0`

## Official repository

https://github.com/bubblegump30/DragonStrap

## Third-party notices

See `THIRD_PARTY_NOTICES.md`.
