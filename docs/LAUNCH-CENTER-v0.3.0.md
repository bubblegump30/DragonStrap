# DragonStrap v0.3.0 — Roblox Launch Center

The Launch Center is the first feature milestone after the Purple Dragon UI/UX pass.

## Implemented
- Direct local Roblox Player launch using `--app`.
- Direct local Roblox Studio launch.
- Experience launch from a numeric Place ID.
- Experience launch from `roblox.com/games/<placeId>` and `roblox.com/games/start` URLs.
- Specific-server launch using an optional Game Instance ID.
- Strict normalization to `roblox://experiences/start` before the Player executable is invoked.
- Persistent local launch history with success/failure state and selected profile.
- Optional minimize-on-success behavior.

## Guardrails
DragonStrap does not pass arbitrary HTTP URLs or arbitrary command-line arguments to Roblox Player. The Launch Target service validates the target and constructs a supported Roblox experience deep link.
