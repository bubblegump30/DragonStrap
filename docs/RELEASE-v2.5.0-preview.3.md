# DragonStrap v2.5.0-preview.3 — Verified game handoff and faster startup

Account launches now send a complete roblox-player URI to the Windows registered handler rather than guessing native Player arguments. Tracking accepts a new Player in that registered launcher's managed installation and continues to reject unrelated executables. Fresh log evidence must match both the requested Place ID and saved Roblox user before the UI reports a confirmed join.

A live verification through the registered handler produced a completed game-join event for the requested saved game and account. The handler used its own Codex-managed Player installation. DragonStrap leaves a separately managed launcher's graphics settings unchanged.

Monitoring starts after the first window paint, hidden account data is loaded on demand, and secondary panels no longer block initial rendering. The Folder Portable ZIP is extracted once and launched directly; unlike the single-file Portable it does not unpack the Electron runtime at every launch. Folder Portable updates use replacement ZIP folders, preserving the shared saved settings.

All builds are unsigned local previews. No VirusTotal report was obtained for them. Private/specific-server provider writes and multi-instance compatibility remain separately unverified.
