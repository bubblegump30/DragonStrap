## v2.0.4 — Roblox Overview Status Polish

- Replaced raw unlabeled Roblox version GUID fragments on the Home overview with clearly labeled installed build IDs.
- Preserved the full `version-...` folder identifier so the values read as real deployment/build IDs rather than arbitrary numbers.
- Replaced arbitrary 100/85/70 gauge percentages with non-quantitative READY/OFFLINE status dials.
- Added explicit Player Build, Selected Channel, and Studio Build metadata labels.
- The LIVE channel is described as the official production channel; custom selected channels are labeled explicitly.
- No Roblox detection, channel selection, or launch behavior changed.

## v2.0.3 — Performance Center Layout Hotfix

- Removed the unused desktop grid column beside Applied State and Managed Boundary.
- Applied State now spans two columns on wide layouts while Managed Boundary fills the remaining column.
- On medium two-column layouts, Applied State and Managed Boundary share the row instead of leaving an empty cell.
- On compact layouts, both cards collapse cleanly to one column.
- No Performance Center settings, hardware detection, FastFlag behavior, or profile logic changed.

## v2.0.2 — Product Menu / Help & About Hotfix

- Converted the DragonStrap avatar/name/version identity block into a functional dropdown menu.
- Added Help with direct navigation to Launch, Performance Center, FastFlag Manager, and Reliability & Recovery.
- Added About navigation that opens Settings and focuses the existing About card.
- Synchronized the menu and About version labels with runtime application metadata instead of relying on stale hard-coded text.
- Added click-outside and Escape handling plus keyboard-focus treatment for the dropdown and Help dialog.
- No DragonStrap 2.0 Core API or service contracts changed.

## v2.0.1 — Home Performance Controls Hotfix

- Replaced the decorative Home Performance Center 2.0 controls with functional shortcuts and state.
- FPS opens and focuses the real FPS controls.
- Render opens and focuses the real renderer controls.
- Network opens Server Intelligence.
- Auto loads the hardware-aware recommendation and enables pre-launch auto-apply.
- Custom switches to manual mode and opens the real tuning controls.
- The chart now opens Performance Center instead of acting as a dead surface.
- Home status now reports the configured profile, FPS target, renderer, and auto/manual state.
- No Performance Center backend or DragonStrap 2.0 Core API contracts were changed.

## v2.0.0 — DragonStrap 2.0

- Consolidated main-process dependency construction behind a new AppKernel and sealed ServiceRegistry.
- Added explicit service capability and contract metadata for long-term API stability.
- Added a shared OperationCoordinator so destructive install, self-update, rollback, and recovery workflows cannot overlap.
- Added a BootstrapPipeline that coordinates Player installation/rollback, DragonStrap self-update, and launch-readiness checks.
- Added short-lived cached Roblox installation status to reduce duplicate filesystem scans across center refreshes.
- Added Core API v2 runtime metadata through the secure preload bridge.
- Added plugin-ready extension contracts for launch adapters, server enrichment, diagnostics contributors, and profile sections while keeping external plugin loading disabled.
- Changed renderer initialization to lazy-load heavy feature centers on navigation rather than querying every subsystem on startup.
- Added a DragonStrap 2.0 Core status panel in Settings and a final dragon-2.css UI consolidation layer.
- Added Core API/service/operation metadata to privacy-conscious diagnostics.
- Preserved v1.x configuration, profile, FastFlag, Studio, server-history, updater, and recovery data formats.
- Expanded architecture/bootstrap/UI regression coverage.

## v1.9.0 — Reliability & Recovery 2.0

- Added Roblox Player structural integrity checks for expected version location, executable PE header/size, AppSettings, core content, and ClientSettings JSON validity.
- Added trusted Player rollback using only DragonStrap-recorded previous installations or pre-replacement backups.
- Added configuration restore points for allowlisted DragonStrap settings and current Player/Studio ClientSettings.
- Restore points are SHA-256 verified and create a safety restore point before transactional restore.
- Added interrupted self-update recovery for malformed state, missing/tampered staged files, partial downloads, and stale portable-update helpers.
- Added abandoned Roblox staging cleanup when no install operation is active.
- Added one-click Safe Repair with automatic restore point creation before repairs.
- Safe Repair can repair malformed ClientSettings, clear abandoned staging/update leftovers, and roll back a corrupted Player only when a trusted rollback candidate exists.
- Upgraded Maintenance to Reliability & Recovery 2.0 with Player integrity, restore points, update recovery, rollback status, and recovery folder access.
- Upgraded diagnostic exports to schema v2 with integrity, rollback, restore-point, update-recovery, and reliability session metadata while excluding credentials and file contents.
- Expanded automated recovery, rollback, updater-recovery, and UI regression coverage.

