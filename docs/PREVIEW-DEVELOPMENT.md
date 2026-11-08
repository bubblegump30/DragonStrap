# DragonStrap preview verification and publication

Updated 8 November 2026. Accepted preview: **2.5.0-preview.6**. The implementation is published with this revision; Windows packages are distributed as a GitHub prerelease. Stable v2.4.1 remains available separately.

## Verified

- A normal game joined with the requested saved account using the Windows registered roblox-player handler. A Player process alone is not proof of a game join.
- Integrated live service: Ryzen CPU Core (Tctl/Tdie) 84.6 C, NVIDIA GPU 77.25 C, and Roblox presentation rate 84.1 FPS from 248 samples. These are point-in-time readings.
- CPU access uses the existing PawnIO 2.1.0 driver with administrator privileges. No driver was installed or Windows permission changed. Separate monitoring software is not needed.
- 216 local tests passed. Main and account-center Windows layout checks passed during preview development. Packaged telemetry code/helpers/libraries matched tested source. Hosted CI is required for the publication revision.
- Extract-once Folder runtime-entry benchmark: 48–128 ms versus 16.7–18.0 s for single-file extraction, two runs each. Excludes GUI loading and game joining; not a general performance guarantee.

## Remaining acceptance

Private and specific-server joins, concurrent accounts, real-game process policy compatibility, anti-AFK effectiveness, opt-in exit recovery, and administrator GDI apply/restore require additional live acceptance. Schedules operate while the manager is open. Roblox controls concurrent-client behavior; no client patching is included.

## Downloads and update behavior

Use the [preview.6 release](https://github.com/bubblegump30/DragonStrap/releases/tag/v2.5.0-preview.6). Extract the entire Fast Folder archive; update it using a new complete folder. Setup and single-file Portable retain their existing updater behavior. Stable remains the default update channel.

All DragonStrap packages remain unsigned. No VirusTotal report was produced for these new files. Old reports apply only to their exact hashes.
