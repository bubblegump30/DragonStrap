# Performance Center 2.0 — v1.5.0

Performance Center 2.0 expands DragonStrap's four-key Performance+ boundary into a hardware-aware configuration workflow without widening the set of Roblox flags DragonStrap writes.

## Hardware intelligence

DragonStrap reads local CPU/memory information through Node.js and, on Windows, uses fixed PowerShell/CIM probes for GPU, display refresh, and the active Windows power plan. Renderer code never supplies commands or paths to these probes.

Hardware signals are advisory. DragonStrap does not modify power plans, drivers, firmware, overclocking, process priority, or Windows services.

## Hardware-aware presets

Performance Center derives four local presets:

- Efficiency
- Recommended
- High Refresh
- Visual Quality

The renderer remains `Default` in all hardware-generated presets because GPU/API stability cannot be inferred safely from a device name alone. Presets only populate DragonStrap's existing FPS/MSAA/render configuration; the user still decides whether to apply or launch with them.

## Reusable and per-experience profiles

Custom profiles store FPS cap, renderer preference, and MSAA preference in DragonStrap's user-data directory. Numeric Place IDs can be assigned to built-in or custom profiles.

When Launch Center starts a validated experience, the exact Place ID mapping is resolved in the main process. If a mapping exists, that profile is applied before launch when auto-apply is enabled. The global profile is not overwritten.

## Live process information

While Performance Center is open, DragonStrap periodically reads Roblox Player process metadata on Windows:

- PID
- working-set memory
- cumulative CPU time
- uptime
- thread count
- responding state

Command-line contents are intentionally not collected because Roblox launch arguments can contain session-sensitive data.

## Startup checks and recommendations

Checks are descriptive and may include Player availability, ClientSettings readability, memory headroom, Windows power plan, auto-apply state, and whether Roblox is already running.

Recommendations are conservative heuristics, not benchmark results. They can flag configurations that appear disproportionate to the detected hardware or display, but DragonStrap does not claim that a recommended configuration is universally faster or more stable.
