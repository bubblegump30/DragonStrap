# DragonStrap

**v2.4.0 — Everyday QoL · Windows release**

DragonStrap is a Windows Roblox bootstrapper and launcher with a custom Purple Dragon UI/UX. v2.4.0 adds clearer installation status, launch preset context, and visible pending FastFlag changes. Windows Setup and Portable x64 packages are available on GitHub Releases.

## DragonStrap 2.0 architecture

- `AppKernel` owns service construction and dependency wiring instead of `main.js` creating services ad hoc.
- A sealed `ServiceRegistry` exposes explicit capabilities and contract versions for core services.
- `BootstrapPipeline` coordinates Roblox Player installation/rollback and DragonStrap self-update operations.
- `OperationCoordinator` prevents destructive install/update/recovery workflows from colliding.
- Core API version `2.0.0` is exposed through the preload boundary and Settings runtime panel.
- Plugin-ready extension points are defined for launch adapters, server enrichment, diagnostics, and profile sections.
- Third-party plugin code is **not executed in v2.0.0**; the extension boundary is ready without weakening the stable Electron security model.
- Roblox installation status reads use a short-lived main-process cache to reduce repeated filesystem scans.
- Heavy feature centers now lazy-load when opened instead of all loading during startup.

## Current centers

- Roblox Launch Center
- Roblox Installation & Update Engine
- Channel & Version Manager
- Update Center 2.0
- Performance Center 2.0
- FastFlag Manager 3.0
- Server Intelligence 2.0
- Studio Center 2.0
- Profiles & Configuration Center
- Reliability & Recovery 2.0

## Safety model

DragonStrap keeps privileged process/filesystem work in the main process. The renderer remains sandboxed with `contextIsolation` enabled and `nodeIntegration` disabled. Renderer calls are restricted to typed preload methods; arbitrary executable paths, shell commands, configuration paths, and third-party plugin code are not accepted.

Installation/update/recovery operations use one coordinated destructive-operation lock. Roblox package installation remains staged and validated before commit, self-updates remain SHA-256 verified, and recovery continues to use allowlisted locations and transactional restore behavior.

## Download status

| Item | Version | Where |
| --- | --- | --- |
| Latest published Windows installer and portable app | v2.4.0 | [Download Setup or Portable](https://github.com/bubblegump30/DragonStrap/releases/tag/v2.4.0) |
| Current repository source | v2.4.0 | [GitHub main](https://github.com/bubblegump30/DragonStrap) |

Download the Setup or Portable x64 executable from the v2.4.0 release and compare its SHA-256 hash with `SHA256SUMS.txt`.

The [VirusTotal report for the v2.4.0 Setup executable](https://www.virustotal.com/gui/file/3f016485826eb77591e8a616b27dbaa5706f4f59f2d25e4e84e546299e373930?nocache=1) corresponds to SHA-256 `3f016485826eb77591e8a616b27dbaa5706f4f59f2d25e4e84e546299e373930`. This report covers Setup only; Portable is a different file with a different hash. Source ZIPs and repository code are for development; they are not Windows installers or Update Center binaries. The Windows packages are unsigned, so Windows may display a SmartScreen warning.

## What changed since v2.0.4

- v2.0.5–v2.0.9: spacing, navigation, Settings, dashboard, and empty-state polish.
- v2.0.10–v2.0.12: layout verification, backup reliability, and a link to the [Purple Dragon Foundation website](https://www.purpledragonfoundationltd.xyz/).
- v2.1.0: first-run setup guide for installation, channels, launch, and recovery.
- v2.2.0: validated launch target preview and clearer launch readiness.
- v2.3.0–v2.3.3: safer profile preview/apply flow, UI layout repairs, and one-click Windows UI verification.
- v2.4.0: clearer Home readiness, selected launch preset context, and visible pending FastFlag reviews.

See [CHANGELOG.md](CHANGELOG.md) and the versioned notes in [docs](docs) for details.

## User tutorial

Follow the [step-by-step guide](docs/USER-GUIDE.md) for installing, launching, configuring, updating, and recovering DragonStrap.

## Run from source

Requirements: Windows 10/11, Node.js, npm, and the Windows `tar.exe` utility used by the Roblox package engine.

```powershell
npm install
npm start
```

Source/dev mode intentionally disables binary self-application. Build a packaged release to exercise Portable or Setup update paths.

## Validation

```powershell
npm run check
npm test
npm run release:verify
npm run ui:verify
```

To run the UI check on Windows, extract the ZIP, open the DragonStrap folder, and double-click **Verify-UI.cmd**. It installs dependencies if needed, runs the check, and keeps the result window open. You can also use PowerShell in the extracted project folder:

```powershell
npm install
npm run ui:verify
```

The check uses Electron at 1600 × 980 (100%, 125%, and 150%) and narrower windows. It does not require Roblox. A passing result means the automated layout checks passed; review the UI on your Windows desktop as well.

## Windows release build

```powershell
.\scripts\Build-Windows-Release.ps1
```

Official releases should upload both Windows executables and the generated `dist\SHA256SUMS.txt` file.

## Version

`2.4.0`

## Project links

- [Official repository](https://github.com/bubblegump30/DragonStrap)
- [Purple Dragon Foundation](https://www.purpledragonfoundationltd.xyz/)

## Architecture and notices

See `docs/ARCHITECTURE.md`, `docs/CORE-API-v2.md`, and `THIRD_PARTY_NOTICES.md`.
