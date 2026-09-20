# Studio Center 2.0 — v1.7.0

DragonStrap v1.7.0 upgrades the creator workflow into a Studio-specific control center while keeping Player and Studio configuration boundaries separate.

## Studio settings and launch profiles

Studio settings are stored independently in `studio-center-settings.json`. The built-in launch profiles control project backup behavior only:

- **Standard** — follows the Auto Backup setting.
- **Protected** — always creates a project backup before launch.
- **Fast Start** — skips automatic backup for the quickest launch path.

Launch profiles do not inject arbitrary Studio command-line arguments.

## Recent-project intelligence

Recent `.rbxl` / `.rbxlx` entries track first/last open time, open count, last-known file size, modification time, the launch profile used, backup count, and whether the project changed since it was last opened through DragonStrap.

## Project backups

Backups are stored under DragonStrap user data in `studio-project-backups`. Retention is bounded per project. Restore always writes a new `.rbxl` / `.rbxlx` copy selected through a native Save dialog; it never overwrites the original project in place.

## Studio version/channel intelligence

Studio Center uses Roblox `WindowsStudio64` deployment metadata. The selected Studio channel is independent from the Player channel. v1.7.0 tracks and compares the selected Studio build but does not install or replace Studio packages.

## Optional isolated Studio FastFlags

Studio FastFlag management is disabled by default. When enabled, DragonStrap derives the Studio `ClientSettings/ClientAppSettings.json` path only from the detected Studio executable. Writes are refused if Player and Studio resolve to the same ClientSettings file. Studio FastFlags use their own first-write backup and snapshot directory and accept only bounded scalar values.
