# DragonStrap v1.5.2 — Safe FastFlag Classification Hotfix

## Scope

This hotfix adds a conservative safety classification layer to FastFlag Manager 3.0 without expanding the set of DragonStrap-owned write targets.

## Safe Core

DragonStrap Safe Core contains five current rendering-related presets:

- `FFlagHandleAltEnterFullscreenManually` → `False`
- `DFFlagDisableDPIScale` → `True`
- `FIntDebugForceMSAASamples` → `2` (Performance Center owned / locked in FastFlag Manager)
- `DFFlagTextureQualityOverrideEnabled` → `True`
- `DFIntTextureQualityOverride` → `2`

Safe Core means DragonStrap considers the key a conservative current bootstrapper preset. It is not an official Roblox guarantee; Roblox can alter or ignore client FastFlags between builds.

## Compatibility-sensitive legacy controls

The following DragonStrap Performance Center keys remain available for backward compatibility but are now explicitly labeled legacy/compatibility-sensitive:

- `DFIntTaskSchedulerTargetFps`
- `FFlagDebugGraphicsPreferD3D11`
- `FFlagDebugGraphicsPreferVulkan`

Current Roblox builds may ignore these overrides. DragonStrap recommends Roblox's own FPS controls when available and keeps the render-engine setting on Default unless the user is intentionally testing compatibility.

## Safety behavior

- Safe Core queueing only stages changes for Before / After review.
- Performance Center-owned MSAA remains locked from FastFlag Manager.
- Unknown flags remain editable but are clearly marked UNKNOWN.
- Experimental/debug-looking flags are marked EXPERIMENTAL/CAUTION.
- Roblox defaults are restored by removing DragonStrap override keys, not by inventing default values.
