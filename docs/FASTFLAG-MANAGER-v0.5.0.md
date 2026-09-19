# DragonStrap v0.5.0 — FastFlag Manager 2.0

## Scope

FastFlag Manager 2.0 manages the current Roblox Player version's `ClientSettings/ClientAppSettings.json`.

## Workflow

1. DragonStrap detects Roblox Player and resolves the settings file itself.
2. Existing flags are listed with an inferred value family.
3. User edits are queued in memory.
4. Pending set/remove operations are reviewed in the UI.
5. Main-process validation runs before disk access.
6. Existing JSON is merged and written atomically.

## Guardrails

- No renderer-controlled file paths.
- Only JSON-object settings files are accepted.
- Only non-null scalar values are accepted for import.
- Flag names are restricted to safe identifier characters.
- One apply operation is limited to 1000 changes.
- Imported files are limited to 2 MB.
- Performance+ managed keys are locked in this editor.
- Existing files receive a one-time `.dragonstrap.bak` backup before the first FastFlag Manager write.

## Presets

Named local snapshots are stored in DragonStrap user data. Loading a preset stages it as an exact snapshot of the editable flag set: editable flags absent from the preset are queued for removal, and preset flags are queued for set/update. Nothing is written until Apply Changes is pressed.
