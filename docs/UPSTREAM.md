# Upstream Integration Notes

DragonStrap is an independent Electron/Node.js project. Fishstrap and Bloxstrap are used as public interoperability references for Roblox bootstrapper behavior; their source trees are not vendored into DragonStrap.

## v1.1.1 manifest compatibility hotfix

DragonStrap recognizes the exact Roblox manifest entry `RobloxPlayerInstaller.exe` as an installer/bootstrap executable and intentionally excludes it from the custom ZIP-package install pipeline. The executable is never launched or extracted by DragonStrap.

## v1.1.0 installation-engine reference work

For the Roblox Installation & Update Engine, DragonStrap independently implements the public Roblox deployment contract used by bootstrapper projects:

- `clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer`
- public custom-channel version metadata
- `rbxPkgManifest.txt` v0 package metadata
- package MD5 signatures and packed/unpacked sizes
- public Roblox setup CDN package resources
- known package extraction-directory behavior

Bloxstrap's public documentation and current package-directory definitions were consulted to validate interoperability assumptions. DragonStrap's service is implemented in JavaScript with its own staging, resume, cancellation, disk-space, validation, IPC, and transaction design.

If upstream source code is ever copied or adapted rather than merely referenced for public behavior, the applicable upstream license text and copyright notice must be included with that derived source.
