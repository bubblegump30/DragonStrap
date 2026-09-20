# DragonStrap v1.9.0 — Reliability & Recovery 2.0

Reliability & Recovery 2.0 adds bounded recovery workflows around DragonStrap's existing Roblox installer, self-updater, configuration system, and diagnostics.

## Player integrity and rollback

DragonStrap checks the detected Player version directory, `RobloxPlayerBeta.exe` Windows PE header/size, `AppSettings.xml`, the core content directory, and Player `ClientAppSettings.json`. Critical binary/configuration failures are separated from non-critical structural warnings.

Rollback never accepts a renderer-supplied path. It can use only rollback candidates derived from DragonStrap's own `roblox-install-state.json`: either the previous recorded `version-*` directory or a pre-replacement backup under `Roblox/DragonStrapBackups`. The current damaged version is quarantined before switching back when applicable.

## Configuration restore points

Restore points live under DragonStrap user data and can include only these allowlisted configuration domains when present:

- `settings.json`
- `performance-profiles.json`
- `configuration-profiles.json`
- `fastflag-presets.json`
- `studio-center-settings.json`
- the currently detected Player `ClientAppSettings.json`
- the currently detected isolated Studio `ClientAppSettings.json`

Each payload is SHA-256 recorded in the restore-point manifest. Before a restore is applied, all applicable payloads are revalidated and DragonStrap creates an automatic safety restore point. Writes are atomic and failed multi-file restores roll back already-written files on a best-effort transactional basis.

Project files, credentials, logs, launch/server history, updater state, and arbitrary file paths are not part of a restore point.

## Update recovery

The self-update recovery scanner detects malformed update state, missing or changed staged artifacts, interrupted `.part` files, and stale portable apply helpers. Repair removes interrupted leftovers and preserves a staged update only when its stored SHA-256/size still match.

## Safe Repair

Safe Repair refuses to run while Roblox installation or self-update download activity is in progress. It creates a restore point first, then may:

1. repair malformed Player ClientSettings using existing backup-safe behavior;
2. remove abandoned DragonStrap Roblox staging directories;
3. repair interrupted DragonStrap self-update state;
4. roll back Player only when structural corruption is detected and a trusted rollback candidate exists.

If Player corruption exists without a rollback candidate, Safe Repair reports that a reinstall through the Installation Engine is required rather than downloading or launching an untrusted replacement.

## Diagnostic Report 2.0

The JSON diagnostic export now adds integrity checks, rollback availability, restore-point count, installer staging state, update-recovery state, and reliability session metadata. It continues to exclude Roblox cookies, FastFlag values, project contents, and file contents.
