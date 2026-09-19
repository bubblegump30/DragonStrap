## v1.0.0 — Stable Release

- Declared the current DragonStrap feature set stable for normal Windows use.
- Replaced remaining prototype/foundation product wording with stable-release status text.
- Finalized the official GitHub release feed for `bubblegump30/DragonStrap`.
- Added stable release policy and v1.0.0 release documentation.
- Added Windows GitHub Actions validation for source checks, automated tests, and release verification.
- Strengthened release verification to require the official repository, stable update channel, release documentation, and CI workflow.
- Improved Windows release-build output with explicit signed/unsigned status.
- Added repository/homepage/issue metadata to `package.json`.
- Preserved explicit scope boundaries: channel deployment replacement and Studio FastFlag writes remain intentionally disabled.
- Corrected the historical v0.6.1 dashboard space-fill changelog heading.

## v0.9.5 — Reliability / Updater / Release Polish

- Added single-instance protection; a second launch focuses the existing DragonStrap window.
- Added structured local reliability logs with clean/unclean previous-session detection.
- Added renderer/process failure and unresponsive-window logging.
- Hardened renderer navigation, popup handling, and permission requests.
- Added a configurable GitHub Releases update checker with stable/pre-release channels.
- Added startup update checking with an explicit unconfigured-feed state.
- Added Settings UI for Update Center, Reliability state, runtime/build information, and log access.
- Added pinned Electron/electron-builder release tooling and Windows NSIS/portable build configuration.
- Added release verification, source integrity manifest generation, PowerShell release build, and SHA-256 artifact generation.
- Automatic update installation remains disabled until official signing/checksum policy is finalized.
- Expanded automated tests for updater and reliability behavior.

## v0.9.0 — Repair, Cache & Diagnostics

- Added a full Maintenance Center with installation/configuration health checks.
- Added allowlisted DragonStrap and Roblox temporary-cache cleanup.
- Added old Roblox log cleanup and trusted-folder shortcuts.
- Added malformed `ClientAppSettings.json` repair with preserved broken copy and backup restore.
- Added privacy-conscious diagnostic JSON export.
- Added maintenance service tests and dedicated Purple Dragon maintenance UI.

## v0.8.0 — Channel & Version Manager

- Added public Roblox deployment metadata lookup for WindowsPlayer and WindowsStudio64.
- Added LIVE/production normalization and validated public custom-channel selection.
- Added installed-vs-available version GUID comparison for Player and Studio.
- Added custom-channel comparison against production.
- Added release timestamps when Roblox deployment manifests expose Last-Modified metadata.
- Added direct access to installed Player and Studio version folders.
- Added explicit restricted/not-found channel handling.
- Channel selection is version-tracking only in v0.8.0; package installation remains disabled until the installer engine is implemented.

## v0.7.0 — Roblox Studio Center

- Replaced the Studio placeholder with a complete creator workspace.
- Added blank Studio launch and native `.rbxl` / `.rbxlx` project selection.
- Added validated recent-project history and trusted history-ID relaunch.
- Added Studio installation/version/executable status.
- Added quick access to Studio install and Roblox logs folders.
- Kept Performance+ and FastFlag Manager isolated to Roblox Player; Studio configuration is not modified.

## v0.6.3 — Detached Windows Launcher Hotfix

- Replaced the attached `npm start` batch-launch behavior with a detached Windows launcher.
- Added `scripts/Start-DragonStrap.vbs` as the preferred no-console launcher.
- `Start-DragonStrap.bat` now hands off to the VBS launcher and exits immediately.
- Kept `npm start` unchanged for developer/debug use where terminal output is expected.
- Updated source validation and run instructions.

## v0.6.2 — Watermark Re-Center Hotfix

- Re-centered the home dashboard dragon watermark after the v0.6.1 space-fill layout change.
- Shifted the watermark upward so it stays visually centered behind the main dashboard cards instead of drifting into the bottom strip.
- Kept the transparent glass cards and full-width bottom status strip intact.

## v0.6.1 — Home Dashboard Space-Fill Hotfix

