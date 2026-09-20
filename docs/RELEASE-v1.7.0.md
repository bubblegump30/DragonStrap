# DragonStrap v1.7.0 — Studio Center 2.0

## Highlights

- Studio-specific settings stored independently from global Player settings.
- Standard, Protected, and Fast Start Studio launch profiles.
- Recent-project intelligence with open counts, file size/modification tracking, change detection, and backup coverage.
- Local bounded project backups with safe restore-as-copy workflow.
- Independent `WindowsStudio64` channel/version tracking.
- Optional isolated Studio FastFlag management with explicit enablement, path-isolation checks, backups, snapshots, and scalar validation.
- Existing Player Performance Center and FastFlag Manager remain unchanged and separate.

## Safety posture

DragonStrap never accepts an arbitrary Studio executable path from the renderer. Project paths enter through native dialogs or trusted history IDs. Backup restore does not overwrite originals. Studio FastFlags are disabled by default and are blocked when Studio and Player would share the same ClientSettings file.

## Validation

Run `npm run check`, `npm test`, and `npm run release:verify` before packaging the Windows release.
