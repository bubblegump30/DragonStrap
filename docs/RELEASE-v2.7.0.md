# DragonStrap v2.7.0 — Compact Accounts, SYSTEM meters and Mods

Accounts is now the default workspace. The redundant Home page is removed, and an older saved Home preference falls back to Accounts. The compact dark layout keeps DragonStrap branding and purple accents while bringing avatar/game thumbnails, aliases, tags, FPS targets, session-policy shortcuts, available RAM/CPU/Robux values and Launch into a dense account table. Groups and reviewed bulk actions remain expandable; Account tools retains the manager's other sections.

The sidebar adds SYSTEM meters for system-wide CPU, physical RAM use and CPU/GPU temperatures. CPU/RAM refresh about every two seconds; temperature probes are cached/shared with Monitoring and do not start FPS capture in the background. Unavailable readings show a dash and status tooltip. Network Online/Offline reflects Windows connectivity, not a latency test. Sessions and Appearance have direct shortcuts, and Stop all managed retains confirmation and affects only sessions controlled by DragonStrap.

Local levels and achievement cards are removed; session/time tracking remains.

## Experimental Mods

Import a local sound, texture/cursor image or font, review its exact existing Player target, then back up and apply with Player closed. One asset mod can be active at a time. Originals are saved before replacement; interrupted writes retain a recovery record, stale previews are rejected, and restore preserves third-party changes by reporting a conflict. Limits: 8 MB per file, 16 entries, 16 MB total. Linked paths, traversal, executable/script targets and shared Studio installations are rejected. Updates require a fresh preview and manual application.

No bundled third-party assets, archive import, remote mod store or automatic launch-time reapplication are included. Read the [Mods guide](https://github.com/bubblegump30/DragonStrap/blob/main/docs/MODS-PREVIEW.md). Fixture checks do not establish that a particular game accepts a local replacement.

## Anti-AFK fixes

Skipped or failed input attempts retry after 30 seconds instead of incorrectly resetting the entire configured cycle. A confirmed sent tap advances the cycle. The Windows helper checks idle time, foreground identity and held keys, rechecks activity/focus before the second tap, and uses a short held Space key with a release attempt in a finally block.

Anti-AFK remains opt-in per account, foreground-only and requires at least 60 seconds of Windows inactivity. DragonStrap never changes focus for it. Cycle interval is 5–18 minutes. Native branch tests use a fake input provider; no real keystrokes were sent during automated verification. Live in-game keep-alive acceptance is still required because games may ignore synthetic input.

## Verification and downloads

259 tests pass, including filesystem backup/restore and conflict cases, system sampling, trusted IPC, Anti-AFK scheduling and simulated native input. Actual isolated main/preload/renderer startup passes. Windows layout/workflow checks cover the shell, account dialogs, Mods and SYSTEM table at multiple sizes and 100/125/150% scaling. Normal saved-account launching retains the previously accepted launch implementation; private joins, concurrency, restart recovery and administrator tuning retain their documented acceptance limits.

Download Setup, Portable, Fast Folder or source with SHA256SUMS.txt. For Fast Folder, close DragonStrap, extract the entire archive into a new folder and run DragonStrap.exe; keep all files together. Existing settings/accounts remain in the normal user-data location. Versioned history, presets and Studio's separate configuration are preserved.

**Unsigned Windows builds. No VirusTotal report has been verified for the newly built v2.7.0 files.** The [v2.6.1 scan evidence](https://github.com/bubblegump30/DragonStrap/blob/main/docs/VIRUSTOTAL-v2.6.1.md) applies only to those exact historical hashes.