- Expanded the bottom DragonStrap foundation/status card across the full dashboard width.
- Reworked its internal layout into a horizontal status strip so the additional width is actually used.
- Removed the large dead area previously left to the right of the card.
- Added responsive two-column and single-column fallbacks for narrower windows.

## v0.6.0 — Server Intelligence + RoValra

- Replaced the Servers placeholder with a real public-server intelligence center.
- Added Place ID / Roblox game URL lookup.
- Added Roblox public server metrics: players, capacity, ping and FPS.
- Added RoValra enrichment for server region, city/country, datacenter, place version and estimated uptime.
- Added RoValra aggregate server/region counts when available.
- Added region/search filtering, sorting and hide-full controls.
- Added direct Join actions routed through DragonStrap Launch Center validation.
- Added explicit RoValra privacy/provider disclosure and degraded-mode fallback.
- Added 20-second in-memory lookup cache and manual refresh only; no background server polling.
- Added automated tests for place normalization, enrichment merge, caching and provider degradation.

## v0.5.0 — FastFlag Manager 2.0

- Replaced the read-only FastFlag placeholder with a full managed editor.
- Added searchable ClientAppSettings flag inventory with inferred value types.
- Added queued set/remove operations with review before disk writes.
- Added JSON import preview and native JSON export.
- Added local named FastFlag snapshots/presets.
- Added automatic one-time pre-edit backup and restore.
- Performance+ owned flags are visible but locked to prevent subsystem conflicts.
- Added scalar/type validation, flag-name validation, import size limits, and atomic writes.
- Added 6 new FastFlag/preset tests; full suite now contains 21 tests.

## v0.4.0 — Performance+

- Added live Performance+ configuration for Roblox Player.
- Added FPS target management from Roblox default through 240 FPS.
- Added Default / Direct3D 11 / Vulkan renderer preferences.
- Added Default / 1× / 2× / 4× MSAA controls.
- Added Performance+ presets: Default, Balanced, Performance and Quality.
- Added auto-apply before Player launches.
- Added explicit Apply Now and Restore Roblox Defaults actions.
- Added applied-state inspection and ClientSettings path reporting.
- Writes only a four-key allowlist and preserves unrelated ClientAppSettings values.
- Added settings validation and atomic configuration writes.

# DragonStrap v0.3.0 — Roblox Launch Center

- Rebuilt Launch Center into a functional launch workspace.
- Added Place ID, Roblox game URL, and `roblox://experiences/start` target normalization.
- Added optional Game Instance ID support for specific-server launches.
- Added persistent local recent-launch history and clear-history control.
- Added launch-result status, timestamps, and better error reporting.
- Normal Roblox app launch now uses the `--app` argument.
- Added optional minimize-after-success behavior using the existing setting.
- Added launch-target and history service boundaries with tests.
- Preserved v0.2.0 Purple Dragon UI/UX and app icon.

## v0.2.0 — Complete Purple Dragon UI/UX

- Added a dedicated `purple-dragon.css` design-system layer for maintainable visual ownership.
- Unified the header, sidebar, cards, page headings, inputs, buttons, focus states, status elements, and footer.
- Refined the transparent glass-card system so the centered dragon watermark remains visible without sacrificing legibility.
- Added consistent purple edge lighting, restrained bloom, hover/pressed states, and high-DPI text treatment.
- Added smooth page transitions with automatic reduced-motion support.
- Improved keyboard accessibility and added `Ctrl+K` search focus / `Esc` search clear behavior.
- Added last-view restoration and dynamic window titles.
- Synchronized launch/profile selectors so the same profile state is reflected throughout the interface.
- Updated visible product labels and About metadata for the v0.2.0 Purple Dragon UI/UX milestone.
- Kept all v0.1.x Roblox detection/launch behavior unchanged.

## v0.1.9 — Dragon Application Icon

- Replaced the native DragonStrap window/taskbar icon with the supplied purple dragon artwork.
- Updated the header brand icon and top-right avatar to use the same dragon artwork.
- Added Windows ICO and PNG application assets for consistent runtime branding.
- Added a stable Windows AppUserModelID for DragonStrap taskbar grouping.

## v0.1.8 — Transparent Home Cards

