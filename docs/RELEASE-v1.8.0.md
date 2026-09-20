# DragonStrap v1.8.0 — Profiles & Configuration Center

v1.8.0 replaces the former Profiles placeholder with a complete profile system for DragonStrap's Player configuration domains.

## Highlights

- Named complete configuration profiles.
- Performance+, editable Player FastFlags, Player channel, launch behavior, and server preferences in one profile.
- Validated before/apply preview.
- Exact editable FastFlag replacement with existing backup/snapshot protections.
- Active-profile tracking.
- Profile cloning.
- Portable import/export via `dragonstrap.configuration-profile.v1`.
- Profile privacy boundary excludes credentials, local paths, project/runtime history, and updater state.
- Persistent Server Intelligence sort/occupancy/favorites/hide-full preferences.
- Rollback path if a complete profile apply fails after partial changes.

## Compatibility

Studio-specific settings, Studio FastFlags, project backups/history, Server Intelligence favorites/recents/latency history, and Update Center preferences remain outside Player configuration profiles.
