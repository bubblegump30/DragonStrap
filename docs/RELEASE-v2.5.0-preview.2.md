# DragonStrap v2.5.0-preview.2 — Saved-game launch correction

Unreleased, unsigned preview. Fixes preview.1 passing the ticket as -a and the timestamp as -t. Native launch now supplies the negotiation URL as -a, the authorization ticket as -t, the saved PlaceLauncher URL as -j, a shared browser tracker ID, and --launchtime separately. Normal, specific-server and private-server targets are covered by exact argument regression tests.

The session display now states Player running / game join unverified rather than treating process creation as proof of a game join. Saved accounts and games retain their existing schema. The Disable all flags / global auto-apply boundary remains preserved.

202 automated tests passed. Live Roblox game-join acceptance is still required; no claim of provider-verified joining is made. No VirusTotal scan was performed on these executables.