- Converted the home dashboard cards to a more transparent glass-style finish.
- Made the DRAGONSTRAP foundation card transparent as well so the dragon watermark remains visible beneath it.
- Preserved legibility with blur, saturation, and a light surface sheen.
- Kept the centered dashboard watermark alignment from v0.1.7.

## v0.1.7 — Dashboard Watermark Alignment

- Repositioned the dragon watermark to the home dashboard layer instead of the full content area.
- Centered the dragon behind the main dashboard cards to better match the approved target.
- Increased the visible watermark footprint while keeping Installation Status fully opaque.
- Preserved all existing layout, control, and button polish changes.

## v0.1.6 — Watermark Visibility Hotfix

- Increased the visibility of the centered dragon watermark in the main content area.
- Kept the dragon centered while slightly enlarging its responsive size range.
- Raised watermark opacity and glow so it remains visible in the live dashboard.
- Preserved the opaque Installation Status card so background bleed does not return.

# Changelog

## 0.1.5 — Centered Dragon Watermark
- Added the supplied DragonStrap dragon artwork as the actual application watermark.
- Reduced the watermark size and centered it in the main content area.
- Tuned opacity and glow so it stays subtle behind the dashboard.
- Kept Installation Status visually clean above the watermark layer.
- Added responsive watermark sizing for smaller windows.

# DragonStrap Changelog

## v0.1.4 — Card Clarity & Option Rail Fix
- Removed the faded NeoPurple reference artwork from the Installation Status card.
- Rebuilt Installation Status as an opaque layered dashboard surface with cleaner row separation and readability.
- Widened the Launch Options mode rail and aligned Fast / Stable / Custom as dedicated icon-label rows.
- Removed label collisions around the circular mode controls at the production window size.
- Corrected vertical slider fill direction so the illuminated track rises naturally from the bottom.
- Retained the v0.1.3 4K violet edge-glow control system and sidebar cleanup.

## v0.1.3 — 4K Glow Controls & Sidebar Cleanup
- Removed the decorative NeoPurple artwork strip from the bottom of the sidebar.
- Rebuilt sidebar navigation buttons with layered dark materials, violet edge lighting and controlled outer bloom.
- Extended the same high-DPI glow language to mode, profile, action, segmented, tile and circular controls.
- Added stronger but bounded hover illumination and tactile pressed states without blurring text.
- Increased sidebar control radius/spacing for a more premium launcher appearance while preserving density.
- Retained v0.1.2 header collision fixes and pointer-free PLAY geometry.

## v0.1.2 — Header Geometry & Control Precision Hotfix
- Fixed topbar grid regression that placed search/profile controls over the centered motto.
- Restored dedicated left/center/right header columns at the 1600 px production window.
- Added responsive collision handling for 1500 px, 1250 px and compact widths.
- Reduced the PLAY control again and tightened its concentric material layers.
- Added consistent keyboard focus treatment to interactive surfaces.
- Preserved v0.1.1 vertical Launch Options slider corrections.

# Changelog

## 0.1.2 — UI/UX Polish Hotfix

- Centered the LAUNCH • OPTIMIZE • PLAY header motto against the application window rather than the surrounding columns.
- Reduced and rebuilt the main PLAY control with a cleaner concentric surface and removed the center pointer line.
- Added a consistent high-DPI material treatment, hover state and pressed state to interactive buttons across the UI.
- Reworked Launch Options vertical range controls to prevent clipping and keep all four sliders visible.
- Tightened desktop typography, glow, borders and shadows while preserving the NeoPurpleGUI design language.

## 0.1.0 — Bootstrapper Foundation

- Established DragonStrap project identity and source layout.
- Ported the supplied NeoPurpleGUI visual language into the DragonStrap shell.
- Added navigation for all planned bootstrapper centers.
- Added secure Electron IPC boundary.
- Added persistent application settings.
- Added local Roblox Player and Roblox Studio detection.
- Added direct launch actions for detected local executables.
- Added source validation and Windows start helper.
- Deferred Roblox updating, channel switching, FastFlag writes, cache deletion and network intelligence until later milestones.
