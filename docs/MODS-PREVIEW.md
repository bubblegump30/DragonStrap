# Mods - experimental v2.7.0 feature

This first increment adds manual, reversible replacement of one existing Player media asset at a time. It ships as an experimental feature in v2.7.0. The Statistics cleanup is retained.

## Use

1. Open Mods in the sidebar.
2. Enter a name and the exact existing asset path relative to the installed Player version folder. For example, a cursor path may be `content/textures/Cursors/KeyboardMouse/ArrowCursor.png`; verify the actual installation before choosing it.
3. Choose a local replacement file with the same extension. Import copies the bytes to the local library; it does not change Roblox.
4. Preview the selected entry. Review its absolute destination, then close Player and select Back up & apply.
5. Start Player normally to check the result. Roblox may ignore or overwrite local content replacements.
6. Close Player and use Restore original before switching to another asset.

The library supports OGG/MP3/WAV under `content/sounds/`, PNG/JPG/JPEG/DDS under `content/textures/`, and TTF/OTF under `content/fonts/`. Limits: 8 MB per file, 16 entries, 16 MB total. Use assets you own or have permission to use. Files are treated as data; Mods never executes them. Executable, script, shader, JSON/configuration and Studio targets are outside this increment. No assets are distributed with this feature.

## Backups and conflicts

The main process checks the detected Player version and constrains destinations to existing media files beneath the official local Versions directory. Junction/symlink paths, traversal, alternate streams and reserved Windows names are rejected. A five-minute review token binds the mod, version and original checksum. A changed target invalidates application.

Original bytes and their checksum are saved to a durable local journal before replacement. An interrupted write leaves the journal available for explicit restoration and blocks another apply. Restoration accepts only the original or applied checksum; a third-party change is preserved and reported as a conflict. Keep the Mods data and journal if an installation is missing or a conflict prevents restore. Do not remove backups to bypass a conflict.

Restore targets the recorded version, not whatever version Roblox later installs. Updates require a new preview and manual apply. There is no launch-time reapplication, no background scanning, no archive importer and no remote mod store. Player must be closed for Apply or Restore; failure to query running processes blocks changes. Changes share DragonStrap's operation coordinator with installation/recovery operations.

## Verification boundary

Automated tests use temporary installations and replacement bytes. They verify backup/restore equality, interrupted writes, changed-target conflicts, version changes, path restrictions, linked paths, size bounds and library operations. UI verification uses synthetic data. No real Roblox file is modified during these checks. A user-selected real asset still needs an explicit in-game acceptance check; neither a fixture pass nor the prior executable VirusTotal scans prove this development feature's runtime compatibility.
