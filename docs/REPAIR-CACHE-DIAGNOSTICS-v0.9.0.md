# DragonStrap v0.9.0 — Repair, Cache & Diagnostics

## Scope

The Maintenance Center verifies the detected Roblox Player/Studio executables, validates Player `ClientAppSettings.json`, inventories known temporary/cache locations, manages old Roblox logs, and exports a diagnostic JSON report.

## Safety boundaries

Cache cleanup is restricted to the following known temporary directories:

- DragonStrap `Cache`
- DragonStrap `Code Cache`
- DragonStrap `GPUCache`
- `%TEMP%\Roblox`
- `%LOCALAPPDATA%\Roblox\Downloads`

It does not remove Roblox versions, LocalStorage, cookies, projects, FastFlag values, or arbitrary user-selected paths. Symlinks are not traversed.

Client-settings repair only runs when JSON is malformed. DragonStrap preserves the malformed file first, then restores a valid `.dragonstrap.bak` when one exists, otherwise it creates an empty JSON object so Roblox can fall back to defaults.

Diagnostic exports contain metadata and paths, not cookies, FastFlag values, project contents, or file contents.
