# DragonStrap

**v2.5.0 — Account & Session Center · Windows stable release**

DragonStrap is a Windows Roblox bootstrapper and launcher with a custom Purple Dragon UI/UX. v2.4.1 adds Disable all flags, including locked Performance Center overrides, and Restore disabled flags. Disabling also turns off pre-launch auto-apply. Windows Setup and Portable x64 packages are available on GitHub Releases.

## Account & Session Center (v2.5.0 development)

The Accounts sidebar entry opens saved accounts, per-account games and servers, session controls, monitoring, schedules, local levels/achievements, appearance presets and Windows optimization settings. Roblox sign-in uses an isolated official login window. Optional cookie import verifies the account and stores the session using asynchronous Windows-backed encryption; passwords are not stored.

See [the feature and acceptance matrix](docs/ACCOUNT-SESSION-CENTER-v2.5.0.md) and [preview verification report](docs/PREVIEW-DEVELOPMENT.md). Normal saved-account game launching and live CPU/GPU/FPS readings were verified on the test PC, and the user accepted preview.6 as the baseline for stable v2.5.0. Private/specific-server joins, concurrency, anti-AFK, restart recovery and administrator tuning remain acceptance items. FPS targets remain legacy overrides; measured FPS is separate.

## Monitoring requirements

The integrated CPU reader uses the bundled LibreHardwareMonitor library and an existing PawnIO driver. On the verified Ryzen PC, run DragonStrap as administrator for CPU sensor and PresentMon FPS access. No sensor driver is installed automatically. NVIDIA GPU temperature uses the driver sensor. Unsupported or inaccessible sensors show an explicit status. Sampling runs only while Monitoring is open.

For fastest portable startup, extract the complete Fast Folder ZIP and run DragonStrap.exe. Keep all files together. Folder updates replace the complete extracted folder and retain the normal user-data directory. Stable update preferences remain the default; v2.5.0 is available on that channel.

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
| Latest stable Windows release | v2.5.0 | [Setup, Portable, Fast Folder and checksums](https://github.com/bubblegump30/DragonStrap/releases/tag/v2.5.0) |
| Previous accepted prerelease | v2.5.0-preview.6 | [Preview archive](https://github.com/bubblegump30/DragonStrap/releases/tag/v2.5.0-preview.6) |
| Current repository source | v2.5.0 | GitHub main; optional features retain documented limitations |

Download the desired package from the v2.5.0 release and compare its SHA-256 hash with `SHA256SUMS.txt`.

The [VirusTotal report for the v2.4.0 Setup executable](https://www.virustotal.com/gui/file/3f016485826eb77591e8a616b27dbaa5706f4f59f2d25e4e84e546299e373930?nocache=1) corresponds to SHA-256 `3f016485826eb77591e8a616b27dbaa5706f4f59f2d25e4e84e546299e373930`. This report describes the previous v2.4.0 Setup file and does not cover v2.4.1, v2.5.0, or any v2.5.0 preview executable. Portable is a different file with a different hash. Source ZIPs and repository code are for development; they are not Windows installers or Update Center binaries. The Windows packages are unsigned, so Windows may display a SmartScreen warning.

## What changed since v2.0.4

| Version | Milestone | Improvements |
| --- | --- | --- |
| **v2.5.0** | Account & Session Center | Accepted saved-account launch and CPU/GPU/FPS telemetry, Fast Folder distribution, startup improvements and reliability fixes; see release notes for optional-feature limits. |
| **v2.4.1** | Disable all Player FastFlags | Removes every Player override, including locked keys, saves a restorable copy, and switches off pre-launch auto-apply. Restore brings back the complete set; restart Roblox for changes to take effect. |
| **v2.4.0** | **Everyday QoL** | Clearer Player and optional Studio detection, last successful scan time, selected launch preset and automatic Performance setting context, and a persistent pending FastFlag review action with a sidebar count. |
| **v2.3.0–v2.3.3** | Profiles and layout refinement | Clearer session presets versus saved configurations, fresh previews before applying profiles, apply progress and retry feedback, balanced FastFlags and Settings layouts, and one-click Windows UI verification through **Verify-UI.cmd**. |
| **v2.2.0** | Launch Center refinement | Validated experience and server target previews, clearer Player readiness, and Join availability based on a valid target and detected Player. |
| **v2.1.0** | First-run experience | A four-step welcome guide using real installation and channel detection, shortcuts to Launch and Recovery, and a Settings option to reopen the guide. |
| **v2.0.10–v2.0.12** | Verification, backups, and project links | Electron layout checks across window sizes and display scaling, reliable Studio backup ordering and metadata writes, protected restore destinations, and the [Purple Dragon Foundation website](https://www.purpledragonfoundationltd.xyz/) in About and the product menu. |
| **v2.0.5–v2.0.9** | UI, dashboard, and Settings polish | More consistent spacing and responsive layouts, clearer scan states and tooltips, scoped Settings resets with save feedback, a compact status bar, and fixes for clipped Installation Status content and the Help/About dropdown. |

**Stable release history:** [v2.4.1 Windows Setup and Portable x64 packages](https://github.com/bubblegump30/DragonStrap/releases/tag/v2.4.1) are published with SHA-256 checksums. GitHub workflows use actions that run on Node.js 24, and unsigned Windows builds display an informational message. Releases remain unsigned. The linked v2.4.0 VirusTotal report above applies to the previous installer.

See [CHANGELOG.md](CHANGELOG.md) and the versioned notes in [docs](docs) for the full history.

## User tutorial

Follow the [step-by-step guide](docs/USER-GUIDE.md) for installing, launching, configuring, updating, and recovering DragonStrap.

## Run from source

Requirements: Windows 10/11, Node.js, npm, and the Windows `tar.exe` utility used by the Roblox package engine.

```powershell
npm ci
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

`2.5.0`

## Project links

- [Official repository](https://github.com/bubblegump30/DragonStrap)
- [Purple Dragon Foundation](https://www.purpledragonfoundationltd.xyz/)

## Architecture and notices

See `docs/ARCHITECTURE.md`, `docs/CORE-API-v2.md`, and `THIRD_PARTY_NOTICES.md`.

Account launches honor the global Performance auto-apply switch. Disable all Player flags continues to keep launch-time FPS/MSAA overrides off.

## Faster portable startup

The Folder Portable build is an extract-once ZIP. Extract the entire folder and run DragonStrap.exe directly; it avoids the single-file Portable's per-launch runtime extraction. Keep the runtime files together. Folder Portable updates use a new complete ZIP folder; your normal DragonStrap user-data folder is retained.

Preview.3 launches saved games through the Windows registered roblox-player handler and tracks Player executables in that handler's managed installation. Fresh completed join events must match both the requested Place ID and saved account before the UI reports a confirmed join. A live verification joined the requested saved game through the registered handler.
