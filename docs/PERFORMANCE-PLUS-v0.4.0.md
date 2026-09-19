# DragonStrap v0.4.0 — Performance+

Performance+ manages a deliberately small allowlist of Roblox Player ClientSettings:

- `DFIntTaskSchedulerTargetFps`
- `FIntDebugForceMSAASamples`
- `FFlagDebugGraphicsPreferD3D11`
- `FFlagDebugGraphicsPreferVulkan`

DragonStrap preserves unrelated entries in `ClientAppSettings.json`, writes atomically, and its restore operation removes only these managed keys. Studio configuration is not modified by this release.
