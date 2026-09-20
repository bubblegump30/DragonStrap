# DragonStrap Architecture — v2.0.0

## Goals

DragonStrap 2.0 consolidates the bootstrapper around explicit service contracts while preserving the renderer/main-process security boundary established in v1.x.

1. Privileged filesystem, process, installation, update, and recovery work remains in the Electron main process.
2. Renderer code receives only typed preload operations and never arbitrary execution capability.
3. Service dependencies are constructed once by `AppKernel` and registered in a sealed `ServiceRegistry`.
4. Destructive bootstrap/update/recovery workflows share an exclusive `OperationCoordinator`.
5. Roblox Player state reads are cached briefly in the main process to avoid repeated directory scans during dense UI refreshes.
6. Feature centers lazy-load on navigation instead of all querying their backends during startup.
7. Future plugin integrations target versioned extension points rather than importing directly into existing services.

## Core graph

```text
Electron main.js
    |
    v
AppKernel
    |-- ServiceRegistry
    |-- OperationCoordinator
    |-- PluginHost (contracts only; external loading disabled)
    |-- RobloxStatusCache
    `-- BootstrapPipeline
            |-- RobloxUpdateEngine
            |-- SelfUpdateService
            |-- UpdateService
            `-- SettingsStore
```

The v1.x domain services remain focused components under `src/services/`. `src/core/` now owns composition, lifecycle contracts, operation coordination, extension metadata, and cross-domain bootstrap orchestration.

## Bootstrap/update pipeline

`BootstrapPipeline` is the common entry point for Player install planning, Player installation, rollback, DragonStrap update download/apply, and launch-readiness checks. It does not replace the lower-level services; it coordinates them.

Destructive operations acquire the shared operation lock. This prevents a Player installation, self-update, rollback, or configuration recovery from starting over another active destructive core operation.

Cancellation remains owned by the lower-level service so in-progress network/archive work can be aborted safely while the coordinator holds the operation lease until the task settles.

## Stable Core API

`preload.js` exposes `apiVersion = "2.0.0"` and a read-only `getCoreState()` operation. Existing v1.x preload methods remain available for compatibility. The Core API reports service contracts, pipeline state, exclusive-operation state, and extension-point metadata without exposing raw service objects to the renderer.

See `CORE-API-v2.md`.

## Plugin-ready boundary

`PluginHost` defines these v2 extension points:

- `launch.adapter`
- `server.enrichment`
- `diagnostics.contributor`
- `profile.section`

Only DragonStrap built-in manifests are registered in v2.0.0. External plugin discovery/loading is deliberately disabled until a future release defines signing, permission, isolation, version negotiation, and revocation policy.

## Renderer performance

The renderer startup path now loads shell/home state first. Performance, FastFlags, Studio, Channels, Recovery, Servers, and other center-specific data is requested when the user enters that center. This removes unnecessary filesystem/network/process queries from normal startup.

Inactive views use the final `dragon-2.css` consolidation layer to reduce layout/paint work while preserving the Purple Dragon visual system.

## Compatibility

v2.0.0 preserves the v1.x data files and service-specific schemas. No forced profile/FastFlag/server-history migration is required for this architecture release.