## v1.8.0 — Profiles & Configuration Center

- Replaced the placeholder Profiles page with a complete Profiles & Configuration Center.
- Added named complete Player configuration profiles spanning Performance+, editable Player FastFlags, Player channel, minimize-after-launch behavior, and Server Intelligence sort/filter preferences.
- Added validated before/apply previews with setting changes, FastFlag additions/changes/removals, warning counts, and explicit destructive-removal disclosure.
- Added exact editable FastFlag-set application while preserving Performance Center-owned keys and existing FastFlag backup/snapshot protections.
- Added profile cloning and active-profile tracking.
- Added portable import/export using the versioned `dragonstrap.configuration-profile.v1` schema.
- Imported profile IDs are never trusted; DragonStrap generates fresh local IDs and resolves name collisions safely.
- Profile files exclude Roblox credentials, local paths, project history, diagnostics, updater state, and machine-specific runtime data.
- Added persistent Server Intelligence preferences for sort, occupancy, favorites-only, and hide-full filtering so those choices participate in profiles.
- Added transactional rollback behavior when complete profile application fails after partial changes.
- Expanded profile-store, apply-service, UI, and persistence regression coverage.

## v1.7.0 — Studio Center 2.0

- Added Studio-specific settings and independent Studio deployment channel tracking.
- Added Standard, Protected, and Fast Start Studio launch profiles.
- Added recent-project intelligence: open counts, last-known size/modified time, change detection, launch-profile history, and backup coverage.
- Added bounded per-project backups and native restore-as-copy workflow.
- Added optional isolated Studio FastFlag management with explicit enablement, separate backup/snapshot storage, scalar validation, and Player-path collision protection.
- Preserved the Player Performance Center/FastFlag boundary and existing Studio executable/project-path validation.

## v1.6.0 — Server Intelligence 2.0

- Upgraded Server Intelligence with normalized region, country, datacenter and occupancy metadata.
- Added persistent seven-day latency history with average/min/max and trend summaries.
- Added local favorite servers and recent successful joins with quick JOIN/REJOIN actions.
- Added occupancy-band filtering, favorites-only filtering, open-slot statistics and new sort modes.
- Added up-to-three-server comparison for ping/history, occupancy, uptime and datacenter.
- Added separate Roblox, RoValra details and RoValra counts provider-health diagnostics with response timing and consecutive-failure tracking.
- Added partial-provider degradation so one RoValra endpoint can fail without hiding successful data from the other provider paths.
- Preserved the no-cookie privacy boundary for RoValra enrichment.
- Expanded Server Intelligence persistence, service and UI regression coverage.

## v1.5.2 — Safe FastFlag Classification Hotfix

- Added a conservative five-flag Safe Core database to FastFlag Manager 3.0.
- Added SAFE / LEGACY / EXPERIMENTAL / UNKNOWN trust classification with visible UI badges and descriptions.
- Added a Safe Core panel and a review-only action that queues the four editable Safe Core values while leaving MSAA locked to Performance Center.
- Reclassified the legacy FPS target and forced Direct3D 11/Vulkan overrides as compatibility-sensitive instead of implying current Roblox support.
- Added compatibility disclosures to Performance Center FPS and render-engine controls.
- Preserved default behavior as key removal rather than writing guessed Roblox defaults.
- Expanded regression coverage for classification, Safe Core catalog contents, and trust metadata in before/after previews.

## v1.5.1 — Performance Profile Layout Hotfix

- Corrected built-in Performance Profile preset text alignment in Performance Center 2.0.
- Prevented the `Performance` title and configuration text from spilling toward the adjacent `Quality` card.
- Added explicit icon/copy regions, bounded text width, normalized baselines, and safe description wrapping.
- Kept all v1.5.0 Performance Center behavior unchanged.

## v1.5.0 — Performance Center 2.0

- Upgraded Performance+ into Performance Center 2.0 with local hardware-aware recommendations.
- Added CPU, GPU, memory, display-refresh, and Windows power-plan intelligence.
- Added hardware-aware Efficiency, Recommended, High Refresh, and Visual Quality presets.
- Added reusable custom FPS/render/MSAA configuration profiles.
- Added per-experience performance profiles keyed by validated Roblox Place ID.
- Launch Center now resolves a per-experience profile in the main process before auto-applying Player settings.
- Added live Roblox Player PID, memory, cumulative CPU time, uptime, responding state, and thread count.
- Added startup optimization checks for Player availability, ClientSettings readability, memory headroom, power plan, auto-apply state, and active Player processes.
- Added conservative configuration recommendations with explanations instead of automatic OS changes.
- Live process telemetry intentionally excludes command-line arguments.
- Preserved the existing four-key Performance+ write boundary and Player-only scope.
- Added Performance Center service/profile/UI regression coverage.

