# DragonStrap

**v2.7.0 — Compact Accounts, SYSTEM meters and Mods · Windows stable release**

DragonStrap is a Windows Roblox bootstrapper and launcher with a custom Purple Dragon UI/UX. v2.4.1 adds Disable all flags, including locked Performance Center overrides, and Restore disabled flags. Disabling also turns off pre-launch auto-apply. Windows Setup and Portable x64 packages are available on GitHub Releases.

## Account & Session Center

The Accounts sidebar entry opens saved accounts, per-account games and servers, session controls, monitoring, schedules, local session statistics, appearance presets and Windows optimization settings. Roblox sign-in uses an isolated official login window. Optional cookie import verifies the account and stores the session using asynchronous Windows-backed encryption; passwords are not stored.

See [the feature and acceptance matrix](docs/ACCOUNT-SESSION-CENTER-v2.5.0.md) and [preview verification report](docs/PREVIEW-DEVELOPMENT.md). Normal saved-account game launching and live CPU/GPU/FPS readings were verified on the test PC, and the user accepted preview.6 as the baseline for stable v2.5.0. Private/specific-server joins, concurrency, anti-AFK, restart recovery and administrator tuning remain acceptance items. FPS targets remain legacy overrides; measured FPS is separate.

## Account groups and bulk workflows

Create or rename a group, then select accounts and use **Move accounts to group**. Each account belongs to one optional group; removing a group keeps its accounts and encrypted credentials. Older account files load as ungrouped without an automatic rewrite.

Selection survives search/group filtering and refresh. The selected count includes hidden rows. Bulk actions refresh account details, mark accounts favorite, assign groups, launch each account’s favorite game, or stop selected managed sessions. Launch and stop actions have a review screen with account-specific targets. Changed favorites or replacement sessions are rejected instead of silently using a new target. **Cancel remaining** leaves the current request to finish and skips later accounts. Multiple launch attempts require the existing concurrent-launch preference; Roblox still decides which clients remain open.

**Sessions** shows active managed clients. **History** retains the newest 1,000 completed/detached sessions, with account/game search, account/outcome filters, local timestamps, tracked duration and join-confirmation context. Pages contain 50 entries. Closing the manager is labeled as detaching, and an exit is not automatically called a crash.

See [the v2.6 workflow guide](docs/ACCOUNT-WORKFLOWS-v2.6.0.md) for details.

## Monitoring requirements

The integrated CPU reader uses the bundled LibreHardwareMonitor library and an existing PawnIO driver. On the verified Ryzen PC, run DragonStrap as administrator for CPU sensor and PresentMon FPS access. No sensor driver is installed automatically. NVIDIA GPU temperature uses the driver sensor. Unsupported or inaccessible sensors show an explicit status. Sidebar CPU/RAM readings refresh while DragonStrap is visible. CPU/GPU temperature probes are shared with Monitoring; FPS capture starts only when Monitoring is open.

For fastest portable startup, extract the complete Fast Folder ZIP and run DragonStrap.exe. Keep all files together. Folder updates replace the complete extracted folder and retain the normal user-data directory. Stable update preferences remain the default; v2.7.0 is available on that channel.

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

## Compact account layout and SYSTEM panel

DragonStrap now uses a flatter dark layout with purple accents, a compact header, dense account rows, avatar/game thumbnails, policy shortcuts, a stop timer and scrollable sidebar navigation. Sessions and Appearance are directly accessible in the sidebar; Account tools retains the remaining manager sections. Home remains removed.

The sidebar SYSTEM panel displays system-wide CPU usage, physical RAM use and CPU/GPU temperatures from the existing hardware providers. CPU/RAM refresh about every two seconds; temperature sampling runs about every fifteen seconds, shares cached probes with Monitoring and does not start PresentMon/FPS capture. Unavailable readings show a dash with an explanatory tooltip. Network status reflects Windows connectivity, not a measured internet latency. Stop all managed only controls sessions owned by DragonStrap, with confirmation.

