# DragonStrap v0.8.0 — Channel & Version Manager

## Scope

DragonStrap now reads public Roblox deployment metadata for Windows Player (`WindowsPlayer`) and Studio (`WindowsStudio64`). LIVE is stored canonically as `production`. Public custom channel names can be previewed and selected after validation.

## Safety model

- Channel names are restricted to letters, numbers, hyphens, and underscores.
- 401/403 responses are treated as restricted channels.
- 404 responses are treated as unavailable channels.
- DragonStrap does not request or store Roblox authentication cookies for channel metadata.
- v0.8.0 does not install or replace Roblox packages. The selected channel is used for version tracking only until the installer/update engine is implemented.

## Version comparison

The manager compares the installed version GUID detected under `%LOCALAPPDATA%\Roblox\Versions` with the selected channel's `clientVersionUpload`. Custom channels are also compared against production semantic version metadata to flag channels that are behind LIVE.
