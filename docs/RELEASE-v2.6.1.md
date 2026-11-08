# DragonStrap v2.6.1 — Refined workspace shortcuts

Redesigns Settings → Your workspace with compact navigation rows: custom line icons, left-aligned titles, helpful descriptions and right-facing chevrons. Removes the equal-height grid stretching that made the old buttons oversized, while retaining the Neo Purple styling and Settings card alignment.

Includes restrained hover/press feedback, visible keyboard focus and reduced-motion support. Launch Roblox, Saved profiles and Repair & recovery keep their existing navigation destinations. Account groups, bulk actions, history, monitoring, Studio, presets and FastFlags are unchanged.

Verification: source/release checks, existing Windows layout checks across 1600×980 at 100/125/150%, 1366×800 and 1180×760, and isolated actual-app navigation through all three shortcuts. The layout gate now checks compact shortcut heights. No new backend behavior or data migration is introduced.

Setup, single-file Portable, Fast Folder and source archives include SHA256SUMS.txt. Extract the entire Fast Folder archive and retain all runtime files; existing settings/accounts remain in the normal user-data location.

Unsigned Windows builds. Existing sensor/Windows permission requirements and optional-feature limits remain documented.

Build verification now downloads the pinned official Electron runtime through GitHub release assets, verifies it against the npm package checksum, and reuses that verified runtime for packaging. This avoids a repeated upstream browser-download timeout; a corrupt-archive test confirmed rejection before extraction. No runtime dependency version changed.

### VirusTotal reports for v2.6.1

Reports retrieved directly through VirusTotal via VTAI on **2026-11-08**. Each link identifies the exact published file by SHA-256.

| Package | Malicious / suspicious | Undetected | Other engine results | Report |
| --- | --- | --- | --- | --- |
| Setup executable | **0 / 0** | 67 | 2 timed out; 6 unsupported | [View report](https://www.virustotal.com/gui/file/b319408ef5d0dc075e52875f4aa4f5a721f72d0e58c958a7fe48f750c518f04d/detection) |
| Portable executable | **0 / 0** | 64 | 5 timed out; 6 unsupported | [View report](https://www.virustotal.com/gui/file/1e798ea8fb42785da0aee476df650f9b1175c3c60b5a2506d9033b9cbc3fdcab/detection) |
| Fast Folder ZIP | **0 / 0** | 64 | 2 timed out; 2 failed; 7 unsupported | [View report](https://www.virustotal.com/gui/file/5e763200be63ebd0a7f19f64df34b400243a6b800bbc7f7777659848aed5f5b5/detection) |

Each report contains 75 engine entries overall. Timed-out, failed and unsupported entries did not provide a detection verdict. Zero detections do not guarantee safety. These reports apply only to the linked v2.6.1 files; they do not cover future builds or the source archive. Full hashes and analysis timestamps: [v2.6.1 scan evidence](https://github.com/bubblegump30/DragonStrap/blob/main/docs/VIRUSTOTAL-v2.6.1.md).

Windows packages remain unsigned, so Windows may display a SmartScreen warning. Source ZIPs and repository code are for development; they are not Windows installers or Update Center binaries.