The v2.7.0 layout preserves account workflows and includes the experimental Mods feature and Statistics cleanup. The historical v2.6.1 scan reports apply only to their exact old files.

## Accounts landing page

The redundant Home section is removed. Accounts is the default opening workspace, including for a saved Home preference from older versions. Installation detection remains available through Instances and header refresh; version information remains in Settings/About. Launch, performance, installation and configuration controls stay in their dedicated sidebar workspaces. Mods and the Statistics cleanup are preserved. These changes ship in v2.7.0.

## Experimental Mods

v2.7.0 includes an experimental Mods workspace for manually reviewed Player asset replacements. Import a sound, texture or font into the local library, enter its existing relative `content/...` target, preview the exact destination, then back up and apply with Player closed. Restore puts the saved original bytes back. One asset can be active at a time; up to 16 library entries, 8 MB per file and 16 MB total. No bundled assets, downloads, script execution or automatic reapplication are included.

See [the Mods preview guide](docs/MODS-PREVIEW.md) for supported paths, backup/conflict behavior and verification limits. Mods is a manual preview: fixture verification does not establish in-game compatibility. The v2.6.1 VirusTotal reports do not cover v2.7.0 binaries.

## Safety model

DragonStrap keeps privileged process/filesystem work in the main process. The renderer remains sandboxed with `contextIsolation` enabled and `nodeIntegration` disabled. Renderer calls are restricted to typed preload methods; arbitrary executable paths, shell commands, configuration paths, and third-party plugin code are not accepted.

Installation/update/recovery operations use one coordinated destructive-operation lock. Roblox package installation remains staged and validated before commit, self-updates remain SHA-256 verified, and recovery continues to use allowlisted locations and transactional restore behavior.

## Download status

