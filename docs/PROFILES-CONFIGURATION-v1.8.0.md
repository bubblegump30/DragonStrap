# DragonStrap v1.8.0 — Profiles & Configuration Center

## Scope

DragonStrap configuration profiles are complete **Player-side DragonStrap configurations**, not machine images. A profile contains:

- Performance+ configuration: FPS target, renderer preference, MSAA, preset label, and auto-apply state.
- Editable Player FastFlags only. Performance Center-owned flags are intentionally excluded from this section.
- Roblox Player deployment channel.
- Launch behavior: minimize DragonStrap after a successful launch.
- Server Intelligence preferences: sort order, occupancy filter, favorites-only filter, and hide-full filter.

## Capture and apply

Saving a profile captures the current validated state. Applying a profile first builds a main-process preview. The preview reports settings changes and the exact editable FastFlag changes, including removals.

A complete profile intentionally replaces the current **editable** FastFlag set with the profile's editable set. Performance Center-owned flags remain under Performance+ ownership. Normal FastFlag backup and automatic snapshot protections run before writes.

If a later stage of profile application fails, DragonStrap restores the previous settings and editable FastFlag set and reapplies the previous Performance+ state.

## Clone

Profiles can be cloned to a new local ID. Clone names must be unique. This provides a safe workflow for experimenting without modifying the source profile.

## Import / export

Portable files use:

`dragonstrap.configuration-profile.v1`

Imported source IDs are ignored. DragonStrap creates a new local ID and safely resolves duplicate names.

Profile files do **not** contain:

- Roblox cookies or credentials
- executable or local file paths
- Studio project history or backups
- server favorites, recent joins, or latency history
- diagnostic logs
- self-update staging state
- machine-specific runtime/process information

## Server preference persistence

Server sort, occupancy, favorites-only, and hide-full choices are now persisted in the main SettingsStore. This makes profile application visible immediately when returning to Server Intelligence 2.0.
