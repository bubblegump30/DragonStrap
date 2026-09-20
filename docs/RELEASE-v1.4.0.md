# DragonStrap v1.4.0 — FastFlag Manager 3.0

v1.4.0 upgrades DragonStrap's Player FastFlag tooling from a raw editor into a safer configuration-intelligence workflow.

## Added

- Inferred FastFlag categories and conservative descriptions.
- Compatibility warnings for experimental/debug flags.
- Performance+ family conflict detection for FPS, MSAA, and renderer-related manual flags.
- Main-process before/after preview with normalized values.
- Filtered multi-selection and bulk Boolean/remove operations.
- Portable preset sharing using `dragonstrap.fastflag-preset.v1`.
- Automatic pre-change snapshots with a 20-snapshot retention limit.
- Snapshot restore that preserves current Performance+ owned values.
- FastFlag warning/conflict counters and category filtering in the Purple Dragon UI.

## Safety boundaries

- Performance+ exact managed keys remain locked in FastFlag Manager.
- Shared presets and normal imports use the same validation rules.
- Snapshot restore cannot overwrite current Performance+ managed values.
- File writes remain atomic.
- The original one-time `.dragonstrap.bak` backup remains available in addition to automatic snapshots.
- Descriptions for unknown Roblox flags are explicitly presented as inferred rather than authoritative behavior.

## Compatibility

v1.4.0 preserves Update Center 2.0, the transactional Roblox Player installation/update engine, Studio Center, Server Intelligence, diagnostics, and all existing launch functionality.