| Item | Version | Where |
| --- | --- | --- |
| Latest stable Windows release | v2.7.0 | [Setup, Portable, Fast Folder and checksums](https://github.com/bubblegump30/DragonStrap/releases/tag/v2.7.0) |
| Previous accepted prerelease | v2.5.0-preview.6 | [Preview archive](https://github.com/bubblegump30/DragonStrap/releases/tag/v2.5.0-preview.6) |
| Current repository source | v2.7.0 | GitHub main; optional features retain documented limitations |

Download the desired package from the v2.7.0 release and compare its SHA-256 hash with `SHA256SUMS.txt`.

**v2.7.0 scan status:** No VirusTotal report has been verified for these new executables or archives. The historical reports below cover v2.6.1 only. Releases remain unsigned.

### Historical VirusTotal reports for v2.6.1

Reports retrieved directly through VirusTotal via VTAI on **2026-11-08**. Each link identifies the exact published file by SHA-256.

| Package | Malicious / suspicious | Undetected | Other engine results | Report |
| --- | --- | --- | --- | --- |
| Setup executable | **0 / 0** | 67 | 2 timed out; 6 unsupported | [View report](https://www.virustotal.com/gui/file/b319408ef5d0dc075e52875f4aa4f5a721f72d0e58c958a7fe48f750c518f04d/detection) |
| Portable executable | **0 / 0** | 64 | 5 timed out; 6 unsupported | [View report](https://www.virustotal.com/gui/file/1e798ea8fb42785da0aee476df650f9b1175c3c60b5a2506d9033b9cbc3fdcab/detection) |
| Fast Folder ZIP | **0 / 0** | 64 | 2 timed out; 2 failed; 7 unsupported | [View report](https://www.virustotal.com/gui/file/5e763200be63ebd0a7f19f64df34b400243a6b800bbc7f7777659848aed5f5b5/detection) |

Each report contains 75 engine entries overall. Timed-out, failed and unsupported entries did not provide a detection verdict. Zero detections do not guarantee safety. These reports apply only to the linked v2.6.1 files; they do not cover future builds or the source archive. Full hashes and analysis timestamps: [v2.6.1 scan evidence](docs/VIRUSTOTAL-v2.6.1.md).

Windows packages remain unsigned, so Windows may display a SmartScreen warning. Source ZIPs and repository code are for development; they are not Windows installers or Update Center binaries.

## What changed since v2.0.4

| Version | Milestone | Improvements |
| --- | --- | --- |
| **v2.7.0** | Compact Accounts, SYSTEM and Mods | Account-first flat layout with purple accents, sidebar meters, local media replacement/restore preview and Anti-AFK timing/input fixes. |
| **v2.6.1** | Workspace shortcuts | Compact icon rows, clear labels/descriptions, subtle hover and keyboard focus states; prevents stretched Settings shortcut buttons. |
| **v2.6.0** | Account workflows | Local groups, multi-select actions with reviewed targets and per-account results, cancellable remaining work, and searchable paginated session history. |
| **v2.5.1** | Session reliability | Cancel pending launches on closing/Stop all, retry failed Windows policies, release completed-session join tracking and preserve unfinished forms during refresh. |
| **v2.5.0** | Account & Session Center | Accepted saved-account launch and CPU/GPU/FPS telemetry, Fast Folder distribution, startup improvements and reliability fixes; see release notes for optional-feature limits. |
| **v2.4.1** | Disable all Player FastFlags | Removes every Player override, including locked keys, saves a restorable copy, and switches off pre-launch auto-apply. Restore brings back the complete set; restart Roblox for changes to take effect. |
| **v2.4.0** | **Everyday QoL** | Clearer Player and optional Studio detection, last successful scan time, selected launch preset and automatic Performance setting context, and a persistent pending FastFlag review action with a sidebar count. |
| **v2.3.0–v2.3.3** | Profiles and layout refinement | Clearer session presets versus saved configurations, fresh previews before applying profiles, apply progress and retry feedback, balanced FastFlags and Settings layouts, and one-click Windows UI verification through **Verify-UI.cmd**. |
| **v2.2.0** | Launch Center refinement | Validated experience and server target previews, clearer Player readiness, and Join availability based on a valid target and detected Player. |
| **v2.1.0** | First-run experience | A four-step welcome guide using real installation and channel detection, shortcuts to Launch and Recovery, and a Settings option to reopen the guide. |
| **v2.0.10–v2.0.12** | Verification, backups, and project links | Electron layout checks across window sizes and display scaling, reliable Studio backup ordering and metadata writes, protected restore destinations, and the [Purple Dragon Foundation website](https://www.purpledragonfoundationltd.xyz/) in About and the product menu. |
| **v2.0.5–v2.0.9** | UI, dashboard, and Settings polish | More consistent spacing and responsive layouts, clearer scan states and tooltips, scoped Settings resets with save feedback, a compact status bar, and fixes for clipped Installation Status content and the Help/About dropdown. |

**Stable release history:** [v2.4.1 Windows Setup and Portable x64 packages](https://github.com/bubblegump30/DragonStrap/releases/tag/v2.4.1) are published with SHA-256 checksums. GitHub workflows use actions that run on Node.js 24, and unsigned Windows builds display an informational message. Releases remain unsigned. Current v2.6.1 VirusTotal reports are linked in Download status above.

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

`2.7.0`

## Project links

- [Official repository](https://github.com/bubblegump30/DragonStrap)
- [Purple Dragon Foundation](https://www.purpledragonfoundationltd.xyz/)

## Architecture and notices

See `docs/ARCHITECTURE.md`, `docs/CORE-API-v2.md`, and `THIRD_PARTY_NOTICES.md`.

Account launches honor the global Performance auto-apply switch. Disable all Player flags continues to keep launch-time FPS/MSAA overrides off.

## Faster portable startup

The Folder Portable build is an extract-once ZIP. Extract the entire folder and run DragonStrap.exe directly; it avoids the single-file Portable's per-launch runtime extraction. Keep the runtime files together. Folder Portable updates use a new complete ZIP folder; your normal DragonStrap user-data folder is retained.

Preview.3 launches saved games through the Windows registered roblox-player handler and tracks Player executables in that handler's managed installation. Fresh completed join events must match both the requested Place ID and saved account before the UI reports a confirmed join. A live verification joined the requested saved game through the registered handler.
