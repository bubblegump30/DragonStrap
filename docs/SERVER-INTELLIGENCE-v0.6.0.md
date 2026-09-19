# DragonStrap v0.6.0 — Server Intelligence + RoValra

## Data flow

1. The user explicitly enters a Roblox Place ID or game URL and starts a lookup.
2. DragonStrap requests up to 100 public servers from Roblox's public server endpoint.
3. Public server IDs and the Place ID are sent to RoValra's public server-detail/count endpoints for region, version and first-seen enrichment.
4. Results are merged locally and displayed in the Purple Dragon UI.
5. Join buttons use DragonStrap's existing validated Roblox deep-link launch path.

DragonStrap does not send a Roblox authentication cookie to RoValra. Server Intelligence is manual-refresh only in v0.6.0 and has a short in-memory cache to reduce repeated provider requests.

## Provider fallback

Roblox's public list is the required source. RoValra enrichment is optional: when RoValra is unavailable, DragonStrap continues to display Roblox player counts, capacity, ping and FPS and labels the provider state as degraded.
