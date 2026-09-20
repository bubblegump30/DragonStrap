# DragonStrap v1.5.0 — Performance Center 2.0

v1.5.0 expands DragonStrap's Player performance workflow with hardware-aware guidance, reusable profiles, per-experience overrides, startup checks, and live Roblox process information.

## Highlights

- Hardware summary for CPU, GPU, RAM, refresh rate, and Windows power plan.
- Hardware-aware Efficiency, Recommended, High Refresh, and Visual Quality presets.
- Conservative hardware-tier recommendation with explanatory reasons.
- Reusable custom FPS/render/MSAA profiles.
- Per-experience profiles keyed by validated Roblox Place ID.
- Main-process profile resolution before Launch Center auto-applies Performance Center settings.
- Live Roblox process PID, memory, cumulative CPU time, uptime, and thread count.
- Startup optimization checks and configuration recommendations.
- Existing four-key Performance+ write boundary remains unchanged.

## Safety boundary

Hardware information is used only for local guidance. DragonStrap does not automatically alter Windows power plans, drivers, process priorities, firmware settings, or overclocking controls. Live process inspection intentionally omits command-line arguments.

Per-experience mappings contain only Place IDs and profile references. They do not store Roblox authentication data.
