# DragonStrap v0.9.5 — Reliability / Updater / Release Polish

## Reliability
- Single-instance lock: a second launch focuses the existing window.
- Structured local reliability log under the DragonStrap user-data logs directory.
- Clean/unclean previous-session detection.
- Renderer crash, unresponsive, load-failure and process-error logging.
- Navigation and permission hardening remain enabled.

## Update checks
DragonStrap uses the GitHub Releases API from the main process only. The official release feed is configured as `bubblegump30/DragonStrap`. The UI checks GitHub Releases from the main process only. No update binary is executed automatically.

## Release build
Run `scripts\Build-Windows-Release.ps1` on Windows. The script runs source validation, tests, release verification, generates a source integrity manifest, builds x64 portable/NSIS artifacts with electron-builder, and writes SHA-256 hashes.

## Security posture
The updater is check-only in v0.9.5. It opens the verified GitHub release page through the main process. Automatic download/install is intentionally deferred until official release signing and checksum policy are finalized.
