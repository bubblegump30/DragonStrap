# DragonStrap v1.1.1 — Roblox Package Manifest Compatibility Hotfix

This hotfix updates the v1.1.0 Roblox Installation & Update Engine for the current Roblox Player package manifest.

## Fixed

- Recognizes the exact manifest entry `RobloxPlayerInstaller.exe`.
- Validates that entry's signature and size metadata, then intentionally excludes it from DragonStrap downloads/extraction.
- DragonStrap never executes `RobloxPlayerInstaller.exe`.
- Arbitrary executable package names remain rejected.
- ZIP package allowlisting, traversal protection, MD5 verification, staging, rollback, disk-space checks, cancellation, and resume behavior remain unchanged.

## Validation

The automated suite includes a regression case matching the live-manifest failure reported during v1.1.0 testing.
