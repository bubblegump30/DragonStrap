# DragonStrap v2.5.0 — Account & Session Center

Stable release based on the user-accepted v2.5.0-preview.6 implementation. Application behavior is unchanged from that preview; version labels and release metadata are synchronized for stable distribution.

## Highlights

- Saved Roblox accounts with isolated official sign-in and optional encrypted session-cookie import; aliases, tags, favorites, saved games and server targets.
- Registered Windows protocol handoff for saved games, with fresh matching account/place evidence required before confirming a game join.
- Session controls, schedules, stop timer, local statistics/achievements, appearance settings and opt-in allowlisted cleanup.
- Integrated CPU temperature through bundled LibreHardwareMonitor and an existing PawnIO driver; NVIDIA GPU temperature and measured Roblox FPS through PresentMon.
- Fast Folder Portable avoids per-launch extraction. Secondary startup work is deferred until after the window paints.
- Dependency and reliability fixes, while preserving Neo Purple branding, Studio configuration, presets and Disable/Restore all Player FastFlags.

## Download and use

Choose Setup x64, single-file Portable x64, or Fast Folder x64. Fast Folder is recommended for portable use: extract every file, keep the complete folder together and run DragonStrap.exe. Existing accounts/settings remain in the normal DragonStrap user-data directory.

On the verified Ryzen PC, run DragonStrap as administrator for direct CPU sensor and FPS access. No PawnIO driver is installed automatically. Missing/unsupported sensors and permission failures are reported explicitly. Folder updates require extracting a new complete folder; executable self-replacement is disabled for this distribution.

Compare downloaded files with SHA256SUMS.txt. v2.5.0 is the Latest stable release and is discoverable on the default stable update channel. The previous preview remains available separately.

## Verification and boundaries

216 local tests passed during preview acceptance. Source/release checks, hosted Windows CI and layout verification passed for the preview; stable publication runs these checks again. Live evidence confirmed one normal saved-account game join and integrated CPU/GPU/FPS readings. Example sample: CPU 84.6 C, GPU 77.25 C and Roblox 84.1 FPS; these are point-in-time measurements, not performance guarantees.

Private/specific-server joins, concurrency, anti-AFK effectiveness, exit recovery, real-game process policy compatibility and administrator GDI tuning retain their documented acceptance limits. Roblox controls concurrent-client behavior; no client patching or singleton-handle bypass is included. Schedules operate while the manager is open. See ACCOUNT-SESSION-CENTER-v2.5.0.md and PREVIEW-DEVELOPMENT.md for details.

All DragonStrap packages remain unsigned. No VirusTotal scan was performed for these newly built stable files. Older reports apply only to the exact files/hashes they describe.
