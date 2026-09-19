# DragonStrap Architecture — v0.7.0

## Design goals

1. Keep the NeoPurple interface independent from bootstrapper internals.
2. Keep privileged filesystem/process operations out of the renderer.
3. Make upstream bootstrapper integration replaceable behind service interfaces.
4. Avoid arbitrary shell execution and arbitrary renderer-supplied executable paths.
5. Store user preferences separately from install/update state.

## Process boundary

The Electron renderer has no Node.js access. `preload.js` exposes only specific DragonStrap methods. `main.js` validates the operation by choosing the executable path from the installation service rather than accepting an arbitrary path from the UI.

## v0.2+ integration plan

A future `BootstrapperService` should own:

- Roblox version metadata lookup
- package download and hash verification
- atomic installation/update staging
- rollback/recovery
- channel metadata
- launch protocol handling
- update locking / single-instance coordination

Fishstrap/Bloxstrap-derived code, if used, should live behind this boundary and preserve upstream licenses.


## v0.2.0 renderer design layer

`renderer/purple-dragon.css` is the DragonStrap-owned visual system loaded after the NeoPurple foundation stylesheet. New UI work should target this layer instead of adding release-specific hotfix blocks to `styles.css`.

## v0.3.0 Launch Center services

The Launch Center adds two isolated backend components:

- `LaunchTargetService` parses user-entered Place IDs, Roblox game URLs, and supported `roblox://experiences/start` links, then emits a normalized Roblox deep link.
- `LaunchHistoryStore` persists a bounded local history of launch attempts in the Electron user-data directory.

The renderer never receives arbitrary filesystem execution capability. It can only request the typed launch actions exposed through `preload.js`; executable paths continue to come exclusively from `RobloxInstallationService`.


## v0.4.0 Performance+ service

`src/services/performance-service.js` owns the only Player ClientSettings writes in v0.4.0. The renderer cannot provide arbitrary flag names or file paths. IPC exposes only get-state, apply-current-settings, and restore-managed-settings operations. The service resolves the current detected Player version, merges a four-key allowlist into `ClientSettings/ClientAppSettings.json`, and preserves unrelated keys.


## v0.5.0 FastFlag Manager 2.0

`src/services/fastflag-service.js` owns general Roblox Player `ClientAppSettings.json` access. The renderer receives a normalized inventory and can submit only validated flag patches; it never supplies a target path. `PerformanceService` retains exclusive ownership of its four managed keys, which FastFlag Manager exposes as protected/read-only.

The FastFlag service serializes values as strings for Roblox/Bloxstrap interoperability, validates flag identifiers and scalar types, uses a temporary file + rename for atomic writes, and creates a one-time sibling backup before its first modification of an existing settings file.

`src/services/fastflag-preset-store.js` persists local named snapshots in DragonStrap's user-data directory. Presets contain only editable flags and are loaded into the renderer as pending changes before the user applies them. Import/export runs in the main process through Electron native dialogs.


## v0.6.0 Server Intelligence + RoValra

`src/services/server-intelligence-service.js` owns all public-server network access. The renderer can provide only a Place ID or supported Roblox game URL; it never provides an arbitrary endpoint. The service queries Roblox's public server list first, then optionally enriches public server IDs through RoValra's server detail/count endpoints.

RoValra failure is non-fatal: Roblox player count, capacity, ping and FPS continue to render without region/uptime enrichment. Lookups are user-initiated, cached briefly in memory, and do not send Roblox authentication cookies to RoValra. Specific-server Join actions continue through `LaunchTargetService` and `LaunchService` rather than executing renderer-provided commands.


## v0.7.0 Roblox Studio Center

The Studio Center adds a main-process Studio service and a local recent-project store. `.rbxl` and `.rbxlx` files are chosen through a native file dialog and validated before launch. Recent projects are relaunched by opaque history ID so the renderer does not submit arbitrary file paths. Studio settings remain read-only in this milestone.
