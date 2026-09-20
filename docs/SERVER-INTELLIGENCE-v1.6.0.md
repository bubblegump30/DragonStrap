# Server Intelligence 2.0 — v1.6.0

DragonStrap v1.6.0 upgrades the public Roblox server browser into a persistent local intelligence center.

## Region intelligence

Roblox public-server metrics are merged with optional RoValra location metadata. DragonStrap normalizes city, subdivision/region, country, datacenter, place-version, and first-seen data into consistent location labels while preserving a Roblox-only degraded mode when RoValra is unavailable.

## Latency history

Each successful lookup can add the public server's reported ping to a local seven-day history. DragonStrap keeps a bounded sample set per server and exposes average, minimum, maximum, latest, and improving/stable/worsening trend information. History is stored only in DragonStrap user data.

## Favorites and recent joins

- Favorite public servers are stored locally by Place ID + server ID.
- Successful joins launched from Server Intelligence are added to a bounded recent list.
- Favorite and recent entries provide direct JOIN/REJOIN actions through the existing validated Launch Center path.
- Server IDs are ephemeral; a saved server may no longer exist when rejoin is attempted.

## Occupancy and comparison

The browser exposes occupancy bands (empty, low, medium, busy, almost full, full), open-slot counts, occupancy sorting, favorites-only filtering, and up to three side-by-side comparison cards.

## Provider health

DragonStrap tracks Roblox public-server, RoValra details, and RoValra counts request state separately. Diagnostics include last check, last success/failure, consecutive failures, and response duration. A RoValra partial failure does not block Roblox-only server browsing.

## Privacy

DragonStrap does not send Roblox cookies to RoValra. The RoValra enrichment request contains the Place ID and public server IDs. Favorites, recent joins, provider-health history, and latency samples are local DragonStrap data.
