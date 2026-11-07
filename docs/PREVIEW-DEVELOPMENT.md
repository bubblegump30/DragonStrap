# DragonStrap v2.5.0 preview development status

Updated 7 November 2026. Latest locally tested preview: **2.5.0-preview.4**.

## Publication status

The latest GitHub Windows release and application source on main remain **v2.4.1**. This document reports local development and verification; it does not make the preview source or Windows packages available on GitHub. Local preview builds have been supplied separately for testing. Existing release downloads remain at [v2.4.1](https://github.com/bubblegump30/DragonStrap/releases/tag/v2.4.1).

## Account & Session Center

The local preview includes saved Roblox accounts, an isolated official Roblox login window, optional encrypted session-cookie import, aliases, tags, favorites, saved games and server targets, session controls, monitoring, schedules, a managed-session stop timer, local statistics and achievements, and appearance settings. Credentials stay out of metadata exports and diagnostics; passwords are not stored.

Opt-in process controls cover priority, CPU efficiency/affinity, memory priority and soft working-set targets. Cleanup is restricted to allowlisted Roblox locations. Windows GDI tuning has an explicit administrator action and backup/restore; page-file settings are diagnostic-only. Roblox decides whether concurrent clients remain open. No client patching or singleton-handle bypass is included. Anti-AFK acts only on an idle foreground managed window; games may ignore synthetic input.

## Game launch correction

Preview.3 replaced direct account Player launches with the registered Windows roblox-player protocol handler. Session tracking recognizes the registered launcher's Player installation and checks process identity. Fresh game-load events must match both the requested place and saved account before a join is confirmed.

One normal saved-account game join was verified live on the test PC. A running Player process alone is not treated as proof of a game join. Private servers, specific-server joins, concurrent accounts and crash recovery still require live acceptance.

## Startup

An extract-once Folder Portable build avoids the single-file Portable wrapper's repeated extraction. In a local two-run runtime-entry benchmark, Folder launches took 48–128 ms and single-file launches took 16.7–18.0 seconds. These measurements exclude GUI loading and Roblox joining and are not general startup guarantees.

The preview also defers monitoring and secondary panel data until after the window paints. Folder builds require complete-folder replacement for updates; executable self-replacement is disabled for that distribution.

## Monitoring in preview.4

| Reading | Provider | Verified result |
| --- | --- | --- |
| GPU temperature | NVIDIA driver / nvidia-smi | RTX 3060 returned 74.59°C during local verification |
| Measured Roblox FPS | PresentMon 2.6.0, three-second ETW presentation sample | Provider integrated; current Windows token returned access denied, so live FPS remains unverified |
| CPU temperature | LibreHardwareMonitor or OpenHardwareMonitor CPU sensors exposed over WMI | Neither provider detected; live CPU temperature remains unverified |

The combined hardcoded Unavailable field is replaced by separate readings and actionable provider statuses. FPS capture requires suitable Windows ETW permissions, such as administrator access or Performance Log Users membership. CPU readings need a running supported WMI sensor provider. Missing readings are never replaced with fabricated zeros or the configured FPS target.

Sampling is asynchronous, coalesced and active only while Monitoring is visible. No hardware driver is installed and no privilege elevation occurs automatically.

## Verification and remaining acceptance

- 212 local automated tests passed.
- Source and release checks passed.
- Windows layout checks passed across five main layouts and account-center panes/dialogs at four window/scale combinations.
- Packaged telemetry service, UI, IPC handler and PresentMon provider matched the final source files.
- Native policy and process controls were tested with a disposable fixture process; that is not proof of their behavior in every Roblox game.
- Live FPS, CPU sensors, concurrency, private/specific-server joins, anti-AFK behavior, restart recovery and administrator tuning remain acceptance items.
- These local results do not replace hosted CI for the unpublished preview implementation.

DragonStrap preview builds remain unsigned. No VirusTotal scan was performed for the new preview executables. Reports for older files apply only to those exact hashes.
