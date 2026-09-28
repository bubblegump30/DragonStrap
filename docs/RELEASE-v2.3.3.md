# DragonStrap v2.3.3 — Windows release

This is the first full Windows package since v2.0.4. It includes the v2.0.5–v2.3.3 source updates: cleaner layouts and dashboard status, Settings defaults, more reliable backups, first-run guidance, Launch Center refinements, saved-profile workflow, and the FastFlags and Settings layout fixes.

## Downloads

- **Setup (x64):** `DragonStrap-Setup-2.3.3-x64.exe`
- **Portable (x64):** `DragonStrap-Portable-2.3.3-x64.exe`
- **Integrity:** `SHA256SUMS.txt` contains SHA-256 hashes for the release files.
- **Setup VirusTotal report:** [View the report](https://www.virustotal.com/gui/file/66e2d71c5a2af1608a530f46918dd8efebf235f8200f943afedb26208dce01cf?nocache=1) for SHA-256 `66e2d71c5a2af1608a530f46918dd8efebf235f8200f943afedb26208dce01cf`. This report is for the Setup executable only; Portable has a separate hash.

Run the installer for a normal installation, or use Portable without installation. Windows may display a SmartScreen warning because these packages are unsigned. Verify a downloaded file with `Get-FileHash .\DragonStrap-Setup-2.3.3-x64.exe -Algorithm SHA256` and compare it with `SHA256SUMS.txt`.

## Upgrade notes

Existing local settings remain in place. First-run completion migrates existing installations as completed. The Update Center requires the published executables and matching checksums. See [CHANGELOG.md](https://github.com/bubblegump30/DragonStrap/blob/main/CHANGELOG.md) for the individual versions.
