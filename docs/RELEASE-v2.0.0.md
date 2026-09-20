# DragonStrap v2.0.0 — DragonStrap 2.0

v2.0.0 is the architecture consolidation release for the complete v1.x feature set.

## Highlights

- Added `AppKernel` for centralized service construction and dependency wiring.
- Added sealed `ServiceRegistry` with explicit service capabilities and contract versions.
- Added shared `OperationCoordinator` to serialize destructive install/update/recovery workflows.
- Added `BootstrapPipeline` for Player install/rollback, self-update, and launch-readiness orchestration.
- Added short-lived Roblox installation-status caching to reduce duplicate filesystem scans.
- Added Core API v2 runtime metadata through the existing secure preload boundary.
- Added plugin-ready extension definitions for launch adapters, server enrichment, diagnostics contributors, and profile sections.
- External plugin code remains disabled in v2.0.0.
- Changed renderer startup to lazy-load heavy feature centers on navigation.
- Added DragonStrap 2.0 Core status UI in Settings.
- Added a final `dragon-2.css` UI consolidation layer with consistent focus handling and reduced inactive-view work.
- Diagnostic exports now include non-sensitive Core API/service/operation metadata.
- Preserved all v1.x configuration/profile/history formats and existing security boundaries.

## Security posture

DragonStrap 2.0 does not expose arbitrary service objects, executable paths, filesystem paths, or plugin execution to the renderer. Third-party plugin loading is not enabled.

## Release validation

Run:

```powershell
npm run check
npm test
npm run release:verify
```

Then build Windows artifacts with:

```powershell
.\scripts\Build-Windows-Release.ps1
```
