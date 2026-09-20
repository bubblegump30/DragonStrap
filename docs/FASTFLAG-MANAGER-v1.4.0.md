# FastFlag Manager 3.0 — v1.4.0

FastFlag Manager 3.0 expands DragonStrap's Roblox Player `ClientAppSettings.json` editor with metadata, comparison, sharing, snapshots, and conflict analysis while preserving the existing Performance+ ownership boundary.

## Flag intelligence

- Flags are grouped into inferred categories such as Rendering, Performance, Network, Physics, UI, Audio, Input, Telemetry, Experimental, and Other.
- The four Performance+ managed flags have explicit DragonStrap descriptions.
- Unknown Roblox flags receive conservative generated descriptions. DragonStrap does not claim an inferred category is an authoritative Roblox specification.
- Experimental/debug-looking keys receive a compatibility warning because Roblox can change or remove them without notice.

## Performance+ conflict detection

Performance+ continues to exclusively own:

- `DFIntTaskSchedulerTargetFps`
- `FIntDebugForceMSAASamples`
- `FFlagDebugGraphicsPreferD3D11`
- `FFlagDebugGraphicsPreferVulkan`

FastFlag Manager cannot edit or remove those exact keys. In addition, v1.4.0 detects editable flags that appear to operate in the same FPS, MSAA, or renderer families. When the corresponding Performance+ family is active, DragonStrap raises a conflict warning before manual changes are written.

## Before / after preview

Pending edits are normalized by the main-process FastFlag service before the Apply button is enabled. The preview shows the current value and resulting value for every add, set, or remove operation. Invalid patches remain blocked.

## Bulk operations

The browser supports filtered multi-selection. Editable selected flags can be:

- Set to `True` in bulk when they are Boolean flags.
- Set to `False` in bulk when they are Boolean flags.
- Queued for removal in bulk.

Protected Performance+ flags cannot be selected for bulk modification.

## Preset sharing

Local presets can be exported as the versioned schema:

`dragonstrap.fastflag-preset.v1`

Shared preset imports are validated through the same FastFlag validation pipeline as normal imports. Invalid entries reject the shared preset, while Performance+ owned keys are excluded from imported editable presets.

## Automatic snapshots

Before a successful manual FastFlag apply, backup restore, or automatic-snapshot restore, DragonStrap saves the current complete ClientAppSettings object under its private user-data directory. Up to 20 recent snapshots are retained.

Restoring an automatic snapshot restores its editable flags but preserves the currently active Performance+ owned values. This prevents a FastFlag rollback from silently changing the user's current Performance+ configuration.
