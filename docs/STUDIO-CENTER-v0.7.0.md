# DragonStrap v0.7.0 — Roblox Studio Center

The Studio Center is deliberately local-first. Project paths are chosen using Electron's native file picker, validated in the main process, and only `.rbxl` / `.rbxlx` files are passed to the detected Roblox Studio executable. Renderer code cannot submit arbitrary executable paths.

Recent projects are stored in DragonStrap user data and may be relaunched only through a trusted history ID resolved by the main process. Performance+ and FastFlag Manager remain Player-only in this milestone.