## v1.4.0 — FastFlag Manager 3.0

- Added inferred FastFlag categories and conservative descriptions.
- Added compatibility warnings for experimental/debug-oriented flags.
- Added Performance+ conflict detection for related FPS, MSAA, and renderer manual flags while keeping exact Performance+ keys locked.
- Added main-process normalized before/after previews before ClientAppSettings writes.
- Added filtered multi-selection and bulk Boolean True/False/remove operations.
- Added portable preset sharing with the versioned `dragonstrap.fastflag-preset.v1` schema.
- Added automatic pre-change snapshots with a 20-snapshot retention limit.
- Added snapshot restoration that preserves current Performance+ managed values.
- Added FastFlag category filtering, warning/conflict counters, selected-flag intelligence, and richer pending-diff UI.
- Preserved the existing one-time `.dragonstrap.bak` backup and atomic write behavior.
- Preserved Update Center 2.0 and the transactional Roblox Player installation/update engine.

## v1.3.0 — Update Center 2.0

- Added real DragonStrap self-update downloads from the official GitHub Releases feed.
- Added Portable vs installed Setup build detection and build-specific artifact selection.
- Added mandatory SHA-256 verification against `SHA256SUMS.txt` before an update can be applied.
- Added GitHub asset-digest cross-checking when the API exposes a SHA-256 digest.
- Added download progress, byte counts, cancellation, and persistent verified staging metadata.
- Added in-app release notes.
- Added stable and pre-release update-channel support.
- Added version-specific update deferral for 1 hour, 1 day, or 7 days.
- Added safe Portable post-exit replacement with backup/restore protection and relaunch.
- Added verified NSIS Setup handoff for installed builds.
- Source/dev sessions remain read-only for application updates.
- Preserved the v1.1.x Roblox Player transactional installation/update engine.

## v1.1.2 — Installer Current-State UI Polish Hotfix

- Corrected the Roblox Player Installation Engine UI when the selected build is already installed.
- CURRENT plans now show `No download required` instead of a misleading remaining-download amount.
- The analyzed Roblox package size remains visible separately for transparency.
- CURRENT plans now display a completed progress state instead of `0%`.
- Free-space copy now states that no staging space is required when no install/update will run.
- The safety/status copy now distinguishes a verified current build from an install-ready plan.
- Preserved the v1.1.1 `RobloxPlayerInstaller.exe` manifest compatibility fix and all transactional installer safeguards.

## v1.1.1 — Roblox Package Manifest Compatibility Hotfix

- Fixed live Roblox manifest analysis failing on the legitimate `RobloxPlayerInstaller.exe` entry.
- The exact installer entry is metadata-validated and then excluded from DragonStrap's package download/extraction pipeline.
- DragonStrap does not execute the Roblox installer executable.
- Arbitrary `.exe` entries remain rejected by the package-manifest parser.
- Added a regression test for the current Roblox manifest shape.

## v1.1.0 — Roblox Installation & Update Engine

- Added a real Roblox Player package installation/update pipeline.
- Added `rbxPkgManifest.txt` v0 parsing with strict package-name, size, and MD5-signature validation.
- Added an explicit package-to-install-directory allowlist and fail-closed handling for unknown Roblox packages.
- Added resumable HTTP byte-range downloads under `Roblox\Downloads\DragonStrap`.
- Added cached package validation and automatic re-download of corrupt packages.
- Added staged package extraction with archive path-traversal checks.
- Added free-disk-space preflight using remaining download bytes, unpacked size, and a 512 MB safety reserve.
- Added transactional version-folder commit and preservation of the previously working Roblox version.
- Added cancellation that keeps partial downloads for the next resume attempt.
- Added live installation progress UI for planning, downloading, extraction, commit, package name, speed, and disk usage.
- Added post-install validation of `RobloxPlayerBeta.exe` and `AppSettings.xml` generation.
- Kept Roblox Studio installation and WebView2 runtime execution outside the v1.1.0 scope.
- Added automated tests for manifest validation, unsafe archive paths, staged commit, disk-space refusal, unknown packages, and interrupted-download resume.

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
