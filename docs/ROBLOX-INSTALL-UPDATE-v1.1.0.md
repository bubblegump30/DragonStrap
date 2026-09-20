# Roblox Installation & Update Engine — v1.1.0

DragonStrap v1.1.0 introduces the first real Roblox Player installation/update engine.

## Transaction model

1. Resolve `WindowsPlayer` deployment metadata for the selected channel.
2. Retrieve and validate the Roblox `rbxPkgManifest.txt` manifest.
3. Refuse any package whose extraction destination is not explicitly known.
4. Preflight disk space before changing an installed version.
5. Download packages into the DragonStrap Roblox download cache.
6. Resume `.part` downloads with HTTP `Range` when possible.
7. Validate exact packed size and MD5 manifest signature.
8. Extract verified packages into `.dragonstrap-staging/<version-guid>`.
9. Reject unsafe archive entry paths before extraction.
10. Write `AppSettings.xml` and verify `RobloxPlayerBeta.exe`.
11. Atomically move the staged directory into the Roblox Versions directory.

The prior working version directory is not deleted by the normal new-version transaction. If the same version GUID must replace an existing directory, that directory is moved into `Roblox/DragonStrapBackups` before commit.

## Resume behavior

Partial downloads are stored as `.part` files. Canceling or a network failure removes the staging directory but intentionally leaves package cache/partial files so a later attempt can resume or reuse verified content.

## Extraction boundary

The renderer cannot supply package names, archive paths, destinations, mirrors, or version-folder paths. These values are resolved and validated in the Electron main process. Unknown package names fail closed rather than being extracted to a guessed directory.

## Scope

- Player installation/update: implemented.
- Studio installation/update: not implemented in v1.1.0.
- WebView2 runtime installer execution: intentionally not automated.
- DragonStrap self-update installation: separate subsystem and still manual in v1.1.0.
