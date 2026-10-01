# DragonStrap v2.4.0 — Everyday QoL

This Windows release makes the daily launch and FastFlags workflow clearer.

## What changed

- Home reports whether Roblox Player and optional Studio were detected and shows the last successful scan time when a later check fails.
- Play displays the selected session preset and automatic Performance setting state.
- FastFlags shows a pending count in the sidebar and a sticky shortcut to review queued changes. Applying changes still requires a validated before/after preview.
- The Windows layout check covers the pending bar at several window sizes and scaling levels.

## Downloads

- **Setup (x64):** `DragonStrap-Setup-2.4.0-x64.exe`
- **Portable (x64):** `DragonStrap-Portable-2.4.0-x64.exe`
- **Integrity:** Compare each downloaded file with `SHA256SUMS.txt` in this release.
- **Setup VirusTotal report:** [View the report](https://www.virustotal.com/gui/file/3f016485826eb77591e8a616b27dbaa5706f4f59f2d25e4e84e546299e373930?nocache=1) for SHA-256 `3f016485826eb77591e8a616b27dbaa5706f4f59f2d25e4e84e546299e373930`. This report covers Setup only; Portable has a separate hash.

These packages are unsigned, so Windows may display a SmartScreen warning. This release was built and checked on a Windows GitHub Actions runner; automated layout and packaging checks do not replace a manual launch check on a desktop with Roblox installed.

Existing local settings are retained. See [CHANGELOG.md](https://github.com/bubblegump30/DragonStrap/blob/main/CHANGELOG.md) for the full version history.
