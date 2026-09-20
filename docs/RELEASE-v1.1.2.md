# DragonStrap v1.1.2 — Installer Current-State UI Polish Hotfix

v1.1.2 is a focused presentation/state-correctness hotfix for the Roblox Player Installation Engine.

## Changes

- When the selected Roblox Player build is already installed, the engine now reports **No download required**.
- The Roblox package payload size is still shown as analyzed metadata instead of being presented as work remaining.
- The installation progress display moves to a **CURRENT** completed state rather than remaining at `0%`.
- Free-space reporting states that no staging space is required for a current build.
- The engine's safety/status text distinguishes a current verified deployment from a plan that is ready to install.
- The v1.1.1 live-manifest compatibility behavior for `RobloxPlayerInstaller.exe` is preserved.

## Installer safety

No transactional installer protections were relaxed in this release. Package allowlisting, manifest validation, size/MD5 validation, staged extraction, path traversal blocking, rollback behavior, resumable downloads, and non-execution of Roblox installer payloads remain unchanged.

## Scope

This is a UI/state hotfix. It does not add Studio installation or DragonStrap automatic self-update installation.
